import * as ejs from 'ejs';
import { Help } from '.';
import ModuleLoader from '../module-loader';
import { collectUsableIds } from '../config/util';
function extractClass(exported) {
    return exported && exported.default ? exported.default : exported;
}
export async function loadHelpClass(config) {
    const pjson = config.pjson;
    const configuredClass = pjson && pjson.oclif && pjson.oclif.helpClass;
    if (configuredClass) {
        try {
            const exported = await ModuleLoader.load(config, configuredClass);
            return extractClass(exported);
        }
        catch (error) {
            throw new Error(`Unable to load configured help class "${configuredClass}", failed with message:\n${error.message}`);
        }
    }
    return Help;
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function template(context) {
    function render(t) {
        return ejs.render(t, context);
    }
    return render;
}
function collateSpacedCmdIDFromArgs(argv, config) {
    if (argv.length === 1)
        return argv;
    const findId = (argv) => {
        const ids = collectUsableIds(config.commandIDs);
        const final = [];
        const idPresent = (id) => ids.has(id);
        const isFlag = (s) => s.startsWith('-');
        const isArgWithValue = (s) => s.includes('=');
        const finalizeId = (s) => s ? [...final, s].join(':') : final.join(':');
        const hasArgs = () => {
            const id = finalizeId();
            if (!id)
                return false;
            const cmd = config.findCommand(id);
            return Boolean(cmd && (cmd.strict === false || Object.keys(cmd.args ?? {}).length > 0));
        };
        for (const arg of argv) {
            if (idPresent(finalizeId(arg)))
                final.push(arg);
            // If the parent topic has a command that expects positional arguments, then we cannot
            // assume that any subsequent string could be part of the command name
            else if (isArgWithValue(arg) || isFlag(arg) || hasArgs())
                break;
            else
                final.push(arg);
        }
        return finalizeId();
    };
    const id = findId(argv);
    if (id) {
        const argvSlice = argv.slice(id.split(':').length);
        return [id, ...argvSlice];
    }
    return argv; // ID is argv[0]
}
export function toStandardizedId(commandID, config) {
    return commandID.replace(new RegExp(config.topicSeparator, 'g'), ':');
}
export function toConfiguredId(commandID, config) {
    const defaultTopicSeparator = ':';
    return commandID.replace(new RegExp(defaultTopicSeparator, 'g'), config.topicSeparator || defaultTopicSeparator);
}
export function standardizeIDFromArgv(argv, config) {
    if (argv.length === 0)
        return argv;
    if (config.topicSeparator === ' ')
        argv = collateSpacedCmdIDFromArgs(argv, config);
    else if (config.topicSeparator !== ':')
        argv[0] = toStandardizedId(argv[0], config);
    return argv;
}
export function getHelpFlagAdditions(config) {
    const helpFlags = ['--help'];
    const additionalHelpFlags = config.pjson.oclif.additionalHelpFlags ?? [];
    return [...new Set([...helpFlags, ...additionalHelpFlags]).values()];
}
export function formatFlagDeprecationWarning(flag, opts) {
    let message = `The "${flag}" flag has been deprecated`;
    if (opts === true)
        return `${message}.`;
    if (opts.message)
        return opts.message;
    if (opts.version) {
        message += ` and will be removed in version ${opts.version}`;
    }
    message += opts.to ? `. Use "${opts.to}" instead.` : '.';
    return message;
}
export function formatCommandDeprecationWarning(command, opts) {
    let message = `The "${command}" command has been deprecated`;
    if (!opts)
        return `${message}.`;
    if (opts.message)
        return opts.message;
    if (opts.version) {
        message += ` and will be removed in version ${opts.version}`;
    }
    message += opts.to ? `. Use "${opts.to}" instead.` : '.';
    return message;
}
export function normalizeArgv(config, argv = process.argv.slice(2)) {
    if (config.topicSeparator !== ':' && !argv[0]?.includes(':'))
        argv = standardizeIDFromArgv(argv, config);
    return argv;
}
