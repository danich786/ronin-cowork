import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import test from 'node:test';
const { waitReady } = createRequire(import.meta.url)('../libexec/ronin-wait-ready.cjs');

async function server(t: test.TestContext, handle: http.RequestListener) {
  const s = http.createServer(handle);
  t.after(() => { s.closeAllConnections(); s.close(); });
  await new Promise<void>(resolve => s.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

test('readiness retries unavailable service and requires HTTP 200', async t => {
  let calls = 0;
  const url = await server(t, (req, res) => {
    assert.equal(req.url, '/api/health');
    res.writeHead(++calls < 3 ? 503 : 200).end();
  });
  await waitReady(url, { timeout: 2000, interval: 5 });
  assert.equal(calls, 3);
});

test('readiness allows a response taking longer than the old 500ms limit', async t => {
  const url = await server(t, (_, res) => setTimeout(() => res.end('{}'), 650));
  await waitReady(url, { timeout: 2000 });
});

test('readiness bounds a stalled request by the overall deadline', async t => {
  const url = await server(t, () => {});
  const started = performance.now();
  await assert.rejects(waitReady(url, { timeout: 80 }), /Request timed out/);
  assert.ok(performance.now() - started < 1000);
});

test('readiness retains the last HTTP error', async t => {
  const url = await server(t, (_, res) => res.writeHead(502).end());
  await assert.rejects(waitReady(url, { timeout: 80, interval: 10 }), /HTTP 502/);
});

test('HTTPS readiness never downgrades when TLS fails', async t => {
  const url = await server(t, (_, res) => res.end('{}'));
  await assert.rejects(waitReady(url.replace('http:', 'https:'), { timeout: 500, interval: 500 }), /EPROTO/);
});
