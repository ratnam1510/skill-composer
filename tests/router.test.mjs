import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverChains } from '../dist/router.js';

function skill(name, overrides = {}) {
  return {
    id: `claude-code--${name}`,
    name,
    description: `${name} skill`,
    triggers: [{ pattern: name, weight: 1 }],
    inputs: [],
    outputs: [],
    categories: ['design'],
    instructions: `# ${name}`,
    chainsTo: [],
    source: { agent: 'claude-code', path: `/x/${name}/SKILL.md`, format: 'markdown' },
    tokenEstimate: 100,
    availability: 'loaded',
    ...overrides,
  };
}

test('discoverChains resolves a manual chain when all skills are loaded', () => {
  const skills = [skill('frontend-design'), skill('animate'), skill('polish')];
  const config = {
    agents: {},
    chains: { 'Design Pipeline': ['frontend-design', 'animate', 'polish'] },
  };

  const manifest = discoverChains(skills, config);
  const manual = manifest.chains.find(c => c.source === 'manual' && c.name === 'Design Pipeline');

  assert.ok(manual);
  assert.deepEqual(manual.skills, ['frontend-design', 'animate', 'polish']);
  assert.deepEqual(manual.missingSkills, []);
});

test('discoverChains marks missing skills when a chain step is only discoverable', () => {
  const loaded = [skill('frontend-design'), skill('polish')];
  const catalog = [skill('animate', { availability: 'discoverable' })];
  const config = {
    agents: {},
    chains: { 'Design Pipeline': ['frontend-design', 'animate', 'polish'] },
  };

  const manifest = discoverChains(loaded, config, catalog);
  const manual = manifest.chains.find(c => c.source === 'manual' && c.name === 'Design Pipeline');

  assert.ok(manual);
  assert.deepEqual(manual.skills, ['frontend-design', 'animate', 'polish']);
  assert.deepEqual(manual.missingSkills, ['animate']);
});

test('discoverChains records referenced skills that are not present anywhere', () => {
  const skills = [skill('frontend-design'), skill('polish')];
  const config = {
    agents: {},
    chains: { 'Pipeline': ['frontend-design', 'made-up-skill', 'polish'] },
  };

  const manifest = discoverChains(skills, config);
  assert.ok(manifest.referencedSkills.includes('made-up-skill'));
});

test('discoverChains promotes referenced skills so the manual chain still surfaces with discover-first markers', () => {
  const skills = [skill('frontend-design')];
  const config = {
    agents: {},
    chains: { 'Pipeline': ['frontend-design', 'polish'] },
  };

  const manifest = discoverChains(skills, config);
  const manual = manifest.chains.find(c => c.source === 'manual' && c.name === 'Pipeline');
  assert.ok(manual, 'manual chain should still be emitted with referenced skills');
  assert.deepEqual(manual.skills, ['frontend-design', 'polish']);
  assert.ok(manual.missingSkills?.includes('polish'));
  assert.ok(manifest.referencedSkills.includes('polish'));
});

test('discoverChains surfaces declared chains from skill chainsTo metadata', () => {
  const skills = [
    skill('foo', { chainsTo: ['bar'] }),
    skill('bar'),
  ];
  const manifest = discoverChains(skills, { agents: {} });
  const declared = manifest.chains.find(c => c.source === 'declared');
  assert.ok(declared);
  assert.deepEqual(declared.skills, ['foo', 'bar']);
});

test('discoverChains counts loaded vs discoverable skills', () => {
  const loaded = [skill('a'), skill('b')];
  const catalog = [skill('c', { availability: 'discoverable' })];
  const manifest = discoverChains(loaded, { agents: {} }, catalog);
  assert.equal(manifest.totalLoadedSkills, 2);
  assert.equal(manifest.totalDiscoverableSkills, 1);
});
