import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const command = path.join(root, 'ronin_bin', 'ronin-host');
const retired = ['tejun-survey', 'tejun-account', 'tejun-secrets', 'tejun-machine-restart'];

test('ronin-host is the sole public host command and advertises its fixed vocabulary', async () => {
  await access(command);
  const source = await readFile(command, 'utf8');
  for (const subcommand of ['inspect', 'account', 'secrets', 'restart']) {
    assert.match(source, new RegExp(`^  ${subcommand}\\)`, 'm'));
  }
  assert.doesNotMatch(source, /systemctl.*\$|exec .*\$1/, 'dispatch cannot select an arbitrary operation');
  for (const name of retired) {
    await assert.rejects(access(path.join(root, 'ronin_bin', name)), `${name} must not exist, even as an alias`);
  }
});
