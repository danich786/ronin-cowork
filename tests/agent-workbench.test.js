import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultWorkspaceState } from '../public/js/workspace.js';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

test('Agent is a first-class Workbench destination with tab-instance state', async () => {
  const [main, workspace] = await Promise.all([source('main.js'), source('workspace.js')]);
  assert.match(main, /workspace\.register\('agent', createAgentView\(\)\)/);
  assert.match(workspace, /workbenchTabs: \{\}/);
  assert.deepEqual(defaultWorkspaceState().workbenchTabs, {});
});

test('Agent profile reuses Self, pure Documents, membership, Work Items and generic surfaces', async () => {
  const text = await source('agent-view.js');
  assert.match(text, /self: WORKBENCH_TYPES\.terminal/);
  assert.match(text, /documents: WORKBENCH_TYPES\.agentDocuments/);
  assert.match(text, /teams: WORKBENCH_TYPES\.agentTeams/);
  assert.match(text, /registerWorkbenchCatalog\(\)/);
  assert.doesNotMatch(text, /profiles\.define|library\.register/, 'Agent owns no private profile or catalog');
  assert.match(text, /sessions: \(\) => agent \? \[\{ key: agent, label: t\('agent\.self', 'Self'\) \}\] : \[\]/);
  assert.match(text, /terminal: \(id\) =>/);
  assert.match(text, /pool\.show\(agent, false\)/, 'the route Agent owns the terminal');
  assert.match(text, /createWarmTerminalPool/);
  assert.doesNotMatch(text, /createTabbedSurface/);
  assert.match(text, /createSurface\(\{ label: t\('workspace\.tab_docs', 'Documents'\)/);
  assert.match(text, /setTeamMembership/);
  assert.doesNotMatch(text, /request\([^\n]*\/teams[^\n]*membership/);
});

test('Agent first-open seats Self beside immutable/current composition facts', async () => {
  const text = await source('agent-view.js');
  assert.match(text, /workspace1: \{ type: TYPES\.self, key: agent \}/);
  assert.match(text, /workspace2: \{ type: TYPES\.composition, key: agent \}/);
  assert.match(text, /context\.workbenchEntry\(defaults\)/);
  assert.match(text, /normalizeWorkbenchState\(state, bench\.declaration\)/);
});

test('Agent dismissal persists an intentional empty seat and does not reseed on refresh', async () => {
  const text = await source('agent-view.js');
  assert.match(text, /change\?\.dismissed[\s\S]*DISMISSED_WORKSPACE/);
});
