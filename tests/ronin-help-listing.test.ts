import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';

const HELP = path.join(import.meta.dirname, '..', 'ronin_bin', 'ronin-help');

test('a behaviour with lists: prints its directory, the user\'s files over stock, in order (KAN-554)', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-help-listing-'));
  try {
    const own = path.join(root, 'workspace_types');
    await mkdir(own, { recursive: true });
    await writeFile(path.join(own, 'code.md'), '# Code, our way\n- **kind:** type\n- **for:** our repos\n- **order:** 10\n\nOurs.\n');
    await writeFile(path.join(own, 'podcast.md'), '# Podcast\n- **kind:** type\n- **for:** audio shows\n- **order:** 35\n\nA recordings folder.\n');
    const env = { ...process.env, HOME: root, RONIN_USER_ROOT: root, RONIN_DATA_ROOT: root };
    const text = execFileSync('bash', [HELP, 'new-workspace'], { env, encoding: 'utf8' });
    assert.match(text, /^# New Workspace/);
    assert.match(text, /- \*\*Code, our way\*\* \(type, our repos\): Ours\./, 'the user\'s file replaces stock by name');
    assert.doesNotMatch(text, /software in a repository/);
    assert.ok(text.indexOf('**Writing**') < text.indexOf('**Podcast**') && text.indexOf('**Podcast**') < text.indexOf('**Research**'), 'an added file takes its place by order');
    assert.match(text, /- \*\*Publishing\*\* \(variant, where finished work goes\): /);
    assert.doesNotMatch(text, /Workspace types and variants/, 'the README is not listed');
    const plain = execFileSync('bash', [HELP, 'working-at-a-desk'], { env, encoding: 'utf8' });
    assert.doesNotMatch(plain, /\*\* \(type/, 'a behaviour without lists: prints only itself');
  } finally { await rm(root, { recursive: true, force: true }); }
});
