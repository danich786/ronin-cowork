# WORKTREE ROOT — get, update, and hand in

- **scope:** conditional
- **requires:** arrangement:managed
- **installation:** —

Run `worktree-desk --help` before the first desk command in a session. The tool owns the
current syntax and resolves the repository's declared arrangement; do not reproduce its
guarded work with raw Git worktree commands.

An assigned desk is a private branch and worktree. Compare `worktree-desk status --assignment`
with the brief before writing. `worktree-desk sync <repo>` merges global dev by default.
Use `--source team` for the shared Team review line, `--source lead` for the Team lead’s
private desk, or `--source <repo:branch>` for a specific teammate’s desk in the same repo.
Only committed work merges. Read the acknowledgement: exact source SHA, destination
before/after HEAD, and merged, already-contained, pending, or conflict. Unsaved source
files are excluded; pending/conflict leaves your files untouched. Resolve conflicts on
your private desk, using the reported commit, then commit and hand in.

Commit preserves a private checkpoint; `worktree-desk hand-in <repo>` admits committed
work to Team review. Sync changes neither source custody nor your hand-in destination.
None of those operations is Git push.

If no desk was named, `worktree-desk open <repo>` either opens one or reports that the
repository uses its checkout. A contradiction between the assignment and status is the
one case to stop and report on the Team wipeboard; do not create the missing branch or
worktree yourself.

After the final hand-in, status must say `CERTIFIED CLEAN`: no unsaved files and every
commit on the Team line. Stay parked unless told to end; `session_end` closes all
certified desks and ends the Agent together.
