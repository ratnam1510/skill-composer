export type KnownAgent = 'claude-code' | 'codex' | 'cursor' | 'windsurf' | 'amp' | 'gemini' | 'cline' | 'continue' | 'aider' | 'roo' | 'qwen' | 'copilot' | 'generic';
export type AgentType = KnownAgent | (string & {});
export type SkillAvailability = 'loaded' | 'discoverable' | 'referenced';
export interface SkillSource {
    agent: AgentType;
    path: string;
    format: 'markdown' | 'json' | 'yaml';
}
export interface TriggerPattern {
    pattern: string;
    weight: number;
}
export interface Skill {
    id: string;
    name: string;
    description: string;
    triggers: TriggerPattern[];
    inputs: string[];
    outputs: string[];
    categories: string[];
    instructions: string;
    chainsTo: string[];
    source: SkillSource;
    tokenEstimate: number;
    availability?: SkillAvailability;
    installHint?: string;
}
export interface SkillEdge {
    from: string;
    to: string;
    weight: number;
    reason: string;
}
export interface SkillGraph {
    nodes: Map<string, Skill>;
    edges: SkillEdge[];
}
export interface ChainDefinition {
    name: string;
    description: string;
    skills: string[];
    triggerHint: string;
    source: 'declared' | 'auto-detected' | 'manual';
    missingSkills?: string[];
}
export interface ChainManifest {
    chains: ChainDefinition[];
    generatedAt: string;
    totalSkills: number;
    totalLoadedSkills: number;
    totalDiscoverableSkills: number;
    referencedSkills: string[];
    totalChains: number;
}
export interface AgentConfig {
    skillDirs: string[];
    outputDir: string;
    configFile: string;
    format: 'markdown' | 'json' | 'yaml';
}
export interface ComposerConfig {
    agents: Record<string, AgentConfig>;
    catalogDirs?: string[];
    catalogFiles?: string[];
    remoteCacheDir?: string;
    remoteCacheTtlHours?: number;
    chains?: Record<string, string[]>;
    exclude?: string[];
    maxChainLength?: number;
}
export interface SkillFile {
    path: string;
    content: string;
    agent: AgentType;
}
export interface ScanResult {
    files: SkillFile[];
    errors: Array<{
        path: string;
        error: string;
    }>;
}
export interface SkillAdapter {
    agent: AgentType;
    extensions: string[];
    parse(file: SkillFile): Skill | null;
}
