import type { AgentType, ComposerConfig } from './types.js';
interface AgentTarget {
    agent: AgentType;
    skillDir: string;
    folderName: string;
    rootDir: string;
}
export declare function detectInstalledAgents(config?: ComposerConfig): AgentTarget[];
export declare function install(agents?: string[], config?: ComposerConfig, dynamic?: boolean): Promise<Array<{
    agent: string;
    path: string;
    action: string;
}>>;
export declare function uninstall(agents?: string[], config?: ComposerConfig): Promise<Array<{
    agent: string;
    action: string;
}>>;
export {};
