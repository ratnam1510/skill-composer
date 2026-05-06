import type { AgentType, ScanResult, Skill, SkillAdapter } from './types.js';
export declare function getAdapter(agent: AgentType): SkillAdapter;
export declare function parseSkillFiles(scanResult: ScanResult): Skill[];
