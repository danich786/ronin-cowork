import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { birthMandateFromReceipt } from '../src/agent-composition.js';

test('legacy receipts do not invent immutable birth mandate facts', () => {
  assert.equal(birthMandateFromReceipt({}), null);
  assert.deepEqual(birthMandateFromReceipt({ mandate: { reach: 'execute', recruit: 'nobody', output: ['code', 'an artifact'] } }), {
    reach: 'execute', recruit: 'nobody', output: ['code', 'an artifact'],
  });
});

// UPDATE (owner, 2026-10-24): the chosen list is written whole, so an unticked behaviour — born
// or added — is simply not in it. A session from before Update, with additions only, still
// reads as born plus additions (a store move reads the old location).
