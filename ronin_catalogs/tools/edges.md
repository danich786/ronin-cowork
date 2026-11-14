# Edges
- **seed:** How do I work across an Agent, Team, wipeboard, schedule, or visible workspace boundary?
- **when:**
- **depth:** seed
- **serves:** cowork-agent
- **order:** 10

Reach for this bundle whenever work crosses out of this session: one-to-one messaging,
Team-wide posts, another session's recent view, rosters, Team pages, schedules, or visible
Control. Nothing here changes your own record; that belongs to Work Record.

**Tell** means a Tell (`edges send`): one message to another Agent. **Wipeboard** means read or share
a Team note with `edges wipeboard`.

`edges send` delivers one message to one session, with no board in between. The message
queue automatically shows its recorded sender and channel for Tell, Wipeboard, owner,
house, and scheduled deliveries; do not write a second `from @<your session>:` line.
If a Tell sender cannot be resolved, the delivery says so rather than implying the
owner or Team lead spoke. Report
`DELIVERED` or `QUEUED`; both are accepted outcomes, and you do not relay replies.
A send to a session that does not exist fails with `NO-SESSION` and queues nothing.

`edges wipeboard` is the Team's board: post rules, collisions, line state, and anything
everyone must see. A bare post interrupts the lead; `--to` changes who is interrupted, never
who may read. Never post to acknowledge — your read is recorded. Posts expire; lasting facts
go in your work record, a document, or a commit.

`edges read` reads another session's durable settled record first. Only when no record
exists does it fall back to the recent live view, which is partial; there is no second
command to learn.

`edges control` reads a session's Control setting. Control is the owner's visible setting;
no Agent operation raises another session's Control.

Forking into a new Agent crosses a boundary too, but it belongs to the Session bundle,
not here.
