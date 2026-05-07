import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { detectInstalledAgents } from '../dist/installer.js';

function tempHome() {
  return mkdtempSync(join(tmpdir(), 'skill-composer-installer-test-'));
}

test('detectInstalledAgents only includes agents whose root dir exists on disk', () => {
  const home = tempHome();
  const presentName = `present-agent-${Date.now()}`;
  const absentName  = `absent-agent-${Date.now()}`;
  mkdirSync(join(home, `.${presentName}`));

  const config = {
    agents: {
      [presentName]: {
        skillDirs: [`${home}/.${presentName}/skills`],
        outputDir: '', configFile: '', format: 'markdown',
      },
      [absentName]: {
        skillDirs: [`${home}/.${absentName}/skills`],
        outputDir: '', configFile: '', format: 'markdown',
      },
    },
  };

  const detected = detectInstalledAgents(config);
  const names = detected.map(t => t.agent);

  assert.ok(names.includes(presentName), `expected ${presentName} to be detected`);
  assert.ok(!names.includes(absentName), `did not expect ${absentName} to be detected`);

  rmSync(home, { recursive: true, force: true });
});

test('detectInstalledAgents accepts custom agents declared in config without code changes', () => {
  const home = tempHome();
  mkdirSync(join(home, '.my-custom-agent'));

  const config = {
    agents: {
      'my-custom-agent': {
        skillDirs: [`${home}/.my-custom-agent/skills`],
        outputDir: '',
        configFile: '',
        format: 'markdown',
      },
    },
  };

  const detected = detectInstalledAgents(config);
  assert.ok(detected.some(t => t.agent === 'my-custom-agent'),
    'custom agent declared in config should be detected when its root exists');

  rmSync(home, { recursive: true, force: true });
});

test('detectInstalledAgents skips the generic adapter even when configured', () => {
  const config = {
    agents: {
      generic: { skillDirs: ['./somewhere'], outputDir: '', configFile: '', format: 'markdown' },
    },
  };
  const detected = detectInstalledAgents(config);
  assert.ok(!detected.some(t => t.agent === 'generic'));
});
