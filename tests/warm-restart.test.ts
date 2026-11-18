// Warm restart (KAN-672; docs/architecture/session-archive.md, Warm restart): restore all brings
// back only what archive all saved and is not already running. The round trip with real Claude
// and Codex sessions is proved on a rig.
import test from 'node:test';
import assert from 'node:assert/strict';
import { warmRestorable, type ArchivedSession } from '../src/session-archive.ts';

const archive = (name: string, warm: boolean): ArchivedSession => ({
  version: 1, id: `${name}-k`, name, key: `${name}-k`, archived_at: '2026-11-18T00:00:00Z', cwd: '/', agent: 'claude',
  provider_session_id: 'u', tags: [], leads: [], wipeboards: [], project_root: '', ...(warm ? { warm_restart: true as const } : {}),
});

test('restore all takes only warm archives, and leaves one whose name is running', () => {
  const { restore, running } = warmRestorable([archive('a', true), archive('b', false), archive('c', true)], new Set(['c']));
  assert.deepEqual(restore.map((a) => a.name), ['a']);
  assert.deepEqual(running.map((a) => a.name), ['c']);
});

test('the calls reuse the one archive and the one restore', async () => {
  const fs = await import('node:fs/promises');
  const route = await fs.readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
  const all = route.slice(route.indexOf("'/api/machine/archive-all'"), route.indexOf('RESUME A STOPPED AGENT'));
  assert.match(all, /archiveWith\(name, provider, \[\], true\)/);
  assert.match(all, /rehydrate\(id, callerOf\(req\)\)/);
  assert.doesNotMatch(all, /releaseHolds|heldItemsRefusal|openDesks/);
});
