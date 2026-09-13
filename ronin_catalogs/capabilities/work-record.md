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
| `work-record read` | read: the current work record | | `work-record --help` |
| `work-record document list` | read: listed documents | | `work-record --help` |
| `work-record document remove` | write: remove Docs visibility | | `work-record --help` |
| `work-record project list` | read: held projects | | `work-record --help` |

## Projects

A project is one canonical object with a stable ID. It moves whole between a Team roster
and an Agent's work record; it is never copied. An Agent writes only the projects it holds.

`project create` is first-class, not an upsert: the Team roster issues its ID,
then the operation writes a complete, valid project with its position and starting state.
Agents never choose or reuse IDs. `project read` and `project write` address a held project
by ID; steps, stages, and gates change through that typed authority, never a second command.

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
