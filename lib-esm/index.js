import * as semver from 'semver';
import { Command } from './command';
import { run, execute } from './main';
import { Config, Plugin, tsPath, toCached } from './config';
import * as Interfaces from './interfaces';
import * as Errors from './errors';
import * as Flags from './flags';
import * as Args from './args';
import { CommandHelp, HelpBase, Help, loadHelpClass } from './help';
import { toStandardizedId, toConfiguredId } from './help/util';
import * as Parser from './parser';
import { settings } from './settings';
import * as ux from './cli-ux';
import { requireJson } from './util';
import { stderr, stdout } from './cli-ux/stream';
import { Performance } from './performance';
const flush = ux.flush;
export { Args, Command, CommandHelp, Config, Errors, Flags, loadHelpClass, Help, HelpBase, Interfaces, Parser, Plugin, Performance, run, toCached, tsPath, toStandardizedId, toConfiguredId, settings, flush, ux, execute, stderr, stdout, };
function checkCWD() {
    try {
        process.cwd();
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            stderr.write('WARNING: current directory does not exist\n');
        }
    }
}
function checkNodeVersion() {
    const pjson = requireJson(__dirname, '..', 'package.json');
    if (!semver.satisfies(process.versions.node, pjson.engines.node)) {
        stderr.write(`WARNING\nWARNING Node version must be ${pjson.engines.node} to use this CLI\nWARNING Current node version: ${process.versions.node}\nWARNING\n`);
    }
}
checkCWD();
checkNodeVersion();
