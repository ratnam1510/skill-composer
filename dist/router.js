import { makeReferencedSkill } from './catalog.js';
import { buildGraph, findChains } from './graph.js';
function availabilityRank(skill) {
    if (skill.availability === 'loaded' || !skill.availability)
        return 3;
    if (skill.availability === 'discoverable')
        return 2;
    return 1;
}
function deduplicateSkillsByName(skills) {
    const byName = new Map();
    for (const skill of skills) {
        const key = skill.name.toLowerCase();
        const existing = byName.get(key);
        if (!existing ||
            availabilityRank(skill) > availabilityRank(existing) ||
            (availabilityRank(skill) === availabilityRank(existing) &&
                skill.instructions.length > existing.instructions.length)) {
            byName.set(key, skill);
        }
    }
    return [...byName.values()];
}
function getDeclaredChains(skills) {
    const nameMap = new Map();
    for (const s of skills)
        nameMap.set(s.name.toLowerCase(), s);
    for (const s of skills)
        nameMap.set(s.id.toLowerCase(), s);
    const chains = [];
    for (const skill of skills) {
        if (skill.chainsTo.length === 0)
            continue;
        const resolved = skill.chainsTo
            .map(name => nameMap.get(name.toLowerCase()))
            .filter((s) => s !== undefined);
        if (resolved.length === 0)
            continue;
        const fullChain = [skill.name, ...resolved.map(s => s.name)];
        chains.push({
            name: fullChain.join(' → '),
            description: `${skill.name} declares chaining to: ${resolved.map(s => s.name).join(', ')}`,
            skills: fullChain,
            triggerHint: skill.triggers.slice(0, 3).map(t => t.pattern).join(', '),
            source: 'declared',
        });
    }
    return chains;
}
function getManualChains(config, skills) {
    if (!config.chains || Object.keys(config.chains).length === 0)
        return [];
    const nameMap = new Map();
    for (const s of skills) {
        nameMap.set(s.name.toLowerCase(), s);
        nameMap.set(s.id.toLowerCase(), s);
    }
    const chains = [];
    for (const [chainName, skillNames] of Object.entries(config.chains)) {
        const resolved = skillNames
            .map(name => nameMap.get(name.toLowerCase()))
            .filter((s) => s !== undefined);
        if (resolved.length < 2)
            continue;
        chains.push({
            name: chainName,
            description: `Manual chain: ${resolved.map(s => s.name).join(' → ')}`,
            skills: resolved.map(s => s.name),
            triggerHint: resolved.flatMap(s => s.triggers.slice(0, 2).map(t => t.pattern)).slice(0, 5).join(', '),
            source: 'manual',
            missingSkills: resolved
                .filter(s => s.availability !== 'loaded')
                .map(s => s.name),
        });
    }
    return chains;
}
function getAutoChains(skills, maxLength) {
    const graph = buildGraph(skills);
    const rawChains = findChains(graph, maxLength);
    const chains = [];
    for (const chain of rawChains) {
        const chainSkills = chain
            .map(id => graph.nodes.get(id))
            .filter((s) => s !== undefined);
        if (chainSkills.length < 2)
            continue;
        const uniqueNames = [...new Set(chainSkills.map(s => s.name))];
        if (uniqueNames.length < 2)
            continue;
        if (uniqueNames.length > 5)
            continue;
        const categories = [...new Set(chainSkills.flatMap(s => s.categories))];
        if (categories.length === 0)
            continue;
        chains.push({
            name: uniqueNames.join(' → '),
            description: `Auto-detected chain (categories: ${categories.join(', ')})`,
            skills: uniqueNames,
            triggerHint: chainSkills
                .flatMap(s => s.triggers.slice(0, 2).map(t => t.pattern))
                .slice(0, 6)
                .join(', '),
            source: 'auto-detected',
        });
    }
    return chains;
}
function deduplicateChains(chains) {
    const seen = new Set();
    const result = [];
    for (const chain of chains) {
        const key = chain.skills.map(s => s.toLowerCase()).join('|');
        if (seen.has(key))
            continue;
        const reversedKey = [...chain.skills].reverse().map(s => s.toLowerCase()).join('|');
        if (seen.has(reversedKey))
            continue;
        seen.add(key);
        result.push(chain);
    }
    return result;
}
function getReferencedSkills(config, skills) {
    if (!config.chains || Object.keys(config.chains).length === 0)
        return [];
    const knownNames = new Set(skills.flatMap(s => [s.name.toLowerCase(), s.id.toLowerCase()]));
    const referenced = [];
    for (const [chainName, skillNames] of Object.entries(config.chains)) {
        for (const skillName of skillNames) {
            const key = skillName.toLowerCase();
            if (knownNames.has(key))
                continue;
            const skill = makeReferencedSkill(skillName, chainName);
            referenced.push(skill);
            knownNames.add(key);
        }
    }
    return referenced;
}
export function discoverChains(skills, config, catalogSkills = []) {
    for (const skill of skills) {
        skill.availability = skill.availability ?? 'loaded';
    }
    const loaded = deduplicateSkillsByName(skills);
    const discoverable = deduplicateSkillsByName(catalogSkills);
    const known = deduplicateSkillsByName([...loaded, ...discoverable]);
    const referenced = getReferencedSkills(config, known);
    const allSkills = deduplicateSkillsByName([...known, ...referenced]);
    const maxLength = config.maxChainLength ?? 8;
    const declared = getDeclaredChains(loaded);
    const manual = getManualChains(config, allSkills);
    const auto = getAutoChains(loaded, maxLength);
    const allChains = deduplicateChains([...manual, ...declared, ...auto]);
    return {
        chains: allChains,
        generatedAt: new Date().toISOString(),
        totalSkills: allSkills.length,
        totalLoadedSkills: loaded.length,
        totalDiscoverableSkills: discoverable.length,
        referencedSkills: referenced.map(s => s.name),
        totalChains: allChains.length,
    };
}
function formatChainSkill(name, missingSkills = []) {
    const missing = missingSkills.some(s => s.toLowerCase() === name.toLowerCase());
    return missing ? `\`/${name}\` _(discover first)_` : `\`/${name}\``;
}
export function generateManifest(manifest) {
    const lines = [];
    lines.push('<!-- AUTO-GENERATED BY SKILL-COMPOSER — do not edit this section manually -->');
    lines.push('<!-- Regenerate with: skill-composer chain -->');
    lines.push('');
    lines.push('## Skill Chains');
    lines.push('');
    lines.push('When a prompt matches one of these chains, invoke the skills in order.');
    lines.push('Each skill runs fully before the next begins. The output of one skill becomes context for the next.');
    lines.push('Do not load all skills at once — chain them: run the first, then the second, and so on.');
    lines.push('Skills marked _(discover first)_ are known by catalog or configuration but are not confirmed loaded; find/install them before invoking.');
    lines.push('');
    const manualAndDeclared = manifest.chains.filter(c => c.source !== 'auto-detected');
    const auto = manifest.chains.filter(c => c.source === 'auto-detected');
    if (manualAndDeclared.length > 0) {
        lines.push('### Defined Chains');
        lines.push('');
        for (const chain of manualAndDeclared) {
            lines.push(`**${chain.name}**`);
            lines.push(`> ${chain.skills.map(s => formatChainSkill(s, chain.missingSkills)).join(' → ')}`);
            if (chain.triggerHint) {
                lines.push(`> _Triggers: ${chain.triggerHint}_`);
            }
            lines.push('');
        }
    }
    if (auto.length > 0) {
        lines.push('### Auto-Detected Chains');
        lines.push('');
        for (const chain of auto) {
            lines.push(`- ${chain.skills.map(s => formatChainSkill(s, chain.missingSkills)).join(' → ')}`);
        }
        lines.push('');
    }
    if (manifest.referencedSkills.length > 0) {
        lines.push('### Referenced But Not Found');
        lines.push('');
        lines.push(manifest.referencedSkills.map(s => `\`/${s}\``).join(', '));
        lines.push('');
    }
    lines.push(`_${manifest.totalLoadedSkills} loaded skills, ${manifest.totalDiscoverableSkills} discoverable skills, ${manifest.totalChains} chains available._`);
    lines.push('<!-- END SKILL-COMPOSER -->');
    return lines.join('\n');
}
//# sourceMappingURL=router.js.map