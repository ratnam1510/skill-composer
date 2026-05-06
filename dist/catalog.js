import { existsSync, readFileSync } from 'fs';
import fg from 'fast-glob';
import { parseSkillFiles } from './parser.js';
import { expandPath, extractKeywords, slugify } from './utils.js';
const DEFAULT_CATALOG_DIRS = [
    '~/.agents/skills',
    '~/.codex/skills',
    '~/.codex/skills/.system',
    '~/.claude/skills',
    '~/.cursor/skills',
    '~/.windsurf/skills',
];
function normalizeName(name) {
    return slugify(name).toLowerCase();
}
function skillKey(skill) {
    return normalizeName(skill.name || skill.id);
}
function inferAgentFromPath(path) {
    const normalized = path.replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('/.codex/'))
        return 'codex';
    if (normalized.includes('/.claude/'))
        return 'claude-code';
    if (normalized.includes('/.cursor/'))
        return 'cursor';
    if (normalized.includes('/.windsurf/'))
        return 'windsurf';
    return 'generic';
}
function catalogDirs(config) {
    const configured = config.catalogDirs ?? [];
    const scanDirs = Object.values(config.agents).flatMap(agent => agent.skillDirs);
    return [...new Set([...configured, ...scanDirs, ...DEFAULT_CATALOG_DIRS])];
}
function loadedLookups(loadedSkills) {
    return {
        names: new Set(loadedSkills.map(skillKey)),
        paths: new Set(loadedSkills.map(s => s.source.path)),
    };
}
function dedupeByName(skills) {
    const byName = new Map();
    for (const skill of skills) {
        const key = skillKey(skill);
        const existing = byName.get(key);
        if (!existing || skill.description.length > existing.description.length) {
            byName.set(key, skill);
        }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export async function discoverSkillCatalog(config, loadedSkills) {
    const { names, paths } = loadedLookups(loadedSkills);
    const files = [];
    const errors = [];
    for (const dir of catalogDirs(config)) {
        const resolved = expandPath(dir);
        if (!existsSync(resolved))
            continue;
        try {
            const matches = await fg(['**/SKILL.md'], {
                cwd: resolved,
                absolute: true,
                onlyFiles: true,
                dot: true,
                ignore: config.exclude ?? [],
            });
            for (const match of matches) {
                if (paths.has(match))
                    continue;
                try {
                    files.push({
                        path: match,
                        content: readFileSync(match, 'utf-8'),
                        agent: inferAgentFromPath(match),
                    });
                }
                catch (err) {
                    errors.push({
                        path: match,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }
        catch (err) {
            errors.push({
                path: resolved,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    const parsed = parseSkillFiles({ files, errors });
    for (const skill of parsed) {
        skill.availability = 'discoverable';
        skill.installHint = `Local skill file: ${skill.source.path}`;
    }
    return dedupeByName(parsed.filter(skill => !names.has(skillKey(skill))));
}
export function makeReferencedSkill(name, category) {
    const normalized = slugify(name);
    const categories = category ? [category] : [];
    return {
        id: `referenced--${normalized}`,
        name,
        description: `Referenced by a configured chain, but not found in the loaded skill set or local catalog.`,
        triggers: extractKeywords(name).map((pattern, index) => ({
            pattern,
            weight: 1 - index * 0.05,
        })),
        inputs: [],
        outputs: [],
        categories,
        instructions: '',
        chainsTo: [],
        source: { agent: 'generic', path: `referenced:${name}`, format: 'markdown' },
        tokenEstimate: 0,
        availability: 'referenced',
        installHint: `Search for this skill with find-skills or npx skills find ${name}`,
    };
}
export function rankSkillsForQuery(skills, query, limit = 20) {
    const terms = extractKeywords(query);
    if (terms.length === 0)
        return skills.slice(0, limit);
    const scored = skills.map(skill => {
        const name = skill.name.toLowerCase();
        const haystack = `${skill.name} ${skill.description} ${skill.categories.join(' ')} ${skill.triggers.map(t => t.pattern).join(' ')}`.toLowerCase();
        let score = 0;
        for (const term of terms) {
            if (name === term)
                score += 12;
            if (name.includes(term))
                score += 6;
            if (haystack.includes(term))
                score += 2;
        }
        if (skill.availability === 'loaded')
            score += 2;
        if (skill.availability === 'discoverable')
            score += 1;
        return { skill, score };
    });
    return scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
        .slice(0, limit)
        .map(item => item.skill);
}
//# sourceMappingURL=catalog.js.map