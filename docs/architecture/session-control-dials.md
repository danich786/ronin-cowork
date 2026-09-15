# Session Control

New sessions start read/write (`write`) through the shared launcher in
`src/spawn.ts`. Agent launch input does not select Control. This default supports
Agents working together; it does not change existing sessions or archive restoration.

The legacy `@ronin-control` metadata still supports `user`, `read`, and `write`.
It is not a general API or tmux authorization boundary. Safe message delivery in
`src/message-queue.ts` does retain a message when the target is not `write`.
Tools may report the stored value for coordination.

The value is stored on the tmux session and returned by
`GET /api/sessions/:name/control`. The legacy setter remains
`POST /api/sessions/:name/control`; the current tile header does not expose a dial.

`bin/shim/tmux` has one separate responsibility: `tmux kill-server` and tmux's accepted
abbreviations for that command are unavailable because they end every session.
