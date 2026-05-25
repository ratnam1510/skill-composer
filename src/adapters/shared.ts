import { extractKeywords } from '../utils.js';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  design: ['design', 'layout', 'style', 'css', 'ui', 'ux', 'component', 'visual'],
  performance: ['performance', 'optimize', 'speed', 'cache', 'lazy', 'bundle', 'fast'],
  quality: ['lint', 'format', 'refactor', 'clean', 'code-review', 'review', 'quality'],
  testing: ['test', 'spec', 'coverage', 'assert', 'mock', 'fixture', 'e2e', 'unit'],
  security: ['security', 'auth', 'encrypt', 'token', 'permission', 'vulnerability', 'sanitize'],
  documentation: ['docs', 'readme', 'comment', 'jsdoc', 'documentation', 'guide', 'tutorial'],
};

export function inferCategories(keywords: string[]): string[] {
  const categories: Set<string> = new Set();
  for (const [category, categoryWords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => categoryWords.includes(kw))) {
      categories.add(category);
    }
  }
  return [...categories];
}

export function inferInputsOutputs(text: string): { inputs: string[]; outputs: string[] } {
  const inputs: string[] = [];
  const outputs: string[] = [];

  if (/\bfile\b/i.test(text) || /\bsource\b/i.test(text)) inputs.push('files');
  if (/\bconfig/i.test(text)) inputs.push('configuration');
  if (/\bprompt/i.test(text) || /\bquery/i.test(text) || /\binstruction/i.test(text)) inputs.push('prompt');
  if (/\bcodebase/i.test(text) || /\brepository/i.test(text)) inputs.push('codebase');

  if (/\bgenerat/i.test(text) || /\bcreate/i.test(text)) outputs.push('generated-files');
  if (/\breport/i.test(text) || /\banalysis/i.test(text)) outputs.push('report');
  if (/\bmodif/i.test(text) || /\bupdate/i.test(text) || /\bedit/i.test(text)) outputs.push('modified-files');
  if (/\blog/i.test(text) || /\boutput/i.test(text) || /\bexplain/i.test(text)) outputs.push('console-output');

  return { inputs, outputs };
}

export function extractNameFromContent(content: string, filePath?: string): string {
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  if (filePath) {
    const basename = filePath.split('/').pop() ?? 'untitled';
    return basename.replace(/\.\w+$/, '');
  }
  const firstLine = content.trim().split('\n')[0];
  return firstLine.slice(0, 60).trim() || 'untitled';
}

export function extractDescriptionFromContent(content: string): string {
  const lines = content.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed;
    }
  }
  return '';
}

export function extractChainsTo(frontmatter: Record<string, unknown>, content: string): string[] {
  if (Array.isArray(frontmatter.chains_to)) return frontmatter.chains_to as string[];
  if (Array.isArray(frontmatter.chainsTo)) return frontmatter.chainsTo as string[];
  if (typeof frontmatter.chain === 'string') return (frontmatter.chain as string).split(',').map(s => s.trim());

  const chainMatch = content.match(/(?:^|\n)\s*(?:chains?[_-]?to|then[_-]?run|followed[_-]?by|next[_-]?skill)\s*:\s*\/?([\w-]+(?:\s*,\s*\/?[\w-]+)*)/i);
  if (chainMatch) {
    return chainMatch[1].split(',').map(s => s.trim().replace(/^\//, ''));
  }

  return [];
}

export { extractKeywords };
