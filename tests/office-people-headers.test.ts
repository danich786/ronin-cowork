import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';

// Core's own launch of Mika passes a request with no headers. person() used to throw on
// req.headers['x-forwarded-email'] in an office_unit and take the server down, and callerOf()
// on req.get(), which made her first launch answer 500; both read it as nobody.
test('office_unit: a request with no headers is nobody, never a throw', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-people-'));
  process.env.RONIN_OFFICE_UNIT_DIR = dir;
  await fs.writeFile(path.join(dir, 'office_record.json'), JSON.stringify({ office_id: 'ou_t', office_park: 'office-park-1', gateway_office: 'http://10.0.0.2:4912', provisioned_at: '2026-11-15T00:00:00Z' }));
  const { person, startOfficePeople } = await import('../src/office-people.js');
  const { callerOf } = await import('../src/routes/work-items-api.js');
  assert.equal(callerOf({ body: {} } as never), 'unknown', 'callerOf: a request with no headers is nobody');
  assert.equal(callerOf({ body: {}, headers: { 'x-ronin-source': 'user_tab' } } as never), 'owner');
  const stop = await startOfficePeople();
  try {
    assert.equal(person({} as IncomingMessage), null);
    assert.equal(person({ headers: {} } as IncomingMessage), null);
    assert.equal(person({ headers: { 'x-forwarded-email': 'A@x.com' } } as unknown as IncomingMessage)?.email, 'a@x.com');
  } finally { stop(); delete process.env.RONIN_OFFICE_UNIT_DIR; await fs.rm(dir, { recursive: true, force: true }); }
});
