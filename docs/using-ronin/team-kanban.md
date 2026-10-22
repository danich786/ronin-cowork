# Task Manager

The Task Manager is the board: the six-column view of work items by stage, Idea, Plan,
Build, Review, Land, and Done. A board is a view, never a work item. It lives on the Agent workbench: open it from the Task Manager card in the selector,
and it shows the Agent's work items across its Teams. Team Leads read a Team's reading with
`team member status <team>`. Run `team --help` for the live surface.

The Task Manager is a reading, not another store. A work item is stored once, and a Team holds a
list of item ids; so does each Agent. The Team's reading is the items the Team holds plus
the items each of its members holds, each child listed after its parent where the lead
made any. A card shows who holds it: the Team (worked by its lead) or one Agent. An item under
the Unfiled epic that nobody holds is unassigned and is not on any Team's reading. See
[work records and work items](work-record.md) for the item's shape, stages, ladder, exit,
and status.

The Task Manager is available while Ronin Services and its Task manager component are enabled.
The `team item` and `work-record item` tools move the same items without Services.

## Land and Done are moved by receipts

Stage is a mark on the item, set by a tool, and every move is a line on the item's trail.
Two tools move it for you:

- An accepted `worktree-desk hand-in <repo> --item <id>` moves the item to Land, with
  the hand-in receipt on its trail.
- A completed Team promotion moves every item named on the hand-ins it carries to Done,
  with the promotion receipt on its trail.

Each of those acknowledgements ends by naming the item and the write that keeps its words
current. Nothing is derived at read time and nothing is blocked.

Dragging a card does not change the item. It sends one move request to the Agent that
holds it—or to the lead, for a Team-held item or a lead action—naming the command that
makes the move, and marks the request locally until the item's next read. Clicking an
Agent holder opens that Agent's tile in the workspace.

## Optional Trello adapter

Trello is an optional integration boundary, not the Task Manager's source of truth. An item
carries `external` ids for connected tools, and a connector reaches the same
`/api/work-items` routes as every tool: parent and child map to the tool's structure,
stage to its list or status, and holding to its assignee only where a Ronin Agent maps to
someone there. It must never store a second copy of the items in Ronin.
