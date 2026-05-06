import type { Skill, SkillGraph } from './types.js';
export declare function buildGraph(skills: Skill[]): SkillGraph;
export declare function findChains(graph: SkillGraph, maxLength: number): string[][];
export declare function getConnectedComponents(graph: SkillGraph): string[][];
