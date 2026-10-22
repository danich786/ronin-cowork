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
| `item write` | write: one item's fields, one trail line | priority | `item --help` |
| `item move` | write: an item's parent and level together | priority | `item --help` |
| `item assign` | write: who holds an item, an Agent, a Team or nobody | priority | `item --help` |
| `item plan` | write: an item's own ladder | priority | `item --help` |
| `item doc` | write: list or unlist a document on an item, visible in Docs | priority | `item --help` |
| `item comment` | write: one comment on an item, with who and when; facts and receipts go here | priority | `item --help` |
| `item focus` | write: which held item your work record shows | priority | `item --help` |

Your work lives on work items. A work item matches Jira: epic, story, task, bug,
feature, subtask.
- **Know your work:** `work-record read` shows the items you hold and your focus
  item's ladder.
- **Move it:** `item write <id> --status BUILD`. Status is the board's column: IDEA
  PLAN BUILD REVIEW LAND DONE. Stuck: `--flagged true`.
- **Plan it:** `item plan <id>`. Phases hold legs, one ACTIVE at a time, a gate where
  you need someone. A short true ladder beats a guessed one.
- **Talk and file:** `item comment <id> <text>`; `item doc <id> add <path>`. The owner
  reaches only the docs you list.
- **New work:** `item create --parent <id> --title <t>`. It lands one level down.
- **Changes:** when someone else changes an item you hold, Ronin tells you. Read it.

Everything else: `item --help`.
