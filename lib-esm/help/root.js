import { compact } from '../util';
import { HelpFormatter } from './formatter';
export default class RootHelp extends HelpFormatter {
    config;
    opts;
    constructor(config, opts) {
        super(config, opts);
        this.config = config;
        this.opts = opts;
    }
    root() {
        let description = this.config.pjson.oclif.description || this.config.pjson.description || '';
        description = this.render(description);
        description = description.split('\n')[0];
        let output = compact([
            description,
            this.version(),
            this.usage(),
            this.description(),
        ]).join('\n\n');
        if (this.opts.stripAnsi)
            output = stripAnsi(output);
        return output;
    }
    usage() {
        return this.section(this.opts.usageHeader || 'USAGE', this.wrap(`$ ${this.config.bin} [COMMAND]`));
    }
    description() {
        let description = this.config.pjson.oclif.description || this.config.pjson.description || '';
        description = this.render(description);
        description = description.split('\n').slice(1).join('\n');
        if (!description)
            return;
        return this.section('DESCRIPTION', this.wrap(description));
    }
    version() {
        return this.section('VERSION', this.wrap(this.config.userAgent));
    }
}
