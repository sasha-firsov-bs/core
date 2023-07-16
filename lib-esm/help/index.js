import * as util from 'util';
import { error } from '../errors';
import CommandHelp from './command';
import RootHelp from './root';
import { compact, sortBy, uniqBy } from '../util';
import { formatCommandDeprecationWarning, getHelpFlagAdditions, standardizeIDFromArgv, toConfiguredId } from './util';
import { HelpFormatter } from './formatter';
import { toCached } from '../config/config';
import { stdout } from '../cli-ux/stream';
export { CommandHelp } from './command';
export { standardizeIDFromArgv, loadHelpClass, getHelpFlagAdditions, normalizeArgv } from './util';
function getHelpSubject(args, config) {
    // for each help flag that starts with '--' create a new flag with same name sans '--'
    const mergedHelpFlags = getHelpFlagAdditions(config);
    for (const arg of args) {
        if (arg === '--')
            return;
        if (mergedHelpFlags.includes(arg) || arg === 'help')
            continue;
        if (arg.startsWith('-'))
            return;
        return arg;
    }
}
export class HelpBase extends HelpFormatter {
    constructor(config, opts = {}) {
        super(config, opts);
        if (!config.topicSeparator)
            config.topicSeparator = ':'; // back-support @oclif/config
    }
}
export class Help extends HelpBase {
    CommandHelpClass = CommandHelp;
    /*
     * _topics is to work around Interfaces.topics mistakenly including commands that do
     * not have children, as well as topics. A topic has children, either commands or other topics. When
     * this is fixed upstream config.topics should return *only* topics with children,
     * and this can be removed.
     */
    get _topics() {
        return this.config.topics.filter((topic) => {
            // it is assumed a topic has a child if it has children
            const hasChild = this.config.topics.some(subTopic => subTopic.name.includes(`${topic.name}:`));
            return hasChild;
        });
    }
    get sortedCommands() {
        let commands = this.config.commands;
        commands = commands.filter(c => this.opts.all || !c.hidden);
        commands = sortBy(commands, c => c.id);
        commands = uniqBy(commands, c => c.id);
        return commands;
    }
    get sortedTopics() {
        let topics = this._topics;
        topics = topics.filter(t => this.opts.all || !t.hidden);
        topics = sortBy(topics, t => t.name);
        topics = uniqBy(topics, t => t.name);
        return topics;
    }
    constructor(config, opts = {}) {
        super(config, opts);
    }
    async showHelp(argv) {
        const originalArgv = argv.slice(1);
        argv = argv.filter(arg => !getHelpFlagAdditions(this.config).includes(arg));
        if (this.config.topicSeparator !== ':')
            argv = standardizeIDFromArgv(argv, this.config);
        const subject = getHelpSubject(argv, this.config);
        if (!subject) {
            if (this.config.pjson.oclif.default) {
                const rootCmd = this.config.findCommand(this.config.pjson.oclif.default);
                if (rootCmd) {
                    await this.showCommandHelp(rootCmd);
                    return;
                }
            }
            await this.showRootHelp();
            return;
        }
        const command = this.config.findCommand(subject);
        if (command) {
            if (command.hasDynamicHelp && command.pluginType !== 'jit') {
                const dynamicCommand = await toCached(await command.load(), undefined, false);
                await this.showCommandHelp(dynamicCommand);
            }
            else {
                await this.showCommandHelp(command);
            }
            return;
        }
        const topic = this.config.findTopic(subject);
        if (topic) {
            await this.showTopicHelp(topic);
            return;
        }
        if (this.config.flexibleTaxonomy) {
            const matches = this.config.findMatches(subject, originalArgv);
            if (matches.length > 0) {
                const result = await this.config.runHook('command_incomplete', { id: subject, argv: originalArgv, matches });
                if (result.successes.length > 0)
                    return;
            }
        }
        error(`Command ${subject} not found.`);
    }
    async showCommandHelp(command) {
        const name = command.id;
        const depth = name.split(':').length;
        const subTopics = this.sortedTopics.filter(t => t.name.startsWith(name + ':') && t.name.split(':').length === depth + 1);
        const subCommands = this.sortedCommands.filter(c => c.id.startsWith(name + ':') && c.id.split(':').length === depth + 1);
        const plugin = this.config.plugins.find(p => p.name === command.pluginName);
        const state = this.config.pjson?.oclif?.state || plugin?.pjson?.oclif?.state || command.state;
        if (state) {
            this.log(state === 'deprecated' ?
                `${formatCommandDeprecationWarning(toConfiguredId(name, this.config), command.deprecationOptions)}` :
                `This command is in ${state}.\n`);
        }
        const summary = this.summary(command);
        if (summary) {
            this.log(summary + '\n');
        }
        this.log(this.formatCommand(command));
        this.log('');
        if (subTopics.length > 0) {
            this.log(this.formatTopics(subTopics));
            this.log('');
        }
        if (subCommands.length > 0) {
            const aliases = [];
            const uniqueSubCommands = subCommands.filter(p => {
                aliases.push(...p.aliases);
                return !aliases.includes(p.id);
            });
            this.log(this.formatCommands(uniqueSubCommands));
            this.log('');
        }
    }
    async showRootHelp() {
        let rootTopics = this.sortedTopics;
        let rootCommands = this.sortedCommands;
        const state = this.config.pjson?.oclif?.state;
        if (state) {
            this.log(state === 'deprecated' ?
                `${this.config.bin} is deprecated` :
                `${this.config.bin} is in ${state}.\n`);
        }
        this.log(this.formatRoot());
        this.log('');
        if (!this.opts.all) {
            rootTopics = rootTopics.filter(t => !t.name.includes(':'));
            rootCommands = rootCommands.filter(c => !c.id.includes(':'));
        }
        if (rootTopics.length > 0) {
            this.log(this.formatTopics(rootTopics));
            this.log('');
        }
        if (rootCommands.length > 0) {
            rootCommands = rootCommands.filter(c => c.id);
            this.log(this.formatCommands(rootCommands));
            this.log('');
        }
    }
    async showTopicHelp(topic) {
        const name = topic.name;
        const depth = name.split(':').length;
        const subTopics = this.sortedTopics.filter(t => t.name.startsWith(name + ':') && t.name.split(':').length === depth + 1);
        const commands = this.sortedCommands.filter(c => c.id.startsWith(name + ':') && c.id.split(':').length === depth + 1);
        const state = this.config.pjson?.oclif?.state;
        if (state)
            this.log(`This topic is in ${state}.\n`);
        this.log(this.formatTopic(topic));
        if (subTopics.length > 0) {
            this.log(this.formatTopics(subTopics));
            this.log('');
        }
        if (commands.length > 0) {
            this.log(this.formatCommands(commands));
            this.log('');
        }
    }
    formatRoot() {
        const help = new RootHelp(this.config, this.opts);
        return help.root();
    }
    formatCommand(command) {
        if (this.config.topicSeparator !== ':') {
            command.id = command.id.replace(/:/g, this.config.topicSeparator);
            command.aliases = command.aliases && command.aliases.map(a => a.replace(/:/g, this.config.topicSeparator));
        }
        const help = this.getCommandHelpClass(command);
        return help.generate();
    }
    getCommandHelpClass(command) {
        return new this.CommandHelpClass(command, this.config, this.opts);
    }
    formatCommands(commands) {
        if (commands.length === 0)
            return '';
        const body = this.renderList(commands.map(c => {
            if (this.config.topicSeparator !== ':')
                c.id = c.id.replace(/:/g, this.config.topicSeparator);
            return [
                c.id,
                this.summary(c),
            ];
        }), {
            spacer: '\n',
            stripAnsi: this.opts.stripAnsi,
            indentation: 2,
        });
        return this.section('COMMANDS', body);
    }
    summary(c) {
        if (c.summary)
            return this.render(c.summary.split('\n')[0]);
        return c.description && this.render(c.description).split('\n')[0];
    }
    description(c) {
        const description = this.render(c.description || '');
        if (c.summary) {
            return description;
        }
        return description.split('\n').slice(1).join('\n');
    }
    formatTopic(topic) {
        let description = this.render(topic.description || '');
        const summary = description.split('\n')[0];
        description = description.split('\n').slice(1).join('\n');
        let topicID = `${topic.name}:COMMAND`;
        if (this.config.topicSeparator !== ':')
            topicID = topicID.replace(/:/g, this.config.topicSeparator);
        let output = compact([
            summary,
            this.section(this.opts.usageHeader || 'USAGE', `$ ${this.config.bin} ${topicID}`),
            description && this.section('DESCRIPTION', this.wrap(description)),
        ]).join('\n\n');
        if (this.opts.stripAnsi)
            output = stripAnsi(output);
        return output + '\n';
    }
    formatTopics(topics) {
        if (topics.length === 0)
            return '';
        const body = this.renderList(topics.map(c => {
            if (this.config.topicSeparator !== ':')
                c.name = c.name.replace(/:/g, this.config.topicSeparator);
            return [
                c.name,
                c.description && this.render(c.description.split('\n')[0]),
            ];
        }), {
            spacer: '\n',
            stripAnsi: this.opts.stripAnsi,
            indentation: 2,
        });
        return this.section('TOPICS', body);
    }
    command(command) {
        return this.formatCommand(command);
    }
    log(...args) {
        stdout.write(util.format.apply(this, args) + '\n');
    }
}
