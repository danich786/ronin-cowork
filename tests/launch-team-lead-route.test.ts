import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { closeTestServer, openTestServer } from './helpers/testserver.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-team-lead-launch-'));
process.env.RONIN_USER_ROOT = path.join(root, 'user');
process.env.RONIN_DATA_ROOT = path.join(root, 'data');
process.env.RONIN_CATALOGS_DIR = path.join(root, 'catalogs');
process.env.RONIN_CONFIG_DIR = path.join(root, 'config');
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(root, 'teams');
process.env.RONIN_SESSION_BOOT_DIR = path.join(root, 'session-boot');
process.env.RONIN_SESSION_BOOT_CACHE_DIR = path.join(root, 'session-boot-cache');
await fs.mkdir(process.env.RONIN_CATALOGS_DIR, { recursive: true });
await fs.mkdir(process.env.RONIN_CONFIG_DIR, { recursive: true });
await fs.writeFile(path.join(process.env.RONIN_CATALOGS_DIR, 'PROJECT_ROOTS.md'), [
  '# Project roots', '', '## ronin_cowork', `- **dir:** ${root}`, '- **remit:** test', '',
].join('\n'));
await fs.writeFile(path.join(process.env.RONIN_CONFIG_DIR, 'machine_settings.json'), JSON.stringify({
  campaigns: { home_machine: { title: 'Home', state: 'active', config: { installations: {}, defaults: {} } } },
}));

const scratch = await openTestServer(`lead-launch-${process.pid}`, { onPath: true });
const { registerLaunch } = await import('../src/routes/launch.js');
const { createTeamRoster } = await import('../src/team-rosters.js');
await createTeamRoster('surface', { objective: 'Build it.', project_root: 'ronin_cowork', repos: [], branch: '' });

const app = express();
app.use(express.json());
registerLaunch(app);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

test.after(async () => {
  server.close();
  await closeTestServer(scratch);
  await fs.rm(root, { recursive: true, force: true });
});

test('POST /api/launch births a Team lead before its composition directory exists', async () => {
  const response = await fetch(`${base}/api/launch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      session_type: 'cowork_agent', team: 'surface', team_lead: true,
      name: 'web_lead', instructions: 'Lead the web work.',
      mandate: { reach: 'open', recruit: 'open', output: ['open'] },
      cmd: '/bin/sh',
    }),
  });
  const body = await response.json() as { error?: string; receipt?: { role?: string; team_lead?: boolean } };
  assert.equal(response.status, 200, body.error);
  assert.equal(body.receipt?.role, 'lead');
  assert.equal(body.receipt?.team_lead, true);
  assert.equal(await scratch.run('has-session', '-t', '=web_lead'), '');
});
