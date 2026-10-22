# Work records and work items

A work record says what an Agent is doing now: its objective, repositories, the work items
it holds, and its focus. The ladder and the documents live on work items. The Task
Manager's board is a view of the same items by status; nothing is stored twice.

Two shipped commands: `work-record` keeps what is about the Agent (objective, repositories,
whether it is on its ladder), and `item` does every act on a work item, the item always
named. `work-record --help` and `item --help` are the canonical vocabulary; there are no
aliases.

## Work items

A work item matches Jira. It is stored once, keyed by its id (`w12`), and changed only by
tools. Every change appends one line to its trail naming who made it. Nobody is refused for
not holding an item: holding is how work is found, never permission.

```json
{
  "id": "w12",
  "title": "Agent-authored items",
  "objective": "Create collision-free work items.",
  "level": 0,
  "kind": "task",
  "status": "BUILD",
  "flagged": false,
  "parent": "w3",
  "ladder": [
    { "gate": "go / no-go", "status": "DONE" },
    { "phase": "Build it", "status": "ACTIVE", "legs": [
      { "title": "Store round-trips", "status": "DONE" },
      { "title": "Focused checks pass", "status": "ACTIVE" }
    ] }
  ],
  "docs": ["/home/me/plans/AGENT_ITEMS.md"],
  "external": { "jira": "RON-12" },
  "trail": [
    { "at": "2026-09-28T15:02:11Z", "by": "lead", "op": "create", "to": "none", "note": "Agent-authored items; under w3" },
    { "at": "2026-09-28T15:04:40Z", "by": "lead", "op": "assign", "from": "none", "to": "agent:builder" }
  ],
  "created": { "at": "2026-09-28T15:02:11Z", "by": "lead" }
}
```

| Field | Values | Meaning |
|---|---|---|
| `level` | `1` epic · `0` story, task or bug · `-1` subtask | stored; a new item is one level below its parent, `0` with none |
| `kind` | `story` · `task` · `bug` · blank | a label; blank unless you set it |
| `status` | `IDEA` · `PLAN` · `BUILD` · `REVIEW` · `LAND` · `DONE` | the board's column |
| `flagged` | `true` · `false` | an impediment, as Jira's flag |
| `parent` | an id, or none | none is normal |
| `external` | `jira`, `trello`, `github` keys | written with `item write <id> --jira <key>` |

One object serves every level; a field that means nothing at a level is simply unused, as in
Jira. An epic's status is set by hand. Adding a child never changes an item's level, and
every item keeps its own ladder, children or not.

Two relations are kept apart. **Holding** (assign, held by) is a list of item ids on each
Team and each Agent; assigning moves the id from one list to another and never touches the
item. **Parent** is one id on the item, or none. A Team holds; it does not contain.

```text
item create --title "Agent-authored items" [--objective "…"] [--parent w3] [--level 1|0|-1] [--kind story|task|bug]
item read w12                       # with its children, if any
item list [--team surface] [--holder builder] [--parent w3 | --no-parent]
item write w12 --status REVIEW --flagged true --jira RON-12
item move w12 --to w3               # parent and level together; --to none for no parent
item assign w12 builder             # or team:surface, or none
item evidence w12 "commit 0123456789"
```

A new item is held by nobody until it is assigned. `item move` is Jira's move: the parent
and the level change in one act, one below the new parent or `0` with none, so any level-0
item moved under another becomes a subtask. An item with subtasks can't move, in one line:
"w39 has subtasks and can't move." A move whose parent chain comes back to the item is
refused with the chain named.

Every write answers with the item as it now is and the trail line it appended. Its
acknowledgement is one line of what the act did, read from that trail line, and nothing
after it: "w39 moved under w40, level -1", "w9 moved to BUILD", "w9 is held by agent:x",
"w12 was created", "w12 changed: kind story, flagged". Status, kind and level appear only
when the act changed them. When an item arrives under one someone holds, by a create with a
parent or a move, that holder gets one message through the ordinary queue: "w9 Fix login
was added under w7, which you hold. Handle it as you see fit." A
Team holder's lead gets it. An item held by nobody notifies nobody.

## Receipts move Land and Done

Name the item on a hand-in with `worktree-desk hand-in <repo> --item <id>`. An accepted
hand-in moves the item to LAND, with the receipt on its trail. A completed promotion moves
every item named on the hand-ins it carries to DONE, with the promotion receipt. No
association is guessed from focus, names, or repositories.

A supporting Agent and an assignment are two operations owned by their tools:

```text
session_create board_reader --prompt "Take w12 and read it with item read w12."
item assign w12 board_reader
```

## Ladders and documents live on items

Every item keeps its own ladder; `item plan` writes it, the item named. Your work record
shows the ladder of your focus item, which `item focus` chooses among the items you hold:

```text
item plan w12 --phase "Build it" --leg 1 "Store round-trips"
item plan w12 --done 1.1 --active 1.2
item plan w12 --gate "owner go"
item focus w12
work-record read --rungs
```

Phases and legs are never items; only a lead breaking work up makes a piece its own item,
with a parent. Documents live on items too, and travel with them when they move between
Agents. The Docs tab lists your README and the documents of every item you hold:

```text
item doc w12 add docs/using-ronin/work-record.md
item doc w12 remove docs/using-ronin/work-record.md
```

## The work record

```text
work-record update_record --objective "<sentence>"
work-record update_record --on_tangent      # stepped off the ladder; --on_track when back
work-record workspace add ronin_cowork --branch team/example/cut
work-record workspace add https://github.com/ronincowork/samurai_lab.git --branch main
work-record workspace list
work-record read
```

Remove an old entry with `work-record workspace remove <repo-or-url>`; add `--branch`
to remove only that branch. The acknowledgement says how many rows changed, including
when none matched. `session_set <name> --root <handle>` separately changes a live
session's recorded Workspace Folder. Neither edit changes its birth directory or opens
a managed desk. These fields locate work; they do not replace commits, hand-ins, or evidence.

When an Agent ends, is archived, or is Hard Deleted, what it held is released: each item
gets a `holder-ended` line and is held by nobody, found again under its parent or with no
parent. Restoring an archived Agent does not reclaim it.

## Items written before 2026-10-22

Item files in the old shape (a `stage`, an `exit`, a green/yellow/red `status`) are read in
the new one: `stage` is the status, red is flagged, and `exit` and the other colours go.
They are written in the new shape on their next write. One migration at start rewrites the
whole store that way, gives every item with children level 1 and every other level 0, and
removes the Unfiled epic, leaving its items with no parent.
