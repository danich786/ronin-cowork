/**
 * Real-tmux regression for the viewer leak of 2026-09-04. A viewer is only
 * reclaimable if the ownership mark actually reaches tmux; a pure predicate test
 * cannot prove the target syntax was accepted by the installed tmux version.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { closeTestServer, openTestServer } from './helpers/testserver.js';

// An install whose .env still carries the retired TMUX_MOUSE=off must not reach the viewer.
// Set before any src module loads: machine settings read the environment once.
process.env.TMUX_MOUSE = 'off';
const { exactPane } = await import('../src/tmux.js');
const { createViewer, VIEWER_OPT, viewerOwner } = await import('../src/viewer.js');

test('a created viewer carries the ownership mark tmux cleanup reads back', async (t) => {
  const server = await openTestServer('viewer_ownership', { onPath: true });
  t.after(() => closeTestServer(server));
  await server.run('new-session', '-d', '-s', 'owner_target');

  const viewer = await createViewer('owner_target', 'probe');
  const mark = await server.run('show-option', '-qv', '-t', exactPane(viewer), VIEWER_OPT);

  assert.equal(mark, viewerOwner());
});

test('a created viewer has mouse on, so the wheel reaches the tile as a scroll and not as Up/Down', async (t) => {
  const server = await openTestServer('viewer_mouse', { onPath: true });
  t.after(() => closeTestServer(server));
  await server.run('new-session', '-d', '-s', 'mouse_target');

  const viewer = await createViewer('mouse_target', 'probe');

  assert.equal(await server.run('show-option', '-qv', '-t', exactPane(viewer), 'mouse'), 'on');
});
