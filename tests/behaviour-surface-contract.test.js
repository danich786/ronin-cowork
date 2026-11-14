import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const surface = await readFile(new URL('../public/js/behaviour-surface.js', import.meta.url), 'utf8');
const campaign = await readFile(new URL('../public/js/campaign-view.js', import.meta.url), 'utf8');
const launch = await readFile(new URL('../public/js/launch-view.js', import.meta.url), 'utf8');
const catalog = await readFile(new URL('../public/js/workbench-catalog.js', import.meta.url), 'utf8');
const docs = await readFile(new URL('../public/js/docs.js', import.meta.url), 'utf8');
const agent = await readFile(new URL('../public/js/new-agent.js', import.meta.url), 'utf8');
const cowork = await readFile(new URL('../public/js/cowork-view.js', import.meta.url), 'utf8');

test('Behavior work surface is the user layer: their brief settings, and every file to read or replace by name', async () => {
  assert.match(surface, /createPhalanx/);
  assert.match(surface, /createBriefSettingsPanel\(\{ layer: 'user'/);
  assert.match(surface, /request\('\/api\/brief\/catalog'/);
  assert.match(surface, /\/api\/brief\/files\/\$\{encodeURIComponent\(row\.scope\)\}/);
  assert.match(surface, /renderMarkdownDocument/);
  // Written through the plain form (BRIEF_MODEL §8): a new file, the user's own version, or an update.
  const author = await readFile(new URL('../public/js/brief-author.js', import.meta.url), 'utf8');
  assert.match(surface, /createAuthorForm\(/);
  assert.match(author, /method: 'POST'/);
  assert.match(author, /method: 'PUT'/);
  assert.match(author, /shadow: true/);
  assert.doesNotMatch(surface, /\/api\/ways|All Cowork Agents|'Conditional'/);
});

test('the central catalog registers Behavior once and admits every reading profile', () => {
  assert.match(catalog, /registerBehaviourSurface\(\)/);
  for (const profile of ['launch', 'cowork', 'team', 'campaign']) {
    assert.match(catalog, new RegExp(`profiles\\.define\\(WORKBENCH_PROFILES\\.${profile}, \\[.*BEHAVIOUR_SURFACE_TYPE`));
  }
  assert.match(campaign, /registerWorkbenchCatalog\(\)/);
  assert.match(launch, /registerWorkbenchCatalog\(\)/);
  assert.doesNotMatch(campaign, /registerBehaviourSurface/);
  assert.doesNotMatch(launch, /registerBehaviourSurface/);
});

test('Behavior implementation keeps the coordinated Docs editor boundary untouched', () => {
  assert.doesNotMatch(surface, /from ['"]\.\/docs\.js/);
  assert.match(docs, /export function createDocumentWorkspaceAdapter/);
});

test('New Agent offers the shared Behavior surface beside its optional choices', async () => {
  const brief = await readFile(new URL('../public/js/brief-step.js', import.meta.url), 'utf8');
  assert.match(brief, /Customize Behaviors/);
  assert.match(brief, /action: \(\) => openBehaviours\(\)/);
  assert.match(cowork, /openBehaviours: \(\) => bench\.place\(BEHAVIOUR_SURFACE_TYPE, oppositeSeat\(id\)\)/);
  assert.match(agent, /ronin:behaviours-changed/);
  assert.match(brief, /shape: 'tall'/, 'New Agent and the layer pages share the same large Behavior stones');
  assert.match(brief, /view: \{ name: row\.name, scope: scopeOf\(row\.kind\) \}/, 'every Behavior stone keeps its View action');
});
