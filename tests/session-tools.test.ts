import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');

async function fixture() {
  const requests: Array<{ method: string; url: string }> = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '' });
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url === '/api/sessions') {
      res.end('[]');
      return;
    }
    if (req.method === 'POST' && req.url === '/api/session') {
      res.end(JSON.stringify({ ok: true, name: 'unused', receipt: {} }));
      return;
    }
    res.statusCode = 404;
    res.end('{}');
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
  const result = await f.run('tejun-session-check', ['unused']);
  assert.equal(result.code, 3);
  assert.match(result.output, /NO-SESSION/);
  assert.deepEqual(f.requests, [{ method: 'GET', url: '/api/sessions' }]);
});

test('creation is an explicit command and uses the launch door', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('tejun-session-create', ['unused', '--prompt', 'Review it']);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /BORN unused/);
  assert.deepEqual(f.requests, [{ method: 'POST', url: '/api/session' }]);
});

test('updating a missing name refuses after its read and never creates it', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const result = await f.run('tejun-session-set', ['unused', '--root', 'lab']);
  assert.equal(result.code, 3);
  assert.match(result.output, /NO-SESSION.*tejun-session-create/s);
  assert.deepEqual(f.requests, [{ method: 'GET', url: '/api/sessions' }]);
});
