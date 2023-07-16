import * as fs from 'fs';
const debug = require('debug');
export function flatMap(arr, fn) {
    return arr.reduce((arr, i) => [...arr, ...fn(i)], []);
}
export function mapValues(obj, fn) {
    return Object.entries(obj)
        .reduce((o, [k, v]) => {
        o[k] = fn(v, k);
        return o;
    }, {});
}
export function exists(path) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise(resolve => resolve(fs.existsSync(path)));
}
export function resolvePackage(id, paths) {
    return require.resolve(id, paths);
}
export function loadJSON(path) {
    debug('config')('loadJSON %s', path);
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, d) => {
            try {
                if (err)
                    reject(err);
                else
                    resolve(JSON.parse(d));
            }
            catch (error) {
                reject(error);
            }
        });
    });
}
export function compact(a) {
    return a.filter((a) => Boolean(a));
}
export function uniq(arr) {
    return [...new Set(arr)].sort();
}
function displayWarnings() {
    if (process.listenerCount('warning') > 1)
        return;
    process.on('warning', (warning) => {
        console.error(warning.stack);
        if (warning.detail)
            console.error(warning.detail);
    });
}
export function Debug(...scope) {
    if (!debug)
        return (..._) => { };
    const d = debug(['config', ...scope].join(':'));
    if (d.enabled)
        displayWarnings();
    return (...args) => d(...args);
}
// Adapted from https://github.com/angus-c/just/blob/master/packages/array-permutations/index.js
export function getPermutations(arr) {
    if (arr.length === 0)
        return [];
    if (arr.length === 1)
        return [arr];
    const output = [];
    const partialPermutations = getPermutations(arr.slice(1));
    const first = arr[0];
    for (let i = 0, len = partialPermutations.length; i < len; i++) {
        const partial = partialPermutations[i];
        for (let j = 0, len2 = partial.length; j <= len2; j++) {
            const start = partial.slice(0, j);
            const end = partial.slice(j);
            const merged = [...start, first, ...end];
            output.push(merged);
        }
    }
    return output;
}
export function getCommandIdPermutations(commandId) {
    return getPermutations(commandId.split(':')).flatMap(c => c.join(':'));
}
/**
 * Return an array of ids that represent all the usable combinations that a user could enter.
 *
 * For example, if the command ids are:
 * - foo:bar:baz
 * - one:two:three
 * Then the usable ids would be:
 * - foo
 * - foo:bar
 * - foo:bar:baz
 * - one
 * - one:two
 * - one:two:three
 *
 * This allows us to determine which parts of the argv array belong to the command id whenever the topicSeparator is a space.
 *
 * @param commandIds string[]
 * @returns string[]
 */
export function collectUsableIds(commandIds) {
    const usuableIds = [];
    for (const id of commandIds) {
        const parts = id.split(':');
        while (parts.length > 0) {
            const name = parts.join(':');
            if (name)
                usuableIds.push(name);
            parts.pop();
        }
    }
    return new Set(usuableIds);
}
