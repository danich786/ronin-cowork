/**
 * A DEAD PANE (KAN-660): an Agent's CLI exited on its own (a crash, a signal, its scope stopped),
 * and remain-on-exit kept the pane. tmux's pane-dead push says so (src/tmux.ts); this is the one
 * place that hears it. The Agent's hook record reads `stopped`, with the exit status and time, in
 * the status field the hooks set (src/asking.ts), so its card and Chat say Stopped and offer
 * Resume; and its Team's leads are told once, through the house notice path. An Agent that ends
 * with session_end, or is closed, has its session killed: no pane is left to die, so neither
 * happens.
 */
import { enqueueMessage } from './message-queue.js';
import { keepHookRecord } from './asking.js';
import { exactPane, listSessions } from './tmux.js';
import { tmux } from './tmux-client.js';
import { sockets } from './sockets.js';
import { unfinishedHolds } from './work-items.js';

const hhmm = (at: Date) => at.toTimeString().slice(0, 5);

export async function paneDied(name: string): Promise<void> {
  const [status, time] = (await tmux.run(['display-message', '-p', '-t', exactPane(name), '#{pane_dead_status}\t#{pane_dead_time}']).catch(() => ''))
    .replace(/\s+$/, '').split('\t'); // not trim(): a signal leaves the status empty, and its tab must stay
  const at = time && Number(time) ? new Date(Number(time) * 1000) : new Date();
  const exit = status === '' || Number.isNaN(Number(status)) ? null : Number(status);
  await keepHookRecord(name, { stance: 'stopped', at: at.toISOString(), ...(exit === null ? {} : { exit }) });
  sockets.rowChanged(name);

  const sessions = await listSessions();
  const self = sessions.find((s) => s.name === name);
  const teams = self?.tags ?? [];
  const leads = sessions.filter((s) => s.name !== name && s.leads.some((team) => teams.includes(team))).map((s) => s.name);
  if (!leads.length) return;
  const held = (await unfinishedHolds(name).catch(() => [])).map((item) => item.id);
  const said = `${name} stopped (${exit === null ? 'exited' : `exit ${exit}`} at ${hhmm(at)}); its items: ${held.length ? held.join(', ') : 'none'}; Resume from its card.`;
  for (const lead of leads) await enqueueMessage(lead, said, 'house', 'Sessions').catch((e) => console.error(`[pane-death] notice to ${lead}:`, e));
}
