import { URL } from 'url';
import { Help } from './help';
import { dirExists, fileExists } from './util';
export function custom(defaults) {
    return (options = {}) => {
        return {
            parse: async (input, _ctx, _opts) => input,
            ...defaults,
            ...options,
            input: [],
            multiple: Boolean(options.multiple === undefined ? defaults.multiple : options.multiple),
            type: 'option',
        };
    };
}
export function boolean(options = {}) {
    return {
        parse: async (b, _) => b,
        ...options,
        allowNo: Boolean(options.allowNo),
        type: 'boolean',
    };
}
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
const stringFlag = custom({});
export { stringFlag as string };
export const version = (opts = {}) => {
    return boolean({
        description: 'Show CLI version.',
        ...opts,
        parse: async (_, ctx) => {
            ctx.log(ctx.config.userAgent);
            ctx.exit(0);
        },
    });
};
export const help = (opts = {}) => {
    return boolean({
        description: 'Show CLI help.',
        ...opts,
        parse: async (_, cmd) => {
            new Help(cmd.config).showHelp(cmd.id ? [cmd.id, ...cmd.argv] : cmd.argv);
            cmd.exit(0);
        },
    });
};
