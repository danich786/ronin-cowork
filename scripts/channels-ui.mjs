#!/usr/bin/env node
// Explicit diagnostic: real browser + channel API + local Slack HTTP/WebSocket emulator.
import assert from 'node:assert/strict';
import { loadPlaywright } from './lib/ui-host.mjs';
import { channelFixture, until } from '../tests/helpers/channel-fixture.ts';

const playwright = await loadPlaywright();
if (!playwright) throw new Error('Playwright is required; see scripts/lib/ui-host.mjs.');
const f = await channelFixture();
let browser;
try {
  await f.slack.identify();
  f.slack.start();
  await until(() => f.slack.status.connected);
  browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(f.url);
  await page.getByLabel('New channel ID', { exact: true }).fill('support');
  await page.getByLabel('Channel title', { exact: true }).fill('Support');
  await page.getByRole('button', { name: 'Create channel', exact: true }).click();
  await page.getByLabel('Slack channel ID (C… or G…)', { exact: true }).fill('CTEST');
  await page.getByRole('button', { name: 'Connect Slack', exact: true }).click();
  await until(async () => Boolean((await f.channels.get('support')).binding));
  await page.getByLabel('Allow replies to external chat', { exact: true }).check();
  await page.getByRole('button', { name: 'Save subscription', exact: true }).click();
  await until(async () => (await f.channels.get('support')).subscriptions.length === 1);
  f.event('ui-event', { text: '<img src=x onerror="window.injected=true"> auth question' });
  await until(() => f.acknowledged.includes('ui-event'));
  await f.channels.pump();
  assert.equal(f.notices[0].name, 'agent-a');
  await page.locator('.rc-message').filter({ hasText: 'auth question' }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  await page.getByLabel('Post to this channel and its connected external chat', { exact: true }).fill('Owner response');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await until(async () => (await f.channels.get('support')).messages.length === 2);
  await f.channels.pump();
  assert.equal(f.posts[0].text, 'owner\nOwner response');
  // Recover an ambiguous delivery visibly rather than silently repeating it.
  f.fail('unknown');
  await page.getByLabel('Post to this channel and its connected external chat', { exact: true }).fill('Uncertain response');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await until(async () => (await f.channels.get('support')).messages.length === 3);
  await f.channels.pump();
  await page.getByRole('button', { name: 'Retry (may duplicate; check Slack first)', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Dismiss outbound delivery', exact: true }).click();
  await until(async () => !(await f.channels.get('support')).messages[2].delivery);
  await page.getByRole('button', { name: 'Archive channel', exact: true }).click();
  await until(async () => (await f.channels.get('support')).archived);
  await page.getByRole('button', { name: 'Restore channel', exact: true }).click();
  await until(async () => !(await f.channels.get('support')).archived);
  await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click();
  await until(async () => !(await f.channels.get('support')).subscriptions.length);
  await page.getByRole('button', { name: 'Disconnect Slack', exact: true }).click();
  await until(async () => !(await f.channels.get('support')).binding);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: browser create/bind/subscribe, Slack inbound, escaped rendering, outbound, recovery, archive/restore, unsubscribe/disconnect, narrow viewport');
} finally {
  await browser?.close();
  await f.close();
}
