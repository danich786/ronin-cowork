import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

async function fixture(
  sessions: unknown[] = [],
  modelFacts?: { provider: string; cli: string; model: string },
  assignError = '',
) {
  const requests: Array<{ method: string; url: string; body: string }> = [];
  const server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method ?? '', url: req.url ?? '', body });
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET' && req.url === '/api/sessions') {
        res.end(JSON.stringify(sessions));
        return;
      }
      if (req.method === 'GET' && req.url === '/api/team-rosters/build') {
        res.end(JSON.stringify({ name: 'build', projects: [{ id: 'build/7', title: 'Render board', objective: 'Return live JSON.' }] }));
        return;
      }
      if (req.method === 'GET' && req.url === '/api/provider-catalog') {
        const facts = modelFacts ?? { provider: 'fixture-provider', cli: 'fixture-cli', model: `fixture-model-${process.pid}` };
        res.end(JSON.stringify({ origin: 'user', updated: 'fixture-date', providers: [{ provider: facts.provider, cli: facts.cli, label: 'Fixture Provider', models: [{ model: facts.model, tier: 'fixture-tier' }] }] }));
        return;
      }
      if (req.method === 'GET' && req.url === '/api/setup/runtime') {
        const facts = modelFacts ?? { provider: 'fixture-provider', cli: 'fixture-cli', model: `fixture-model-${process.pid}` };
        res.end(JSON.stringify({ providers: [{ id: facts.cli, installed: true, signed_in: true, activated: true }] }));
        return;
      }
      if (req.method === 'GET' && req.url === '/api/launch-seed') {
        const facts = modelFacts ?? { provider: 'fixture-provider', cli: 'fixture-cli', model: `fixture-model-${process.pid}` };
        res.end(JSON.stringify({ seeds: { provider: { value: facts.provider, stated_by: [{ source: 'fixture Campaign default' }] }, model: { value: facts.model, stated_by: [{ source: 'fixture Campaign default' }] } } }));
        return;
      }
      if (req.method === 'POST' && req.url === '/api/session') {
        const stated = JSON.parse(body || '{}') as { name?: string; team?: string };
        res.end(JSON.stringify({ ok: true, name: stated.name ?? 'unused', receipt: { team: stated.team } }));
        return;
      }
      if (req.method === 'POST' && req.url?.startsWith('/api/sessions/')) {
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.method === 'POST' && req.url === '/api/team-rosters/build/projects/7/assign') {
        if (assignError) { res.statusCode = 400; res.end(JSON.stringify({ error: assignError })); }
        else res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const run = async (tool: string, args: string[]) => {
    try {
      const result = await exec(path.join(root, 'ronin_bin', tool), args, {
        env: { ...process.env, RONIN_URL: `http://127.0.0.1:${address.port}`, RONIN_CLI_TOKEN: 'test' },
      });
      return { code: 0, output: result.stdout + result.stderr };
    } catch (error) {
      const e = error as { code?: number; stdout?: string; stderr?: string };
      return { code: e.code ?? 1, output: (e.stdout ?? '') + (e.stderr ?? '') };
    }
  };
  return { requests, run, close: () => server.close() };
}

test('checking an unused name is GET-only and never creates it', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('session_check', ['unused']);
  assert.equal(result.code, 3);
  assert.match(result.output, /NO-SESSION/);
  assert.deepEqual(f.requests, [{ method: 'GET', url: '/api/sessions', body: '' }]);
});

test('creation is an explicit command and uses the launch door', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('session_create', ['unused', '--prompt', 'Review it']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /BORN unused/);
  assert.equal(f.requests.length, 1);
  assert.deepEqual({ method: f.requests[0].method, url: f.requests[0].url }, { method: 'POST', url: '/api/session' });
});

test('raising for a project puts its identity in the brief and assigns it after birth', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('session_create', ['builder', '--project', 'build/7']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /ASSIGNED build\/7 to builder.*check your work record/);
  assert.deepEqual(f.requests.map(({ method, url }) => ({ method, url })), [
    { method: 'GET', url: '/api/team-rosters/build' },
    { method: 'POST', url: '/api/session' },
    { method: 'POST', url: '/api/team-rosters/build/projects/7/assign' },
  ]);
  const birth = JSON.parse(f.requests[1].body) as { prompt: string; team: string };
  assert.equal(birth.team, 'build');
  assert.match(birth.prompt, /Project build\/7: Render board\. Return live JSON\./);
});

