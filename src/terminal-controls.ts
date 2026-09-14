import { readFile } from 'node:fs/promises';
import type { Express } from 'express';
import { readMachineSettingsSection, updateDocument } from './machine-settings.js';
import { agentSpec } from './agents.js';
import { exactPane, listSessions } from './tmux.js';
import { tmux } from './tmux-client.js';
import { withMessageTarget } from './message-queue.js';

export const CONTROL_DEFAULTS = Object.freeze({ copy: 'Ctrl+Shift+C', clear: 'Ctrl+Shift+Backspace', close: 'Ctrl+C', stop: 'Escape' });
export type TerminalIntent = keyof typeof CONTROL_DEFAULTS;
export type ControlBindings = Record<TerminalIntent, string>;
export function validateBindings(input: unknown): ControlBindings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Supply the four shortcut bindings.');
  const bindings = input as Record<string, unknown>;
  if (Object.keys(bindings).some((k) => !(k in CONTROL_DEFAULTS))) throw new Error('Unknown terminal action.');
  const result = {} as ControlBindings;
  for (const intent of Object.keys(CONTROL_DEFAULTS) as TerminalIntent[]) {
    const key = bindings[intent];
    if (typeof key !== 'string' || !/^(?:(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?(?:Meta\+)?(?:[A-Z]|Backspace|Delete|Enter|Escape)|F(?:[1-9]|1[0-2]))$/.test(key)) throw new Error(`Invalid shortcut for ${intent}. Use Ctrl+X, Escape, or a function key.`);
    if (/^(?:Shift\+)?[A-Z]$/.test(key) || ['Enter', 'Backspace', 'Delete', 'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'Ctrl+L', 'Meta+C', 'Meta+V', 'Meta+X', 'Meta+W', 'Meta+Q', 'Alt+F4', 'F5', 'F11', 'F12'].includes(key)) throw new Error(`${key} belongs to typing or the browser. Choose another shortcut.`);
    result[intent] = key;
  }
  if (new Set(Object.values(result)).size !== 4) throw new Error('Each action needs a different shortcut.');
  return result;
}
export async function controlBindings(): Promise<ControlBindings> {
  const stored = await readMachineSettingsSection('terminalControls', { bindings: CONTROL_DEFAULTS });
  try { return validateBindings(stored.bindings); } catch { return { ...CONTROL_DEFAULTS }; }
}
export function agentControlKeys(cli: string, intent: 'stop' | 'clear'): readonly string[] {
  const keys = agentSpec(cli)?.controls[intent];
  if (!keys?.length) throw new Error(`No ${intent} binding is registered for ${cli || 'this terminal'}. Local Clear and Copy still work.`);
  return keys;
}
export function registerTerminalControls(app: Express): void {
  app.get('/api/terminal-controls/help', async (_req, res) => res.type('text/plain').send(await readFile(new URL('../docs/terminal-controls.md', import.meta.url), 'utf8')));
  app.get('/api/terminal-controls', async (_req, res) => res.json({ bindings: await controlBindings(), defaults: CONTROL_DEFAULTS }));
  app.put('/api/terminal-controls', async (req, res) => {
    let bindings: ControlBindings;
    try { bindings = validateBindings(req.body?.bindings); }
    catch (e) { return res.status(400).json({ error: (e as Error).message }); }
    await updateDocument((doc) => { doc.terminalControls = { bindings }; });
    res.json({ bindings, defaults: CONTROL_DEFAULTS });
  });
  app.post('/api/sessions/:name/control-action', async (req, res) => {
    const intent = req.body?.intent;
    if (intent !== 'stop' && intent !== 'clear') return res.status(400).json({ error: 'Choose Stop or Clear.' });
    const session = (await listSessions()).find((s) => s.name === req.params.name);
    if (!session || session.key !== req.body?.key) return res.status(409).json({ error: 'This Agent session changed. Reopen its Tile.' });
    let keys: readonly string[];
    try { keys = agentControlKeys(session.identity?.cli || session.agent, intent); }
    catch (e) { return res.status(422).json({ error: (e as Error).message }); }
    try {
      await withMessageTarget(session.key, async () => {
        await tmux.run(['send-keys', '-t', exactPane(session.name), '-X', 'cancel']).catch(() => {});
        await tmux.run(['send-keys', '-t', exactPane(session.name), ...keys]);
      });
      res.json({ ok: true, message: intent === 'stop' ? 'Stop sent' : 'Clear sent to CLI input' });
    } catch (e) { res.status(409).json({ error: (e as Error).message }); }
  });
}
