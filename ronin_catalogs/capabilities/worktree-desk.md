# Worktree desk
- **label:** Worktree desk
- **blurb:** How do I preserve and hand in repository work held in a managed desk?
- **class:** cowork
- **requires:** arrangement:managed
- **order:** 40

Reach for the desk tool because you hold a managed desk: a private branch and worktree leased to you. Compare its status with your brief before writing; sync adopts accepted `dev` changes; commit is a private checkpoint; hand-in admits committed work to the Team review line. None of these is Git push, and Git push belongs only to release work. Read `ronin_sops/worktree-root.md` before your first write.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `worktree-desk status` | read: lifecycle facts of your desks | priority | `worktree-desk --help` |
| `worktree-desk sync` | write: merge current local `dev` into the desk | priority | `worktree-desk --help` |
| `worktree-desk hand-in` | write: admit committed work to the Team line | priority | `worktree-desk --help` |
| `worktree-desk open` | create: a private desk | | `worktree-desk --help` |
| `worktree-desk close` | write: remove a clean, integrated desk | | `worktree-desk --help` |
| `worktree-desk receipts` | read: the publication record | | `worktree-desk --help` |
| `worktree-desk reply` | write: answer a conflict on a receipt | | `worktree-desk --help` |
| `worktree-desk handoff` | write: transfer custody | | `worktree-desk --help` |
| `worktree-desk discard` | destroy: exact confirmation required | | `worktree-desk --help` |
| `worktree-desk repository-init` | create: local `git init` in an existing Workspace Folder | | `worktree-desk --help` |

An ordinary contributor uses `status`, `sync`, and `hand-in`. Opening, handoff, receipts,
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
