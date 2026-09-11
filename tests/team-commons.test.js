import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Commons opens on its separate Roster and keeps Configuration separate', async () => {
  const view = await source('public/js/cowork-view.js');
  assert.match(view, /label: t\('team\.commons', 'Commons'\)/);
  assert.match(view, /channels: \[\s*\{ id: 'roster'/);
  assert.match(view, /selected: 'roster'/);
  assert.match(view, /services: \{ roster: service\(roster\)[\s\S]*'team-configuration': service\(config\)/);
  assert.match(view, /commons\.roster\.replaceChildren\(members\)/);
  assert.match(view, /commons\.config\.replaceChildren\(config\)/);
  assert.doesNotMatch(view, /commons\.config\.replaceChildren\(members, config\)/);
});

test('Roster Open uses the paired workspace and Close reuses the tile retirement dialog', async () => {
  const [view, members, retirement, css] = await Promise.all([
    source('public/js/cowork-view.js'), source('public/js/team-members.js'), source('public/js/session-retire.js'), source('public/css/team-workspace.css'),
  ]);
  assert.match(view, /workspace1: 'workspace2', workspace2: 'workspace1', workspace3: 'workspace4', workspace4: 'workspace3'/);
  assert.match(view, /onOpen: \(member\) => putSession\(member\.name, oppositeSeat\(id\)\)/);
  assert.match(view, /reading: readingsOf/);
  assert.match(view, /provider: \(row\.provider \|\| ''\)\.toLowerCase\(\)/);
  assert.match(view, /onClose: \(member\) => retireSession\(member\.name/);
  assert.match(members, /actions: \[open, rename, lead, eject, close\]/);
  assert.match(members, /classList\.add\('league-team-member-live'\)/);
  assert.match(css, /\.league-team-member-detail\[hidden\] \{ display: none; \}/);
  assert.match(members, /toggle\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(members, /toggle\.setAttribute\('aria-controls', detail\.id\)/);
  assert.match(members, /reading\.description/);
  assert.match(members, /actions: \[rename, lead, eject, close\]/);
  assert.match(css, /\.league-team-member-actions \{[^}]*flex-wrap: wrap;[^}]*justify-content: flex-end;/);
  for (const label of ['Archive', 'Delete', 'Hard Delete']) assert.match(retirement, new RegExp(`'${label}'`));
});
