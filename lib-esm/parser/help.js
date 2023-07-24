import * as chalk from 'chalk';
import { sortBy } from '../util';
export function flagUsage(flag, options = {}) {
    const label = [];
    if (flag.helpLabel) {
        label.push(flag.helpLabel);
    }
    else {
        if (flag.char)
            label.push(`-${flag.char}`);
        if (flag.name)
            label.push(` --${flag.name}`);
    }
    const usage = flag.type === 'option' ? ` ${flag.name.toUpperCase()}` : '';
    let description = flag.summary || flag.description || '';
    if (options.displayRequired && flag.required)
        description = `(required) ${description}`;
    description = description ? chalk.dim(description) : undefined;
    return [` ${label.join(',').trim()}${usage}`, description];
}
export function flagUsages(flags, options = {}) {
    if (flags.length === 0)
        return [];
    return sortBy(flags, f => [f.char ? -1 : 1, f.char, f.name])
        .map(f => flagUsage(f, options));
}
