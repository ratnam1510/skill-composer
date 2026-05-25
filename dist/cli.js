import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';
import { scanSkills } from './scanner.js';
import { parseSkillFiles } from './parser.js';
import { buildGraph } from './graph.js';
import { discoverChains } from './router.js';
import { install, uninstall, detectInstalledAgents } from './installer.js';
import { discoverSkillCatalog, rankSkillsForQuery } from './catalog.js';
import { clearRemoteSkillCache, fetchRemoteSkill, getRemoteCacheDir, listCachedRemoteSkills, parseRemoteSkillReference, searchCachedRemoteSkills, } from './remote.js';
function loadConfig(configPath) {
    const candidates = [];
    if (configPath) {
        candidates.push(resolve(configPath));
    }
    else {
        candidates.push(resolve(process.cwd(), 'composer.config.json'));
        candidates.push(join(homedir(), '.skill-composer', 'config.json'));
    }
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            const raw = readFileSync(candidate, 'utf-8');
            return JSON.parse(raw);
        }
    }
    return undefined;
}
function dedupeSkillsForDisplay(skills) {
    const byKey = new Map();
    for (const skill of skills) {
        const key = `${skill.source.agent}:${skill.name.toLowerCase()}`;
        const existing = byKey.get(key);
        if (!existing || (skill.tokenEstimate ?? 0) > (existing.tokenEstimate ?? 0)) {
            byKey.set(key, skill);
        }
    }
    return [...byKey.values()];
}
const program = new Command();
program
    .name('skill-composer')
    .description('Install once. Skills chain automatically.')
    .version('1.0.1')
    .option('-c, --config <path>', 'path to config file');
