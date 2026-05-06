import type { ComposerConfig } from './types.js';
export declare function install(agents?: string[], config?: ComposerConfig, dynamic?: boolean): Promise<Array<{
    agent: string;
    path: string;
    action: string;
}>>;
export declare function uninstall(agents?: string[]): Promise<Array<{
    agent: string;
    action: string;
}>>;
