import { error } from '../errors';
import * as globby from 'globby';
import * as path from 'path';
import { inspect } from 'util';
import { toCached } from './config';
import { Debug } from './util';
import { tsPath } from './ts-node';
import { compact, exists, resolvePackage, flatMap, loadJSON, mapValues } from './util';
import { isProd, requireJson } from '../util';
import ModuleLoader from '../module-loader';
import { Performance } from '../performance';
const _pjson = requireJson(__dirname, '..', '..', 'package.json');
function topicsToArray(input, base) {
    if (!input)
        return [];
    base = base ? `${base}:` : '';
    if (Array.isArray(input)) {
        return [...input, ...flatMap(input, t => topicsToArray(t.subtopics, `${base}${t.name}`))];
    }
    return flatMap(Object.keys(input), k => {
        input[k].name = k;
        return [{ ...input[k], name: `${base}${k}` }, ...topicsToArray(input[k].subtopics, `${base}${input[k].name}`)];
    });
}
// essentially just "cd .."
function* up(from) {
    while (path.dirname(from) !== from) {
        yield from;
        from = path.dirname(from);
    }
    yield from;
}
async function findSourcesRoot(root) {
    for (const next of up(root)) {
        const cur = path.join(next, 'package.json');
        // eslint-disable-next-line no-await-in-loop
        if (await exists(cur))
            return path.dirname(cur);
    }
}
/**
 * @returns string
 * @param name string
 * @param root string
 * find package root
 * for packages installed into node_modules this will go up directories until
 * it finds a node_modules directory with the plugin installed into it
 *
 * This is needed because some oclif plugins do not declare the `main` field in their package.json
 * https://github.com/oclif/config/pull/289#issuecomment-983904051
 */
