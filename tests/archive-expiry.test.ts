/**
 * ARCHIVES EXPIRE (KAN-517; docs/architecture/session-archive.md): an archive older than
 * ARCHIVE_DAYS is removed, manifest and retained session folder together, by the archive's own
 * Hard Delete removal; at service start and on each new archive. A newer one stays.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-archive-expiry-'));
process.env.HOME = isolated;
process.env.RONIN_USER_ROOT = path.join(isolated, 'user');
process.env.RONIN_DATA_ROOT = path.join(isolated, 'data');
process.env.RONIN_MESSAGE_QUEUE_DIR = path.join(isolated, 'queue');
process.env.RONIN_SOCKET = path.join(isolated, 'no-tmux.sock');
delete process.env.TMUX;

const { ARCHIVE_DAYS, ARCHIVE_DIR, expiredArchives, writeArchive, listArchives } = await import('../src/session-archive.ts');
const { sessionDir } = await import('../src/session-dir.ts');
const { expireArchives } = await import('../src/routes/sessions-api.ts');

const DAY = 86_400_000;
const archive = (id: string, at: number) => ({
  version: 1 as const, id, name: id, key: id, archived_at: new Date(at).toISOString(), cwd: isolated,
  agent: 'claude', provider_session_id: '00000000-0000-4000-8000-000000000000',
  tags: ['system'], leads: [], wipeboards: [], project_root: '',
});

test('the period is one constant: seven days', () => {
  assert.equal(ARCHIVE_DAYS, 7);
  const now = Date.now();
  const picked = expiredArchives([archive('old', now - 8 * DAY), archive('edge', now - 6 * DAY)], now);
  assert.deepEqual(picked.map((a) => a.id), ['old']);
});

test('an expired archive goes with its session folder; a recent one stays', async () => {
  const now = Date.now();
  for (const [id, at] of [['stale-key', now - 9 * DAY], ['fresh-key', now - DAY]] as const) {
    await writeArchive(archive(id, at));
    await fs.mkdir(sessionDir(id), { recursive: true });
    await fs.writeFile(path.join(sessionDir(id), 'transcript.jsonl'), '');
  }
  assert.deepEqual(await expireArchives(now), ['stale-key']);
  assert.deepEqual((await listArchives()).map((a) => a.id), ['fresh-key']);
  await assert.rejects(fs.stat(sessionDir('stale-key')));
  await fs.stat(sessionDir('fresh-key'));
  await assert.rejects(fs.stat(path.join(ARCHIVE_DIR, 'stale-key.json')));
});

test('expiry runs at service start and after each new archive, through the Hard Delete removal', async () => {
  const route = await fs.readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
  const index = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(index, /void expireArchives\(\)/);
  const write = route.slice(route.indexOf('async function archiveWith'), route.indexOf('async function deleteArchived'));
  assert.match(write, /await writeArchive\(archived\)[\s\S]*void expireArchives\(\)/);
  const hard = route.slice(route.indexOf("app.delete('/api/archived-sessions/:id'"), route.indexOf("app.delete('/api/sessions/:name'"));
  assert.match(hard, /await deleteArchived\(archived\)/);
  assert.match(route.slice(route.indexOf('export async function expireArchives')), /await deleteArchived\(archived\)/);
});
