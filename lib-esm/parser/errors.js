import { CLIError } from '../errors';
import { flagUsages } from './help';
import { renderList } from '../cli-ux/list';
import * as chalk from 'chalk';
import { uniq } from '../config/util';
export { CLIError } from '../errors';
export class CLIParseError extends CLIError {
    parse;
    constructor(options) {
        options.message += '\nSee more help with --help';
        super(options.message);
        this.parse = options.parse;
    }
}
export class InvalidArgsSpecError extends CLIParseError {
    args;
    constructor({ args, parse }) {
        let message = 'Invalid argument spec';
        const namedArgs = Object.values(args).filter(a => a.name);
        if (namedArgs.length > 0) {
            const list = renderList(namedArgs.map(a => [`${a.name} (${a.required ? 'required' : 'optional'})`, a.description]));
            message += `:\n${list}`;
        }
        super({ parse, message });
        this.args = args;
    }
}
export class RequiredArgsError extends CLIParseError {
    args;
    constructor({ args, parse }) {
        let message = `Missing ${args.length} required arg${args.length === 1 ? '' : 's'}`;
        const namedArgs = args.filter(a => a.name);
        if (namedArgs.length > 0) {
            const list = renderList(namedArgs.map(a => [a.name, a.description]));
            message += `:\n${list}`;
        }
        super({ parse, message });
        this.args = args;
    }
}
export class RequiredFlagError extends CLIParseError {
    flag;
    constructor({ flag, parse }) {
        const usage = renderList(flagUsages([flag], { displayRequired: false }));
        const message = `Missing required flag:\n${usage}`;
        super({ parse, message });
        this.flag = flag;
    }
}
export class UnexpectedArgsError extends CLIParseError {
    args;
    constructor({ parse, args }) {
        const message = `Unexpected argument${args.length === 1 ? '' : 's'}: ${args.join(', ')}`;
        super({ parse, message });
        this.args = args;
    }
}
export class NonExistentFlagsError extends CLIParseError {
    flags;
    constructor({ parse, flags }) {
        const message = `Nonexistent flag${flags.length === 1 ? '' : 's'}: ${flags.join(', ')}`;
        super({ parse, message });
        this.flags = flags;
    }
}
export class FlagInvalidOptionError extends CLIParseError {
    constructor(flag, input) {
        const message = `Expected --${flag.name}=${input} to be one of: ${flag.options.join(', ')}`;
        super({ parse: {}, message });
    }
}
export class ArgInvalidOptionError extends CLIParseError {
    constructor(arg, input) {
        const message = `Expected ${input} to be one of: ${arg.options.join(', ')}`;
        super({ parse: {}, message });
    }
}
export class FailedFlagValidationError extends CLIParseError {
    constructor({ parse, failed }) {
        const reasons = failed.map(r => r.reason);
        const deduped = uniq(reasons);
        const errString = deduped.length === 1 ? 'error' : 'errors';
        const message = `The following ${errString} occurred:\n  ${chalk.dim(deduped.join('\n  '))}`;
        super({ parse, message });
    }
}
