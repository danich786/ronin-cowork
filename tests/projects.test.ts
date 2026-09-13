import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProject,
  PROJECT_EXITS,
  PROJECT_STAGES,
  PROJECT_STATUSES,
} from '../src/projects.js';

const project = {
  id: 'virtual-kanban/7',
  title: 'Kanban tab',
  objective: 'Team commons renders the projects.',
  stage: 'BUILDING',
  exit: 'user',
  status: 'green',
  ladder: [
    { stage: 'PLANNING', legs: [{ title: 'Plan agreed', done: true }] },
    { stage: 'LANDING' },
  ],
  evidence: ['commit 4f1e2c9'],
};

test('the canonical project shape keeps every authored field and has no owner machinery', () => {
  assert.deepEqual(normalizeProject(project), project);
  assert.deepEqual(PROJECT_STAGES, ['IDEAS', 'PLANNING', 'BUILDING', 'LANDING', 'DONE']);
  assert.deepEqual(PROJECT_EXITS, ['none', 'agent', 'lead', 'user']);
  assert.deepEqual(PROJECT_STATUSES, ['green', 'yellow', 'red']);
  assert.equal('owner' in normalizeProject(project)!, false);
});

test('malformed projects are absent instead of becoming partial cards', () => {
  assert.equal(normalizeProject({ ...project, stage: 'BACKLOG' }), null);
  assert.equal(normalizeProject({ ...project, exit: 'reviewer' }), null);
  assert.equal(normalizeProject({ ...project, status: 'blue' }), null);
  assert.equal(normalizeProject({ ...project, ladder: [{ stage: 'BUILDING', legs: [{ title: 'x', done: 'yes' }] }] }), null);
  assert.equal(normalizeProject({ ...project, evidence: ['commit ok', 7] }), null);
});
