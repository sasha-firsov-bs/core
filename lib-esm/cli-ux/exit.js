export class ExitError extends Error {
    'cli-ux';
    code;
    error;
    constructor(status, error) {
        const code = 'EEXIT';
        super(error ? error.message : `${code}: ${status}`);
        this.error = error;
        this['cli-ux'] = { exit: status };
        this.code = code;
    }
}
