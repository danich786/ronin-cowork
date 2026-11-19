/**
 * Sign-in: with a password set, the page and the API are closed until login, open after it,
 * closed again after logout; the login page never sends anyone off-site.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createHash, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { bootRonin, ROOT } from './helpers/ronin.js';

const ronin = await bootRonin('signin', { env: { NODE_ENV: 'production' } });
test.after(() => ronin.stop());

test('open with no password; after one is set the page and API need a login, and logout closes them', async () => {
  assert.equal((await ronin.api('/api/sessions')).status, 200, 'no password: open');

  // `ronin password set`, the owner's command: it reaches Ronin over the operator socket.
  const set = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const payload = JSON.stringify({ args: ['set'], input: 'correct horse\ncorrect horse\n' });
    const request = http.request({ socketPath: ronin.socket, path: '/api/cli/auth', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.once('error', reject);
    request.end(payload);
  });
  assert.equal(set.status, 200, set.body);
  assert.match(JSON.parse(set.body).stdout, /password set/);

  const destination = '/m?view=team%2Fclean-round';
  for (const headers of [{ accept: 'text/html' }, { accept: 'text/html', host: 'ronin.example.ts.net:4810' }]) {
    const gated = await fetch(`${ronin.base}${destination}`, { redirect: 'manual', headers });
    assert.equal(gated.status, 302);
    assert.equal(gated.headers.get('location'), `/login?next=${encodeURIComponent(destination)}`);
  }
  assert.equal((await ronin.api('/api/sessions')).status, 401);

  const wrong = await ronin.api('/api/login', { body: { password: 'wrong' } });
  assert.notEqual(wrong.status, 200);

  const login = await fetch(`${ronin.base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct horse' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
  assert.match(cookie, /^ronin_session=/);
  assert.equal((await fetch(`${ronin.base}${destination}`, { redirect: 'manual', headers: { cookie } })).status, 200);
  assert.equal((await ronin.api('/api/sessions', { headers: { cookie } })).status, 200);

  assert.equal((await fetch(`${ronin.base}/api/logout`, { method: 'POST', headers: { cookie } })).status, 200);
  assert.equal((await fetch(`${ronin.base}${destination}`, { redirect: 'manual', headers: { accept: 'text/html' } })).status, 302);

  const tool = await ronin.tool('item', ['search']);
  assert.equal(tool.status, 0, `Agents' tools still reach Ronin over the socket: ${tool.stderr}`);
});

test('a passkey login signed with a real key verifies; a forged, foreign, replayed or absent-user one does not', async () => {
  const { verifyAssertion } = await import('../src/passkey.js');
  const RP = 'box.example.ts.net';
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const cred = { id: 'cred-1', publicKey: (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).toString('base64'), alg: -7, rpId: RP, counter: 0, label: 'key', createdAt: '2026-11-19T00:00:00.000Z' };
  // What a browser posts back, built byte for byte as an authenticator does and signed for real.
  const assertion = (o: { challenge: string; rpId?: string; origin?: string; flags?: number }) => {
    const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: o.challenge, origin: o.origin ?? `https://${RP}:4810` }));
    const ad = Buffer.alloc(37);
    createHash('sha256').update(o.rpId ?? RP).digest().copy(ad, 0);
    ad[32] = o.flags ?? 0x05;
    const signed = Buffer.concat([ad, createHash('sha256').update(clientData).digest()]);
    return { clientDataJSON: clientData.toString('base64url'), authenticatorData: ad.toString('base64url'), signature: cryptoSign('sha256', signed, privateKey).toString('base64url') };
  };
  const once = (want: string) => { let spent = false; return (c: string) => !spent && c === want && (spent = true); };
  const check = (a: ReturnType<typeof assertion>, challenge: string, spent = once(challenge)) => verifyAssertion(cred, a, { rpId: RP, challengeSpent: spent }).ok;

  const good = assertion({ challenge: 'c1' });
  const spent = once('c1');
  assert.equal(check(good, 'c1', spent), true, 'a genuine login');
  assert.equal(check(good, 'c1', spent), false, 'the same login replayed');
  const tampered = { ...assertion({ challenge: 'c2' }), signature: assertion({ challenge: 'other' }).signature };
  assert.equal(check(tampered, 'c2'), false, 'a signature over something else');
  assert.equal(check(assertion({ challenge: 'c3', rpId: 'evil.example' }), 'c3'), false, 'another site');
  assert.equal(check(assertion({ challenge: 'c4', origin: 'https://evil.example' }), 'c4'), false, 'another origin');
  assert.equal(check(assertion({ challenge: 'c5', flags: 0x01 }), 'c5'), false, 'no user verification');
});

test('the login page returns to the page asked for, fragment included, and never off-site', async () => {
  const html = await fs.readFile(path.join(ROOT, 'public', 'login.html'), 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
  assert.ok(script);
  for (const [search, hash, expected] of [
    ['?next=%2F', '#/team/clean-round', '/#/team/clean-round'],
    ['?next=%2Fm%3Fview%3Dteam', '#/team/clean-round', '/m?view=team#/team/clean-round'],
    ['?next=%2F%2Fevil.example', '#/team/clean-round', '/#/team/clean-round'],
  ]) {
    const controls = new Map<string, any>();
    const element = (id: string) => {
      if (!controls.has(id)) controls.set(id, {
        value: id === 'pw' ? 'correct horse' : '', dataset: {},
        addEventListener(_event: string, handler: (event: { preventDefault(): void }) => Promise<void>) { this.submit = handler; },
        focus() {},
      });
      return controls.get(id);
    };
    let returned = '';
    vm.runInNewContext(script, {
      document: { getElementById: element }, URLSearchParams,
      location: { search, hash, replace: (url: string) => { returned = url; } },
      window: { isSecureContext: false }, matchMedia: () => ({ matches: false }),
      fetch: async (url: string) => ({ ok: true, text() { return this.json().then((b) => JSON.stringify(b)); }, json: async () => url === '/api/passkey/options' ? { registered: false } : { ok: true } }),
    });
    await element('f').submit({ preventDefault() {} });
    assert.equal(returned, expected, search);
  }
});
