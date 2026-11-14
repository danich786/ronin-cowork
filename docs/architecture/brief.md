# The brief: what an Agent is told, and how it is built

The construction contract for what a Cowork Agent (and Mika) is told. Adding a behaviour or a
tool is adding its file; nothing else changes. Agents know a little about a lot, and only what
is on their path. The words are defined in [KOTOBA](../../KOTOBA.md); how an owner changes what
Agents are told is in [Customize Ronin](../getting-started/customize.md).

## 1. Three objects

| Object | What it is | Folder | How much is told |
|---|---|---|---|
| **Fact** | true about the user and the Agent's situation: the user, the office's people, the Workspace, the Team, the mandate, the task | `ronin_catalogs/facts/` | in full when told. Facts are short; anything long is a behaviour |
| **Behaviour** | how to work: guidance an Agent follows | `ronin_catalogs/behaviours/` | a depth (§2) |
| **Tool** | something to call: one command, or a family (`session_*`) | `ronin_catalogs/tools/` | a depth (§2) |

Integrations, bridges, Services, roles, desks and arrangements are not further kinds. They are
values on the work record that bring facts, behaviours and tools into play. A bridge is a
behaviour with its tools.

## 2. Depths, and when an Agent is told

| Depth | What the Agent gets |
|---|---|
| **not told** (`none`) | nothing; the tool is still on its PATH |
| **seed** | one line: that it exists, and where to read more (`ronin-help <name>`) |
| **full** | the whole text, in the brief from the start |

A tool's seed is its one job (a family's names its members); the brief says once that every
tool answers `--help`. A tool in full adds its commands and whatever `--help` does not say.

An Agent is told at birth; when its situation changes (a desk is cut, an integration turns on,
it is made lead); when the user changes its configuration; and when it asks (`ronin-help
<name>` prints the full text of anything it holds a seed for).

**Hide, never guard.** A depth, a block or a screen decides only what the Agent is told.
Nothing is taken off the PATH, refused or stopped: an Agent that finds a tool or behaviour it
was not told about can use it.

## 3. The files and their header

One flat folder per object. The file name (no `.md`, kebab-case) is the id that `when:`,
`serves:`, brief settings and `ronin-help` use. Every file starts the same:

```
# Write it Down
- **seed:** WRITE IT DOWN: put what you work on on your work record.
- **when:** cowork
- **depth:** full
- **order:** 40

<the full text>
```

| Field | Files | Means |
|---|---|---|
| title (`#`) | all | the name the brief prints; for a tool, the command |
| `seed:` | behaviours, tools | the one line. A behaviour's seed stands on its own; a tool's is its one job |
| `line:` | facts | the line the brief prints, with `{record.path}` placeholders; `{<lead> x}` prints `<lead>` and x only when x is set; `{x?yes\|no}` prints one of two texts |
| `when:` | all | the conditionals (§4) that must all hold, comma-separated; `!` for not; blank = every Agent. A tool that serves a behaviour needs none: it is in play when its behaviour is |
| `depth:` | behaviours, tools | `none`, `seed` or `full`: the stock depth. Layers may raise it (§6) |
| `serves:` | tools | the behaviour ids it serves. Blank: it goes under Other tools |
| `order:` | all | its place in its section, lower first |

Header lines run from the title to the first blank line. An unknown field is ignored; an
unknown conditional never holds. A fact may also carry placeholders in its body, and a fact
whose placeholders all come out empty is not printed.

- **Tools point at behaviours, never the reverse.** A behaviour never lists its tools; the
  brief lists, under each behaviour, the tools whose `serves:` names it. It may name a tool in
  its guidance ("hand in with `worktree-desk hand-in`").
- **No other list of tools is kept by hand.** The [Tools help page](../using-ronin/agent-tools.md)
  list is generated from the headers (`node scripts/tool-list.mjs`, checked by
  `tests/tool-list.test.ts`).
- **A hand-in that adds a tool adds its file**, as it adds its docs.

**The user's store.** `~/ronin/facts/`, `~/ronin/behaviours/` and `~/ronin/tools/` (beside the
user's own executables) add new files and replace stock ones by id, whole. They live outside
what an update replaces, so customisations survive updates; a replacement also stops later
stock changes reaching that file. Other catalogs follow [shadowing](shadowing.md).

## 4. Conditionals

They read values on the work record (§5).

