# The tile — one cell of the coworkspace, top to bottom

A **tile** is one cell of the coworkspace showing one session. The public word is *tile*;
*pane* is the tmux terminal underneath and is machinery only (KOTOBA § THE GROUND).

A tile is three things and nothing more: **a header**, **a mount point**, and **one of two
views** composed into it. `class Tile` (`public/js/tile.js`) owns what any of it means; the
header is built in one place (`public/js/tilehead.js`) and every callback in it lands back
on the tile.

Construction order is load-bearing: `this.body` must exist before anything mounts into it.
tape, then the commons panel, then xterm.

---

## What ships where

**All frontend lives in `RONIN_COWORK`.** A `ronin_service` ships no HTML, JS or CSS — it
fills a subset of *cowork's own* UI (KOTOBA § SURFACES). So every button below is a cowork
button. The question is only whether the thing behind it is plugged in.

The client asks once, at boot, before the grid is built: `GET /api/version`
(`src/routes/version.ts:41`) answers `stream` (is rireki's 🔓 handler registered?) and
`services` (who registered, by name: `michi` · `koshi` · `rireki` · `counting` · `koe`).
`main.js:16-25` parks those on `S.streamOff` and `S.services`.

The house rule for an absent service: **draw the surface opaque-and-inert, never fetch into
a 404.** "Not plugged in", not "broken", not missing.

This table is about **services** only — which control goes dark because something is not
installed. The other half of "is this reachable", whether a control needs a *session*, is
the `needs` column of the header table itself (`public/js/tilehead.js`); both end up in the
same `needs` string, and both dim the control the same way.

| Control | Needs (service) | When it is not there |
|---|---|---|
| ● connection dot | — | always |
| session picker | — | always |
| the mark (job) | — | always — see the note below |
| SHINGO chip + ladder | `michi` | chip hidden, ladder unreachable, never fetched |
| ⛽ context gauge | — | always (hides when there is no reading) |
| 🎛 control dial | — | always |
| ⛩ commons | — | always (individual tabs gate: `koe` · `counting` · `koshi`) |
| メ the drop | — | always — it is a container, and it holds 🔒, which needs no session |
| Output | rireki's stream handler | contains Locked only |
| 🏷 groups | — | always |
| 📄 docs | `michi` | inert and opaque, saying so; the doc list is TEGAMI data |
| 📝 note | — | always |
| 🗑 kill | — | always |

The work record holds the Agent's objective, mandate, derived Teams, repositories, ladder,
position, documents, and status. It carries no job or role axis.

---

## The six Outputs

The tile composes one or the other. Neither knows the other exists.

**🔒 Locked — `public/js/termview.js`.** The untouched `tmux attach` mirror. xterm.js, an
emulator, because the stream is a live screen full of positioning. Scrollback stays
server-side, while xterm also keeps the output it has already painted in a local buffer.
Ordinary trackpad/wheel movement through that local history stays entirely in xterm and
shows no tmux position indicator. When an intentional terminal gesture needs older tmux
history, the tile drives copy-mode itself (`src/viewer.ts`) with explicit commands aimed at
the tile's pane — position indicator hidden where supported, exit at the bottom — never
through the server's key tables. While the pane
is in copy-mode, ordinary typing from the tile is dropped so it cannot invoke the server
owner's copy-mode bindings (jump, search, goto…); Escape leaves, and page and arrow keys
still move. The server's own bindings are untouched, because the tmux server is shared with
whatever else the owner runs there, and copy-mode is pane state: someone attached to the
same session sees it while the tile is scrolled. `tests/tmux-server-conf.test.ts` pins that
the start-only config rewrites no key table, and that the tile's commands leave every table
byte-identical.

xterm has two input owners behind one public `onData` event: human keyboard/paste/mouse
input and terminal-generated protocol replies. Ronin keeps the owners separate when the
pinned xterm provenance signal is present: person input (`t:i`) retains the pane-state and
DVR rules, while other terminal replies (`t:p`) answer the attached PTY directly. That
private signal is an optimization, not a boot dependency; a future xterm without it still
opens the tile and treats public `onData` as person input.

Device Attributes need a stronger timing guarantee. tmux accepts DA answers for only five
seconds after attach, but a hidden browser may not parse the query until later. The server
therefore recognizes tmux's exact output-side DA1/DA2 queries and answers each at most once
beside the PTY during the five-second attach window, then disarms. Public xterm CSI handlers
consume the same queries in the browser so it cannot send a duplicate late answer. This does
not inspect or filter human input: deliberately typing
or pasting `ESC [ > 0;276;0c` remains person input byte-for-byte.

**🔓 Unlocked — `public/js/tapeview.js`.** RIREKI's client-side render. **It holds no tmux
connection** — no attach, no viewer session, no pipe; tmux does not know this view exists.
Display comes from the tape; input goes back out through the tile's socket. It is a plain
scrollable div, not a terminal, because a tape-fed stream is 100% plain text and a div gets
hardware-accelerated momentum scrolling for free.

The socket sits beside both and is owned by neither (`public/js/tilewire.js`).

**Output is a property of a tile.** Locked attaches the live terminal. Terminal Mirror, Detailed,
Condensed, Conversation and Agent Summary are record-fed views registered by Ronin Services.
Bare cowork offers Locked only. `S.locked` remains a compatibility alias for transport choice.
The old lock button and its global flip are retired. The Output selector changes only its
tile and is compact on touch; Locked remains available there, with tmux copy-mode's normal
round-trip scrolling tradeoff.

The six choices are contracts, not degrees on an unnamed “detail” slider:

| Output | What the tile shows | Produced by |
|---|---|---|
| **Locked** | The attached live tmux terminal, including its active screen and interaction | tmux/xterm |
| **Terminal Mirror** | Every settled RIREKI record, including recognized terminal chrome | mechanical projection |
| **Detailed** | Terminal Mirror without positively identified spinner and input-box chrome | mechanical projection |
| **Condensed** | Dialogue and ordinary text, with adjacent thinking/tool/result/code records represented as compact activity groups | mechanical projection |
| **Conversation** | Positively identified owner and agent dialogue; non-dialogue work is represented as activity rather than silently presented as speech | mechanical projection using the session's decoder |
| **Agent Summary** | Persistent, authored accounts of closed transcript ranges | one-shot `koshi_kaki` calls |

Unknown content is retained by Detailed and Condensed. Conversation is deliberately stricter:
only content mechanically identified as dialogue is rendered as dialogue, while recognized work
becomes an activity row. This keeps provider-specific recognition inside RIREKI's decoder rather
than scattering Claude/Codex guesses through the browser.

Agent Summary has two session policies. **On demand** writes when the owner asks for a summary.
**Keep current** watches for a quiet, settled boundary and then makes another one-shot Kaki call;
it runs whether or not anybody is viewing the tile. The stored chunks therefore remain ready for
a later reader. This cut does not include KOE or voice playback.

The five record-fed Outputs are also service reads, not browser-only presentations. RIREKI exposes
the four mechanical projections through `GET /api/sessions/:name/render?view=...`; Koshi exposes
the fifth through `GET` and `POST /api/sessions/:name/kaki`. A future tool-using reader such as KOE
can call those authenticated routes without recreating the browser's filtering rules.

---

## The header, left to right

Built order (`public/js/tilehead.js`):

```
● │ [ session ▾ ] │ chip │ mark │ ←spacer→ │ ⛩ ⚡ メ
                                                  └─ 🔒 🏷 ⛽ 🎛 📄 📝 🗑
```

**Three on top, the rest behind メ**. The row used to end in
eight controls against a picker that has to fit a session name, and at four tiles up
there was not room for both — measured at a 629px tile, the eight left the spacer 23px
short before the picker started giving up characters. So ⛩ Commons and ⚡ session picker stay,
and the rest drop out of メ **as themselves**: the same elements, appended into a
horizontal strip instead of into the row, keeping every handler, every live setter and
every `needs` rule they were built with. Nothing was redesigned into a menu row — the
dial is still the dial and the gauge is still the gauge.

**One table, and a loop.** Every control above is one row of `HEADER` in
`public/js/tilehead.js`, and everything about it is on that row: where it sits, its class,
its glyph, its hover text, its click, what it needs to be live, what it says while it is
not, and — for the three whose help is a reading rather than a sentence — how to read it.
The order of the rows is the order on screen. `buildTileHead` loops the table to build;
`syncTileHead` loops the same table to bring it up to date. Adding a control is adding a
row, and it cannot be half-wired because there is no second place to forget.

That structure is not decoration. A control used to be spread over up to five places —
markup in an HTML string, hover text beside it, click in the tile constructor, inert rule
in a fourth spot, live reading in a fifth — and the set drifted: **three controls had no
inert rule at all**, because nobody had written them a line.

**`needs` is the whole rule for whether a control is reachable.** `session` for the ones
that act on a session; a service name for the ones whose route ships with a service. A row
with no `needs` is claiming to work always — a claim, not an oversight.

The hover help panel is disabled system-wide. Control text is still seized into accessible
labels by `public/js/tips.js`, including the reason an inert control is unavailable, but no
custom or native tooltip is drawn. The refusal still lives in the handler, never in the
stylesheet.

### ● The connection dot

Green attached, amber connecting, grey disconnected. Set from the socket's status
(`Tile.setDot`). Not a button.

### [ session ▾ ] The session picker

Pick or switch the session this tile shows. `— pick session —` (blank) **detaches** — stops
viewing, does not kill. `➕ new session…` prompts for a name and creates one. A session
that has left the list but is still connected stays visible as `name (gone?)`. A `•` beside
a name means attached elsewhere.

No mark is drawn in the picker: the collapsed `<select>` sat an inch from the job button
showing the same icon, which is the same fact twice.

### The SHINGO chip 信号

Position, then how long it has sat there. **Hidden until a ladder exists** — a session that
keeps no TEGAMI costs nothing on screen. Tapping it is *always* the ladder; there is no gate
view and no detail view.

This is an **outline indicator, not a channel**. It says moving / held / stopped somewhere it
shouldn't be. Nothing on this side can touch a session; a gate is answered by typing into the
pane like everything else. The age is the file's mtime — the cheapest true thing on the
tile, and beside a gate it reads as how long the session has been waiting on *you*.

**The ladder** unrolls under the header (`public/js/shingo.js:85`). Four fixed columns —
torii · done-or-not · leg # · description — so the eye can run straight down any of them.
Exactly one rung is live: you are at the gate or you are doing leg four, never both. It opens
scrolled to the rung you are standing on. `[GATE]` rows are a rung **kind**, never a status;
statuses are `PLANNED` · `ACTIVE` · `DONE`.

Needs `michi`. `refreshTegami` asks `serviceMissing('michi')` and simply does not fetch when
michi is absent — the one way that question is asked anywhere in the client.

### ⛩ The torii — the Commons

⌃⇧C (⌃⌥C on Linux/Windows). One press, straight to the CoWorking Commons over this tile,
landing on ⌂ Roster — roster, new session, wipeboard, project roots, hotwords. It needs no
session, because it is the way to GET one. **A way in, not a close:** the session keeps
streaming behind the panel and ✕ on the tab strip comes back to it. Stopping viewing is the
blank option in the picker; killing is 🗑.

**The torii means this, and only this, everywhere**. It was メ
here and き in the bar for the same act, while ⛩ on this same header meant something else
entirely — the letter. One glyph for two things and two glyphs for one thing. Both moved in
the same pass, so the mark never had a period of meaning both.

**The letter button is gone.** It opened `/api/sessions/:name/tegami/raw` — the TEGAMI
verbatim, in a scrollable selectable block — and it was the only client reader of that
route. What went with it is worth naming, because it was deliberate: the chip and the
ladder are an INTERPRETATION, and the letter was the source, which is the question you ask
when the readout looks wrong. The cost is real and the owner weighed it: `js/shingo.js`
hides the chip when a session has no ladder, so a session with a letter and no ladder up now
has no route to its own letter at all. The header width won.

The route is MICHI's and still serves — a client ceasing to be a consumer is not a reason to
take an endpoint away. If the raw view returns, it belongs inside the ladder panel, where
the reader already is, not as a second glyph competing with the first.

### メ The drop — the rest of the header

One click, and 🔒 🏷 ⛽ 🎛 📄 📝 🗑 appear in a horizontal strip under the header. The owner's
words: *"consolidate the Lock, the Tags, the Gauge, the Dial, the Save status, and the
Trash Can into a single button… When you click it, you just see those boxes exactly as they
are, but maybe it just drops down horizontally."* Which is what it does — the controls are
**the same nodes, appended somewhere else**, not a redrawing of them as menu rows.

**メ is a reclaimed glyph, and this shape is not new.** It was the tile-head Commons button
exactly this all along: `tiledrop.js` collapses the whole header into one bar row where メ
is *this session*. Desktop is being brought into line with a design the phone already wore.
The only difference is the shape — a pointer needs no word beside the icon, and a desktop
header has room for a strip rather than a list.

**It needs nothing**, which is a claim about the control: it is a container, and it holds
🔒, which works with no session at all. Dimming it would have hidden the six explanations of
why its contents are dim. A control that is inert in the row is inert in the drop, with the
same sentence — `setInert` paints the element, and the element is the one that moved.

**Dismissal follows ⚡, not the retired `ui.popover`** (`public/js/tilemore.js` says why at
length). The short version: ⚡ sits immediately to メ's left, anchors to the same corner of
the same header, and closes its rivals with a `.open` **class** sweep, which is the phone's
grammar too. A `hidden`-attribute drop would be one no existing sweep could see and the two
would open on top of each other. What it does take from the retired primitive is the half
that was about access — `aria-haspopup` / `aria-expanded` on メ, and focus back on メ when
the drop closes under the keyboard.

Escape closes it, in the **capture** phase and only while it is open — so it beats a locked
pane to the keystroke when the drop is up, and never takes Escape away from that pane when
it is not — and **not while a modal sheet is up over it**, since that Escape belongs to the
topmost surface and this listener would otherwise reach it first. Clicking outside closes
it; clicking a control inside closes it *if that control raises something the strip could
cover*. The instruments (⛽ and 🎛, the `holds` rows whose value changes in place) leave it
up, exactly as the phone gives the dial its `stay` mode.

full-viewport scrim at a z-index far above the strip, so there was never anything for the
strip to cover; closing it only hid their own opener, and a `display: none` button cannot
take focus back when the sheet closes. Focus fell to `<body>` and the next Tab restarted
the page. Leaving the drop up means the owner comes back to the exact control they left
from, and 📄 is the counter-example that keeps this a per-row column rather than a rule:
its docs pane is an in-tile surface the strip really would sit on top of, so 📄 still closes
it. The primitive was hardened in the same pass (docs/ui.md) — this stops *causing* the
failure, `ui.sheet` stops *hiding* it.

A **click on the scrim** closes the drop as well, and that is the intended asymmetry
rather than a leak: the scrim's click still reaches `document`, where it is an outside
click for everything under it. The keyboard peels one layer per Escape (sheet, then drop);
a pointer pressed on the scrim dismisses the stack it was pressed through. Measured
lands on メ with the drop closed, and neither lands on `<body>`.

**Desktop only.** `collapseTileHead` hoists this header into the phone's app bar behind its
*own* メ, snapshotting the header's children to restore later; a control nested one level
deeper is not in that snapshot, and the restore would leave it inside a sheet that is then
removed. So the drop is built on a fine pointer and skipped on a coarse one — the same
`isCoarse()` test the collapse gates on, which makes the two exactly complementary. A phone
at two or four tiles gets its own headers back, every control in the row, as before.

### 🔒 / 🔓 The lock

Behind メ.

**Not "streaming" and not "disconnected".** The session is running in tmux either way. What
differs is whether *this view* is attached, and the consequence is lag.

- **🔒 Locked** — attached to the live tmux session, painting in lockstep. Scrolling goes
  back to the server and back. **This is a drawn screen, not selectable text.**
- **🔓 Unlocked** — reading what the terminal painted, captured byte by byte as it went, so
  the text can lag the live pane. Scrolling is instant and stays in your browser, typing
  still goes to the real terminal, and **the text selects and copies like any web page**.

Flipping reconnects **only this tile**. Parked text is discarded on a flip — it is visible in
the strip, so nothing vanishes silently.

With no record service the button is dim and inert on every device, and the refusal is
stated in `setLocked` rather than in the stylesheet: `.lock.off` used to carry
`pointer-events: none`, which blocked the hover that delivers the tooltip, so the one control
that most needed to explain itself said nothing.

### 🏷 Groups

Behind メ.

The session's memberships, stored on the tmux session itself (`@ronin-tags`). The point is
**addressing, not decoration** — "the kojinsa group" resolves to a session list, so a
coordinator can be pointed at a set instead of at named members one by one. Agents resolve
the same names with `ronin_bin/edges team`. The button lights when the session is in any.

### ⛽ The context gauge

Behind メ — and that is the one place where hiding a control costs something real, because
a reading you have to open is a reading you stop watching. The owner was asked about exactly
that and ruled it anyway: *"the context viewer is also visible at the bottom of all of the
Claude sessions anyway, so we're showing it twice."* The pane already prints the number; the
gauge was the second copy, and the second copy is what pays for the header's width.

How full the session's context window is. A tachometer tuned to the **useful** range: 0% at
6:00, 15% at 9:00, 50% at 12:00, pegged by ~80% — sessions never reach 100%, and the
difference between 6/17/35% is what you actually watch. The arc shows each zone's colour only
as it is reached.

Scraped from **ordinary pane text** (`src/ctx.ts`) — the same status line the CLI already
prints, never from agent internals. A plain shell has no status line, reports null, and the
gauge hides rather than showing a placeholder. Tap (touch) or hover (desktop) for the number
and the model.

A readout, not a control. Dials are inputs; gauges are readouts.

### 🎛 The control dial

Behind メ, and it is one of the two rows that do NOT close the drop when clicked: you turn
it by tapping the thing you are already looking at, three detents in a ring.

`@ronin-control` is a visible coordination preference. Three detents, tap to advance:

- **👤 owner only**
- **👁 watch**
- **🤖 type**, the default for an unflagged session

The value does not enforce access. tmux is the single source of truth: the dial POSTs and
then **re-reads** rather than assuming the write took. See `docs/session-control-dials.md`.

On both surfaces — an explicit override of the never-change-desktop rule, because the
cockpit motif is meant to be the same everywhere.

### 📄 Docs

Behind メ, beside 📝 — the two things a session keeps in writing: the post-it it wrote for
you, and the documents it is working in.

One press lists **this session's** docs; one more opens the file, in place, over this tile.
this tile's docs', it's not actually easy or intuitive to find them by going to the Commons,
going to Docs, and then looking for their particular agent's tracked docs."* The ▧ Docs tab
lists **every** session's docs grouped by session, so reaching one tile's meant leaving the
tile, remembering the session's name, and finding its group among all the others — three
steps and a memory test for a fact the tile already knows about itself.

**It fetches nothing.** `refreshTegami` already parks the whole letter on the tile and
`docs` is part of that payload (`src/services/michi/tegami.ts`), refreshed on connect, after
a write, and by the 30s poll. So there is no loading state and no failure state here to
design: the read that already exists refuses to fetch without michi rather than 404ing,
discards a response if the tile switched session mid-flight, and keeps its last value on a
failed read. The Team commons Docs surface renders what that left behind.

**Opening one clobbers the terminal**, which is the owner's own reasoning: *"it would just
open in place on that session, clobbering the session I'm looking at, which is fine because
you can just close the commons and you're back in the session."* The Commons already renders
*into* a tile, so this is the existing architecture and not a new panel — the same editor the
▧ Docs tab uses (`public/js/docs.js`, whose `open` is exported for exactly this), the session
still streaming behind it, ✕ on the tab strip to come back.

**It is not the file browser, and it is not a crack in that rule.** A doc is on this list for
the one reason it is on the ▧ Docs tab: an agent ran `work-record document add <path>`. All that is
different is the scope. Which is also why a session that has listed nothing gets a sentence
saying so — the same sentence the tab uses for its own empty list, narrowed to one session —
and never a fallback to the global list, which would rebuild the hunt inside the tile.

The button lights when there is something behind it, the same reading 🏷 and 📝 carry, so the
drop does not have to be opened to learn it is empty. **Needs a session and `michi`**: the
list is TEGAMI data, exactly as the SHINGO chip is, and without either the button dims and
says which is missing.

Height is measured at open time against the room under the header (`fitDropToTile`,
`public/js/tilemore.js`) — `.tile` is `overflow: hidden`, so a list longer than the tile is
cut with no scrollbar. That measurement was ⚡'s, spelled once and now shared by both drops.

### 📝 Note

Behind メ.

A post-it on the session. Lives on the tmux session itself as a user option — no separate
storage, gone when the session dies. The button lights when there is one.

### 🗑 Kill

Behind メ — which is also a second's worth of friction in front of the one control on this
header that cannot be undone. That is a side effect of the width ruling, not its reason.

Destroys the tmux session on the host, root plus its `grid_*` viewers. Confirms first, then
the tile detaches and returns to the commons. Inert without a session — there is nothing to
kill, and it used to stay lit and say nothing about why pressing it did nothing.

---

## Typing, and copy-paste

### Typing out

**Locked** is key-for-key to the host: every keystroke round-trips to the tmux terminal
exactly as `tmux attach` always did.

**Controls have one owner.** [Terminal controls](terminal-controls.md) defines Copy,
Clear, Close and Stop, their configurable browser shortcuts, the pinned Hints card,
and desktop/mobile behavior. `public/js/terminal-controls.js` intercepts gestures;
`src/terminal-controls.ts` reads native key sequences from `docs/agents/*.md`. Provider identity is stored
with the session. No busy-screen classifier is consulted by a control.

**Unlocked** is the DVR rule (`public/js/dvr.js`, pure and tested). Printable text — typed or
pasted — **parks locally** and shows in a thin strip over the tile. Command keys (Esc, arrows,
Tab, and control characters not claimed by the shared controls) go straight through immediately. Enter sends the whole parcel
as **one atomic write with the `\r` glued on**; a delayed `\r` on a timer is a message iOS can
lose halfway. Backspace eats parked text first, and is a command key once the strip is empty.

**The composer** is the tile's own staging textarea, docked at the bottom (`composer.js`).
Born as the unlocked tile's input — a tape-fed tile hides xterm entirely, so without it
there was nothing on the page to type into — and since the MOBILE pass it also rides the
LOCKED mirror on every coarse-pointer tile, because a tap never focuses xterm on touch and
a locked tile without it cannot be typed into at all. It is a cowork surface: nothing in
it needs a service, and text staged in it reaches the Agent through the message API on send. Enter sends; Shift+Enter **and
Option+Enter** insert a newline (Option+Enter is the muscle memory the agent's own box takes,
and it used to send). A bare Enter with an empty box is a command key, and it is the recovery
path when a TUI swallowed a previous send's Enter.

**A message is not a keystroke.** The composer posts plain text to `/api/messages` in
both views. It bypasses preflight because the owner explicitly pressed Send. The common
sender leaves tmux copy mode, types the text, pauses 300 ms, and sends a separate Enter.
There is no screen inspection after typing and no browser timer responsible for Enter.
Direct terminal keys still use the terminal socket and its copy-mode rules.

The box clears when the server accepts the message, and only if it still holds the sent
text. An edit made while the request is in flight is kept. Refusal or network failure keeps
the text with a reason. Repeated Enter while the request is in flight does nothing.
Retained server messages remain visible in Messages. See [message delivery](message-queue.md).

### Copying out

[Terminal controls](terminal-controls.md#copy-while-locked) owns Copy, native selection,
per-Tile selection retention and the locked/mobile snapshot. `public/js/layout.js` keeps the
xterm clipboard bridge; `terminal-controls.js` owns the shared action.

### Pasting in

Locked pastes straight through. Unlocked parks the pasted text in the strip like anything
else printable, and sends it on Enter. The composer takes a native paste.

Composer and touch-key overlays are not part of xterm's event subtree. Pointer/focus
events there activate the composer only; they cannot focus xterm or start its copy/scroll
handling. The coarse touch-scroll and desktop copy-hint listeners similarly require an
xterm-owned target. This preserves ordinary trackpad scrolling exactly as xterm handles
it and deliberate terminal touch/wheel routing exactly as tmux handles it. The intermittent
field click that exposed this boundary was not deterministic; the invariant is enforced
without guessing a click coordinate or suppressing global pointer/wheel events.

The yellow numeric marker at the top-right is tmux's copy-mode position indicator, not
xterm's ordinary viewport scroll. A press followed by motion across a terminal cell can
invoke tmux's stock `MouseDrag1Pane` copy-mode behavior. Previously Ronin then observed the
pane in copy mode and dropped the matching mouse release with other non-navigation input,
so tmux never ran `MouseDragEnd1Pane` and remained locked. Mouse releases now pass through
while in copy mode; typing remains quiet, and ordinary wheel/trackpad reports retain their
existing byte and command paths. Composer ownership guards are separate defensive hygiene,
not claimed as the reproduced cause of this lock.

---

## The phone and the touch keys

**A phone never downloads the workbench at all.** The server reads the phone off the
request and sends `public/mobile.html` — its own document, booted by `js/phone.js`, with
no desktop bar, workbench or boot skeleton in it to paint first — at `/` for a phone-class
User-Agent and always at `/m` (`src/index.ts`). Three screens, one at a time: the Teams
list, a Team's **Agents | Docs**, and one Agent's tile. On the tile the head is hidden and
the document's slim bar replaces it — ‹ back, the Agent's title, and one メ sheet holding
the head's own controls (Work record, Docs, session picker, Output where Services allow, Note,
Control, Close), **relocated, not cloned**, so every handler and live widget keeps its owner.

The navigation row (`public/js/keysrow.js`) supplies Backspace, Tab, Shift-Tab,
arrows and Jump to latest. Stop, Clear, Close and Copy have mobile action buttons. Desktop uses shortcuts and
[Hints](terminal-controls.md). No raw interrupt/clear aliases remain in
this row. The composer remains available on locked coarse Tiles without Services.

The one-row hoisted phone header, the keys drawer, the ニ sheet and the header's
`.ctrls` keys are all retired with this; `tiledrop.js` keeps only `isCoarse` and
`makeDrop`, the sheet primitives.

An iPad (coarse but wide) keeps the workbench; `trimBarForTouch` (`layout.js`) moves the
shape button to the end of the bar and drops the desktop scaffolding.

---

## Known drift

Recorded so nobody re-discovers it.

*Both entries that stood here are now fixed and have been removed — the un-gated ⛩
torii and the dead `.dc` row in the phone sheet. Nothing is outstanding.*

**The one thing worth knowing, because it is not drift but a deliberate overload:**
`.off` means two things by position. On a button or the dial it means INERT (dimmed,
still hoverable, guarded in its handler). On the connection `.dot` it is one of that
indicator's three states — `on` / `wait` / `off` — and means DISCONNECTED. No selector
crosses the two (`.tile-head button.off` cannot match a span), so this costs nothing
today; it would cost something the day the dot becomes a button.

---

## Where the code is

| Piece | File |
|---|---|
| the cell | `public/js/tile.js` |
| the header — the table, and the loops that build and sync it | `public/js/tilehead.js` |
| 🔒 the mirror | `public/js/termview.js` |
| 🔓 the tape render | `public/js/tapeview.js` |
| the socket | `public/js/tilewire.js` |
| the text entry | `public/js/composer.js` |
| the parked-parcel rule | `public/js/dvr.js` |
| dial, gauge, job menu, `setInert` | `public/js/widgets.js` |
| tooltip suppression and accessible labels | `public/js/tips.js` |
| chip, ladder, letter | `public/js/shingo.js` |
| メ — the desktop drop | `public/js/tilemore.js` |
| 📝 and 🏷 | `public/js/panels.js` |
| the phone's one row | `public/js/tiledrop.js` |
| the letter's role half | `src/tegami.ts` |
| who is plugged in | `src/routes/version.ts` |

Related: `docs/session-control-dials.md` · `public/js/README.md` · KOTOBA § COWORKSPACE,
§ SURFACES, § LADDER.
