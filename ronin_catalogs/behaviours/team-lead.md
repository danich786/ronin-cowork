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

More: `ronin-help edges`
