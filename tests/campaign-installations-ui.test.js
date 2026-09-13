import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Campaign installations use ERABI rows and gate Services dependants in the shared control', async () => {
  const source = await readFile(new URL('../public/js/campaign-installations.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ ask \} from '\.\/ask\.js'/);
  assert.match(source, /const question = ask\(/);
  assert.match(source, /\{ v: 'off', l:/);
  assert.match(source, /\{ v: 'off', l:[^\n]+off: required/);
  assert.match(source, /\{ v: 'on', l:[^\n]+off: required/);
  assert.match(source, /Ronin Services required/);
  assert.match(source, /installed\?\.services\?\.parts/);
  assert.doesNotMatch(source, /cv-switch|type = 'checkbox'/);
  assert.match(source, /save\(installation\.name, answer\[installation\.name\] === 'on'/);
});
