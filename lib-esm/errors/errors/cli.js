import * as chalk from 'chalk';
import * as indent from 'indent-string';
import * as cs from 'clean-stack';
import * as wrap from 'wrap-ansi';
import * as screen from '../../screen';
import { config } from '../config';
/**
 * properties specific to internal oclif error handling
 */
export function addOclifExitCode(error, options) {
    if (!('oclif' in error)) {
        error.oclif = {};
    }
    error.oclif.exit = options?.exit === undefined ? 2 : options.exit;
    return error;
}
export class CLIError extends Error {
    oclif = {};
    code;
    constructor(error, options = {}) {
        super(error instanceof Error ? error.message : error);
        addOclifExitCode(this, options);
        this.code = options.code;
    }
    get stack() {
        return cs(super.stack, { pretty: true });
    }
    /**
     * @deprecated `render` Errors display should be handled by display function, like pretty-print
     * @return {string} returns a string representing the dispay of the error
     */
    render() {
        if (config.debug) {
            return this.stack;
        }
        let output = `${this.name}: ${this.message}`;
        output = wrap(output, screen.errtermwidth - 6, { trim: false, hard: true });
        output = indent(output, 3);
        output = indent(output, 1, { indent: this.bang, includeEmptyLines: true });
        output = indent(output, 1);
        return output;
    }
    get bang() {
        try {
            return chalk.red(process.platform === 'win32' ? '»' : '›');
        }
        catch { }
    }
}
(function (CLIError) {
    class Warn extends CLIError {
        constructor(err) {
            super(err instanceof Error ? err.message : err);
            this.name = 'Warning';
        }
        get bang() {
            try {
                return chalk.yellow(process.platform === 'win32' ? '»' : '›');
            }
            catch { }
        }
    }
    CLIError.Warn = Warn;
})(CLIError || (CLIError = {}));
