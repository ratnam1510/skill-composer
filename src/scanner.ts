import { readFileSync } from 'fs';
import fg from 'fast-glob';
import { expandPath } from './utils.js';
import type { AgentType, ComposerConfig, ScanResult, SkillFile } from './types.js';

const EXTENSION_MAP: Record<string, string[]> = {
  markdown: ['**/*.md'],
  json: ['**/*.json'],
  yaml: ['**/*.yaml', '**/*.yml'],
};

function isSkillRoot(dir: string): boolean {
  const normalized = dir.replace(/\\/g, '/').toLowerCase();
  return /(^|\/)\.?[a-z-]*skills?(\/|$)/.test(normalized);
}

function isPluginRoot(dir: string): boolean {
  const normalized = dir.replace(/\\/g, '/').toLowerCase();
  return /(^|\/)plugins?(\/|$)/.test(normalized);
}

function getScanPatterns(dir: string, format: ComposerConfig['agents'][string]['format']): string[] {
  if (isSkillRoot(dir)) {
    return ['**/SKILL.md'];
  }

  if (isPluginRoot(dir)) {
    return ['**/skills/**/SKILL.md'];
  }

  return [
    ...EXTENSION_MAP.markdown,
    ...(format === 'json' ? EXTENSION_MAP.json : []),
    ...(format === 'yaml' ? EXTENSION_MAP.yaml : []),
  ];
}

export async function scanSkills(config: ComposerConfig): Promise<ScanResult> {
  const files: SkillFile[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const [agentName, agentConfig] of Object.entries(config.agents)) {
    const agent = agentName as AgentType;

    for (const dir of agentConfig.skillDirs) {
      const resolved = expandPath(dir);
      const patterns = getScanPatterns(dir, agentConfig.format);

      try {
        const matches = await fg(patterns, {
          cwd: resolved,
          absolute: true,
          ignore: config.exclude ?? [],
          onlyFiles: true,
          dot: true,
        });

        for (const match of matches) {
          try {
            const content = readFileSync(match, 'utf-8');
            files.push({ path: match, content, agent });
          } catch (err) {
            errors.push({
              path: match,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        errors.push({
          path: resolved,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { files, errors };
}
