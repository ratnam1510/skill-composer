import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { expandPath } from './utils.js';
import { scanSkills } from './scanner.js';
import { parseSkillFiles } from './parser.js';
import { discoverChains } from './router.js';
import { discoverSkillCatalog } from './catalog.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
/**
 * Built-in registry of known AI coding agents that follow a `~/.<agent>/skills`
 * convention. Each entry is auto-detected at install time: skill-composer only
 * installs into agents whose root directory exists on disk.
 *
 * To add a custom agent, declare it under `agents.<name>` in composer.config.json
 * with at least a `skillDirs` array — the first entry will be used as the install
 * target and the agent will be auto-detected like the built-ins.
 */
const KNOWN_AGENTS = [
    { agent: 'claude-code', rootDir: '~/.claude', skillDir: '~/.claude/skills', folderName: 'skill-composer' },
    { agent: 'codex', rootDir: '~/.codex', skillDir: '~/.codex/skills', folderName: 'skill-composer' },
    { agent: 'cursor', rootDir: '~/.cursor', skillDir: '~/.cursor/skills', folderName: 'skill-composer' },
    { agent: 'windsurf', rootDir: '~/.windsurf', skillDir: '~/.windsurf/skills', folderName: 'skill-composer' },
    { agent: 'amp', rootDir: '~/.amp', skillDir: '~/.amp/skills', folderName: 'skill-composer' },
    { agent: 'gemini', rootDir: '~/.gemini', skillDir: '~/.gemini/skills', folderName: 'skill-composer' },
    { agent: 'cline', rootDir: '~/.cline', skillDir: '~/.cline/skills', folderName: 'skill-composer' },
    { agent: 'continue', rootDir: '~/.continue', skillDir: '~/.continue/skills', folderName: 'skill-composer' },
    { agent: 'aider', rootDir: '~/.aider', skillDir: '~/.aider/skills', folderName: 'skill-composer' },
    { agent: 'roo', rootDir: '~/.roo', skillDir: '~/.roo/skills', folderName: 'skill-composer' },
    { agent: 'qwen', rootDir: '~/.qwen', skillDir: '~/.qwen/skills', folderName: 'skill-composer' },
    { agent: 'copilot', rootDir: '~/.copilot', skillDir: '~/.copilot/skills', folderName: 'skill-composer' },
];
function buildTargetRegistry(config) {
    const byAgent = new Map();
    for (const t of KNOWN_AGENTS)
        byAgent.set(t.agent, t);
    if (config?.agents) {
        for (const [agent, cfg] of Object.entries(config.agents)) {
            if (agent === 'generic')
                continue;
            const skillDir = cfg.skillDirs?.[0];
            if (!skillDir)
                continue;
            const rootDir = skillDir.replace(/\/skills(\/.*)?$/, '');
            if (!byAgent.has(agent)) {
                byAgent.set(agent, { agent, rootDir, skillDir, folderName: 'skill-composer' });
            }
        }
    }
    return [...byAgent.values()];
}
export function detectInstalledAgents(config) {
    return buildTargetRegistry(config).filter(t => existsSync(expandPath(t.rootDir)));
}
function getTemplatePath() {
    const candidates = [
        resolve(__dirname, '..', 'templates', 'SKILL.md'),
        resolve(__dirname, '..', '..', 'templates', 'SKILL.md'),
    ];
    for (const c of candidates) {
        if (existsSync(c))
            return c;
    }
    throw new Error(`SKILL.md template not found. Searched:\n${candidates.join('\n')}`);
}
function generateDynamicSkill(baseTemplate, skills, catalogSkills, chains) {
    if (chains.length === 0 && skills.length === 0 && catalogSkills.length === 0)
        return baseTemplate;
    const skillIndex = skills
        .map(s => `- **${s.name}** — ${s.description || s.categories.join(', ') || 'general'}`)
        .slice(0, 60)
        .join('\n');
    const discoverableIndex = catalogSkills
        .map(s => `- **${s.name}** — ${s.description || s.categories.join(', ') || 'general'}${s.installHint ? ` (${s.installHint})` : ''}`)
        .slice(0, 80)
        .join('\n');
    const customChains = chains
        .filter(c => c.source === 'declared')
        .map(c => `### ${c.name}\n\`${c.skills.map(s => `/${s}`).join('` → `')}\``)
        .join('\n\n');
    const targetAwareChains = chains
        .filter(c => c.source === 'manual')
        .map(c => {
        const missing = new Set((c.missingSkills ?? []).map(s => s.toLowerCase()));
        const steps = c.skills
            .map(skill => missing.has(skill.toLowerCase()) ? `\`/${skill}\` _(discover first)_` : `\`/${skill}\``)
            .join(' → ');
        return `### ${c.name}\n${steps}`;
    })
        .join('\n\n');
    let result = baseTemplate;
    if (targetAwareChains) {
        result = result.replace('## Chain Selection', `## Target-Aware Chain Map\n\nUse this generated map before the generic examples below. Steps marked _(discover first)_ are catalogued or configured but not confirmed loaded for this agent; find or install them before invoking.\n\n${targetAwareChains}\n\n## Chain Selection`);
    }
    if (customChains) {
        result = result.replace('## Dynamic Chaining', `## Skill-Declared Chains\n\n${customChains}\n\n## Dynamic Chaining`);
    }
    if (discoverableIndex) {
        result = result.replace('## Dynamic Chaining', `## Local And Remote Discovery\n\nIf no loaded skill fits the user's request, check the Discoverable Skills Index and remote cache before giving up. Discoverable skills are installed on disk or configured in a local catalog but may not be loaded in the current agent context.\n\n- Do not claim you used a discoverable or remote skill unless it is actually loaded, installed, fetched into cache, or its \`SKILL.md\` has been read.\n- If a discoverable skill is the right fit, load it through the agent's normal skill workflow, or read its \`SKILL.md\` directly when the environment allows it.\n- Before network search, run \`skill-composer remote search <query>\` when available and use a fresh matching cache entry immediately.\n- If local and cached candidates are weak, search skills.sh with \`/find-skills\`, \`npx skills find <query>\`, or browser search/opening when available.\n- If a skills.sh result is the best fit, run \`skill-composer remote fetch <url>\` when available, or read its skill page/repository \`SKILL.md\` for same-turn use. Install only through the normal command/approval flow when future automatic loading is needed.\n- If the user provides a skills.sh URL like \`https://skills.sh/<owner>/<repo>/<skill>\`, resolve it to \`npx skills add https://github.com/<owner>/<repo> --skill <skill>\`.\n\n## Dynamic Chaining`);
    }
    result = result.replace('## When NOT to Chain', `## Installed Skills Index\n\n${skillIndex || '- No loaded skills found.'}\n\n${discoverableIndex ? `## Discoverable Skills Index\n\n${discoverableIndex}\n\n` : ''}## When NOT to Chain`);
    return result;
}
async function generateContentForAgent(template, targetAgent, config, dynamic = true) {
    if (!dynamic || !config || !(targetAgent in config.agents))
        return template;
    const targetConfig = {
        ...config,
        agents: { [targetAgent]: config.agents[targetAgent] },
    };
    const scanResult = await scanSkills(targetConfig);
    const skills = parseSkillFiles(scanResult);
    const catalogSkills = await discoverSkillCatalog(config, skills);
    const manifest = discoverChains(skills, config, catalogSkills);
    return generateDynamicSkill(template, skills, catalogSkills, manifest.chains);
}
export async function install(agents, config, dynamic = true) {
    const results = [];
    let template;
    try {
        template = readFileSync(getTemplatePath(), 'utf-8');
    }
    catch (err) {
        throw new Error(`Cannot read template: ${err}`);
    }
    const registry = buildTargetRegistry(config);
    const targets = agents ? registry.filter(t => agents.includes(t.agent)) : registry;
    for (const target of targets) {
        const dir = expandPath(join(target.skillDir, target.folderName));
        try {
            const rootDir = expandPath(target.rootDir);
            if (!existsSync(rootDir)) {
                results.push({ agent: target.agent, path: dir, action: 'skipped (agent not installed)' });
                continue;
            }
            mkdirSync(dir, { recursive: true });
            const filePath = join(dir, 'SKILL.md');
            const existed = existsSync(filePath);
            let finalContent = template;
            try {
                finalContent = await generateContentForAgent(template, target.agent, config, dynamic);
            }
            catch {
                finalContent = template;
            }
            writeFileSync(filePath, finalContent, 'utf-8');
            results.push({
                agent: target.agent,
                path: filePath,
                action: existed ? 'updated' : 'installed',
            });
        }
        catch (err) {
            results.push({
                agent: target.agent,
                path: dir,
                action: `failed: ${err instanceof Error ? err.message : err}`,
            });
        }
    }
    return results;
}
export async function uninstall(agents, config) {
    const results = [];
    const registry = buildTargetRegistry(config);
    const targets = agents ? registry.filter(t => agents.includes(t.agent)) : registry;
    for (const target of targets) {
        const dir = expandPath(join(target.skillDir, target.folderName));
        const filePath = join(dir, 'SKILL.md');
        if (existsSync(filePath)) {
            const { rmSync } = await import('fs');
            rmSync(dir, { recursive: true });
            results.push({ agent: target.agent, action: 'removed' });
        }
        else {
            results.push({ agent: target.agent, action: 'not installed' });
        }
    }
    return results;
}
//# sourceMappingURL=installer.js.map