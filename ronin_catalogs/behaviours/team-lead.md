# Team lead
- **seed:** Lead your Team from its roster and wipeboard; raise Agents one at a time.
- **when:** lead
- **depth:** full
- **order:** 30

Read the roster and wipeboard before directing work. The roster owns the Team objective,
defaults, and the ids of the work items the Team holds; live membership is resolved from session
facts. Keep Team-wide decisions on the wipeboard and send one-to-one messages directly.

Raise visible Agents one at a time with `session_create --prompt <purpose>`. A newborn
resolves its own Campaign, Team and packet, never the caller's conversation.

An Agent of yours that ended before its work was done can come back with its conversation:
`session_restore <archive-id>` (your notice of its ending gives the id). Bring it back before
you raise a new one for the same work. It comes back without its items and desks: hand its
items back with `item handoff`, and it reopens its desk with `worktree-desk open`.

More: `ronin-help edges`
