# Managed worktrees

A managed worktree is an Agent's own branch and folder for a repository, so several Agents
can change the same repository at once without getting in each other's way.

- **Hand-in** puts an Agent's committed work on its Team's line for the lead to review.
- **Promotion** is the lead moving reviewed Team work onto global dev; that is where you try it.
  Neither is a release or a push.
- **CERTIFIED CLEAN** on a worktree means nothing in it would be lost if its Agent ended now.
- A worktree closes with its Agent at `session_end`. The Worktrees page shows every worktree,
  who stands in it and what it has handed in.

How an Agent works in one is in its brief (Working at a desk) and `ronin-help worktree-desk`.
Contributors: [Worktrees](../architecture/worktrees.md) defines applicability and resolution;
[worktree construction](../architecture/desks.md) describes state, queues, and hand-in mechanics.
