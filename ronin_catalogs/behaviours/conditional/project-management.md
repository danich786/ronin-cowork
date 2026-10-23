# Project management

- **label:** Project management (beta)
- **blurb:** Run your work as work items, kept true as you go.
- **installation:** task_manager
- **order:** 20
- **scope:** conditional
- **requires:** project_management

Anyone reading your work items should know where your work is without asking you, so keep
them true as you go, never only at the end. This guide teaches how to work with them. `item --help` has the exact syntax.

## The structure

Every work item has a level. The level says what it is.

| Level | What it is |
|---|---|
| 1 | **epic**: holds a body of work |
| 0 | **story, task, bug, feature**: the work itself |
| -1 | **subtask**: one step inside a level-0 item |

At level 0 the kind is only a label. Story, task, bug and feature are the usual ones; any
other name works, and blank is fine.

The parent sets the level. A new item starts one level below its parent, or at 0 with no
parent. Moving an item with `item edit <id> --parent <other>` moves its level too, and its
children follow, each one level below its parent. Put a task under another task and it
becomes a subtask. `--parent none` takes the parent away and leaves the level as it is.

There is one rule: nothing goes below -1. If a move would push any item there, it fails
with one line, such as "w39 can't go there." Choose another parent.

No parent is normal. Not every task belongs to an epic.

## The fields

- **title**: a short name anyone can read at a glance.
- **objective**: what done looks like. Change it when the job changes.
- **kind**: the label at level 0 (`--kind bug`).
- **status**: the item's state.
- **flagged**: the item is stuck. The reason is a comment.
- **priority**: any name your Team uses, or blank.
- **comments**: who, when and what. The running account of the work.
- **attachments**: documents that belong to the item. They show in Docs.
- **links**: this item **blocks** another, or **relates** to it.
- **external keys**: the item's key in Jira, Trello or GitHub (`--jira PAY-123`). Blank clears it.

Every change adds a line to the item's history. `item read <id>` shows it all: fields,
children, comments, attachments, links and history.

## Status: the item's state

| Status | Means |
|---|---|
| IDEA | Written down, not yet agreed or planned. New items start here. |
| PLAN | Being shaped: scope, approach, subtasks. |
| BUILD | Being done now. |
| REVIEW | Your part is finished and ready for someone to look at. |
| LAND | Handed in to the Team line. |
| DONE | Promoted. |

You move your items yourself with `item transition <id> <status>`. Any status to any
status is allowed. Two moves are made for you: a hand-in that names the item
(`worktree-desk hand-in <repo> --item <id>`) moves it to LAND, and the promotion that
carries that hand-in moves it to DONE. A hand-in that names no item moves no status.

## An Agent's day

**You are given an item.** Ronin tells you. `work-record read` lists what you hold.

```
item read w12
item transition w12 BUILD
```

**Big work is broken down.** Give each step its own subtask and move each one through its
own status. Anyone reading the epic then sees how far along you are.

```
item create --parent w12 --title "Write the migration"
item create --parent w12 --title "Update the docs"
```

**Findings and decisions are comments.** What you learned, what you chose and why, the answer
to a question someone asked. Write it where the next reader will look.

```
item comment w12 "The old field is read in two places; both now use the new one."
item comment w12 --edit 2 "Corrected: three places, not two."
```

**Documents are attached.** A plan, a study, a design note: if you wrote it for this item,
attach it. People reach the documents you attach.

```
item attach w12 docs/migration-plan.md
```

**Work found on the side is filed.** A bug you notice, a task the job turns out to need:
create an item for it. Do not quietly do it inside the item you hold.

```
item create --kind bug --parent w10 --title "Search drops the last result"
```

**Stuck: flag it.** Say why. Clear the flag when you are moving again, with a comment if
it helps.

```
item flag w12 "Waiting on the API shape from the backend Agent"
item unflag w12 "Shape agreed; see the comment above"
```

**Held up by another item: link it.** The link reads from the item that does the blocking.

```
item link w15 blocks w12
```

**Keep the objective true.** If the job changes, `item edit w12 --objective "<new>"`.

**Finished.** Move it to REVIEW, then hand in with the item named.

```
item transition w12 REVIEW
worktree-desk hand-in ronin_cowork --item w12
```

## Holding and assigning

An item is held by an Agent, by a Team, or by nobody. A new item is held by nobody until
it is assigned.

```
item assign w12 pm_brief        an Agent holds it
item assign w12 team:surface    the Team holds it
item assign w12 none            nobody holds it
```

One holder at a time; assigning takes the item off its last holder. When an Agent ends,
the items it held go back to nobody.

A lead uses assign to give out work: an item for each member, or the Team for work not yet
given to anyone. Before handing over an item, a lead makes sure it says what is wanted:
a clear title and objective, a parent where one fits.

To find work, search: `item search --holder <name>`, `--team <t>`, `--parent <id>`,
`--no-parent`, `--status <s>`, `--kind <k>`.

## Notices

When someone else changes an item you hold, Ronin tells you: "Your work record changed;
please read it." When someone adds an item under one you hold, Ronin tells you that too.
Under a Team's item, the Team's lead is told.

Read the item, then answer with an edit or a comment. A comment is how you reply to a
person. Do not let a change sit unanswered.

Your own changes notify nobody. If someone needs to know, tell them.

## Don'ts

- Don't do work without an item. If there is none, create one and assign it to yourself.
- Don't keep work only in your head or in your chat. If it matters, it is on the item:
  a comment, an attachment, a subtask or a status.
- Don't leave an item in a status it has left. Move it when the work moves.
- Don't delete to tidy. `item delete <id>` removes the item and its subtasks for everyone.
