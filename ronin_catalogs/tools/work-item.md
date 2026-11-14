# item
- **seed:** create, find, move, hand off and comment on work items
- **when:**
- **depth:** seed
- **serves:** project-management
- **order:** 40

## Commands

| Tool | Authority |
|---|---|
| `item create` | create: one work item under an epic, held by you (a lead's: by its Team); answers `created <id> under <parent>` |
| `item read` | read: one item with its children, comments, attachments, links and history |
| `item search` | read: items by Campaign, Team, holder, parent, status, kind, or `--text` in the title or objective |
| `item edit` | write: one item's fields; `--parent` moves it, the level following |
| `item transition` | write: the status of one or several items; a hand-in to In Review takes `--note`, the Handed in comment for the user |
| `item flag` | write: one or several items are stuck, with the reason as a comment |
| `item unflag` | write: one or several items are clear |
| `item handoff` | write: the giver comes off one or several items and the receiver (an Agent or `team:<name>`) goes on. The giver is you, with any Team of yours or of the receiver's that holds it; `--from` names it; `--keep-holding` keeps it on too |
| `item handover` | write: an ending Agent hands one or several items to its Team or an Agent, with where each stands and what is next (a Handover comment); `--to-do`, `--flag "<the question>"` |
| `item watch` | write: track one or several items without holding them; `item unwatch` stops |
| `item comment` | write: one comment, or `--edit <n>` changes one |
| `item attach` | write: attach or remove a document, visible in Docs |
| `item link` | write: a link by type name (Blocks, Relates, …) |
| `item archive` | write: one or several Done items off every list now, as five days Done does; `--done [--team <t>]` clears every Done item you or your Teams hold; an item not Done is refused |
| `item delete` | write: one or several items go, with their subtasks |

## Syntax

- An id is a plain id such as `w12` or `KAN-65`; every id an item has had still finds it.
- Where a tool takes several ids, list them: `item transition w12 w13 "In Progress"`,
  `item handover w12 w13 team:surface "<where they stand; what is next>"`.
- Status, kind, priority and link type are the space's names exactly (`item --help` lists
  them); anything else is refused, naming the set.
- Flag as `item flag <id> "Waiting on <who>: <what>"`.

More: `ronin-help work-items`

## Usage

Every act on a work item, the item always named: create, read, search, edit, transition, flag, unflag, handoff, comment, attach, link and delete. `item --help`.
