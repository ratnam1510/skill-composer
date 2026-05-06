import type { Skill, ChainManifest, ComposerConfig } from './types.js';
export declare function discoverChains(skills: Skill[], config: ComposerConfig, catalogSkills?: Skill[]): ChainManifest;
export declare function generateManifest(manifest: ChainManifest): string;