| Conditional | Holds when |
|---|---|
| `cowork` · `bare` · `mika` | the session type |
| `owner` · `member` | the user's role in the office |
| `new-owner` | the Campaign has no Team yet |
| `experience:<non_technical\|some\|developer>` · `ai:<new\|some\|daily>` · `use:<coding\|…\|other>` | the user's Lounge answers (hosted) |
| `hosted` | a hosted office (else self-hosted) |
| `service:<part>` | that Ronin Services part is running |
| `integration:<name>` | that integration is on for the Agent (§6) |
| `pm` | project management is on (§6) |
| `team` · `lead` · `role:<coworker\|lead\|epic_lead\|coordinator>` | on a Team, its lead, its role |
| `desk` · `checkout` | a desk is cut, a repository is checked out |
| `workspace:<name>` | born in that Workspace |

The mandate is told (a fact), never a `when:`. A tool may say in its seed which mandate it
rides ("`session_create` rides Recruit: staff agents"); an Agent with Recruit `nobody` still
sees it and decides.

## 5. The work record is the source of truth

Each session's work record holds every value its brief depends on; the brief is the work
record plus the files, nothing else.

| Part | Values |
|---|---|
| Session | name, title, type, the template it came from, objective, the task at birth |
| User | name and what to call them, role in the office, new owner, organization, technical level, AI experience, planned use, time zone, language, about, and the user's own intro text |
| People (hosted) | the office's owner and members: role, name, organization |
| Setting | hosted or self-hosted; Campaign; Workspace (its instructions, repositories, folders); integrations on; project management; the Services parts running |
| Agent | role and Team(s); mandate (Reach, Recruit, Output); provider, model, harness, launch mode |
| Work | desk or checkout per repository; items held and watched |
| Brief settings | this Agent's add, block and only (§6) |

- The Team roster, the Workspace and the Campaign own their values; Ronin writes them into the
  record, as it writes `teams`.
- A value another place owns and keeps no copy of is read there when the brief is built: in a
  hosted office, the people and the user's Lounge answers from `office_unit/members.json`
  through `src/office-people.ts`.
- Who is talking now is never in the brief: the per-message From line (`src/message-queue.ts`)
  says it.
- Ronin rebuilds the brief on any record change and sends the Agent the difference only when
  the brief came out different. Items and the objective are on the record but not in the
  brief, so they send nothing.

**Ronin's own lines on the record.** The mandate is written by `writeMandate`
(`src/tegami.ts`) at creation and on an Update. The `teams` block is one entry per Team
(`team`, `team_role` lead or member, the roster's `objective`; a lead's entry also lists
`members`); `teamChanged` derives it again on every roster write, join, leave, lead change,
restore and Team retire, and `memberEnded` drops an ended Agent from its leads' lists. The
`configuration` line (`{ title, project_root }`) is written by `writeConfiguration` at birth,
on a restore, and when the title or Workspace Folder changes. A write to the record by anyone
but the Agent pushes it one line, "Your work record changed; please read it (work-record
read)." (`ackRecord`); a change to an item it holds is not a record write, and its notice
names the item and the change (`ackHolders`, `src/work-items.ts`).

## 6. Layers and brief settings

The layers, widest first: the stock file (its header), the user, the Campaign, the Workspace,
the Team, the Agent. Each layer's record holds the same three lists, naming only what it
changes:

| List | Names | Effect |
|---|---|---|
| **add** | facts, behaviours or tools, with a depth | brings them in, or raises their depth |
| **block** | facts, behaviours or tools | takes them out |
| **only** (a screen) | facts, behaviours, optionally single tools | when set, nothing else gets through |

The user's lists are in the user's store; the Campaign's in Campaign settings; the
Workspace's in the Workspace record; the Team's on the roster; the Agent's on its work record.

Applied in order:

1. Start from each file's header (`when:`, `depth:`).
2. **Add** from every layer; where two give a depth, the higher holds.
3. **Block** from every layer.
4. **Screen**: a screen covers its layer and every layer below; a lower screen only narrows it,
   and nothing below adds back what a screen above left out. A behaviour let through brings
   the tools that serve it; a tool that serves no behaviour comes through only if named.

Example, a Workspace that uses Netlify and wants More checkpoints for every Agent:
`add: netlify-bridge, more-checkpoints: full`. A tailored Agent is a screen on it or its
template: `only: base-agent, netlify-bridge`.

**Integrations cascade the same way**: on for a Campaign is on for its Workspaces, Teams and
Agents, and each may add its own. On for an Agent makes `integration:<name>` hold, so its
bridge behaviour and that behaviour's tools come into play.

**Project management is its own switch**, cascading like an integration. When the Jira
integration is on, it is on; otherwise each layer may turn it on or off. Off: no item
behaviours and no `item` seed. On: the item model for everyone, role behaviours by role. The
Services part that runs project management keeps its own switch for running; the brief reads
`pm`.

## 7. The brief

One file per session, `~/.ronin/sessions/<name>-<ts>/AGENT_BIRTH_BRIEF.md`, generated top to
bottom:

