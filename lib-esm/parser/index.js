import { Parser } from './parse';
import { validate } from './validate';
export { flagUsages } from './help';
export async function parse(argv, options) {
    const input = {
        argv,
        context: options.context,
        '--': options['--'],
        flags: (options.flags ?? {}),
        args: (options.args ?? {}),
        strict: options.strict !== false,
    };
    const parser = new Parser(input);
    const output = await parser.parse();
    await validate({ input, output });
    return output;
}
