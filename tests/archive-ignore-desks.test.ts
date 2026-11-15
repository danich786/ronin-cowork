/**
 * ARCHIVE PAST OPEN DESKS (w623; docs/using-ronin/archived-sessions.md, When the pane is stuck or
 * dead): archive refuses an Agent with an open desk and names --ignore-desks; with it the archive
 * goes ahead on a dead pane, every desk left as it is and named on the manifest; expiry removes
 * the archive, never the desk, and its lead notice says the desks are kept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { closeTestServer, openTestServer } from './helpers/testserver.js';

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-archive-ignore-desks-'));
process.env.HOME = tmp;
process.env.RONIN_USER_ROOT = path.join(tmp, 'user');
process.env.RONIN_DATA_ROOT = path.join(tmp, 'data');
process.env.RONIN_MESSAGE_QUEUE_DIR = path.join(tmp, 'queue');
process.env.RONIN_DESKS_DIR = path.join(tmp, 'desks');
process.env.RONIN_CATALOGS_DIR = path.join(tmp, 'catalogs');

const PROVIDER = '6b1f0c2e-4d3a-4f5b-9c8d-7e6f5a4b3c2d';

test('a dead pane with an open desk: refused with the way past, then archived with its desk kept', async (t) => {
  const server = await openTestServer('archive_ignore_desks', { onPath: true });
  t.after(async () => { await closeTestServer(server); await fs.rm(tmp, { recursive: true, force: true }); });
  const work = path.join(tmp, 'agent-cwd');
  await fs.mkdir(work, { recursive: true });
  await server.run('new-session', '-d', '-s', 'stuck', '-c', work, 'sleep 300');
  await server.run('set-option', '-w', '-t', 'stuck', 'remain-on-exit', 'on');
  await server.run('set-option', '-t', 'stuck', '@ronin-key', 'stuck-1');
  await server.run('set-option', '-t', 'stuck', '@ronin-agent', 'claude');
  process.kill(Number(await server.run('display-message', '-p', '-t', 'stuck', '#{pane_pid}')), 'SIGKILL');
  for (let i = 0; i < 100 && await server.run('display-message', '-p', '-t', 'stuck', '#{pane_dead}') !== '1'; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(await server.run('display-message', '-p', '-t', 'stuck', '#{pane_dead}'), '1', 'the pane is dead, its process gone');

  const { writeLaunchIdentity } = await import('../src/launch-binding.js');
  await writeLaunchIdentity({ key: 'stuck-1', cli: 'claude', strategy: 'minted', providerSession: PROVIDER, env: {} });
  const { writeDesk, deskRow } = await import('../src/desks/registry.js');
  const branch = 'team/system/stuck';
  await writeDesk({ repo: 'ronin_cowork', branch, session: 'stuck', owners: ['stuck'], state: 'open' } as unknown as Parameters<typeof writeDesk>[0]);
  const deskBefore = await fs.readFile(deskRow('ronin_cowork', branch), 'utf8');

  const { registerSessions, expireArchives, expiryNotice } = await import('../src/routes/sessions-api.js');
  const app = express();
  app.use(express.json());
  registerSessions(app);
  const http = app.listen(0, '127.0.0.1');
  t.after(() => http.close());
  await new Promise((resolve) => http.once('listening', resolve));
  const archive = (body: object) => fetch(`http://127.0.0.1:${(http.address() as AddressInfo).port}/api/sessions/stuck/archive`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  const refused = await archive({ ignore_items: true });
  assert.equal(refused.status, 409);
  const said = await refused.json() as { error: string; acknowledge: string; desks_open: string[] };
  assert.match(said.error, /owns open desk ronin_cowork:team\/system\/stuck/);
  assert.match(said.error, /In an emergency \(a stuck or dead pane\): session_archive stuck --ignore-desks keeps them for its restore\./);
  assert.equal(said.acknowledge, 'ignore_desks');
  assert.equal(await server.run('has-session', '-t', '=stuck').then(() => true, () => false), true, 'a refusal leaves it');

  const done = await archive({ ignore_desks: true, ignore_items: true });
  const body = await done.json() as { ok: boolean; archived: { id: string; desks_left_open: string[] } };
  assert.equal(done.status, 200, JSON.stringify(body));
  assert.deepEqual(body.archived.desks_left_open, [`ronin_cowork:${branch}`]);
  assert.equal(await server.run('has-session', '-t', '=stuck').then(() => true, () => false), false, 'the dead pane is stopped');

  const { readArchive, writeArchive, removeArchive } = await import('../src/session-archive.js');
  const manifest = await readArchive('stuck-1');
  assert.equal(manifest.provider_session_id, PROVIDER, 'the id comes from the launch identity, not the dead process');
  assert.equal(manifest.cwd, work, 'a dead pane has no current path; its start path is kept');
  assert.equal(await fs.readFile(deskRow('ronin_cowork', branch), 'utf8'), deskBefore, 'the desk is exactly as it was');

  // Expiry: the archive and its folder go; the desk stays and the lead is told so.
  await removeArchive('stuck-1');
  await writeArchive({ ...manifest, archived_at: new Date(Date.now() - 9 * 86_400_000).toISOString() });
  assert.deepEqual(await expireArchives(), ['stuck-1']);
  assert.equal(await fs.readFile(deskRow('ronin_cowork', branch), 'utf8'), deskBefore, 'expiry never touches a desk');
  assert.equal(expiryNotice(manifest),
    `stuck's archive stuck-1 expired; its open desk ronin_cowork:${branch} was left as it is, not deleted: close or hand over with worktree-desk.`);
  assert.equal(expiryNotice({ ...manifest, desks_left_open: undefined }), '');
});

test('expiry passes its notice to the lead through the one removal', async () => {
  const route = await fs.readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
  assert.match(route, /await deleteArchived\(archived, expiryNotice\(archived\)\)/);
  assert.match(route, /memberEnded\(name, restore \? `\$\{name\} ended, \$\{restore\}` : said\)/);
});
