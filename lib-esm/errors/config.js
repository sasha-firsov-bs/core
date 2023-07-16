import { settings } from '../settings';
import { Logger } from './logger';
function displayWarnings() {
    if (process.listenerCount('warning') > 1)
        return;
    process.on('warning', (warning) => {
        console.error(warning.stack);
        if (warning.detail)
            console.error(warning.detail);
    });
}
export const config = {
    errorLogger: undefined,
    get debug() {
        return Boolean(settings.debug);
    },
    set debug(enabled) {
        settings.debug = enabled;
        if (enabled)
            displayWarnings();
    },
    get errlog() {
        return settings.errlog;
    },
    set errlog(errlog) {
        if (errlog) {
            this.errorLogger = new Logger(errlog);
            settings.errlog = errlog;
        }
        else {
            delete this.errorLogger;
            delete settings.errlog;
        }
    },
};
