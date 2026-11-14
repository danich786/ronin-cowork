# session_*
- **seed:** check, create, change, archive, restore and end Agent sessions; `session_create` rides Recruit: staff agents
- **when:**
- **depth:** seed
- **serves:** cowork-agent, team-lead, mika
- **order:** 30

Reach for the session tools when the question is about an Agent's existence rather than
its work: inspect a name, launch a visible Ronin Agent, change Team or lead designation,
archive and restore, or end yourself safely.

**AN OWNER ASKING FOR AN AGENT ALWAYS MEANS: CREATE ANOTHER VISIBLE RONIN SESSION WITH
`session_create`. IT NEVER MEANS SPAWN A CLI-INTERNAL SUB-AGENT.** “Agent,” “new agent,”
“fork,” and “fork it” do not request or authorize spawning. Internal spawning is your
own implementation choice only when independently allowed; the owner's wording does not
provoke it. Supply the visible session's particular topic in its prompt.

**Create new session (Agent)** means create that visible session with `session_create`.
**Close session** means end this Agent safely with `session_end` after its custody
preflight succeeds.

**Live tools:** every command in the table below ships in `ronin_bin/`.

`session_create` is universal and is every Cowork Agent's one visible-session creation
surface. It does not inherit the caller's conversation or context: the caller supplies an
explicit prompt, while the ordinary resolver selects Campaign and Team launch context.
There is no dial option; creation does not change the caller, and the newborn reads its
own brief and prompt.

Every documented `session_create` form works for every Agent; its brief changes only
what it is told.
`session_create --help` lists the exact model ids from each provider's refreshed CLI
inventory. Use those ids with `--provider` and `--model`; display names are for the owner.
CLI-supported names already stored in settings, such as Claude's `sonnet`, also pass
through unchanged. The tool does not maintain a separate alias map.

A newborn's mandate is chosen at creation and carried in its birth brief, never written
after birth: `session_create <name> --reach execute --recruit nobody --output code` (the
New Agent form passes the same `mandate`). Naming any axis sets the whole mandate, an axis
left out taking its plain default (reach `plan`, recruit `propose agents`, output `open`);
naming none inherits the Team's defaults. A later change goes through the mandate route,
which acks the Agent one line.

`--role coworker|lead|epic_lead|coordinator` sets the newborn's role, as the New Agent form
does; coworker when not named.

`session_set <name> --root <handle>` changes the recorded Workspace Folder; `--clear-root`
clears it. The original birth directory and the running shell's directory remain as they
were. Read the handle with `session_check <name>`. From inside the Agent's session, use
`work-record workspace list|add|remove` to keep its working repositories current. Those
entries are its work record, not a command to open or close managed desks.

## Lifecycle boundaries

- **Create** is the common visible-delegation path. Its `--prompt` gives the newborn's
  exact purpose; the canonical launch resolver supplies only Campaign/Team context and
  reports `BORN` or `REFUSED`.
- **End** runs the custody preflight and ends this Agent only after every assigned worktree is
  safe; nothing is discarded. **Archive** is distinct: it keeps the session resumable and
  leaves desk custody unchanged; **restore** brings one back.

## Usage

- `session_check`: **Read one live session by exact name.** An unused name reports `NO-SESSION`; this tool never creates or changes anything.
- `session_create`: **Create one visible Agent through the ordinary launch resolver. AN OWNER ASKING FOR AN AGENT ALWAYS MEANS THIS VISIBLE SESSION; IT NEVER MEANS SPAWN A CLI-INTERNAL SUB-AGENT.** “Agent,” “new agent,” “fork,” and “fork it” do not request or authorize spawning. Supply the newborn's purpose explicitly with `--prompt`; only Campaign and Team launch context are resolved, never the caller's conversation. There is no dial option: the caller is unchanged and the newborn reads its own brief. `session_create --help` dynamically renders provider/model choices and defaults from the canonical Campaign/provider catalog shared with UI dropdowns, so configuration changes require no maintained list. An existing name is refused rather than read or updated.
- `session_set`: **Change named facts on one existing live session.** It updates Team membership, lead designation, or Workspace Folder handle; a missing name is refused and the bare form points to `session_check`.
- `session_archive`: `session_archive <session>` → `ARCHIVED <session> as <archive-id> — resumable`. Uses the existing live-session archive route; it never substitutes hard delete. Exit 2 = bad arguments, 4 = refused, 5 = unreachable.
- `session_restore`: `session_restore <archive-id>` → `REHYDRATED <session>`; the id is session_archive's, or the one a lead's notice names after a `session_end`. Uses the existing provider-resume and metadata-restoration route; the manifest is removed only after restoration succeeds. Exit 2 = bad arguments, 4 = refused, 5 = unreachable.
- `session_end`: `session_end` — **no arguments**. Resolves the current Agent, checks all assigned worktrees, automatically closes every clean worktree whose tip is contained in its Team line (an ACCEPTED hand-in is enough; global-dev promotion and manual close are not required), then archives the Agent so `session_restore <archive-id>` brings it back (the lead's end notice names the id; only an unresumable conversation ends outright). Any dirty, pending/rejected, unique, shared, or occupied worktree keeps the whole operation live and prints exact next actions; nothing is discarded. No output on success. Exit 4 = actionable refusal or owner-dialled; exit 5 = Ronin unreachable/stuck.
