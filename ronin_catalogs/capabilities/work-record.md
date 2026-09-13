# Work Record
- **label:** Work Record
- **blurb:** How do I keep my current work, documents, and held projects truthful?
- **class:** cowork
- **requires:** —
- **order:** 20

Reach for the work-record tools whenever your task, position, documents, or a project you hold changes: it is the one record the owner reads on your tile and the roster, and a stale one is worse than none. Documents and projects are resources inside it, not separate memory systems.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `work-record update-record` | write: objective, repository rows, focus | priority | `work-record --help` |
| `work-record document add` | write: what the owner can open from Docs | priority | `work-record --help` |
| `work-record project create` | create: one complete project; the Team roster issues its unique stable ID | priority | `work-record --help` |
| `work-record project read` | read: one held project | priority | `work-record --help` |
| `work-record project write` | write: one held project's fields, stages, gates, and flags | priority | `work-record --help` |
| `work-record document list` | read | | `work-record --help` |
| `work-record document remove` | write | | `work-record --help` |
| `work-record project list` | read | | `work-record --help` |

`update-record` changes session-level fields: the objective, repository rows, focus, and
other record metadata. `document add|remove` controls what the owner can open from the
Docs tab — a document you did not list is one they cannot reach without asking you for the
path.

## Projects

A project is one canonical object with a stable ID. It moves whole between a Team roster
and an Agent's work record; it is never copied. An Agent writes only the projects it holds.

`project create` is first-class creation, not an upsert: the Team roster issues its ID,
then the operation writes a complete, valid project with its position and starting state.
Agents never choose or reuse IDs. `project read` and `project write` work on a held project by ID; steps,
stages, and gates change through `project write`, never through a second ladder command.

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
