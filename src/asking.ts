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
const MOVED_ON = new Set(['Stop', 'UserPromptSubmit', 'PostToolUse', 'PostToolUseFailure', 'PermissionDenied', 'ElicitationResult']);

/** true raises the flag, false lowers it, null leaves it as it is. */
export function asksFromHook(event: HookEvent): boolean | null {
  const name = event.hook_event_name ?? '';
  if (name === 'PermissionRequest' || name === 'Elicitation') return true;
  if (name === 'PreToolUse') return event.tool_name === 'AskUserQuestion';
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
