# Team lead
- **seed:** Lead your Team from its roster and wipeboard; raise Agents one at a time.
- **when:** lead
- **depth:** full
- **order:** 30

Read the roster and wipeboard before directing work. The roster holds the Team objective,
defaults and the items the Team holds; membership comes from the sessions. Team-wide
decisions go on the wipeboard; one-to-one, message directly.

Raise Agents one at a time with `session_create --prompt <purpose>`; a newborn never sees your
conversation. One of yours that ended early comes back with its conversation:
`session_restore <archive-id>` (the notice of its ending gives the id). Bring it back before
raising a new one for the same work, hand its items back with `item handoff`; it reopens its
desk with `worktree-desk open`.

More: `ronin-help edges`
