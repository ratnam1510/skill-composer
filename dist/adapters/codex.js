import matter from 'gray-matter';
import { estimateTokens, extractKeywords, slugify } from '../utils.js';
const CATEGORY_KEYWORDS = {
    design: ['design', 'layout', 'style', 'css', 'ui', 'ux', 'component'],
    performance: ['performance', 'optimize', 'speed', 'cache', 'bundle', 'fast'],
    quality: ['lint', 'format', 'refactor', 'clean', 'review', 'quality'],
    testing: ['test', 'spec', 'coverage', 'assert', 'mock', 'e2e', 'unit'],
    security: ['security', 'auth', 'encrypt', 'token', 'permission', 'sanitize'],
    documentation: ['docs', 'readme', 'comment', 'documentation', 'guide'],
};
function inferCategories(keywords) {
    const categories = new Set();
    for (const [category, categoryWords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => categoryWords.includes(kw))) {
            categories.add(category);
        }
    }
    return [...categories];
}
function extractNameFromContent(content, filePath) {
    const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
    if (headingMatch)
        return headingMatch[1].trim();
    const basename = filePath.split('/').pop() ?? 'untitled';
    return basename.replace(/\.(md|txt)$/, '');
}
function extractDescriptionFromContent(content) {
    const lines = content.trim().split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
            return trimmed;
        }
    }
    return '';
}
function inferInputsOutputs(text) {
    const inputs = [];
    const outputs = [];
    if (/\bfile\b/i.test(text) || /\bsource\b/i.test(text))
        inputs.push('files');
    if (/\bconfig/i.test(text))
        inputs.push('configuration');
    if (/\bprompt/i.test(text) || /\binstruction/i.test(text))
        inputs.push('prompt');
    if (/\bgenerat/i.test(text) || /\bcreate/i.test(text))
        outputs.push('generated-files');
    if (/\bmodif/i.test(text) || /\bupdate/i.test(text))
        outputs.push('modified-files');
    if (/\bexplain/i.test(text) || /\boutput/i.test(text))
        outputs.push('console-output');
    return { inputs, outputs };
}
function extractChainsTo(frontmatter, content) {
    if (Array.isArray(frontmatter.chains_to))
        return frontmatter.chains_to;
    if (Array.isArray(frontmatter.chainsTo))
        return frontmatter.chainsTo;
    const chainMatch = content.match(/(?:chain|then run|followed by|next skill)[:\s]+\/?([\w-]+(?:\s*,\s*\/?[\w-]+)*)/i);
    if (chainMatch) {
        return chainMatch[1].split(',').map(s => s.trim().replace(/^\//, ''));
    }
    return [];
}
export const codexAdapter = {
    agent: 'codex',
    extensions: ['.md'],
    parse(file) {
        if (!file.content.trim())
            return null;
        let frontmatter = {};
        let content;
        try {
            const parsed = matter(file.content);
            frontmatter = parsed.data;
            content = parsed.content;
        }
        catch {
            content = file.content;
        }
        const name = frontmatter.name || extractNameFromContent(content, file.path);
        const description = frontmatter.description || extractDescriptionFromContent(content);
        const instructions = content.trim();
        if (!instructions)
            return null;
        const keywords = extractKeywords(`${name} ${description} ${instructions}`);
        const triggers = keywords.slice(0, 10).map((kw, i) => ({
            pattern: kw,
            weight: 1 - i * 0.05,
        }));
        const categories = frontmatter.categories ?? inferCategories(keywords);
        const { inputs, outputs } = inferInputsOutputs(instructions);
        const chainsTo = extractChainsTo(frontmatter, instructions);
        return {
            id: slugify(name),
            name,
            description,
            triggers,
            inputs: frontmatter.inputs ?? inputs,
            outputs: frontmatter.outputs ?? outputs,
            categories,
            instructions,
            chainsTo,
            source: { agent: 'codex', path: file.path, format: 'markdown' },
            tokenEstimate: estimateTokens(instructions),
        };
    },
};
//# sourceMappingURL=codex.js.map