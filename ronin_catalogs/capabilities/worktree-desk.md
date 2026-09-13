# Worktree desk
- **label:** Worktree desk
- **blurb:** How do I preserve and hand in repository work held in a managed desk?
- **class:** cowork
- **requires:** arrangement:managed
- **order:** 40

Reach for this bundle because you hold a managed desk: a private branch and worktree leased
to you. Status, sync, commit, and hand-in are distinct; none is Git push. Read
`ronin_sops/worktree-root.md` before the first write.

**TBD capability:** no `worktree-desk` executable ships yet, so this document grants the
desk contract but teaches no callable command. Do not type or invent `worktree-desk ...`
operations. Its future typed surface covers status, sync, hand-in, open, close, receipts,
conflict reply, handoff, exact-confirmed discard, assignment, and local repository init.

An ordinary contributor needs status, sync, and hand-in. Opening, handoff, receipts,
conflict replies, discard, and closing are in help and on the Worktrees page; assigning a
desk to another Agent is the lead's.

Hand-in constructs an isolated candidate and reports `ACCEPTED` with a receipt, or keeps
the desk and records the evidence on a conflict; nothing is lost either way. Hand-in reaches
the Team line only: the lead's promotion moves the coherent Team line to `dev`, and release
publication is separate work.

`close` removes only a clean desk already contained in its line and refuses while a live
session stands in it. The desk you were born in is closed with you when you end, never by
hand. `discard` is the one destructive form and requires the exact confirmation shown.

`repository-init` runs local `git init` only, in an existing Workspace Folder; it never
creates the folder, a remote, or a hosted repository.

The table is the executable contract. All ten rows are subcommands of the single
`worktree-desk` executable and appear in its help. `status`, `sync`, `hand-in`, `open`,
`close`, `receipts`, `reply`, `handoff`, and `discard` retain the guarded desk lifecycle;
`repository-init` is the repository operation. No second desk or repository initializer
is projected.

After the final hand-in, `status` must say `CERTIFIED CLEAN`: no unsaved files and every
commit on the Team line. Stay parked unless told to end.
