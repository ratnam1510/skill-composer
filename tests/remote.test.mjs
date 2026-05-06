import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  clearRemoteSkillCache,
  fetchRemoteSkill,
  getCachedRemoteSkill,
  listCachedRemoteSkills,
  parseRemoteSkillReference,
  searchCachedRemoteSkills,
} from '../dist/remote.js';

const PDF_URL = 'https://skills.sh/anthropics/skills/pdf';

function tempCacheDir() {
  return mkdtempSync(join(tmpdir(), 'skill-composer-remote-test-'));
}

function response(body, status = 200) {
  return new Response(body, { status });
}

function withFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = original;
    });
}

test('parses skills.sh references into install metadata', () => {
  const ref = parseRemoteSkillReference(PDF_URL);

  assert.deepEqual(ref, {
    name: 'pdf',
    sourceUrl: PDF_URL,
    repositoryUrl: 'https://github.com/anthropics/skills',
    installCommand: 'npx skills add https://github.com/anthropics/skills --skill pdf',
  });
  assert.equal(parseRemoteSkillReference('https://example.com/nope'), null);
});

test('fetches raw SKILL.md, stores it, and serves fresh cache without network', async () => {
  const cacheDir = tempCacheDir();
  const calls = [];
  const skillMarkdown = `---
name: pdf
description: PDF processing and table extraction.
---

# PDF Processing Guide

Use this for extracting text and tables from PDF files.
`;

  await withFetch(async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/main/skills/pdf/SKILL.md')) {
      return response(skillMarkdown);
    }
    return response('not found', 404);
  }, async () => {
    const first = await fetchRemoteSkill(PDF_URL, undefined, { cacheDir, ttlHours: 1 });
    assert.equal(first.cacheHit, false);
    assert.equal(first.entry.name, 'pdf');
    assert.equal(first.entry.title, 'pdf');
    assert.equal(first.entry.description, 'PDF processing and table extraction.');
    assert.match(first.entry.rawUrl, /raw\.githubusercontent\.com/);
    assert.ok(first.entry.tokenEstimate > 0);

    const second = await fetchRemoteSkill(PDF_URL, undefined, { cacheDir, ttlHours: 1 });
    assert.equal(second.cacheHit, true);
    assert.equal(calls.length, 1);

    const cached = getCachedRemoteSkill(PDF_URL, undefined, { cacheDir });
    assert.equal(cached?.name, 'pdf');

    const search = searchCachedRemoteSkills('pdf tables', undefined, { cacheDir });
    assert.equal(search.length, 1);
    assert.equal(search[0].name, 'pdf');
  });

  rmSync(cacheDir, { recursive: true, force: true });
});

test('clears expired remote cache entries without deleting fresh entries', async () => {
  const cacheDir = tempCacheDir();
  const skillMarkdown = `---
name: pdf
description: PDF processing.
---

# PDF Processing Guide
`;

  await withFetch(async (url) => {
    if (String(url).endsWith('/main/skills/pdf/SKILL.md')) return response(skillMarkdown);
    return response('not found', 404);
  }, async () => {
    const fetched = await fetchRemoteSkill(PDF_URL, undefined, { cacheDir, ttlHours: 1, refresh: true });
    const file = join(cacheDir, `${fetched.entry.id}.json`);
    const entry = JSON.parse(readFileSync(file, 'utf-8'));
    entry.expiresAt = new Date(Date.now() - 1000).toISOString();
    writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8');

    assert.equal(listCachedRemoteSkills(undefined, { cacheDir }).length, 1);
    assert.equal(clearRemoteSkillCache(undefined, { cacheDir, expiredOnly: true }), 1);
    assert.equal(listCachedRemoteSkills(undefined, { cacheDir }).length, 0);
  });

  rmSync(cacheDir, { recursive: true, force: true });
});

test('falls back to skills.sh HTML when raw SKILL.md candidates miss', async () => {
  const cacheDir = tempCacheDir();

  await withFetch(async (url) => {
    if (String(url) === PDF_URL) {
      return response('<h2>SKILL.md</h2><h1>PDF Processing Guide</h1><p>Extract tables from PDFs.</p>');
    }
    return response('not found', 404);
  }, async () => {
    const fetched = await fetchRemoteSkill(PDF_URL, undefined, { cacheDir, ttlHours: 1, refresh: true });
    assert.equal(fetched.cacheHit, false);
    assert.equal(fetched.entry.rawUrl, PDF_URL);
    assert.match(fetched.entry.content, /PDF Processing Guide/);
  });

  rmSync(cacheDir, { recursive: true, force: true });
});
