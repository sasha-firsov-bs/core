import { fileURLToPath } from 'node:url';
import * as chalk from 'chalk';
import { format, inspect } from 'util';
import { ux } from './cli-ux';
import { Config } from './config';
import * as Errors from './errors';
import * as Parser from './parser';
import { formatCommandDeprecationWarning, formatFlagDeprecationWarning, toConfiguredId, normalizeArgv } from './help/util';
import { boolean } from './flags';
import { requireJson } from './util';
import { stdout, stderr } from './cli-ux/stream';
const pjson = requireJson(__dirname, '..', 'package.json');
/**
 * swallows stdout epipe errors
 * this occurs when stdout closes such as when piping to head
 */
stdout.on('error', (err) => {
    if (err && err.code === 'EPIPE')
        return;
    throw err;
});
const jsonFlag = {
    json: boolean({
        description: 'Format output as json.',
        helpGroup: 'GLOBAL',
    }),
};
/**
 * An abstract class which acts as the base for each command
 * in your project.
 */
export class Command {
    argv;
    config;
    static _base = `${pjson.name}@${pjson.version}`;
    /** A command ID, used mostly in error or verbose reporting. */
    static id;
    /**
     * The tweet-sized description for your class, used in a parent-commands
     * sub-command listing and as the header for the command help.
     */
    static summary;
    /**
     * A full description of how to use the command.
     *
     * If no summary, the first line of the description will be used as the summary.
     */
    static description;
    /** Hide the command from help */
    static hidden;
    /** Mark the command as a given state (e.g. beta or deprecated) in help */
    static state;
    static deprecationOptions;
    /**
     * Emit deprecation warning when a command alias is used
     */
    static deprecateAliases;
    /**
     * An override string (or strings) for the default usage documentation.
     */
    static usage;
    static help;
    /** An array of aliases for this command. */
    static aliases = [];
    /** When set to false, allows a variable amount of arguments */
    static strict = true;
    /** An order-dependent object of arguments for the command */
    static args = {};
    static plugin;
    static pluginName;
    static pluginType;
    static pluginAlias;
    /**
     * An array of examples to show at the end of the command's help.
     *
     * IF only a string is provided, it will try to look for a line that starts
     * with the cmd.bin as the example command and the rest as the description.
     * If found, the command will be formatted appropriately.
     *
     * ```
     * EXAMPLES:
     *   A description of a particular use case.
     *
     *     $ <%= config.bin => command flags
     * ```
     */
    static examples;
    static hasDynamicHelp = false;
    static '_--' = false;
    static _enableJsonFlag = false;
    static get enableJsonFlag() {
        return this._enableJsonFlag;
    }
    static set enableJsonFlag(value) {
        this._enableJsonFlag = value;
        if (value === true) {
            this.baseFlags = jsonFlag;
        }
        else {
            delete this.baseFlags?.json;
            this.flags = {}; // force the flags setter to run
            delete this.flags?.json;
        }
    }
    static get '--'() {
        return Command['_--'];
    }
    static set '--'(value) {
        Command['_--'] = value;
    }
    get passThroughEnabled() {
        return Command['_--'];
    }
    /**
     * instantiate and run the command
     *
     * @param {Command.Class} this - the command class
     * @param {string[]} argv argv
     * @param {LoadOptions} opts options
     * @returns {Promise<unknown>} result
     */
    static async run(argv, opts) {
        if (!argv)
            argv = process.argv.slice(2);
        // Handle the case when a file URL string is passed in such as 'import.meta.url'; covert to file path.
        if (typeof opts === 'string' && opts.startsWith('file://')) {
            opts = fileURLToPath(opts);
        }
        const config = await Config.load(opts || require.main?.filename || __dirname);
        const cmd = new this(argv, config);
        if (!cmd.id) {
            const id = cmd.constructor.name.toLowerCase();
            cmd.id = id;
            cmd.ctor.id = id;
        }
        return cmd._run();
    }
    static _baseFlags;
    static get baseFlags() {
        return this._baseFlags;
    }
    static set baseFlags(flags) {
        this._baseFlags = Object.assign({}, this.baseFlags, flags);
        this.flags = {}; // force the flags setter to run
    }
    /** A hash of flags for the command */
    static _flags;
    static get flags() {
        return this._flags;
    }
    static set flags(flags) {
        this._flags = Object.assign({}, this._flags ?? {}, this.baseFlags, flags);
    }
    id;
    debug;
    constructor(argv, config) {
        this.argv = argv;
        this.config = config;
        this.id = this.ctor.id;
        try {
            this.debug = require('debug')(this.id ? `${this.config.bin}:${this.id}` : this.config.bin);
        }
        catch {
            this.debug = () => { };
        }
    }
    get ctor() {
        return this.constructor;
    }
    async _run() {
        let err;
        let result;
        try {
            // remove redirected env var to allow subsessions to run autoupdated client
            delete process.env[this.config.scopedEnvVarKey('REDIRECTED')];
            await this.init();
            result = await this.run();
        }
        catch (error) {
            err = error;
            await this.catch(error);
        }
        finally {
            await this.finally(err);
        }
        if (result && this.jsonEnabled())
            this.logJson(this.toSuccessJson(result));
        return result;
    }
    exit(code = 0) {
        return Errors.exit(code);
    }
    warn(input) {
        if (!this.jsonEnabled())
            Errors.warn(input);
        return input;
    }
    error(input, options = {}) {
        return Errors.error(input, options);
    }
    log(message = '', ...args) {
        if (!this.jsonEnabled()) {
            message = typeof message === 'string' ? message : inspect(message);
            stdout.write(format(message, ...args) + '\n');
        }
    }
    logToStderr(message = '', ...args) {
        if (!this.jsonEnabled()) {
            message = typeof message === 'string' ? message : inspect(message);
            stderr.write(format(message, ...args) + '\n');
        }
    }
    /**
     * Determine if the command is being run with the --json flag in a command that supports it.
     *
     * @returns {boolean} true if the command supports json and the --json flag is present
     */
    jsonEnabled() {
        // if the command doesn't support json, return false
        if (!this.ctor.enableJsonFlag)
            return false;
        // if the command parameter pass through is enabled, return true if the --json flag is before the '--' separator
        if (this.passThroughEnabled) {
            const ptIndex = this.argv.indexOf('--');
            const jsonIndex = this.argv.indexOf('--json');
            return jsonIndex > -1 && (ptIndex === -1 || jsonIndex < ptIndex);
        }
        return this.argv.includes('--json');
    }
    async init() {
        this.debug('init version: %s argv: %o', this.ctor._base, this.argv);
        if (this.config.debug)
            Errors.config.debug = true;
        if (this.config.errlog)
            Errors.config.errlog = this.config.errlog;
        const g = global;
        g['http-call'] = g['http-call'] || {};
        g['http-call'].userAgent = this.config.userAgent;
        this.warnIfCommandDeprecated();
    }
    warnIfFlagDeprecated(flags) {
        for (const flag of Object.keys(flags)) {
            const flagDef = this.ctor.flags[flag];
            const deprecated = flagDef?.deprecated;
            if (deprecated) {
                this.warn(formatFlagDeprecationWarning(flag, deprecated));
            }
            const deprecateAliases = flagDef?.deprecateAliases;
            const aliases = (flagDef?.aliases ?? []).map(a => a.length === 1 ? `-${a}` : `--${a}`);
            if (deprecateAliases && aliases.length > 0) {
                const foundAliases = aliases.filter(alias => this.argv.some(a => a.startsWith(alias)));
                for (const alias of foundAliases) {
                    let preferredUsage = `--${flagDef?.name}`;
                    if (flagDef?.char) {
                        preferredUsage += ` | -${flagDef?.char}`;
                    }
                    this.warn(formatFlagDeprecationWarning(alias, { to: preferredUsage }));
                }
            }
        }
    }
    warnIfCommandDeprecated() {
        const [id] = normalizeArgv(this.config);
        if (this.ctor.deprecateAliases && this.ctor.aliases.includes(id)) {
            const cmdName = toConfiguredId(this.ctor.id, this.config);
            const aliasName = toConfiguredId(id, this.config);
            this.warn(formatCommandDeprecationWarning(aliasName, { to: cmdName }));
        }
        if (this.ctor.state === 'deprecated') {
            const cmdName = toConfiguredId(this.ctor.id, this.config);
            this.warn(formatCommandDeprecationWarning(cmdName, this.ctor.deprecationOptions));
        }
    }
    async parse(options, argv = this.argv) {
        if (!options)
            options = this.ctor;
        const opts = { context: this, ...options };
        // the spread operator doesn't work with getters so we have to manually add it here
        opts.flags = options?.flags;
        opts.args = options?.args;
        const results = await Parser.parse(argv, opts);
        this.warnIfFlagDeprecated(results.flags ?? {});
        return results;
    }
    async catch(err) {
        process.exitCode = process.exitCode ?? err.exitCode ?? 1;
        if (this.jsonEnabled()) {
            this.logJson(this.toErrorJson(err));
        }
        else {
            if (!err.message)
                throw err;
            try {
                ux.action.stop(chalk.bold.red('!'));
            }
            catch { }
            throw err;
        }
    }
    async finally(_) {
        try {
            const config = Errors.config;
            if (config.errorLogger)
                await config.errorLogger.flush();
        }
        catch (error) {
            console.error(error);
        }
    }
    toSuccessJson(result) {
        return result;
    }
    toErrorJson(err) {
        return { error: err };
    }
    logJson(json) {
        ux.styledJSON(json);
    }
}
