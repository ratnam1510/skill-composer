import type { Skill, SkillEdge, SkillGraph } from './types.js';
import { extractKeywords, jaccardSimilarity } from './utils.js';

export function buildGraph(skills: Skill[]): SkillGraph {
  const nodes = new Map<string, Skill>();
  for (const skill of skills) {
    nodes.set(skill.id, skill);
  }

  const edges: SkillEdge[] = [];

  for (const a of skills) {
    for (const b of skills) {
      if (a.id === b.id) continue;
      if (a.source.agent === b.source.agent && a.name === b.name) continue;

      let totalWeight = 0;
      const reasons: string[] = [];

      const categorySim = jaccardSimilarity(a.categories, b.categories);
      if (categorySim > 0) {
        totalWeight += categorySim * 0.4;
        reasons.push(`category overlap (${categorySim.toFixed(2)})`);
      }

      const outputInputOverlap = a.outputs.filter(o =>
        b.inputs.some(i => i.toLowerCase() === o.toLowerCase())
      );
      if (outputInputOverlap.length > 0) {
        totalWeight += 0.6;
        reasons.push(`output→input match: ${outputInputOverlap.join(', ')}`);
      }

      const triggerKeywordsA = a.triggers.map(t => t.pattern.toLowerCase());
      const triggerKeywordsB = b.triggers.map(t => t.pattern.toLowerCase());
      const triggerSim = jaccardSimilarity(triggerKeywordsA, triggerKeywordsB);
      if (triggerSim > 0) {
        totalWeight += triggerSim * 0.3;
        reasons.push(`trigger similarity (${triggerSim.toFixed(2)})`);
      }

      const descKeywordsA = extractKeywords(a.description);
      const descKeywordsB = extractKeywords(b.description);
      const descSim = jaccardSimilarity(descKeywordsA, descKeywordsB);
      if (descSim > 0) {
        totalWeight += descSim * 0.2;
        reasons.push(`description similarity (${descSim.toFixed(2)})`);
      }

      const hasStrongSignal =
        outputInputOverlap.length > 0 ||
        triggerSim >= 0.35 ||
        descSim >= 0.25;

      if (totalWeight > 0.55 && hasStrongSignal) {
        edges.push({
          from: a.id,
          to: b.id,
          weight: totalWeight,
          reason: reasons.join('; '),
        });
      }
    }
  }

  return { nodes, edges };
}

export function findChains(graph: SkillGraph, maxLength: number): string[][] {
  const outgoing = new Map<string, SkillEdge[]>();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from)!.push(edge);
  }

  for (const [, edgeList] of outgoing) {
    edgeList.sort((a, b) => b.weight - a.weight);
  }

  const components = getConnectedComponents(graph);

  const chains: Array<{ chain: string[]; weight: number }> = [];
  const seenChainSets = new Set<string>();

  for (const component of components) {
    if (component.length < 2) continue;

    const componentSet = new Set(component);
    const componentEdges = graph.edges.filter(
      e => componentSet.has(e.from) && componentSet.has(e.to)
    );

    if (componentEdges.length === 0) continue;

    const inDegree = new Map<string, number>();
    for (const id of component) inDegree.set(id, 0);
    for (const e of componentEdges) {
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }

    const startCandidates = [...inDegree.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([id]) => id);

    for (const start of startCandidates) {
      dfs(
        [start],
        new Set([start]),
        0,
        maxLength,
        outgoing,
        componentSet,
        chains,
        seenChainSets,
      );
    }
  }

  chains.sort((a, b) => b.weight - a.weight);

  const topChains: string[][] = [];
  const usedSkills = new Set<string>();
  for (const { chain } of chains) {
    const allNew = chain.some(id => !usedSkills.has(id));
    if (!allNew) continue;
    topChains.push(chain);
    for (const id of chain) usedSkills.add(id);
    if (topChains.length >= 20) break;
  }

  return topChains;
}

function dfs(
  path: string[],
  visited: Set<string>,
  totalWeight: number,
  maxLength: number,
  outgoing: Map<string, SkillEdge[]>,
  scope: Set<string>,
  results: Array<{ chain: string[]; weight: number }>,
  seenSets: Set<string>,
): void {
  if (path.length >= 2) {
    const key = [...path].sort().join('|');
    if (!seenSets.has(key)) {
      seenSets.add(key);
      results.push({ chain: [...path], weight: totalWeight });
    }
  }
  if (path.length >= maxLength) return;

  const current = path[path.length - 1];
  const neighbors = (outgoing.get(current) ?? []).slice(0, 5);

  for (const edge of neighbors) {
    if (visited.has(edge.to)) continue;
    if (!scope.has(edge.to)) continue;
    visited.add(edge.to);
    path.push(edge.to);
    dfs(path, visited, totalWeight + edge.weight, maxLength, outgoing, scope, results, seenSets);
    path.pop();
    visited.delete(edge.to);
  }
}

export function getConnectedComponents(graph: SkillGraph): string[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const id of graph.nodes.keys()) {
    adjacency.set(id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of graph.nodes.keys()) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }
    components.push(component);
  }

  return components;
}
