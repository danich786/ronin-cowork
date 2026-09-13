# BASE ABILITIES — ordinary Ronin work

**Fork versus spawn.** `+forkit:`, **fork it** and **new session** always mean Ronin's
visible-session workflow: compile `tejun forkit`, write the handoff it asks for, launch with
`tejun-fork`, report your understanding and stop until the owner says go. They never mean
your CLI's internal sub-agent or a bare tmux session. **Spawn it** and **spawn an agent**
mean the internal sub-agent. Delegation using neither vocabulary is your call and needs no
extra confirmation.

**Repository arrangement.** Every Workspace Folder is either a **worktree root** or a
**checkout**, as declared by that repository. Before your first write in a folder, read
the page its arrangement names: `ronin_sops/worktree-root.md` for a worktree root, or
`ronin_sops/checkout.md` for a checkout. Your birth brief names the arrangement of the
root where you start; `tejun-desk open <repo>` names it for another root.

**Your work record** is the owner's account of your task, progress, tracked documents,
worktrees and team. `read_tegami` prints it. Change one field with one call:
`write_tegami --objective "<sentence>"`, `--phase "<title>"`, `--leg N "<title>"`,
`--done N.M`, `--gate "<what you wait for>"`, `--doc <path>`; `write_tegami < block.json`
replaces the whole authored block. The shape is in the letter you were seeded with and
in the `write_tegami` row of `ronin_catalogs/TOOLS.md`. Keep it true whenever your task,
position or documents change.

**Other sessions.** `tejun-peek <session>` shows its recent live pane. `tejun-send
<session> <message...>` delivers one message; open with `from @<your session>:` since the
tool adds no watermark, report `DELIVERED` or `QUEUED`, and do not relay replies. The
session's `@ronin-control` value remains visible and does not restrict either action.
Use `tejun-send` for one session, with no board in between.

**Your team's board** already exists if you are on a team:

Use the wipeboard for team-wide messages: rules, collisions, line state, and anything everyone must see.

```bash
tejun-wipeboard                  # everything you have not read
tejun-wipeboard post <text...>   # post; the default interrupts the team lead
```

`--to <session,session>` also interrupts those, `--to all` everyone, `--to none` nobody;
addressing changes who is interrupted, not who may read. Never post to acknowledge — your
read is recorded. Posts expire after 48 hours; lasting facts go in your work record, a
document or a commit.

If a named tool is not on `PATH`, say so; do not reproduce its guarded job with raw tmux,
Git or store access. Full teaching is in the applicable capability document and command help.
To use an unfamiliar tool, run `<tool> --help` first, then run the command; current task
details live with the tool instead of in this birth reading.
