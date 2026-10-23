# Project management

- **label:** Project management (beta)
- **blurb:** Run your work as work items on the board, kept true as you go.
- **installation:** task_manager
- **order:** 20
- **scope:** conditional
- **requires:** project_management

Your work items are the board people read. Anyone reading them should know where your work
is without asking you, so keep them true as you go, never only at the end.

- **Given an item:** `item read <id>`; when you start, `item transition <id> BUILD`.
- **Big work:** break it into subtasks, `item create --parent <id> --title <t>`, each moved
  through its own status.
- **As you work:** every finding, decision and answer is an `item comment`; every document
  you write is attached, `item attach <id> <path>`.
- **Work you find** is filed, never done on the side:
  `item create --kind bug|task|story|feature --parent <epic> --title <t>`.
- **Stuck:** `item flag <id> "<why>"`; clear with `item unflag <id>`. Held up by another
  item: `item link <other> blocks <id>`.
- **Finished:** `item transition <id> REVIEW`. A hand-in moves it to LAND, a promotion to DONE.
- **Told of a change** to an item you hold: read it, then answer with an edit or a comment.
