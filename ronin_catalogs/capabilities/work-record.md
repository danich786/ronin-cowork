# Work Record
- **label:** Work Record
- **blurb:** How do I keep my current work, documents, and held projects truthful?
- **class:** cowork
- **requires:** —
- **order:** 20

Reach for this bundle when your task, position, documents, or a held project changes: it
is the one record the owner reads on your tile and roster. Documents and projects are
resources inside it, not separate memory systems.

**Live tool:** the shipped `work-record` dispatcher owns record fields, Docs visibility,
and held-project create/read/write.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `work-record update_record` | write: objective, repositories, ladder, and focus | priority | `work-record --help` |
| `work-record document add` | write: make one document visible in Docs | priority | `work-record --help` |
| `work-record project create` | create: one complete project with a Team-issued ID | priority | `work-record --help` |
| `work-record project read` | read: one held project | priority | `work-record --help` |
| `work-record project write` | write: one held project's typed fields | priority | `work-record --help` |
| `work-record project return` | write: move one held project whole back to Team Ideas | priority | `work-record project --help` |
| `work-record read` | read: the current work record | | `work-record --help` |
| `work-record document list` | read: listed documents | | `work-record --help` |
| `work-record document remove` | write: remove Docs visibility | | `work-record --help` |
| `work-record project list` | read: held projects | | `work-record --help` |
| `team-lead project list` | read: Team-held projects; the same dispatcher also exposes Team-holder project operations | | `team-lead --help` |

## Projects

A project is one canonical object with a stable ID. It moves whole between a Team roster
and an Agent's work record; it is never copied. An Agent writes only the projects it holds.

`project create` is first-class, not an upsert: the Team roster issues its ID,
then the operation writes a complete, valid project with its position and starting state.
Agents never choose or reuse IDs. `project read` and `project write` address a held project
by ID; steps, stages, and gates change through that typed authority, never a second command.

Every Agent may take an assignment. If work arrives without a Project, create its one
canonical object with `work-record project create --team <team> --title <text> --objective
<text>`. The Team roster issues the stable ID; never hand-pick an ID or copy a project.
Read the returned ID, then use `work-record project read <id>` and the lifecycle verbs
shown by `work-record project --help`.

There are three entrances to the same custody path: a lead creates and assigns one Project;
an Agent returns that same object with `work-record project return <id>`; or an Agent creates
its own Project when work arrived without one. Every path uses the Team roster's ID sequence,
and no path copies the object.

A project carries exactly two flags:

| Flag | Values | Meaning |
|---|---|---|
| `exit` | `none` · `agent` · `lead` · `user` | who the project is waiting on to move |
| `status` | `green` · `yellow` · `red` | how the held work is going |

The move itself is the approval. A project has no revision counter, history, log, owner
field, verdict, or decider; the Team Kanban is a read-time projection over the projects the
lead and the Agents hold.

Handoffs are documents attached to a project or listed in the record; there is no
separate handoff command. Reporting an outcome is ordinary responsibility, not an
operation.

Use the intent verbs when they say what happened more plainly than raw fields:
`working <id>` means yellow with the Agent acting next; `ready <id> --for lead|user`
means green and names the next actor; `stuck <id>` means red while the Agent retains the
next move; `blocked <id> --on lead|user` means red and names who must act; `advance <id>
--to <stage>` changes only the stage. No verb advances a project because a receipt,
message, drag, or acknowledgement appeared.

`backlog <id>` takes a held project off the active table without moving its holder or
changing its stage or flags; `resume <id>` returns it at the same stage. Ideas and return
are not backlog.
