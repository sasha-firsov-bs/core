import * as wrap from 'wrap-ansi';
import * as screen from '../../screen';
import { config } from '../config';
export function applyPrettyPrintOptions(error, options) {
    const prettyErrorKeys = ['message', 'code', 'ref', 'suggestions'];
    for (const key of prettyErrorKeys) {
        const applyOptionsKey = !(key in error) && options[key];
        if (applyOptionsKey) {
            error[key] = options[key];
        }
    }
    return error;
}
const formatSuggestions = (suggestions) => {
    const label = 'Try this:';
    if (!suggestions || suggestions.length === 0)
        return undefined;
    if (suggestions.length === 1)
        return `${label} ${suggestions[0]}`;
    const multiple = suggestions.map(suggestion => `* ${suggestion}`).join('\n');
    return `${label}\n${indent(multiple, 2)}`;
};
export default function prettyPrint(error) {
    if (config.debug) {
        return error.stack;
    }
    const { message, code, suggestions, ref, name: errorSuffix, bang } = error;
    // errorSuffix is pulled from the 'name' property on CLIError
    // and is like either Error or Warning
    const formattedHeader = message ? `${errorSuffix || 'Error'}: ${message}` : undefined;
    const formattedCode = code ? `Code: ${code}` : undefined;
    const formattedSuggestions = formatSuggestions(suggestions);
    const formattedReference = ref ? `Reference: ${ref}` : undefined;
    const formatted = [formattedHeader, formattedCode, formattedSuggestions, formattedReference]
        .filter(Boolean)
        .join('\n');
    let output = wrap(formatted, screen.errtermwidth - 6, { trim: false, hard: true });
    output = indent(output, 3);
    output = indent(output, 1, { indent: bang || '', includeEmptyLines: true });
    output = indent(output, 1);
    return output;
}
