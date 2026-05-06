import type { ComposerConfig, Skill } from './types.js';
export declare function discoverSkillCatalog(config: ComposerConfig, loadedSkills: Skill[]): Promise<Skill[]>;
export declare function makeReferencedSkill(name: string, category?: string): Skill;
export declare function rankSkillsForQuery(skills: Skill[], query: string, limit?: number): Skill[];
