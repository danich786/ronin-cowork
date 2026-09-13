# Work Record
- **label:** Work Record
- **blurb:** How do I keep my current work, documents, and held projects truthful?
- **class:** cowork
- **requires:** —
- **order:** 20

Reach for this bundle when your task, position, documents, or a held project changes: it
is the one record the owner reads on your tile and roster. Documents and projects are
resources inside it, not separate memory systems.

**TBD capability:** no `work-record` executable ships yet, so this document teaches the
record contract but no callable command. Do not type or invent `work-record ...`
operations. Its eventual typed surface owns record fields, Docs visibility, and held
project create/read/write; until it ships, report the needed record change rather than
claiming it was made.

## Projects

A project is one canonical object with a stable ID. It moves whole between a Team roster
and an Agent's work record; it is never copied. An Agent writes only the projects it holds.

Project creation is first-class, not an upsert: the Team roster issues its ID,
then the operation writes a complete, valid project with its position and starting state.
Agents never choose or reuse IDs. Read and write address a held project by ID; steps,
stages, and gates change through that typed project authority, never a second ladder command.

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
