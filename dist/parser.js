import { claudeCodeAdapter } from './adapters/claude-code.js';
import { codexAdapter } from './adapters/codex.js';
import { genericAdapter } from './adapters/generic.js';
const adapters = {
    'claude-code': claudeCodeAdapter,
    codex: codexAdapter,
    cursor: genericAdapter,
    windsurf: genericAdapter,
    generic: genericAdapter,
};
export function getAdapter(agent) {
    return adapters[agent] ?? genericAdapter;
}
export function parseSkillFiles(scanResult) {
    const skills = [];
    const seenIds = new Map();
    for (const file of scanResult.files) {
        const adapter = getAdapter(file.agent);
        const skill = adapter.parse(file);
        if (!skill)
            continue;
        const baseId = `${file.agent}--${skill.id}`;
        const count = seenIds.get(baseId) ?? 0;
        seenIds.set(baseId, count + 1);
        skill.id = count > 0 ? `${baseId}-${count}` : baseId;
        skills.push(skill);
    }
    return skills;
}
//# sourceMappingURL=parser.js.map