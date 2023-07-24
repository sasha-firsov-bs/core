import { CLIError } from '../errors';
import { Plugin as IPlugin, PluginOptions } from '../interfaces/plugin';
import { Manifest } from '../interfaces/manifest';
import { PJSON } from '../interfaces/pjson';
import { Topic } from '../interfaces/topic';
import { Command } from '../command';
export declare class Plugin implements IPlugin {
    options: PluginOptions;
    _base: string;
    name: string;
    version: string;
    pjson: PJSON.Plugin;
    type: string;
    root: string;
    alias: string;
    tag?: string;
    manifest: Manifest;
    commands: Command.Loadable[];
    hooks: {
        [k: string]: string[];
    };
    valid: boolean;
    alreadyLoaded: boolean;
    parent: Plugin | undefined;
    children: Plugin[];
    hasManifest: boolean;
    private _commandsDir;
    protected _debug: (..._: any) => void;
    protected warned: boolean;
    constructor(options: PluginOptions);
    /**
     * Loads a plugin
     * @param isWritingManifest - if true, exclude selected data from manifest
     * default is false to maintain backwards compatibility
     * @returns Promise<void>
     */
    load(isWritingManifest?: boolean): Promise<void>;
    get topics(): Topic[];
    get commandsDir(): string | undefined;
    get commandIDs(): string[];
    findCommand(id: string, opts: {
        must: true;
    }): Promise<Command.Class>;
    findCommand(id: string, opts?: {
        must: boolean;
    }): Promise<Command.Class | undefined>;
    protected _manifest(ignoreManifest: boolean, errorOnManifestCreate?: boolean, isWritingManifest?: boolean): Promise<Manifest>;
    protected warn(err: string | Error | CLIError, scope?: string): void;
    private addErrorScope;
}
