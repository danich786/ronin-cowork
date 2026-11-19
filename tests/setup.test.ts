/**
 * Setup and Help on a fresh box: Ronin answers health, Setup sees the provider CLIs, a
 * sign-in is noticed, the person's words are kept, and Help (Mika) launches once a provider
 * is signed in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { bootRonin, until } from './helpers/ronin.js';

const ronin = await bootRonin('setup');
test.after(() => ronin.stop());
type Provider = { id: string; installed: boolean; signed_in: boolean };
const provider = (body: { providers: Provider[] }, id: string) => body.providers.find((p) => p.id === id)!;

test('a fresh box answers health, the page, and an unanswered Setup', async () => {
  const health = await ronin.api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  const page = await fetch(`${ronin.base}/`, { headers: { accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') ?? '', /html/);
  const progress = (await ronin.api('/api/setup/progress')).body as { steps: Array<{ id: string; answered: boolean }> };
  assert.ok(progress.steps.some((s) => s.id === 'provider'));
  assert.ok(progress.steps.every((s) => !s.answered));
});

test('Setup sees the installed CLIs, not yet signed in; Help will not start and says why', async () => {
  const before = (await ronin.api('/api/setup/runtime')).body;
  assert.ok(before.providers, JSON.stringify(before).slice(0, 400));
  assert.equal(provider(before, 'claude').installed, true);
  assert.equal(provider(before, 'claude').signed_in, false);
  const refused = await ronin.api('/api/mika', { body: {} });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, 'mika_no_ready_provider');
});

test('a sign-in is noticed on refresh', async () => {
  await fs.mkdir(path.join(ronin.env.HOME!, '.claude'), { recursive: true });
  await fs.writeFile(path.join(ronin.env.HOME!, '.claude', '.credentials.json'), '{}');
  const after = (await ronin.api('/api/setup/providers/refresh', { body: {} })).body;
  assert.equal(provider(after, 'claude').signed_in, true);
});

test('the person\'s own words are kept and read back', async () => {
  const intro = 'I run a small bike shop and want help with the website.';
  assert.equal((await ronin.api('/api/setup/user-intro', { method: 'PUT', body: { intro } })).status, 200);
  assert.equal((await ronin.api('/api/setup/user-intro')).body.intro.trim(), intro);
});

test('Help (Mika) launches on the signed-in provider with her brief', async () => {
  const launched = await ronin.api('/api/mika', { body: {} });
  assert.equal(launched.status, 200, JSON.stringify(launched.body));
  const name = launched.body.name as string;
  assert.ok((await ronin.tmux.run('list-sessions', '-F', '#{session_name}')).split('\n').includes(name));
  const run = await until(async () => (await ronin.cliRuns()).find((r) => r.argv.startsWith('claude ')), 'Mika\'s CLI');
  assert.match(run.argv, /Mika/);
  const sessions = path.join(ronin.scratch, 'data', 'sessions');
  const folder = (await fs.readdir(sessions)).find((f) => f.startsWith(`${name}-`));
  assert.ok(folder, `Mika's session folder under ${sessions}`);
  assert.match(await fs.readFile(path.join(sessions, folder, 'AGENT_BIRTH_BRIEF.md'), 'utf8'), /Setup/);
});
