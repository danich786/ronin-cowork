import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Execute the real service gate with a fake network: no installed services or
// user's tmux server are involved. The .env file is the app's actual input seam.
for (const [label, dotenv, extra, expected] of [
  ['installed loopback', 'BIND=127.0.0.1\nPORT=4810\n', {}, 'http://127.0.0.1:4810/'],
  ['fallback backend port', 'BIND="127.0.0.1"\nPORT=3776\n', {}, 'http://127.0.0.1:3776/'],
  ['service environment wins', 'BIND=127.0.0.1\nPORT=3776\n', { BIND: '100.64.0.2', PORT: '4900' }, 'http://100.64.0.2:4900/'],
  ['unrecorded source defaults', '', {}, 'http://100.64.0.1:4810/'],
  ['IPv6 wildcard', 'BIND=::\n', {}, 'http://[::1]:4810/'],
] as const) {
  test(`service gate resolves ${label}`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ronin-gate-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, 'libexec'));
    fs.mkdirSync(path.join(root, 'bin'));
    fs.copyFileSync('libexec/ronin-gate', path.join(root, 'libexec/ronin-gate'));
    fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, '.env'), dotenv);
    fs.writeFileSync(path.join(root, 'libexec/ronin-render-check.sh'),
      'render_check() { RENDER_REPORT="no browser"; return 2; }\n');
    fs.writeFileSync(path.join(root, 'bin/tailscale'), '#!/bin/sh\necho 100.64.0.1\n', { mode: 0o755 });
    fs.writeFileSync(path.join(root, 'bin/curl'), '#!/bin/sh\nfor arg; do printf "%s\\n" "$arg"; done > "$CALLS"\n', { mode: 0o755 });
    const env: NodeJS.ProcessEnv = { ...process.env, ...extra, PATH: `${root}/bin:${process.env.PATH}`, CALLS: `${root}/calls` };
    for (const key of ['BIND', 'PORT', 'RONIN_GATE_URL']) {
      if (!(key in extra)) delete env[key];
    }
    const out = execFileSync('bash', [path.join(root, 'libexec/ronin-gate')], { env, encoding: 'utf8' });
    assert.match(out, /RONIN GATE: SKIP/);
    assert.equal(fs.readFileSync(`${root}/calls`, 'utf8').trim().split('\n').at(-1), `${expected}api/health`);
  });
}
