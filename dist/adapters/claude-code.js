import matter from 'gray-matter';
import { estimateTokens, slugify } from '../utils.js';
import { inferCategories, inferInputsOutputs, extractNameFromContent, extractDescriptionFromContent, extractChainsTo, extractKeywords, } from './shared.js';
export const claudeCodeAdapter = {
    agent: 'claude-code',
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
        const name = frontmatter.name || extractNameFromContent(content);
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
            source: { agent: 'claude-code', path: file.path, format: 'markdown' },
            tokenEstimate: estimateTokens(instructions),
        };
    },
};
//# sourceMappingURL=claude-code.js.map