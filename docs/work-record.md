# Work records and projects

A work record says what an Agent is doing now. It contains session context—objective,
repositories, documents, and focus—and every project the Agent currently holds. The
Team Kanban is derived from these records and the Team roster; there is no stored board
to reconcile.

Use the shipped `work-record` command exposed to your session. `work-record --help` is the
canonical command vocabulary; there are no legacy reader or writer aliases.

## Projects are the work ladder

Plan real deliverable work as a project. Do not also maintain a session-level ladder for
the same work. A project is one complete object:

```json
{
  "id": "virtual-kanban/6",
  "title": "Agent-authored projects",
  "objective": "Create collision-free projects in an Agent work record.",
  "stage": "BUILDING",
  "exit": "agent",
  "status": "yellow",
  "ladder": [
    { "stage": "BUILDING", "legs": [
      { "title": "Roster issued the stable ID", "done": true },
      { "title": "Focused checks pass", "done": false }
    ] },
    { "stage": "LANDING" }
  ],
  "evidence": []
}
```

The stable ID is issued by the Team roster's monotonic counter. An Agent does not state
the number and must not derive it from the projects it can see:

```text
work-record project create --team virtual-kanban \
  --title "Agent-authored projects" \
  --objective "Create collision-free projects in an Agent work record."
```

Issuing an ID advances the roster counter before the project is written. If the later write fails, create a new
project; a gap is harmless, while reusing an issued identity is not.

`project create` is creation, never an upsert. It writes the complete starting shape into
the calling Agent's own record and refuses an existing ID. An Agent can write only a
project it holds.

## Stage, exit, and status

`stage` is the project's current column:

- `IDEAS`: held by the Team roster before assignment.
- `PLANNING`: the Agent is shaping the accepted project.
- `BUILDING`: the Agent is producing it.
- `LANDING`: implementation is moving through hand-in, promotion, or master.
- `DONE`: the delivered result is contained by master.

Each ladder rung names one of those stages. Legs describe observable outcomes and carry
only `done: true|false`. Revise the ladder when reality changes and ask whether each test
earns a leg and its maintenance cost.

| Flag | Values | Meaning |
|---|---|---|
| `exit` | `none` · `agent` · `lead` · `user` | who must act next |
| `status` | `green` · `yellow` · `red` | delivery health |

There is no owner field. The holder is where the board found the canonical project: the
Team roster or one Agent record. There is also no revision counter, history, verdict, or
decider. Evidence is an append-only list of useful facts such as commit SHAs and hand-in
receipts, not a second status system.

Typical updates are:

```text
work-record project write virtual-kanban/6 --stage LANDING
work-record project write virtual-kanban/6 --exit lead
work-record project write virtual-kanban/6 --status green
work-record project write virtual-kanban/6 --leg BUILDING.2 done
work-record project write virtual-kanban/6 --evidence "commit 0123456789"
```

## Whole-project moves

The lead creates ideas in the Team roster and assigns or returns the whole project. The
move is the approval: assignment changes an idea to `PLANNING` and places it in the
Agent's record; return places it back in the roster as `IDEAS`. Never copy a project
between the two holders.

A lead may raise a supporting Agent for a roster-held project:

```text
session_create board_reader --project virtual-kanban/6
```

The newborn's brief names the project and tells the Agent to check the work record. Only
after birth succeeds does the lead operation place the whole project. If placement fails,
the command reports a partial result: the Agent exists, the roster still holds the
project, and no message claims it was installed.

## Session context

Session objective, repositories, documents, focus, and the legacy ladder remain for
compatibility and non-project work. Do not duplicate a project ladder there. List documents
the owner should be able to open and keep checkout rows current:

```text
work-record document add docs/work-record.md
work-record update-record --repo ronin_cowork:team/example/cut
```

These fields locate work; they do not replace commits, hand-ins, or project evidence.
Read the record after structural edits. Keep the project truthful when the plan changes,
when a leg completes, when work waits on someone else, and when landing evidence arrives.
