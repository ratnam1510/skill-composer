import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSkillFiles, getAdapter } from '../dist/parser.js';

function file(agent, path, content) {
  return { agent, path, content };
}

test('claude-code adapter ignores prose-style "chain them" false positives', () => {
  const skill = getAdapter('claude-code').parse(
    file(
      'claude-code',
      '/x/skill-composer/SKILL.md',
      `---
name: skill-composer
description: Chains skills together when chaining helps.
---

# Skill Composer

When a prompt would benefit from multiple skills, chain them together.
`,
    ),
  );

  assert.ok(skill);
  assert.deepEqual(skill.chainsTo, []);
});

test('claude-code adapter respects frontmatter chains_to', () => {
  const skill = getAdapter('claude-code').parse(
    file(
      'claude-code',
      '/x/foo/SKILL.md',
      `---
name: foo
description: Foo skill.
chains_to: [bar, baz]
---

# Foo
`,
    ),
  );

  assert.ok(skill);
  assert.deepEqual(skill.chainsTo, ['bar', 'baz']);
});

test('claude-code adapter parses explicit "chains_to:" body declaration', () => {
  const skill = getAdapter('claude-code').parse(
    file(
      'claude-code',
      '/x/foo/SKILL.md',
      `# Foo

chains_to: bar, baz
`,
    ),
  );

  assert.ok(skill);
  assert.deepEqual(skill.chainsTo, ['bar', 'baz']);
});

test('codex adapter does not capture prose like "skill of the day"', () => {
  const skill = getAdapter('codex').parse(
    file(
      'codex',
      '/x/math/SKILL.md',
      `---
name: math-olympiad
description: A solver skill of olympiad-grade problems.
---

# Math Olympiad

This is the next skill of the series.
`,
    ),
  );

  assert.ok(skill);
  assert.deepEqual(skill.chainsTo, []);
});

test('generic adapter ignores prose triggers and parses explicit declaration', () => {
  const promptOnly = getAdapter('generic').parse(
    file(
      'generic',
      '/x/a/SKILL.md',
      'This skill builds on top of others.',
    ),
  );
  assert.ok(promptOnly);
  assert.deepEqual(promptOnly.chainsTo, []);

  const explicit = getAdapter('generic').parse(
    file(
      'generic',
      '/x/b/SKILL.md',
      `# B

then_run: cleanup, deploy
`,
    ),
  );
  assert.ok(explicit);
  assert.deepEqual(explicit.chainsTo, ['cleanup', 'deploy']);
});

test('parseSkillFiles assigns unique ids per agent and dedupes collisions', () => {
  const skills = parseSkillFiles({
    files: [
      file('claude-code', '/a/foo/SKILL.md', '# Foo\n\nDoes foo.'),
      file('claude-code', '/b/foo/SKILL.md', '# Foo\n\nAnother foo.'),
      file('codex', '/c/foo/SKILL.md', '# Foo\n\nCodex foo.'),
    ],
    errors: [],
  });

  assert.equal(skills.length, 3);
  const ids = skills.map(s => s.id);
  assert.equal(new Set(ids).size, 3, `expected unique ids, got ${ids.join(', ')}`);
});

test('parseSkillFiles skips empty files', () => {
  const skills = parseSkillFiles({
    files: [
      file('claude-code', '/a/empty/SKILL.md', ''),
      file('claude-code', '/a/whitespace/SKILL.md', '   \n\n'),
      file('claude-code', '/a/real/SKILL.md', '# Real\n\nDoes a real thing.'),
    ],
    errors: [],
  });

  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, 'Real');
});