```
# Brief — <name>

## Facts
- You: …
- User: …
- Workspace: …
- Mandate: …
- Task: …

## Behaviours

### <behaviour>
<full text, or its seed line>
Tools:
- `<tool>`: <seed>

## Other tools
- `<tool>`: <seed>

Every tool is a command on your PATH; `<tool> --help` gives its syntax.

— end of packet for <name> —
```

- Facts, then the behaviours in play (full text or seed, by `order:`), each with its tools,
  then Other tools, the one `--help` line and the end line.
- **One read.** Every supported provider caps one file read, so the brief is held to 30,000
  bytes and 380 lines (`src/birth-brief.ts`); a test compiles the fullest stock brief and
  fails over either. Do not raise the budget to fit prose: shorten the source, or lower its
  depth. An over-budget brief is still written, with a warning, and the read line tells the
  Agent to read it in parts.
- **The launch prompt** carries only the task, the read line — "Read first: `<path>` — N
  lines, N KB, one read; it ends with the line "— end of packet for `<name>` —". Do not act
  before you have seen that line." — and, where the launch profile asks for it, the
  acknowledgement (quote the end line). Team, mandate and Workspace are facts in the brief, so
  an update reaches them.
- **The birth receipt** (`birth-receipt.json`) records the brief's path, bytes, lines,
  terminator and over-budget state.
- **An update** rebuilds the brief and, when it differs, sends the Agent "Your brief changed"
  with the facts that changed and the behaviours and tools that came into play (at their
  depth) or left it. A mandate change sends the new mandate only.
- **The brief shows at the bottom of the work record** on the tile.

## 8. Where it is set in the UI

- **New Agent form, Behaviours step:** Integrations (inherited ones shown on, the Agent's own
  to add, and the project-management switch); Optional (the Agent's add list, with depth);
  Conditional (read-only: what is in play for this Agent and why, worked out by the server).
- **Campaign, Workspace and Team pages** edit their add, block and only lists, integrations
  and project management, in the same compact form. The user's own layer is the customise
  page.

## 9. The stock files

```
facts/       you, user, user-about, user-intro, people (hosted), ronin, workspace,
             integrations, team (team), mandate (cowork), model, work, task
behaviours/  base-agent (full) · cowork-agent, mandates, write-it-down (cowork, full)
             team-lead, planning (lead) · lead-worktrees (lead, desk)
             project-management (pm, full) · pm-coworker · pm-lead · pm-epic-lead ·
             pm-traffic-control (pm, by role, full)
             working-at-a-desk (desk) · checkout (checkout) · integrations
             mika, install-check (mika) · services-off (!service:ronin_services) · using-ronin
             optional (depth none): team-work, more-checkpoints, working-with-the-user,
             visual-staging, codebase-team
tools/       edges, work-record, agent-session (session_*), cowork-team (team), plan,
             work-item (item), worktree-desk, secret, netlify, preview, lookup, show,
             owner-view, mika, ronin-host, machine-settings, ronin-help ·
             ronin-team, ronin-desk-settle (house, depth none)
```

Each file's header is the authority for its `when:`, depth and order; this list is a map.
Workspace-specific guidance is a user behaviour with `when: workspace:<name>`. Helpers that are
not tools (`ronin-url`, `ronin-http.sh`, `tool-path.sh`) get no file
(`ronin_bin/README.md`).

## 10. Boundaries

- **Tool**: Ronin executable authority; its `--help` describes its callable contract. A
  **composite tool** coordinates guarded operations under one contract and outcome, reusing
  their validation and audit evidence; it is still a tool.
- **Behaviour**: provider-neutral guidance; it governs the work and any procedure around a tool.
- **Fact**: a value, told; teaching what a value means is a behaviour (the Mandates behaviour
  explains the Mandate fact).
- **Skill**: provider-native adaptation or teaching inside a provider shell. It never holds a
  Ronin rule or authority alone; another provider gets its own form, from the same Ronin file.
- **UI**: a client of the same tool and API contracts. None copies the choreography.

Docs explain Ronin and stay searchable; an Agent's operational instruction belongs in a
behaviour or a tool's file or help, never only in a docs page.

## Change checkpoint

Any change to facts, behaviours, tools, brief settings or brief compilation answers:

1. Which file is it, and what `when:` brings it into play?
2. What depth, and does a layer need to change it?
3. Does a tool name the behaviour it serves, rather than a behaviour list the tool?
4. Does the user's store still replace it by id?
5. Does the fullest stock brief still fit one read?
6. Do the read line, the receipt and the acknowledgement still describe the same brief?

The reason for the budget is concrete: in September 2026 a vocabulary source was pointed at a
105 KB UI string table, the packet grew past 2,000 lines, and the working rules fell outside
the newborn's first read.
