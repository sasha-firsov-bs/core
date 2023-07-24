import { CLIError } from './cli';
export class ExitError extends CLIError {
    // oclif!: { exit: number }
    code = 'EEXIT';
    constructor(exitCode = 1) {
        super(`EEXIT: ${exitCode}`, { exit: exitCode });
    }
    render() {
        return '';
    }
}
