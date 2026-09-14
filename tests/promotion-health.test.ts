import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultUrl } from '../src/promotion/health.js';

function install(env: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ronin-promotion-health-'));
  fs.writeFileSync(path.join(dir, '.env'), env);
  return dir;
}

test('promotion health follows an existing install still configured on port 3006', () => {
  const dir = install('PORT=3006\nBIND=127.0.0.1\n');
  try {
    assert.equal(defaultUrl(dir, {}), 'http://127.0.0.1:3006/');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('promotion health follows the new installed default on port 4810', () => {
  const dir = install('PORT=4810\nBIND=127.0.0.1\n');
  try {
    assert.equal(defaultUrl(dir, {}), 'http://127.0.0.1:4810/');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('promotion health keeps explicit continuation environment above installed configuration', () => {
  const dir = install('PORT=3006\nBIND=127.0.0.1\n');
  try {
    assert.equal(defaultUrl(dir, { PORT: '9000', BIND: '10.0.0.8' }), 'http://10.0.0.8:9000/');
    assert.equal(defaultUrl(dir, { RONIN_GATE_URL: 'https://health.example/' }), 'https://health.example/');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
