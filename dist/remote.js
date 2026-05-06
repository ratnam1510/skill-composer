import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import matter from 'gray-matter';
import { estimateTokens, expandPath, extractKeywords, slugify } from './utils.js';
const SKILLS_SH_RE = /^https:\/\/skills\.sh\/([^/]+)\/([^/]+)\/([^/?#]+)(?:[/?#].*)?$/i;
const DEFAULT_TTL_HOURS = 24 * 14;
export function parseRemoteSkillReference(reference) {
    const trimmed = reference.trim();
    const skillsMatch = trimmed.match(SKILLS_SH_RE);
    if (skillsMatch) {
        const [, owner, repo, skill] = skillsMatch;
        const repositoryUrl = `https://github.com/${owner}/${repo}`;
        return {
            name: skill,
            sourceUrl: trimmed,
            repositoryUrl,
            installCommand: `npx skills add ${repositoryUrl} --skill ${skill}`,
        };
    }
    return null;
}
export function getRemoteCacheDir(config, override) {
    if (override)
        return expandPath(override);
    if (config?.remoteCacheDir)
        return expandPath(config.remoteCacheDir);
    return resolve(homedir(), '.skill-composer', 'remote-skills');
}
function cacheId(ref) {
    return slugify(`${ref.repositoryUrl}-${ref.name}`) || Buffer.from(ref.sourceUrl).toString('base64url');
}
function cachePath(cacheDir, id) {
    return join(cacheDir, `${id}.json`);
}
function ttlMs(ttlHours = DEFAULT_TTL_HOURS) {
    return ttlHours * 60 * 60 * 1000;
}
function isFresh(entry) {
    return Date.parse(entry.expiresAt) > Date.now();
}
export function getCachedRemoteSkill(reference, config, options = {}) {
    const ref = parseRemoteSkillReference(reference);
    if (!ref)
        return null;
    const dir = getRemoteCacheDir(config, options.cacheDir);
    const file = cachePath(dir, cacheId(ref));
    if (!existsSync(file))
        return null;
    try {
        const entry = JSON.parse(readFileSync(file, 'utf-8'));
        return isFresh(entry) ? entry : null;
    }
    catch {
        return null;
    }
}
function rawSkillUrlCandidates(ref) {
    const match = ref.repositoryUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
    if (!match)
        return [];
    const [, owner, repo] = match;
    const encodedSkill = encodeURIComponent(ref.name);
    const base = `https://raw.githubusercontent.com/${owner}/${repo}`;
    return [
        `${base}/main/skills/${encodedSkill}/SKILL.md`,
        `${base}/main/${encodedSkill}/SKILL.md`,
        `${base}/master/skills/${encodedSkill}/SKILL.md`,
        `${base}/master/${encodedSkill}/SKILL.md`,
    ];
}
async function fetchText(url) {
    const response = await fetch(url, {
        headers: {
            'accept': 'text/markdown,text/plain,text/html;q=0.8,*/*;q=0.5',
            'user-agent': 'skill-composer',
        },
    });
    if (!response.ok)
        return null;
    return response.text();
}
function parseSkillContent(content, fallbackName) {
    const parsed = matter(content);
    const body = parsed.content.trim() || content.trim();
    const firstHeading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const title = String(parsed.data.name || firstHeading || fallbackName);
    const description = String(parsed.data.description || body.split('\n').find(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```');
    }) || '');
    return { title, description, body };
}
function extractSkillMarkdownFromHtml(html) {
    const headingIndex = html.indexOf('SKILL.md');
    if (headingIndex === -1)
        return null;
    const slice = html.slice(headingIndex);
    const text = slice
        .replace(/<script[\s\S]*?<\/script>/gi, '\n')
        .replace(/<style[\s\S]*?<\/style>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|h1|h2|h3|h4|li|pre|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text.length > 50 ? text : null;
}
export async function fetchRemoteSkill(reference, config, options = {}) {
    const ref = parseRemoteSkillReference(reference);
    if (!ref) {
        throw new Error('Unsupported remote skill reference. Expected: https://skills.sh/<owner>/<repo>/<skill>');
    }
    const cacheDir = getRemoteCacheDir(config, options.cacheDir);
    const ttlHours = options.ttlHours ?? config?.remoteCacheTtlHours ?? DEFAULT_TTL_HOURS;
    if (!options.refresh) {
        const cached = getCachedRemoteSkill(reference, config, options);
        if (cached)
            return { entry: cached, cacheHit: true };
    }
    let rawUrl = '';
    let content = null;
    for (const candidate of rawSkillUrlCandidates(ref)) {
        content = await fetchText(candidate);
        if (content) {
            rawUrl = candidate;
            break;
        }
    }
    if (!content) {
        const html = await fetchText(ref.sourceUrl);
        const markdown = html ? extractSkillMarkdownFromHtml(html) : null;
        if (markdown) {
            rawUrl = ref.sourceUrl;
            content = markdown;
        }
    }
    if (!content) {
        throw new Error(`Could not fetch SKILL.md for ${ref.sourceUrl}`);
    }
    const parsed = parseSkillContent(content, ref.name);
    const now = new Date();
    const entry = {
        ...ref,
        id: cacheId(ref),
        rawUrl,
        fetchedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs(ttlHours)).toISOString(),
        title: parsed.title,
        description: parsed.description,
        content: parsed.body,
        tokenEstimate: estimateTokens(parsed.body),
    };
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cachePath(cacheDir, entry.id), JSON.stringify(entry, null, 2), 'utf-8');
    return { entry, cacheHit: false };
}
export function listCachedRemoteSkills(config, options = {}) {
    const cacheDir = getRemoteCacheDir(config, options.cacheDir);
    if (!existsSync(cacheDir))
        return [];
    return readdirSync(cacheDir)
        .filter(file => file.endsWith('.json'))
        .flatMap(file => {
        try {
            return [JSON.parse(readFileSync(join(cacheDir, file), 'utf-8'))];
        }
        catch {
            return [];
        }
    })
        .sort((a, b) => a.name.localeCompare(b.name));
}
export function searchCachedRemoteSkills(query, config, options = {}) {
    const terms = extractKeywords(query);
    if (terms.length === 0)
        return listCachedRemoteSkills(config, options);
    return listCachedRemoteSkills(config, options)
        .map(entry => {
        const haystack = `${entry.name} ${entry.title} ${entry.description} ${entry.content.slice(0, 2000)}`.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { entry, score };
    })
        .filter(item => item.score > 0 && isFresh(item.entry))
        .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
        .map(item => item.entry);
}
export function clearRemoteSkillCache(config, options = {}) {
    const cacheDir = getRemoteCacheDir(config, options.cacheDir);
    if (!existsSync(cacheDir))
        return 0;
    let removed = 0;
    for (const file of readdirSync(cacheDir)) {
        if (!file.endsWith('.json'))
            continue;
        const filePath = join(cacheDir, file);
        if (options.expiredOnly) {
            try {
                const entry = JSON.parse(readFileSync(filePath, 'utf-8'));
                if (isFresh(entry))
                    continue;
            }
            catch {
                // Remove corrupt entries when cleaning expired cache.
            }
        }
        rmSync(filePath);
        removed += 1;
    }
    return removed;
}
//# sourceMappingURL=remote.js.map