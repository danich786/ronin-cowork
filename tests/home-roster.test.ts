import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityCache } from '../src/status.js';

test('unchanged activity keeps the last classification without another capture', async () => {
  let captures = 0;
  const classify = createActivityCache(async (session: string) => {
    captures++;
    return `${session}:${captures}`;
  });

  assert.equal(await classify('agent', 100), 'agent:1');
  assert.equal(await classify('agent', 100), 'agent:1');
  assert.equal(captures, 1);
  assert.equal(await classify('agent', 101), 'agent:2');
  assert.equal(captures, 2);
});

test('a failed changed capture keeps the prior classification and retries later', async () => {
  let fail = false;
  let captures = 0;
  const classify = createActivityCache(async () => {
    captures++;
    if (fail) throw new Error('pane disappeared');
    return 'ready';
  });

  assert.equal(await classify('agent', 100), 'ready');
  fail = true;
  assert.equal(await classify('agent', 101), 'ready');
  assert.equal(await classify('agent', 101), 'ready');
  assert.equal(captures, 3, 'the failed activity stamp remains eligible for retry');
});

test('a question drawn in the second the pane was last read flags once that second is over (KAN-616)', async () => {
  const { readFileSync } = await import('node:fs');
  const { asksForInput } = await import('../src/status.js');
  const claude = '❯ 1. Credit balance\n  2. Spending limit\n  3. Type something.\n────\n  4. Chat about this\nEnter to select · ↑/↓ to navigate · Esc to cancel';
  const codex = readFileSync(new URL('./fixtures/codex-update-prompt.txt', import.meta.url), 'utf8');
  for (const [cli, question] of [['Claude', claude], ['Codex', codex]] as const) {
    const stamp = 1_794_860_697;
    let screen = '✻ Cerebrating… (12s · esc to interrupt)';
    let at = stamp * 1000 + 300; // the push that saw the output, inside the stamp's second
    let captures = 0;
    const asking = createActivityCache(async () => { captures++; return asksForInput(screen); }, () => at);
    assert.equal(await asking('agent', stamp), false, `${cli}: at work`);
    screen = question; // drawn later in the same second: tmux's stamp does not move
    at = stamp * 1000 + 1200; // tmux's report that the second is over
    assert.equal(await asking('agent', stamp), true, `${cli}: the question flags`);
    assert.equal(await asking('agent', stamp), true);
    assert.equal(captures, 2, `${cli}: a reading after the second is kept`);
  }
});