test('raise reports a truthful partial result when placement fails after birth', async (t) => {
  const f = await fixture([], undefined, 'letter unavailable');
  t.after(f.close);
  const result = await f.run('session_create', ['builder', '--project', 'build/7']);
  assert.equal(result.code, 6);
  assert.match(result.output, /BORN builder/);
  assert.match(result.output, /PARTIAL: builder was born, but project build\/7 was not installed: letter unavailable/);
});

test('creation help renders current catalog choices, availability, and Campaign defaults', async (t) => {
  const facts = { provider: `provider-${process.pid}`, cli: `cli-${process.pid}`, model: `model-${process.pid}` };
  const f = await fixture([], facts);
  t.after(f.close);
  const result = await f.run('session_create', ['--help']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, new RegExp(`${facts.provider} \\(Fixture Provider\\) — available`));
  assert.match(result.output, new RegExp(`${facts.model} · fixture-tier — available`));
  assert.match(result.output, new RegExp(`Current launch default: ${facts.provider}/${facts.model} — fixture Campaign default`));
  assert.deepEqual(f.requests.map(({ method, url }) => `${method} ${url}`), [
    'GET /api/provider-catalog', 'GET /api/setup/runtime', 'GET /api/launch-seed',
  ]);
});

test('creation validates one catalog pair and forwards the selected provider and model unchanged', async (t) => {
  const facts = { provider: `provider-${process.pid}`, cli: `cli-${process.pid}`, model: `model-${process.pid}` };
  const f = await fixture([], facts);
  t.after(f.close);
  const result = await f.run('session_create', ['unused', '--provider', facts.provider, '--model', facts.model]);
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(f.requests.map(({ method, url }) => `${method} ${url}`), [
    'GET /api/provider-catalog', 'POST /api/session',
  ]);
  const body = JSON.parse(f.requests[1]!.body);
  assert.equal(body.name, 'unused');
  assert.equal(body.provider, facts.provider);
  assert.equal(body.model, facts.model);
});

test('creation reports invalid model choices from the current catalog response', async (t) => {
  const facts = { provider: `provider-${process.pid}`, cli: `cli-${process.pid}`, model: `model-${process.pid}` };
  const f = await fixture([], facts);
  t.after(f.close);
  const missing = `missing-${process.pid}`;
  const result = await f.run('session_create', ['unused', '--provider', facts.provider, '--model', missing]);
  assert.equal(result.code, 4);
  assert.match(result.output, new RegExp(`BAD-MODEL: ${facts.provider}/${missing}`));
  assert.match(result.output, new RegExp(`Available: ${facts.provider}/${facts.model}`));
  assert.deepEqual(f.requests.map(({ method, url }) => `${method} ${url}`), ['GET /api/provider-catalog']);
});

test('updating a missing name refuses after its read and never creates it', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('session_set', ['unused', '--root', 'lab']);
  assert.equal(result.code, 3);
  assert.match(result.output, /NO-SESSION.*session_create/s);
  assert.deepEqual(f.requests, [{ method: 'GET', url: '/api/sessions', body: '' }]);
});

test('value-taking flags refuse a missing value before making a request', async (t) => {
  const f = await fixture();
  t.after(f.close);
  for (const [tool, args] of [
    ['session_create', ['unused', '--prompt']],
    ['session_create', ['unused', '--team', '--lead']],
    ['session_set', ['unused', '--team']],
    ['session_set', ['unused', '--root', '--lead']],
  ] as const) {
    const result = await f.run(tool, [...args]);
    assert.equal(result.code, 2);
    assert.match(result.output, /BAD-ARG: .* requires a value/);
  }
  assert.deepEqual(f.requests, []);
});

test('updating safely JSON-encodes accepted Team names and lead payloads', async (t) => {
  const f = await fixture([{ name: 'active', tags: [], leads: [], control: 'read' }]);
  t.after(f.close);
  const result = await f.run('session_set', ['active', '--team', 'design-review_2', '--lead']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /UPDATED active team=design-review_2 人=design-review_2/);
  assert.deepEqual(f.requests.map(({ method, url, body }) => ({ method, url, body: body ? JSON.parse(body) : null })), [
    { method: 'GET', url: '/api/sessions', body: null },
    { method: 'POST', url: '/api/sessions/active/tags', body: { tags: 'design-review_2' } },
    { method: 'POST', url: '/api/sessions/active/team_lead', body: { teams: ['design-review_2'] } },
  ]);
});
