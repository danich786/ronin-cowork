# Work Record
- **label:** Work Record
- **blurb:** How do I keep my objective, repositories and place on the ladder truthful?
- **class:** cowork
- **requires:** —
- **order:** 20

Reach for this bundle when your objective, your repositories, or whether you are on your
ladder changes: it is the one record the owner reads on your tile and roster. The record
keeps what is about you: your objective, repositories, the ids you hold, and your focus.
Work items, with their ladders and documents, are the `item` tool's: the Work Item capability.

**Show docs** means list the documents of the items you hold: `work-record read` shows them. **Update work record** means
record your current objective and repositories through the typed dispatcher.

**Live tool:** the shipped `work-record` dispatcher owns the record's fields; `work-record
read` also shows the items you hold and your focus item's ladder, from `/api/work-items`.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `work-record update_record` | write: objective and repositories on the record | priority | `work-record --help` |
| `work-record workspace` | read/write: list, add or remove repositories this Agent records as current work; accepts a handle or full URL and a separate branch | priority | `work-record workspace --help` |
| `work-record read` | read: the record, the items held and the focus item's ladder | priority | `work-record --help` |

## The record and the items

The record holds your objective, mandate, repositories, the Teams you are on (derived), the
ids of the items you hold and your focus. Your ladder is your focus item's (the Work Item
capability). Reporting an outcome is ordinary
responsibility, not an operation.
