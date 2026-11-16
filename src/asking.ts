/**
 * IS THIS AGENT STOPPED AT A QUESTION? From the CLI's own hooks (KAN-616).
 *
 * Claude Code and Codex run `ronin-asking` on their hook events (docs/agents/claude.md,
 * codex.md); it posts the event here. A question raises the flag; the CLI moving on (the
 * turn ends, the person sends a prompt, the next tool runs) lowers it. The home row reads
 * it beside the screen read (src/routes/launch.ts), which stays for what no hook tells: a
 * login lapsing mid-run, Codex's request_user_input.
 */
export interface HookEvent { hook_event_name?: string | null; tool_name?: string | null; notification_type?: string | null }

// Claude's Notification types that mean the person is wanted; idle_prompt is a finished turn.
const ASKING_NOTICES = new Set(['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input']);
const ASKING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);
const MOVED_ON = new Set(['Stop', 'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'PermissionDenied', 'ElicitationResult']);

/** true raises the flag, false lowers it, null leaves it as it is. */
export function asksFromHook(event: HookEvent): boolean | null {
  const name = event.hook_event_name ?? '';
  if (name === 'PermissionRequest' || name === 'Elicitation') return true;
  // Claude's question dialog, and its plan approval (KAN-618); any other tool is moving on.
  if (name === 'PreToolUse') return ASKING_TOOLS.has(event.tool_name ?? '');
  if (name === 'Notification') return ASKING_NOTICES.has(event.notification_type ?? '') ? true : null;
  return MOVED_ON.has(name) ? false : null;
}

const asking = new Set<string>();
export const askingByHook = (session: string): boolean => asking.has(session);

/** Record one hook event; says whether the flag moved. */
export function recordHook(session: string, event: HookEvent): boolean {
  const now = asksFromHook(event);
  if (now === null || now === asking.has(session)) return false;
  if (now) asking.add(session); else asking.delete(session);
  return true;
}
export const forgetAsking = (session: string): void => void asking.delete(session);

/**
 * NO PROGRESS (owner, 2026-11-16, KAN-618): an Agent that reads working while its conversation's
 * newest record is 12 minutes old is flagged, as a question is. `at` is that record's time, which
 * the home row already has; new activity moves it and the flag goes. One timer per Agent, set
 * for the moment `at` turns 12 minutes old: it reads nothing, it only asks for the row again.
 */
export const NO_PROGRESS_MS = 12 * 60 * 1000;
export function createNoProgress(due: (session: string) => void, now: () => number = Date.now,
  schedule: (fire: () => void, ms: number) => unknown = (fire, ms) => setTimeout(fire, ms).unref()) {
  const armed = new Map<string, { at: string; timer: unknown }>();
  const disarm = (session: string) => {
    const was = armed.get(session);
    if (was) clearTimeout(was.timer as ReturnType<typeof setTimeout>);
    armed.delete(session);
  };
  return {
    /** Is this row's Agent stuck? Arms or moves its one timer as a side effect. */
    check(session: string, stance: unknown, at: unknown): boolean {
      const since = typeof at === 'string' ? Date.parse(at) : NaN;
      if (stance !== 'working' || !Number.isFinite(since)) { disarm(session); return false; }
      const left = since + NO_PROGRESS_MS - now();
      if (left <= 0) { disarm(session); return true; }
      if (armed.get(session)?.at !== at) {
        disarm(session);
        armed.set(session, { at: at as string, timer: schedule(() => { armed.delete(session); due(session); }, left) });
      }
      return false;
    },
    forget: disarm,
  };
}
