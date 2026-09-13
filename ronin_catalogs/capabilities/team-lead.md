# Team lead
- **label:** Team lead
- **blurb:** How do I keep the Team's record and its projects truthful, and move projects to and from my Agents?
- **class:** cowork
- **requires:** lead
- **order:** 60

Reach for this because you are the designated Team lead. Every Agent keeps its personal work record; you additionally read and update the Team roster — the Team's record — and manage the projects the Team holds. `ronin_sops/teams.md` is the procedure; the Team roster tools are being settled with the session vocabulary and join the table below as they land.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `session_create` | create: one supporting Agent, optionally for a roster-held project, through the ordinary launch resolver; refuses an existing name | priority | `session_create --help` |
| `session_check` | read: one live session by exact name | | |
| `session_set` | write: a member's Team membership, lead designation, or project root | | |
| `worktree-desk assign` | write: give a named Agent a desk with the same source choice | | `worktree-desk --help` |
| `edges wipeboard post --to all` | write: a broadcast every member is interrupted for | | `edges --help` |

## What the lead does

| Capability | Meaning |
|---|---|
| Team record read and update | the roster's objective, launch defaults, membership, and the Team page |
| Team project create, read, write | projects the Team holds before they are assigned; lead ideas live in the Team roster, not in a separate file or pool |
| Assign and return | the two lead moves: assign a held project whole to one Agent; take one back from an Agent's record. A project is one canonical object and is never copied |
| Member and project status | each member's work record and each project's two flags — `exit` (none · agent · lead · user) and `status` (green · yellow · red) — as the Team Kanban projects them at read time |
| Supporting-Agent lifecycle | create, re-cut, and end supporting Agents; assign their desks with the same source choice |
| Team broadcasts | the wipeboard for everything the whole Team must see; one-on-one goes directly to the session |

The move is the approval: there is no verdict, decider, revision counter, or history on a
project. Parking a project for a future common pool is outside this bundle.

`session_create <name> --project <team/id>` composes two existing operations. Its brief
names the project, birth happens through the ordinary resolver, and only then is the whole
project assigned. If assignment fails after birth, it reports that partial result and does
not claim the newborn holds the project.

Promotion is the lead's: hand-ins reach the Team line, and the lead moves the coherent Team
line to `dev` once, on the owner's word. Never promote mid-refactor.
