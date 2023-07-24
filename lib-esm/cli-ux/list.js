import { stdtermwidth } from '../screen';
import { maxBy } from '../util';
const wordwrap = require('wordwrap');
function linewrap(length, s) {
    return wordwrap(length, stdtermwidth, {
        skipScheme: 'ansi-color',
    })(s).trim();
}
export function renderList(items) {
    if (items.length === 0) {
        return '';
    }
    const maxLength = maxBy(items, item => item[0].length)?.[0].length ?? 0;
    const lines = items.map(i => {
        let left = i[0];
        let right = i[1];
        if (!right) {
            return left;
        }
        left = left.padEnd(maxLength);
        right = linewrap(maxLength + 2, right);
        return `${left}  ${right}`;
    });
    return lines.join('\n');
}
