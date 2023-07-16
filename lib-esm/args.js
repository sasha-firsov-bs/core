import { URL } from 'node:url';
import { dirExists, fileExists, isNotFalsy } from './util';
export function custom(defaults) {
    return (options = {}) => {
        return {
            parse: async (i, _context, _opts) => i,
            ...defaults,
            ...options,
            input: [],
            type: 'option',
        };
    };
}
export const boolean = custom({
    parse: async (b) => Boolean(b) && isNotFalsy(b),
});
export const integer = custom({
    parse: async (input, _, opts) => {
        if (!/^-?\d+$/.test(input))
            throw new Error(`Expected an integer but received: ${input}`);
        const num = Number.parseInt(input, 10);
        if (opts.min !== undefined && num < opts.min)
            throw new Error(`Expected an integer greater than or equal to ${opts.min} but received: ${input}`);
        if (opts.max !== undefined && num > opts.max)
            throw new Error(`Expected an integer less than or equal to ${opts.max} but received: ${input}`);
        return num;
    },
});
export const directory = custom({
    parse: async (input, _, opts) => {
        if (opts.exists)
            return dirExists(input);
        return input;
    },
});
export const file = custom({
    parse: async (input, _, opts) => {
        if (opts.exists)
            return fileExists(input);
        return input;
    },
});
/**
 * Initializes a string as a URL. Throws an error
 * if the string is not a valid URL.
 */
export const url = custom({
    parse: async (input) => {
        try {
            return new URL(input);
        }
        catch {
            throw new Error(`Expected a valid url but received: ${input}`);
        }
    },
});
const stringArg = custom({});
export { stringArg as string };
