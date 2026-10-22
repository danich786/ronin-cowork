# Work Item
- **label:** Work Item
- **blurb:** How do I create, read, change, move, comment on or hold a work item, its ladder and its documents?
- **class:** cowork
- **requires:** —
- **order:** 25

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `item create` | create: one work item, held by nobody until assigned | priority | `item --help` |
| `item read` | read: one work item, who holds it, and its children | priority | `item --help` |
| `item list` | read: items by Team, holder or parent | priority | `item --help` |
| `item edit` | write: one item's fields, one trail line | priority | `item --help` |
| `item transition` | write: an item's status, any to any | priority | `item --help` |
| `item move` | write: an item's parent and level together | priority | `item --help` |
| `item assign` | write: who holds an item, an Agent, a Team or nobody | priority | `item --help` |
| `item plan` | write: an item's own ladder | priority | `item --help` |
| `item doc` | write: list or unlist a document on an item, visible in Docs | priority | `item --help` |
| `item comment` | write: one comment on an item, with who and when; facts and receipts go here | priority | `item --help` |
| `item focus` | write: which held item your work record shows | priority | `item --help` |

Your work lives on work items, as in Jira.

**Kinds.** An **epic** holds a body of work. A **story, task, bug or feature** is the
work itself; it is what you will create most. A **subtask** is a step inside one of
those. The kind names are the space's own.

| To | Command |
|---|---|
| see what you hold | `work-record read` |
| read an item | `item read <id>` |
| create one | `item create --title <t> --kind task\|bug\|story\|feature`. Add `--parent <id>` when you know where it belongs: under an epic it is work, under a task it is a subtask. With no parent it is work with no epic yet. |
| edit it | `item edit <id> --objective <o> --flagged true --priority <p>` |
| transition it | `item transition <id> BUILD`: moves it to a status, the next column on the board |
| comment on it | `item comment <id> <text>`: how you answer a person, from Jira or Ronin |
| assign it | `item assign <id> <agent>` |
| keep its ladder | `item plan <id> …`: how you will get the item done and where you are. Phases hold legs, one ACTIVE at a time; a gate where you need someone. The owner reads it on your tile. Ronin's own; Jira has none |
| attach a document | `item doc <id> add <path>`: the owner reaches only the documents you attach |

Status is the board's column: IDEA PLAN BUILD REVIEW LAND DONE; any transition is allowed. Stuck is
`--flagged true`. When someone else changes an item you hold, Ronin tells you: read it,
then edit or comment. Epics are made by leads (`--level 1`). Everything else:
`item --help`.
