import * as semver from 'semver';
import { requireJson } from '../util';
import spinner from './action/spinner';
import simple from './action/spinner';
import pride from './action/pride-spinner';
const version = semver.parse(requireJson(__dirname, '..', '..', 'package.json').version);
const g = global;
const globals = g['cli-ux'] || (g['cli-ux'] = {});
const actionType = (Boolean(process.stderr.isTTY) &&
    !process.env.CI &&
    !['dumb', 'emacs-color'].includes(process.env.TERM) &&
    'spinner') || 'simple';
const Action = actionType === 'spinner' ? spinner : simple;
const PrideAction = actionType === 'spinner' ? pride : simple;
export class Config {
    outputLevel = 'info';
    action = new Action();
    prideAction = new PrideAction();
    errorsHandled = false;
    showStackTrace = true;
    get debug() {
        return globals.debug || process.env.DEBUG === '*';
    }
    set debug(v) {
        globals.debug = v;
    }
    get context() {
        return globals.context || {};
    }
    set context(v) {
        globals.context = v;
    }
}
function fetch() {
    if (globals[version.major])
        return globals[version.major];
    globals[version.major] = new Config();
    return globals[version.major];
}
export const config = fetch();
export default config;
