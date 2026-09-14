# Message delivery

There are two input paths:

- Direct terminal typing stays direct: keys, including Enter, go to the Agent.
- Complete messages use the message queue: direct tells, House receipts, wipeboard
  notices, and Ronin's message box (on mobile and in Unlocked views).

## One send operation

Delivery means **type the text, pause 300 ms, press Enter**. The pause lets the CLI
finish accepting pasted text. Text and Enter are separate terminal commands, so Enter
is not swallowed as part of a paste. There are no screen checks between them, no
fingerprints, no prompt-disappearance verification, and no repeated Enter loop.

Success means Ronin sent text and Enter, not that the Agent has processed the message.
A terminal transport error remains visible in Messages.

## Preflight and the two-minute limit

Ordinary queued messages check the target's birth identity, Control setting and input
before typing. A recognized draft or dialog holds the message without inserting anything.
Thinking by itself does not hold delivery, and must not hide a draft or dialog.
Unknown screens do not hold delivery. The preflight is deliberately best effort.

Waiting messages retry every two seconds. At two minutes from acceptance, Ronin bypasses
Control and input checks and sends once. Continued typing and retries do not reset the
deadline. This deliberately accepts colliding with an unfinished draft or a dialog.
The deadline is fixed; the former `messages.auto_force_after_s` setting is no longer used.
A stopped server or unavailable terminal cannot meet the deadline; retained messages are
considered again when the server runs. A failed forced transport is kept for manual retry.

Ronin's message box is the owner's explicit send: **it bypasses preflight immediately**.
It posts plain text to `POST /api/messages`, in either terminal view, and uses the same
text-then-Enter operation as every other message. It does not depend on the terminal
WebSocket. One Enter or tap sends; a second press while the request is in flight does
nothing. Shift+Enter inserts a newline. A bare Enter in an empty box remains a direct key.
The box clears when the server accepts responsibility for the message, unless the owner
has edited it in the meantime. A refusal or network error keeps the text with a reason.

Complete messages to one target share a filesystem lock, including CLI workers and the
server. Another message waits until the first finishes its text and Enter. Direct human
terminal input is not routed through this lock. Different targets progress independently.
Within a sweep, wipeboard interruption notices follow other messages, because the posts
remain available through a wipeboard read.

## Identity, retained messages and actions

Acceptance requires a live target and stores its birth key. A missing or reused target
becomes **Target missing** and cannot be forced into a different Agent.

- **Waiting:** preflight or another message held delivery. Automatic retries continue.
- **Failed:** a terminal operation failed after delivery started. The message stays visible.
- **Force:** send now without preflight. **Try Again:** repeat preflight and send if allowed.
- **Dismiss:** remove the retained message. Bulk actions use the exact displayed IDs.

A message's `auto_forced_at` marks its one deadline override. Attempts counts actual
attempts, not preflight holds. Messages have generated IDs; identical intentional text
remains separate messages.

The existing transport TTLs remain: direct tells 30 minutes, wipeboard notices 10 minutes,
other sources 60 minutes. Expired or dismissed direct tells send a House negative
acknowledgement when the sender still exists. House and viewer identities do not create
acknowledgement loops. Wipeboard posts and durable work receipts are separate from their
interruption copies.

## API

- `GET /api/messages`
- `POST /api/messages` with `{ "target": "agent", "text": "message" }`: immediate owner send
- `POST /api/messages/:id/retry`
- `POST /api/messages/:id/force`
- `POST /api/messages/force` with `{ "ids": ["..."] }`
- `DELETE /api/messages/:id`
- `DELETE /api/messages` with `{ "ids": ["..."] }`

`POST /api/sessions/:name/send` is also an immediate owner send through the queue.
