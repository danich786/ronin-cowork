# Managed desks

A managed desk gives an Agent its own branch and worktree for a repository. Parallel
Agents can change files independently and hand their work to the Team review line.

## Work at your assigned desk

1. Read the desk assignment and run `worktree-desk --help` for the current command surface.
2. Use `worktree-desk status --assignment` to check the repositories and working folders.
3. Use `worktree-desk sync <repo>` to adopt global development changes, or select a source below.
4. Edit, verify, and commit at the desk. A commit preserves work privately.
5. Use `worktree-desk hand-in <repo>` to submit committed work to the Team line.
6. Check status again. **CERTIFIED CLEAN** means no unsaved work or private commits will
   be lost when the session ends.

Hand-in and promotion are separate. Hand-in admits work to Team review; promotion admits
reviewed work to the global development line. Neither means a release was deployed or
published remotely.

## Choose a sync source

| Source | Command |
|---|---|
| Global development | `worktree-desk sync <repo> --source dev` (the default) |
| Shared Team review line | `worktree-desk sync <repo> --source team` |
| Team lead's private desk | `worktree-desk sync <repo> --source lead` |
| A specific teammate's desk | `worktree-desk sync <repo> --source <repo:branch>` |

A lead's desk and the shared Team line are distinct. Name the exact desk when the lead
has several. A source desk must belong to the same repository. Sync copies committed
history, not unsaved files, and does not move the source or change your hand-in destination.
Private source work is not necessarily reviewed or verified.

The acknowledgement identifies the source ref and SHA and destination before/after HEAD.
It says whether a merge occurred, the commit was already contained, the update is pending,
or a conflict aborted the merge. If the source is dirty, it explicitly says those unsaved
changes were excluded. Pending and conflict preserve your files; read the named reason
and files before continuing. A retry uses the source you select on that invocation.

## When something needs attention

Read the tool's result before retrying. A conflict needs review at the desk. A dirty or
unique desk needs its work preserved. Do not delete its folder or rewrite the shared line
to make a status message go away.

Use the documented handoff command to transfer unfinished work. End a session through
`session_end` so all of its assigned desks are considered together. Follow the current
help and the assignment's lifecycle instructions for closing an unused desk.

Contributors: [Worktrees](../architecture/worktrees.md) defines applicability and resolution;
[desk construction](../architecture/desks.md) describes state, queues, and hand-in mechanics.
