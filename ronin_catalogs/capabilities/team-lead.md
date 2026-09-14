# Team lead
- **label:** Team lead
- **blurb:** How do I keep the Team's record and its projects truthful, and move projects to and from my Agents?
- **class:** cowork
- **requires:** lead
- **order:** 60

Reach for this because you are the designated Team lead. Every Agent keeps its personal
work record; you additionally own the Team roster and the projects it holds.
`ronin_sops/teams.md` is the procedure.

**Live tools:** the shipped `team-lead` dispatcher owns Team records and projects.
Universal `session_create` is the default visible-delegation path for a lead, not a tool
owned or duplicated by this conditional bundle.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `team-lead roster read` | read: one canonical Team roster | priority | `team-lead --help` |
| `team-lead project create` | create: one roster-held project | priority | `team-lead --help` |
| `team-lead project read` | read: one roster-held project | priority | `team-lead --help` |
| `team-lead project list` | read: roster-held projects | priority | `team-lead --help` |
| `team-lead project write` | write: one roster-held project's typed fields | priority | `team-lead --help` |
| `team-lead project assign` | write: move a project whole to one Agent | priority | `team-lead --help` |
| `team-lead project return` | write: move a project whole back from one Agent | priority | `team-lead --help` |
| `team-lead member status` | read: settled Team Kanban member/project shape | priority | `team-lead --help` |
| `team-lead roster write` | write: typed Team roster fields | | `team-lead --help` |
| `session_check` | read: one live session by exact name | | `session_check --help` |
| `session_set` | write: a member's Team membership, lead designation, or project root | | `session_set --help` |

Desk assignment and Team broadcast remain in their own capability bundles; this tool does
not duplicate them. Read-only Team enumeration belongs to `edges team`.

## What the lead does

| Capability | Meaning |
|---|---|
| Team record read and update | the roster's objective, launch defaults, membership, and the Team page |
| Team project create, read, write | projects the Team holds before they are assigned; lead ideas live in the Team roster, not in a separate file or pool |
| Assign and return | the two lead moves: assign a held project whole to one Agent; take one back from an Agent's record. A project is one canonical object and is never copied |
| Member and project status | each member's work record and each project's two flags — `exit` (none · agent · lead · user) and `status` (green · yellow · red) — as the Team Kanban projects them at read time |
| Supporting-Agent configuration | delegate visibly with universal `session_create`, then inspect and configure Team, lead, or project-root state through `session_check` and `session_set` |
| Team broadcasts | the wipeboard for everything the whole Team must see; one-on-one goes directly to the session |

The move is the approval: there is no verdict, decider, revision counter, or history on a
project. Parking a project for a future common pool is outside this bundle.

For a lead, universal `session_create` is the default way to delegate visible work. The
guarded `--project` form assigns a roster-held project after birth, and guarded `--lead`
may designate the newborn as a lead; those privileges come from lead authority, not from
a duplicate command grant in this bundle.

`session_create <name> --project <team/id>` composes two existing operations. Its brief
names the project, birth happens through the ordinary resolver, and only then is the whole
project assigned. If assignment fails after birth, it reports that partial result and does
not claim the newborn holds the project.

Promotion is the lead's: hand-ins reach the Team line, and the lead moves the coherent Team
line to `dev` once, on the owner's word. Never promote mid-refactor.
