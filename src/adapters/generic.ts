import matter from 'gray-matter';
import { estimateTokens, extractKeywords, slugify } from '../utils.js';
import type { Skill, SkillAdapter, SkillFile } from '../types.js';

function extractNameFromContent(content: string, filePath: string): string {
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const basename = filePath.split('/').pop() ?? 'untitled';
  return basename.replace(/\.\w+$/, '');
}

function extractDescriptionFromContent(content: string): string {
  const lines = content.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed;
    }
  }
  return '';
}

function extractChainsTo(frontmatter: Record<string, unknown>, content: string): string[] {
  if (Array.isArray(frontmatter.chains_to)) return frontmatter.chains_to as string[];
  if (Array.isArray(frontmatter.chainsTo)) return frontmatter.chainsTo as string[];

  const chainMatch = content.match(/(?:^|\n)\s*(?:chains?[_-]?to|then[_-]?run|followed[_-]?by|next[_-]?skill)\s*:\s*\/?([\w-]+(?:\s*,\s*\/?[\w-]+)*)/i);
  if (chainMatch) {
    return chainMatch[1].split(',').map(s => s.trim().replace(/^\//, ''));
  }
  return [];
}

export const genericAdapter: SkillAdapter = {
  agent: 'generic',
  extensions: ['.md', '.txt'],

  parse(file: SkillFile): Skill | null {
    if (!file.content.trim()) return null;

    let frontmatter: Record<string, unknown> = {};
    let content = file.content;

    try {
      const parsed = matter(file.content);
      frontmatter = parsed.data;
      content = parsed.content;
    } catch {
      content = file.content;
    }

    const name =
      (frontmatter.name as string) || extractNameFromContent(content, file.path);
    const description =
      (frontmatter.description as string) || extractDescriptionFromContent(content);
    const instructions = content.trim();

    if (!instructions) return null;

    const keywords = extractKeywords(`${name} ${description}`);
    const triggers = keywords.slice(0, 8).map((kw, i) => ({
      pattern: kw,
      weight: 1 - i * 0.05,
    }));

    const chainsTo = extractChainsTo(frontmatter, instructions);

    return {
      id: slugify(name),
      name,
      description,
      triggers,
      inputs: (frontmatter.inputs as string[]) ?? [],
      outputs: (frontmatter.outputs as string[]) ?? [],
      categories: (frontmatter.categories as string[]) ?? [],
      instructions,
      chainsTo,
      source: { agent: file.agent, path: file.path, format: 'markdown' },
      tokenEstimate: estimateTokens(instructions),
    };
  },
};