program
    .command('install')
    .description('Install skill-composer as a skill for all detected agents')
    .option('--agent <name>', 'install for specific agent only (claude-code, codex, cursor)')
    .option('--static', 'use static template without scanning installed skills')
    .action(async (opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const agents = opts.agent ? [opts.agent] : undefined;
    const dynamic = !opts.static;
    console.log('\nSkill Composer — Installing...\n');
    if (dynamic && config) {
        console.log('Scanning installed skills for chain discovery...');
    }
    const results = await install(agents, config, dynamic);
    for (const r of results) {
        const icon = r.action.startsWith('fail') ? 'x' : r.action === 'skipped (agent not installed)' ? '-' : '+';
        console.log(`  [${icon}] ${r.agent}: ${r.action}`);
        if (r.action === 'installed' || r.action === 'updated') {
            console.log(`      ${r.path}`);
        }
    }
    const installed = results.filter(r => r.action === 'installed' || r.action === 'updated');
    if (installed.length > 0) {
        console.log(`\nDone. skill-composer installed for ${installed.length} agent(s).`);
        console.log('Skills will chain automatically on next prompt.\n');
    }
    else {
        console.log('\nNo agents found to install for.\n');
    }
});
program
    .command('uninstall')
    .description('Remove skill-composer from all agents')
    .option('--agent <name>', 'uninstall from specific agent only')
    .action(async (opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const agents = opts.agent ? [opts.agent] : undefined;
    const results = await uninstall(agents, config);
    console.log('\nSkill Composer — Uninstalling...\n');
    for (const r of results) {
        console.log(`  ${r.agent}: ${r.action}`);
    }
    console.log('');
});
program
    .command('agents')
    .description('List AI agents auto-detected on this machine')
    .action(() => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const detected = detectInstalledAgents(config);
    if (detected.length === 0) {
        console.log('\nNo supported agents detected.\n');
        console.log('Skill-composer scans for ~/.<agent>/ directories from a built-in registry.');
        console.log('To add a custom agent, declare it under "agents" in composer.config.json.\n');
        return;
    }
    console.log('');
    console.log(`Auto-detected ${detected.length} agent(s):\n`);
    for (const t of detected) {
        console.log(`  + ${t.agent.padEnd(14)} ${t.skillDir}`);
    }
    console.log('');
});
program
    .command('scan')
    .description('Discover installed skills across all agents')
    .option('--agent <name>', 'filter by agent name')
    .action(async (opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    if (!config) {
        console.error('No config found. Run from the skill-composer directory or pass --config.');
        process.exit(1);
    }
    let effectiveConfig = config;
    if (opts.agent) {
        if (!(opts.agent in config.agents)) {
            console.error(`Agent "${opts.agent}" not found in config.`);
            process.exit(1);
        }
        effectiveConfig = { ...config, agents: { [opts.agent]: config.agents[opts.agent] } };
    }
    const scanResult = await scanSkills(effectiveConfig);
    const skills = dedupeSkillsForDisplay(parseSkillFiles(scanResult));
    if (skills.length === 0) {
        console.log('No skills found.');
        return;
    }
    const nameWidth = 35;
    const agentWidth = 14;
    const chainsWidth = 30;
    const header = 'Name'.padEnd(nameWidth) +
        'Agent'.padEnd(agentWidth) +
        'Chains To'.padEnd(chainsWidth) +
        'Tokens';
    console.log(`\n${header}`);
    console.log('-'.repeat(header.length + 10));
    for (const skill of skills) {
        const chains = skill.chainsTo.length > 0 ? skill.chainsTo.join(', ') : '-';
        console.log(skill.name.slice(0, nameWidth - 1).padEnd(nameWidth) +
            skill.source.agent.padEnd(agentWidth) +
            chains.slice(0, chainsWidth - 1).padEnd(chainsWidth) +
            String(skill.tokenEstimate));
    }
    const agentCount = new Set(skills.map(s => s.source.agent)).size;
    console.log(`\n${skills.length} skill(s) across ${agentCount} agent(s).\n`);
});
program
    .command('chains')
    .description('Show discovered skill chains')
    .option('--agent <name>', 'treat one agent as the loaded context')
    .action(async (opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    if (!config) {
        console.error('No config found.');
        process.exit(1);
    }
    let effectiveConfig = config;
    if (opts.agent) {
        if (!(opts.agent in config.agents)) {
            console.error(`Agent "${opts.agent}" not found in config.`);
            process.exit(1);
        }
        effectiveConfig = { ...config, agents: { [opts.agent]: config.agents[opts.agent] } };
    }
    const scanResult = await scanSkills(effectiveConfig);
    const skills = parseSkillFiles(scanResult);
    const catalogSkills = await discoverSkillCatalog(config, skills);
    const manifest = discoverChains(skills, config, catalogSkills);
    console.log(`\n${manifest.totalLoadedSkills} loaded, ${manifest.totalDiscoverableSkills} discoverable → ${manifest.totalChains} chains\n`);
    for (const chain of manifest.chains) {
        const tag = chain.source === 'manual' ? '[manual]' : chain.source === 'declared' ? '[declared]' : '[auto]';
        const suffix = chain.missingSkills?.length ? `  (discover first: ${chain.missingSkills.join(', ')})` : '';
        console.log(`  ${tag} ${chain.skills.join(' → ')}${suffix}`);
    }
    if (manifest.referencedSkills.length > 0) {
        console.log(`\nReferenced but not found: ${manifest.referencedSkills.join(', ')}`);
    }
    console.log('');
});
program
    .command('discover [query...]')
    .description('Search loaded and locally discoverable skills')
    .option('--agent <name>', 'treat one agent as the loaded context')
    .option('--all', 'show every indexed skill when no query is provided')
    .action(async (queryParts, opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const query = queryParts?.join(' ').trim();
    if (!config) {
        console.error('No config found.');
        process.exit(1);
    }
    if (query) {
        const remote = parseRemoteSkillReference(query);
        if (remote) {
            const cached = searchCachedRemoteSkills(remote.name, config).find(entry => entry.sourceUrl === remote.sourceUrl);
            console.log('');
            console.log(`[remote] ${remote.name}`);
            console.log(`  Source: ${remote.sourceUrl}`);
            console.log(`  Install: ${remote.installCommand}`);
            if (cached)
                console.log(`  Cache: hit, ${cached.tokenEstimate} tokens, expires ${cached.expiresAt}`);
            else
                console.log('  Cache: miss; run `skill-composer remote fetch <url>` for same-turn cached use');
            console.log('');
            return;
        }
    }
    let effectiveConfig = config;
    if (opts.agent) {
        if (!(opts.agent in config.agents)) {
            console.error(`Agent "${opts.agent}" not found in config.`);
            process.exit(1);
        }
        effectiveConfig = { ...config, agents: { [opts.agent]: config.agents[opts.agent] } };
    }
    const scanResult = await scanSkills(effectiveConfig);
    const loadedSkills = dedupeSkillsForDisplay(parseSkillFiles(scanResult)).map(skill => ({
        ...skill,
        availability: 'loaded',
    }));
    const catalogSkills = await discoverSkillCatalog(config, loadedSkills);
    const allSkills = dedupeSkillsForDisplay([...loadedSkills, ...catalogSkills]);
    const results = query
        ? rankSkillsForQuery(allSkills, query, 25)
        : opts.all
            ? allSkills
            : allSkills.slice(0, 25);
    if (results.length === 0) {
        console.log(query ? `No local skills matched "${query}".` : 'No local skills found.');
        console.log('Try: npx skills find <query>');
        return;
    }
    console.log('');
    for (const skill of results) {
        const status = skill.availability === 'loaded' ? 'loaded' : 'discoverable';
        const category = skill.categories.length ? ` · ${skill.categories.join(', ')}` : '';
        console.log(`[${status}] ${skill.name}${category}`);
        if (skill.description)
            console.log(`  ${skill.description}`);
        if (skill.availability !== 'loaded' && skill.installHint)
            console.log(`  ${skill.installHint}`);
    }
    console.log(`\n${loadedSkills.length} loaded, ${catalogSkills.length} discoverable.\n`);
});
program
    .command('resolve <reference>')
    .description('Resolve a remote skills.sh URL into an install command')
    .action((reference) => {
    const remote = parseRemoteSkillReference(reference);
    if (!remote) {
        console.error('Unsupported remote skill reference. Expected: https://skills.sh/<owner>/<repo>/<skill>');
        process.exit(1);
    }
    console.log('');
    console.log(`Skill: ${remote.name}`);
    console.log(`Source: ${remote.sourceUrl}`);
    console.log(`Repository: ${remote.repositoryUrl}`);
    console.log(`Install: ${remote.installCommand}`);
    console.log('');
});
const remote = program
    .command('remote')
    .description('Manage cached remote skills from skills.sh');
