# Edges
- **label:** Edges
- **blurb:** How do I work across an Agent, Team, wipeboard, schedule, or visible workspace boundary?
- **class:** cowork
- **requires:** —
- **order:** 10

Reach for the edge tools whenever the work crosses out of this session: a line for one other Agent, a post the whole Team must see, a look at what another session is doing, the Team roster, the Team page, or a scheduled request. Nothing here changes your own record; that is the Work Record bundle.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `edges send` | write: one message to one session | priority | `edges --help` |
| `edges wipeboard` | read/write: the Team's board | priority | `edges --help` |
| `edges read` | read: another session's recent live view | priority | `edges --help` |
| `edges team` | read: a Team's sessions | priority | `edges --help` |
| `edges page` | read/write: the Team page | | `edges --help` |
| `edges schedule` | read/write: the Team's Cron jobs | | `edges --help` |
| `edges control` | read: a session's Control setting | | `edges --help` |

`edges send` delivers one message to one session, with no board in between. Open with
`from @<your session>:` — the tool adds no watermark — and report `DELIVERED` or `QUEUED`;
both are accepted outcomes, and you do not relay replies.

`edges wipeboard` is the Team's board: post rules, collisions, line state, and anything
everyone must see. A bare post interrupts the lead; `--to` changes who is interrupted, never
who may read. Never post to acknowledge — your read is recorded. Posts expire; lasting facts
go in your work record, a document, or a commit.

`edges read` shows another session's recent live view and reports it as partial. When a
durable record returns, the same operation reads it first; there is no second command to
learn.

`edges control` reads a session's Control setting. Control is the owner's visible setting;
no Agent operation raises another session's Control.

Forking into a new Agent crosses a boundary too, but it belongs to the Session bundle,
not here.
