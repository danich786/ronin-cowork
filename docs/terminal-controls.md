# Terminal controls

Every Ronin browser Tile uses four actions. The CLI running inside it does not choose
your browser shortcuts. These controls work on desktop and mobile, locked or unlocked.

The complete default [input → CLI mapping table](README.md#terminal-controls) is at the
top of the documentation README. Clear means the entire unsubmitted input box.

**Hints** is pinned below the selector's scrolling cards, expanded on first use. Collapse
it if desired; its saved expansion state is independent of the roster. A failed locked-terminal
selection attempt expands Hints and flashes it orange, instead of showing a popup. Mobile puts the
same card below its terminal. The four action buttons appear only on mobile Tiles, including while the keyboard is
open. Desktop Hints shows bold labels and shortcuts, without action buttons or descriptions. Keyboard users can Tab to a
button and activate it with Enter or Space.

## Change your shortcuts

Open **Hints → Customize shortcuts**. Edit the three bindings, then **Save**. For example,
change Close from `Ctrl+Shift+X` to `Ctrl+X`. That changes the browser gesture for every CLI;
it does not change the command Ronin sends to that CLI. Reset defaults fills the original
bindings; Save applies them. Help opens this page.

Use `Ctrl+X`, `Alt+Shift+X`, `Meta+Shift+X`, `Escape`, or an available function key.
Each action needs a different shortcut. Typing keys and common reserved browser commands
are refused. If a pad binding already takes a shortcut, remove that binding in the pad
panel first. OS/browser shortcuts cannot always be intercepted; test your choice before
relying on it. Buttons remain available.

The one saved record is `terminalControls.bindings` in the owner's
`machine_settings.json` in `ronin-store config`. Edit it through this validating panel;
no shipped JavaScript needs changing. Other tabs update immediately; other devices read
new settings on focus. A rejected save keeps the previous bindings.

Native Copy, Cut, Paste, Select All and Undo remain browser operations in ordinary text
fields, including the Ronin composer. Copy has no Ronin shortcut or remapping field. With terminal text selected, native
Cmd+C / Ctrl+C copies it. Terminal Ctrl+C is intercepted so it cannot quit the Agent; without a native Copy
selection it points you to Stop or Close. Close uses Ctrl+Shift+X. Escape dismisses an
open Ronin sheet/menu first. No shortcut leaks through that sheet into the Agent.

## Clear and Stop are different

Clear removes the browser's entire unsent draft when that is the focused input. It
never recalls a message already accepted by the delivery queue. At the CLI, Clear sends
its registered native sequence once: Claude gets Escape; Codex, Gemini, Grok and Hermes
get Ctrl+C. Ronin does
not classify the screen or reinterpret the result. These keys retain the CLI's native
behavior, including interrupting activity or handling an empty prompt differently.
Unknown CLIs have no guessed control sequence.

Stop sends the registered interrupt once. It does not wait for the CLI to look idle or
confirm that a tool stopped. A CLI may consume it in an open menu, or stop a tool at its
own cancellation boundary. Repeated deliberate presses have the CLI's native semantics;
Ronin does not repeat held keys or retry after a network failure. The feedback says
“Stop sent”, not “all tools stopped”.

## Copy while locked

Desktop: Option-drag on macOS or Shift-drag elsewhere selects through applications
that capture the mouse. Copy uses the originating Tile's selection, never another Tile's.
Mobile: tap Copy to get a still text snapshot and use native selection handles. If the
browser denies clipboard access, the snapshot remains available for native Copy.
The snapshot contains available terminal history, not a claim to the complete transcript.
Selecting/copying neither unlocks the Tile nor sends input to the CLI.

## Close

Close opens the existing Archive / Delete / Hard Delete sheet. Read the consequences
there. Archive requires supported conversation identity and resume. Delete checks the
Agent's desks. Hard Delete requires its separate explicit confirmation. Hide view only
hides the Tile and keeps the Agent running.

## Implementation ownership

- `src/terminal-controls.ts`: default bindings, validation, settings API, intent dispatch.
- `public/js/terminal-controls.js`: shortcut interception, buttons, Hints and editor.
- `src/agents.ts`: CLI Stop/Clear command adapters; [Agent integration index](agents/README.md).
- `src/tmux.ts`: persisted launch identity (`sessionType`, `cli`, `provider`, `model`).
- `public/js/session-retire.js`: the existing Close confirmation and shutdown flow.

Controls act on the identity stored with the session. They do not detect the provider
from terminal output. Model is the model selected at launch; an in-CLI model switch does
not change the CLI control adapter. Older sessions use their existing CLI launch stamp;
unidentified terminals have no guessed Stop/Clear adapter. Their local Clear, Copy, and
confirmed Close still work. A control waits only for an already-started queued paste and
its Enter to finish, never for the message queue's typing grace.
