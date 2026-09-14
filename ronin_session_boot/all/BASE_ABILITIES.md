# BASE ABILITIES — ordinary Ronin work

**Fork versus spawn.** Fork words mean `session_create --prompt <purpose>`. The newborn
resolves Campaign/Team and reads its own packet, not this conversation; there is no dial
option and the caller is unchanged. “Spawn” is CLI-internal and needs owner permission.

**Vocabulary:** **Fork it** / **New Agent** `session_create`; **Tell** `edges send`; **Wipeboard** `edges wipeboard`; **Show docs** `work-record document list` then read;
**Update work record** `work-record update_record`; **New Team** `team-lead roster write`; **Hand in** `worktree-desk hand-in`; **Promote** lead review then `bin/ronin-promote <team>`; **Close session** `session_end`.

**Repository arrangement.** Every Workspace Folder is either a **worktree root** or a
**checkout**, as declared by that repository. Before your first write in a folder, read
the page its arrangement names: `ronin_sops/worktree-root.md` for a worktree root, or
`ronin_sops/checkout.md` for a checkout. Your birth brief names the arrangement of the
root where you start; `worktree-desk open <repo>` names it for another root.

**Your work record** is the owner's account of your task, progress, tracked documents,
worktrees and team. `work-record read` prints it. Change one field with one call:
`work-record update_record --objective "<sentence>"`, `--phase "<title>"`, `--leg N "<title>"`,
`--done N.M`, `--gate "<what you wait for>"`; `work-record document add <path>` lists a
document, and `work-record update_record < block.json`
replaces the whole authored block. The shape is in the letter you were seeded with and
in the `work-record update_record` row of `ronin_catalogs/TOOLS.md`. Keep it true whenever your task,
position or documents change.

**Other sessions.** `edges read <session>` reads its durable record first and falls back
to a recent live pane when no record exists. `edges send
<session> <message...>` delivers one message; open with `from @<your session>:` since the
tool adds no watermark, report `DELIVERED` or `QUEUED`, and do not relay replies. The
`edges control <session>` reads the session's visible Control value; neither operation changes it.
Use `edges send` for one session, with no board in between.

**Your team's board** already exists if you are on a team:

Use the wipeboard for team-wide messages: rules, collisions, line state, and anything everyone must see.

```bash
edges wipeboard                  # everything you have not read
edges wipeboard post <text...>   # post; the default interrupts the team lead
```

`--to <session,session>` also interrupts those, `--to all` everyone, `--to none` nobody;
addressing changes who is interrupted, not who may read. Never post to acknowledge — your
read is recorded. Posts expire after 48 hours; lasting facts go in your work record, a
document or a commit.

If a named tool is not on `PATH`, say so; do not reproduce its guarded job with raw tmux,
Git or store access. Full teaching is in the applicable capability document and command help.
To use an unfamiliar tool, run `<tool> --help` first, then run the command; current task
details live with the tool instead of in this birth reading.