remote
    .command('resolve <reference>')
    .description('Resolve a skills.sh URL into repository and install metadata')
    .action((reference) => {
    const skill = parseRemoteSkillReference(reference);
    if (!skill) {
        console.error('Unsupported remote skill reference. Expected: https://skills.sh/<owner>/<repo>/<skill>');
        process.exit(1);
    }
    console.log(JSON.stringify(skill, null, 2));
});
remote
    .command('fetch <reference>')
    .description('Fetch and cache a remote skill SKILL.md')
    .option('--cache-dir <path>', 'cache directory override')
    .option('--refresh', 'ignore fresh cache and fetch again')
    .option('--ttl-hours <hours>', 'cache TTL in hours', (value) => Number(value))
    .action(async (reference, opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    try {
        const { entry, cacheHit } = await fetchRemoteSkill(reference, config, {
            cacheDir: opts.cacheDir,
            refresh: opts.refresh,
            ttlHours: opts.ttlHours,
        });
        console.log('');
        console.log(`${cacheHit ? 'Cache hit' : 'Cached'}: ${entry.name}`);
        console.log(`Title: ${entry.title}`);
        if (entry.description)
            console.log(`Description: ${entry.description}`);
        console.log(`Source: ${entry.sourceUrl}`);
        console.log(`Raw: ${entry.rawUrl}`);
        console.log(`Tokens: ${entry.tokenEstimate}`);
        console.log(`Cache: ${getRemoteCacheDir(config, opts.cacheDir)}`);
        console.log(`Expires: ${entry.expiresAt}`);
        console.log('');
    }
    catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
});
remote
    .command('list')
    .description('List cached remote skills')
    .option('--cache-dir <path>', 'cache directory override')
    .action((opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const entries = listCachedRemoteSkills(config, { cacheDir: opts.cacheDir });
    if (entries.length === 0) {
        console.log('No cached remote skills.');
        return;
    }
    console.log('');
    for (const entry of entries) {
        console.log(`${entry.name.padEnd(24)} ${entry.tokenEstimate.toString().padStart(6)} tokens  expires ${entry.expiresAt}`);
        console.log(`  ${entry.sourceUrl}`);
    }
    console.log('');
});
remote
    .command('search <query...>')
    .description('Search cached remote skills')
    .option('--cache-dir <path>', 'cache directory override')
    .action((queryParts, opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const query = queryParts.join(' ');
    const entries = searchCachedRemoteSkills(query, config, { cacheDir: opts.cacheDir });
    if (entries.length === 0) {
        console.log(`No cached remote skills matched "${query}".`);
        return;
    }
    console.log('');
    for (const entry of entries) {
        console.log(`[cached] ${entry.name} (${entry.tokenEstimate} tokens)`);
        if (entry.description)
            console.log(`  ${entry.description}`);
        console.log(`  ${entry.sourceUrl}`);
    }
    console.log('');
});
remote
    .command('clear')
    .description('Clear cached remote skills')
    .option('--cache-dir <path>', 'cache directory override')
    .option('--expired', 'clear only expired or corrupt entries')
    .option('--all', 'clear all cached remote skills')
    .action((opts) => {
    if (!opts.expired && !opts.all) {
        console.error('Pass --expired or --all.');
        process.exit(1);
    }
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    const removed = clearRemoteSkillCache(config, {
        cacheDir: opts.cacheDir,
        expiredOnly: opts.expired && !opts.all,
    });
    console.log(`Removed ${removed} cached remote skill(s).`);
});
program
    .command('graph')
    .description('Show skill relationships')
    .option('--dot', 'output DOT format for graphviz')
    .action(async (opts) => {
    const parentOpts = program.opts();
    const config = loadConfig(parentOpts.config);
    if (!config) {
        console.error('No config found.');
        process.exit(1);
    }
    const scanResult = await scanSkills(config);
    const skills = parseSkillFiles(scanResult);
    const graph = buildGraph(skills);
    if (opts.dot) {
        console.log('digraph skills {');
        console.log('  rankdir=LR;');
        console.log('  node [shape=box];');
        for (const [id, skill] of graph.nodes) {
            console.log(`  "${id}" [label="${skill.name}"];`);
        }
        for (const edge of graph.edges) {
            console.log(`  "${edge.from}" -> "${edge.to}" [label="w: ${edge.weight.toFixed(2)}"];`);
        }
        console.log('}');
        return;
    }
    if (graph.edges.length === 0) {
        console.log('No relationships found.');
        return;
    }
    console.log(`\n${graph.nodes.size} skills, ${graph.edges.length} relationships\n`);
    const sorted = [...graph.edges].sort((a, b) => b.weight - a.weight).slice(0, 30);
    for (const edge of sorted) {
        const from = graph.nodes.get(edge.from)?.name ?? edge.from;
        const to = graph.nodes.get(edge.to)?.name ?? edge.to;
        console.log(`  ${from} → ${to} (${edge.weight.toFixed(2)})`);
    }
    console.log('');
});
program.parse();
//# sourceMappingURL=cli.js.map