# Lead with worktrees
- **seed:** Give out worktrees and promote the Team line.
- **when:** lead, desk
- **depth:** full
- **order:** 40

Give each code Agent a worktree: `worktree-desk assign <repo> --session <name> --team <team>
--source dev|team`, `dev` for new work, `team` to join work in flight; the source sets where
the branch starts, not where it hands in. **Promote** moves reviewed Team-line work to global
`dev` with `bin/ronin-promote <team>`. Coherent UI usually goes without asking, batched, one
restart a round; a refactor once, on the owner's word. Master is always the owner's.
