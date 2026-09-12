import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('Campaign defaults use ask() and Output keeps multi-select semantics', async () => {
  const [source, css] = await Promise.all([
    fs.readFile(new URL('../public/js/campaign-defaults.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../public/css/campaign-home.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(source, /controls\.output\.multiple\s*=\s*true/);
  assert.doesNotMatch(source, /controls\.output\.size\s*=/);
  assert.match(source, /const questions = ask\(/);
  assert.match(source, /key: 'output'.*many: true/);
  assert.match(source, /const next = \{ \.\.\.current, \.\.\.picked,/);
  assert.match(css, /\.cv-defaults-form > \.ask,[\s\S]*?\.cv-defaults-form > \.cv-default-field \{ grid-column: 1 \/ -1; \}/, 'questions take the full row and Behaviours follows beneath');
});
