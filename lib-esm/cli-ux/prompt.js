import * as Errors from '../errors';
import config from './config';
import * as chalk from 'chalk';
import { stderr } from './stream';
const ansiEscapes = require('ansi-escapes');
const passwordPrompt = require('password-prompt');
function normal(options, retries = 100) {
    if (retries < 0)
        throw new Error('no input');
    return new Promise((resolve, reject) => {
        let timer;
        if (options.timeout) {
            timer = setTimeout(() => {
                process.stdin.pause();
                reject(new Error('Prompt timeout'));
            }, options.timeout);
            timer.unref();
        }
        process.stdin.setEncoding('utf8');
        stderr.write(options.prompt);
        process.stdin.resume();
        process.stdin.once('data', b => {
            if (timer)
                clearTimeout(timer);
            process.stdin.pause();
            const data = (typeof b === 'string' ? b : b.toString()).trim();
            if (!options.default && options.required && data === '') {
                resolve(normal(options, retries - 1));
            }
            else {
                resolve(data || options.default);
            }
        });
    });
}
function getPrompt(name, type, defaultValue) {
    let prompt = '> ';
    if (defaultValue && type === 'hide') {
        defaultValue = '*'.repeat(defaultValue.length);
    }
    if (name && defaultValue)
        prompt = name + ' ' + chalk.yellow('[' + defaultValue + ']') + ': ';
    else if (name)
        prompt = `${name}: `;
    return prompt;
}
async function single(options) {
    const raw = process.stdin.isRaw;
    if (process.stdin.setRawMode)
        process.stdin.setRawMode(true);
    options.required = options.required ?? false;
    const response = await normal(options);
    if (process.stdin.setRawMode)
        process.stdin.setRawMode(Boolean(raw));
    return response;
}
function replacePrompt(prompt) {
    stderr.write(ansiEscapes.cursorHide + ansiEscapes.cursorUp(1) + ansiEscapes.cursorLeft + prompt +
        ansiEscapes.cursorDown(1) + ansiEscapes.cursorLeft + ansiEscapes.cursorShow);
}
async function _prompt(name, inputOptions = {}) {
    const prompt = getPrompt(name, inputOptions.type, inputOptions.default);
    const options = {
        isTTY: Boolean(process.env.TERM !== 'dumb' && process.stdin.isTTY),
        name,
        prompt,
        type: 'normal',
        required: true,
        default: '',
        ...inputOptions,
    };
    switch (options.type) {
        case 'normal':
            return normal(options);
        case 'single':
            return single(options);
        case 'mask':
            return passwordPrompt(options.prompt, {
                method: options.type,
                required: options.required,
                default: options.default,
            }).then((value) => {
                replacePrompt(getPrompt(name, 'hide', inputOptions.default));
                return value;
            });
        case 'hide':
            return passwordPrompt(options.prompt, {
                method: options.type,
                required: options.required,
                default: options.default,
            });
        default:
            throw new Error(`unexpected type ${options.type}`);
    }
}
/**
 * prompt for input
 * @param name - prompt text
 * @param options - @see IPromptOptions
 * @returns Promise<string>
 */
export async function prompt(name, options = {}) {
    return config.action.pauseAsync(() => {
        return _prompt(name, options);
    }, chalk.cyan('?'));
}
/**
 * confirmation prompt (yes/no)
 * @param message - confirmation text
 * @returns Promise<boolean>
 */
export function confirm(message) {
    return config.action.pauseAsync(async () => {
        const confirm = async () => {
            const response = (await _prompt(message)).toLowerCase();
            if (['n', 'no'].includes(response))
                return false;
            if (['y', 'yes'].includes(response))
                return true;
            return confirm();
        };
        return confirm();
    }, chalk.cyan('?'));
}
/**
 * "press anykey to continue"
 * @param message - optional message to display to user
 * @returns Promise<string>
 */
export async function anykey(message) {
    const tty = Boolean(process.stdin.setRawMode);
    if (!message) {
        message = tty ?
            `Press any key to continue or ${chalk.yellow('q')} to exit` :
            `Press enter to continue or ${chalk.yellow('q')} to exit`;
    }
    const char = await prompt(message, { type: 'single', required: false });
    if (tty)
        stderr.write('\n');
    if (char === 'q')
        Errors.error('quit');
    if (char === '\u0003')
        Errors.error('ctrl-c');
    return char;
}