async function findRootLegacy(name, root) {
    for (const next of up(root)) {
        let cur;
        if (name) {
            cur = path.join(next, 'node_modules', name, 'package.json');
            // eslint-disable-next-line no-await-in-loop
            if (await exists(cur))
                return path.dirname(cur);
            try {
                // eslint-disable-next-line no-await-in-loop
                const pkg = await loadJSON(path.join(next, 'package.json'));
                if (pkg.name === name)
                    return next;
            }
            catch { }
        }
        else {
            cur = path.join(next, 'package.json');
            // eslint-disable-next-line no-await-in-loop
            if (await exists(cur))
                return path.dirname(cur);
        }
    }
}
async function findRoot(name, root) {
    if (name) {
        let pkgPath;
        try {
            pkgPath = resolvePackage(name, { paths: [root] });
        }
        catch { }
        return pkgPath ? findSourcesRoot(path.dirname(pkgPath)) : findRootLegacy(name, root);
    }
    return findSourcesRoot(root);
}
export class Plugin {
    options;
    // static loadedPlugins: {[name: string]: Plugin} = {}
    _base = `${_pjson.name}@${_pjson.version}`;
    name;
    version;
    pjson;
    type;
    root;
    alias;
    tag;
    manifest;
    commands;
    hooks;
    valid = false;
    alreadyLoaded = false;
    parent;
    children = [];
    hasManifest = false;
    _commandsDir;
    // eslint-disable-next-line new-cap
    _debug = Debug();
    warned = false;
    constructor(options) {
        this.options = options;
    }
    /**
     * Loads a plugin
     * @param isWritingManifest - if true, exclude selected data from manifest
     * default is false to maintain backwards compatibility
     * @returns Promise<void>
     */
    async load(isWritingManifest) {
        this.type = this.options.type || 'core';
        this.tag = this.options.tag;
        const root = await findRoot(this.options.name, this.options.root);
        if (!root)
            throw new Error(`could not find package.json with ${inspect(this.options)}`);
        this.root = root;
        this._debug('reading %s plugin %s', this.type, root);
        this.pjson = await loadJSON(path.join(root, 'package.json'));
        this.name = this.pjson.name;
        this.alias = this.options.name ?? this.pjson.name;
        const pjsonPath = path.join(root, 'package.json');
        if (!this.name)
            throw new Error(`no name in ${pjsonPath}`);
        if (!isProd() && !this.pjson.files)
            this.warn(`files attribute must be specified in ${pjsonPath}`);
        // eslint-disable-next-line new-cap
        this._debug = Debug(this.name);
        this.version = this.pjson.version;
        if (this.pjson.oclif) {
            this.valid = true;
        }
        else {
            this.pjson.oclif = this.pjson['cli-engine'] || {};
        }
        this.hooks = mapValues(this.pjson.oclif.hooks || {}, i => Array.isArray(i) ? i : [i]);
        this.manifest = await this._manifest(Boolean(this.options.ignoreManifest), Boolean(this.options.errorOnManifestCreate), isWritingManifest);
        this.commands = Object
            .entries(this.manifest.commands)
            .map(([id, c]) => ({
            ...c,
            pluginAlias: this.alias,
            pluginType: c.pluginType === 'jit' ? 'jit' : this.type,
            load: async () => this.findCommand(id, { must: true }),
        }))
            .sort((a, b) => a.id.localeCompare(b.id));
    }
    get topics() {
        return topicsToArray(this.pjson.oclif.topics || {});
    }
    get commandsDir() {
        if (this._commandsDir)
            return this._commandsDir;
        this._commandsDir = tsPath(this.root, this.pjson.oclif.commands, this.type);
        return this._commandsDir;
    }
    get commandIDs() {
        if (!this.commandsDir)
            return [];
        const marker = Performance.mark(`plugin.commandIDs#${this.name}`, { plugin: this.name });
        this._debug(`loading IDs from ${this.commandsDir}`);
        const patterns = [
            '**/*.+(js|cjs|mjs|ts|tsx)',
            '!**/*.+(d.ts|test.ts|test.js|spec.ts|spec.js)?(x)',
        ];
        const ids = globby.sync(patterns, { cwd: this.commandsDir })
            .map(file => {
            const p = path.parse(file);
            const topics = p.dir.split('/');
            const command = p.name !== 'index' && p.name;
            const id = [...topics, command].filter(f => f).join(':');
            return id === '' ? '.' : id;
        });
        this._debug('found commands', ids);
        marker?.addDetails({ count: ids.length });
        marker?.stop();
        return ids;
    }
    async findCommand(id, opts = {}) {
        const marker = Performance.mark(`plugin.findCommand#${this.name}.${id}`, { id, plugin: this.name });
        const fetch = async () => {
            if (!this.commandsDir)
                return;
            const search = (cmd) => {
                if (typeof cmd.run === 'function')
                    return cmd;
                if (cmd.default && cmd.default.run)
                    return cmd.default;
                return Object.values(cmd).find((cmd) => typeof cmd.run === 'function');
            };
            let m;
            try {
                const p = path.join(this.commandsDir ?? this.pjson.oclif.commands, ...id.split(':'));
                const { isESM, module, filePath } = await ModuleLoader.loadWithData(this, p);
                this._debug(isESM ? '(import)' : '(require)', filePath);
                m = module;
            }
            catch (error) {
                if (!opts.must && error.code === 'MODULE_NOT_FOUND')
                    return;
                throw error;
            }
            const cmd = search(m);
            if (!cmd)
                return;
            cmd.id = id;
            cmd.plugin = this;
            return cmd;
        };
        const cmd = await fetch();
        if (!cmd && opts.must)
            error(`command ${id} not found`);
        marker?.stop();
        return cmd;
    }
    async _manifest(ignoreManifest, errorOnManifestCreate = false, isWritingManifest = false) {
        const readManifest = async (dotfile = false) => {
            try {
                const p = path.join(this.root, `${dotfile ? '.' : ''}oclif.manifest.json`);
                const manifest = await loadJSON(p);
                if (!process.env.OCLIF_NEXT_VERSION && manifest.version.split('-')[0] !== this.version.split('-')[0]) {
                    process.emitWarning(`Mismatched version in ${this.name} plugin manifest. Expected: ${this.version} Received: ${manifest.version}\nThis usually means you have an oclif.manifest.json file that should be deleted in development. This file should be automatically generated when publishing.`);
                }
                else {
                    this._debug('using manifest from', p);
                    this.hasManifest = true;
                    return manifest;
                }
            }
            catch (error) {
                if (error.code === 'ENOENT') {
                    if (!dotfile)
                        return readManifest(true);
                }
                else {
                    this.warn(error, 'readManifest');
                }
            }
        };
        const marker = Performance.mark(`plugin.manifest#${this.name}`, { plugin: this.name });
        if (!ignoreManifest) {
            const manifest = await readManifest();
            if (manifest) {
                marker?.addDetails({ fromCache: true, commandCount: Object.keys(manifest.commands).length });
                marker?.stop();
                return manifest;
            }
        }
        const manifest = {
            version: this.version,
            commands: (await Promise.all(this.commandIDs.map(async (id) => {
                try {
                    return [id, await toCached(await this.findCommand(id, { must: true }), this, isWritingManifest)];
                }
                catch (error) {
                    const scope = 'toCached';
                    if (Boolean(errorOnManifestCreate) === false)
                        this.warn(error, scope);
                    else
                        throw this.addErrorScope(error, scope);
                }
            })))
                .filter((f) => Boolean(f))
                .reduce((commands, [id, c]) => {
                commands[id] = c;
                return commands;
            }, {}),
        };
        marker?.addDetails({ fromCache: false, commandCount: Object.keys(manifest.commands).length });
        marker?.stop();
        return manifest;
    }
    warn(err, scope) {
        if (this.warned)
            return;
        if (typeof err === 'string')
            err = new Error(err);
        process.emitWarning(this.addErrorScope(err, scope));
    }
    addErrorScope(err, scope) {
        err.name = `${err.name} Plugin: ${this.name}`;
        err.detail = compact([err.detail, `module: ${this._base}`, scope && `task: ${scope}`, `plugin: ${this.name}`, `root: ${this.root}`, 'See more details with DEBUG=*']).join('\n');
        return err;
    }
}
