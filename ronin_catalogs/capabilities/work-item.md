# Work Item
- **label:** Work Item
- **blurb:** How do I create, read, change, move or hold a work item, its ladder and its documents?
- **class:** cowork
- **requires:** —
- **order:** 25

Reach for `item` whenever a work item is involved: making one, reading it, changing its
fields, filing it under a parent, holding it, planning it, listing its documents, recording
evidence on it, or choosing which held item your work record shows. Every act names its
item; nothing is edited through a focus.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `item create` | create: one work item, held by nobody until assigned | priority | `item --help` |
| `item read` | read: one work item, who holds it, and its children | priority | `item --help` |
| `item list` | read: items by Team, holder or parent | priority | `item --help` |
| `item write` | write: one item's fields, one trail line | priority | `item --help` |
| `item move` | write: an item's parent and level together | priority | `item --help` |
| `item assign` | write: who holds an item, an Agent, a Team or nobody | priority | `item --help` |
| `item plan` | write: an item's own ladder | priority | `item --help` |
| `item doc` | write: list or unlist a document on an item, visible in Docs | priority | `item --help` |
| `item evidence` | write: a fact with its receipt on an item's trail | priority | `item --help` |
| `item focus` | write: which held item your work record shows | priority | `item --help` |

## The work item

A work item matches Jira. It is one object with a stable id (`w12`), stored once, with the
same fields at every level; a field that means nothing at a level is simply unused.

| Field | Values | Meaning |
|---|---|---|
| `level` | `1` epic · `0` story, task or bug · `-1` subtask | stored; a new item is one below its parent, `0` with none |
| `kind` | `story` · `task` · `bug` · blank | a label; blank by default |
| `status` | `IDEA` · `PLAN` · `BUILD` · `REVIEW` · `LAND` · `DONE` | the board's column |
| `flagged` | `true` · `false` | an impediment |
| `parent` | an id, or none | none is normal |
| `ladder` | phases, legs, gates | every item keeps its own, children or not |
| `docs` | paths | the item's documents |
| `external` | `jira` · `trello` · `github` keys | written with `item write <id> --jira <key>` |

Adding a child never changes an item's level or its ladder. `item move <id> --to <parent>|none`
sets the parent and the level in one act, as Jira's move does; an item with subtasks can't
move. Stuck is `item write <id> --flagged true`.

Holding is a list of ids on each Agent and Team; `item assign` moves the id and never the
item. Holding is how work is found, never permission: any Agent may change any item, and
every write appends one trail line naming who called. Every acknowledgement answers with the
item as it now is ("w9 is a task at PLAN", "w7 is an epic at PLAN") and ends with the writes
that keep it current; read it before your next act.

Two other tools move status from receipts: a hand-in naming the item moves it to LAND, and
a promotion moves the items on its hand-ins to DONE. Phases and legs are never items.
Handoffs are documents on an item.
