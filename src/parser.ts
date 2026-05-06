import type { AgentType, ScanResult, Skill, SkillAdapter } from './types.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';
import { codexAdapter } from './adapters/codex.js';
import { genericAdapter } from './adapters/generic.js';

const adapters: Record<string, SkillAdapter> = {
  'claude-code': claudeCodeAdapter,
  codex: codexAdapter,
  cursor: genericAdapter,
  windsurf: genericAdapter,
  generic: genericAdapter,
};

export function getAdapter(agent: AgentType): SkillAdapter {
  return adapters[agent] ?? genericAdapter;
}

export function parseSkillFiles(scanResult: ScanResult): Skill[] {
  const skills: Skill[] = [];
  const seenIds = new Map<string, number>();

  for (const file of scanResult.files) {
    const adapter = getAdapter(file.agent);
    const skill = adapter.parse(file);
    if (!skill) continue;

    const baseId = `${file.agent}--${skill.id}`;
    const count = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, count + 1);
    skill.id = count > 0 ? `${baseId}-${count}` : baseId;

    skills.push(skill);
  }

  return skills;
}
