import * as Errors from '../errors';
import * as util from 'util';
import * as chalk from 'chalk';
import { ActionBase } from './action/base';
import { config, Config } from './config';
import { ExitError } from './exit';
import * as styled from './styled';
import { Table } from './styled';
import * as uxPrompt from './prompt';
import uxWait from './wait';
import { stdout } from './stream';
const hyperlinker = require('hyperlinker');
function timeout(p, ms) {
    function wait(ms, unref = false) {
        return new Promise(resolve => {
            const t = setTimeout(() => resolve(null), ms);
            if (unref)
                t.unref();
        });
    }
    return Promise.race([p, wait(ms, true).then(() => Errors.error('timed out'))]);
}
async function _flush() {
    const p = new Promise(resolve => {
        stdout.once('drain', () => resolve(null));
    });
    const flushed = stdout.write('');
    if (flushed) {
        return Promise.resolve();
    }
    return p;
}
export class ux {
    static config = config;
    static get prompt() {
        return uxPrompt.prompt;
    }
    /**
     * "press anykey to continue"
     */
    static get anykey() {
        return uxPrompt.anykey;
    }
    static get confirm() {
        return uxPrompt.confirm;
    }
    static get action() {
        return config.action;
    }
    static get prideAction() {
        return config.prideAction;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static styledObject(obj, keys) {
        this.info(styled.styledObject(obj, keys));
    }
    static styledHeader(header) {
        this.info(chalk.dim('=== ') + chalk.bold(header) + '\n');
    }
    static get styledJSON() {
        return styled.styledJSON;
    }
    static get table() {
        return styled.Table.table;
    }
    static get tree() {
        return styled.tree;
    }
    static get wait() {
        return uxWait;
    }
    static get progress() {
        return styled.progress;
    }
    static async done() {
        config.action.stop();
    }
    static trace(format, ...args) {
        if (this.config.outputLevel === 'trace') {
            stdout.write(util.format(format, ...args) + '\n');
        }
    }
    static debug(format, ...args) {
        if (['trace', 'debug'].includes(this.config.outputLevel)) {
            stdout.write(util.format(format, ...args) + '\n');
        }
    }
    static info(format, ...args) {
        stdout.write(util.format(format, ...args) + '\n');
    }
    static log(format, ...args) {
        this.info(format || '', ...args);
    }
    static url(text, uri, params = {}) {
        const supports = require('supports-hyperlinks');
        if (supports.stdout) {
            this.log(hyperlinker(text, uri, params));
        }
        else {
            this.log(uri);
        }
    }
    static annotation(text, annotation) {
        const supports = require('supports-hyperlinks');
        if (supports.stdout) {
            // \u001b]8;;https://google.com\u0007sometext\u001b]8;;\u0007
            this.log(`\u001B]1337;AddAnnotation=${text.length}|${annotation}\u0007${text}`);
        }
        else {
            this.log(text);
        }
    }
    static async flush(ms = 10_000) {
        await timeout(_flush(), ms);
    }
}
const action = ux.action;
const annotation = ux.annotation;
const anykey = ux.anykey;
const confirm = ux.confirm;
const debug = ux.debug;
const done = ux.done;
const error = Errors.error;
const exit = Errors.exit;
const flush = ux.flush;
const info = ux.info;
const log = ux.log;
const prideAction = ux.prideAction;
const progress = ux.progress;
const prompt = ux.prompt;
const styledHeader = ux.styledHeader;
const styledJSON = ux.styledJSON;
const styledObject = ux.styledObject;
const table = ux.table;
const trace = ux.trace;
const tree = ux.tree;
const url = ux.url;
const wait = ux.wait;
const warn = Errors.warn;
export { action, ActionBase, annotation, anykey, config, Config, confirm, debug, done, error, exit, ExitError, flush, info, log, prideAction, progress, prompt, styledHeader, styledJSON, styledObject, table, Table, trace, tree, url, wait, warn, };
const cliuxProcessExitHandler = async () => {
    try {
        await ux.done();
    }
    catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
};
// to avoid MaxListenersExceededWarning
// only attach named listener once
const cliuxListener = process.listeners('exit').find(fn => fn.name === cliuxProcessExitHandler.name);
if (!cliuxListener) {
    process.once('exit', cliuxProcessExitHandler);
}
