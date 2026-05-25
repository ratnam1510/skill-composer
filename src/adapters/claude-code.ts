import matter from 'gray-matter';
import { estimateTokens, slugify } from '../utils.js';
import type { Skill, SkillAdapter, SkillFile } from '../types.js';
import {
  inferCategories,
  inferInputsOutputs,
  extractNameFromContent,
  extractDescriptionFromContent,
  extractChainsTo,
  extractKeywords,
} from './shared.js';

export const claudeCodeAdapter: SkillAdapter = {
  agent: 'claude-code',
  extensions: ['.md'],

  parse(file: SkillFile): Skill | null {
    if (!file.content.trim()) return null;

    let frontmatter: Record<string, unknown> = {};
    let content: string;
    try {
      const parsed = matter(file.content);
      frontmatter = parsed.data;
      content = parsed.content;
    } catch {
      content = file.content;
    }

    const name = (frontmatter.name as string) || extractNameFromContent(content);
    const description =
      (frontmatter.description as string) || extractDescriptionFromContent(content);
    const instructions = content.trim();

    if (!instructions) return null;

    const keywords = extractKeywords(`${name} ${description} ${instructions}`);
    const triggers = keywords.slice(0, 10).map((kw, i) => ({
      pattern: kw,
      weight: 1 - i * 0.05,
    }));

    const categories =
      (frontmatter.categories as string[]) ?? inferCategories(keywords);
    const { inputs, outputs } = inferInputsOutputs(instructions);

    const chainsTo = extractChainsTo(frontmatter, instructions);

    return {
      id: slugify(name),
      name,
      description,
      triggers,
      inputs: (frontmatter.inputs as string[]) ?? inputs,
      outputs: (frontmatter.outputs as string[]) ?? outputs,
      categories,
      instructions,
      chainsTo,
      source: { agent: 'claude-code', path: file.path, format: 'markdown' },
      tokenEstimate: estimateTokens(instructions),
    };
  },
};
