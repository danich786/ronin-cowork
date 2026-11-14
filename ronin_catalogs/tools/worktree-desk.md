# Managed worktree
- **seed:** How do I preserve and hand in repository work held in a managed worktree?
- **when:**
- **depth:** seed
- **serves:** working-at-a-desk, lead-worktrees
- **order:** 45

Reach for this bundle when a repository uses managed worktrees or a later assignment needs
a managed worktree. It is a private branch and working folder leased to you. Status,
sync, commit, and hand-in are distinct; none is Git push. `worktree-desk open` answers with
the brief to read before your first write: `ronin-help worktree-root`.

If `worktree-desk open` reports that the repository uses its checkout, use ordinary Git in
that checkout and read the brief it names (`ronin-help checkout`); no worktree or hand-in
applies there.

**Hand in** means submit committed worktree work to the Team review line with
`worktree-desk hand-in`; it does not promote or push.

An ordinary contributor needs status, sync, and hand-in. Opening, handoff, receipts,
conflict replies, discard, and closing are in help and on the Worktrees page; assigning a
worktree to another Agent is the lead's.

Add `--item <id>` to hand-in when the receipt belongs to one work item. An accepted
hand-in records the association and moves the item to In Review, the receipt on its trail, and
ends with the write that keeps the item current. A conflict or refusal moves nothing.

Hand-in constructs an isolated candidate and reports `ACCEPTED` with a receipt, or keeps
the worktree and records the evidence on a conflict; nothing is lost either way. Hand-in reaches
the Team line only: the lead's promotion moves the coherent Team line to `dev`, and release
publication is separate work.

`close` removes only a clean worktree already contained in its line and refuses while a live
Agent stands in it. The worktree you were born in is closed with you when you end, never by
hand. `discard` is the one destructive form and requires the exact confirmation shown. A
discard refuses while any live Agent stands in the worktree and reports who occupies it;
nothing is deleted. Use the existing Hard Delete action when the intention is to remove
the Agent and its worktrees together. Normal clean closure remains `session_end`.

`repository-init` runs local `git init` only, in an existing Workspace Folder; it never
creates the folder, a remote, or a hosted repository.

The table is the executable contract. All ten rows are subcommands of the single
`worktree-desk` executable and appear in its help. `status`, `sync`, `hand-in`, `open`,
`close`, `receipts`, `reply`, `handoff`, and `discard` retain the managed-worktree lifecycle;
`repository-init` is the repository operation. No second worktree or repository initializer
is projected.

## Choose what to sync

```sh
worktree-desk sync <repo>                       # global dev (default)
worktree-desk sync <repo> --source team         # shared Team review line
worktree-desk sync <repo> --source lead         # Team lead's private worktree
worktree-desk sync <repo> --source <repo:branch> # a specific teammate's worktree
```

The named worktree must be in the same repository. If the lead choice is ambiguous, name
one of the exact worktrees the tool reports. Source selection does not change custody,
the hand-in destination, or the source worktree. It merges committed work only; uncommitted
source files stay there. This does not certify the source work as reviewed or tested.

Read the acknowledgement: it names the source ref and exact SHA, the destination's
before/after HEAD, and merged, already-contained, pending, or conflict. Pending and
conflict leave your files untouched. Commit or preserve destination edits before retrying
a pending sync with the same explicit source. On conflict, resolve the reported commit
on your private worktree; do not edit the source or shared Team line.

After the final hand-in, `status` must say `CERTIFIED CLEAN`: no unsaved files and every
commit on the Team line.

## Usage

**Get, assign, update, hand in, close, and inspect managed worktrees; initialize an existing Workspace Folder as a local repository.** `--help` lists every operation. `open <repo[:branch]> [--source dev\|team]` defaults to current local `dev`; `team` explicitly starts from the Team review line and records its exact SHA. `sync <repo[:branch]> [--source dev\|team\|lead\|<repo:branch>]` merges committed work from global dev (default), the shared Team line, the Team lead’s private worktree, or a named worktree in the same repository. Its acknowledgement names the exact source SHA, destination before/after HEAD, and whether anything merged; unsaved source files are excluded. `hand-in [<repo[:branch]>] [--assignment]` constructs an isolated candidate from current `dev`, accepted Team delta, then worktree delta; conflicts and stale CAS attempts keep the worktree and record evidence. `close` removes only a clean integrated worktree and refuses while a live session is inside it; `close … --with-session` uses coordinated shutdown. `handoff` transfers custody; `receipts` reads publication evidence; `reply` answers a conflict; exact-confirmed `discard` records a receipt before deletion. `repository-init <existing-project-root>` runs local `git init` only, never creates the folder or adds a remote, and reports `READY` when a repository already exists. Exit 0 done · 2 bad arguments · 3 no matching worktree/session · 4 not accepted · 5 stuck.
