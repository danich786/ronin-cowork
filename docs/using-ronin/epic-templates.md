# Epic templates

An epic template is a ready-made epic with its tasks: a piece of work that comes up again and
again, such as welcoming a person to a new office or mapping a project they bring in. Starting
one makes the epic and its tasks as real [work items](work-items.md), gives them to an Agent,
and tells it to walk the epic through.

## The templates

| Name | Epic | For |
|---|---|---|
| `onboarding` | Getting set up in your new office | a person who has just moved into their office: sign in an Agent harness, create their first Workspace (GitHub, their folders or repositories, mapping a project they brought), a tour if they want one |
| `import-project` | Mapping a project they brought in | an existing project brought into a Workspace: map every surface it has, write PROJECT_MAP.md, make an HTML summary, tell the person what was found |

`epic-template list` prints what this install has, your own included.

## Who starts one

Ronin starts one by itself: on a hosted office's first start, the `onboarding` epic, given to
Mika. Every other template is an Agent's choice. An Agent that sees one fits reads
`epic-template list` and starts it:

```text
session_create mapper
epic-template start import-project --to mapper --workspace my_site
```

`--to <agent>` gives it to another Agent; a new one is made first with `session_create`. Without
it, the Agent starting it walks it through itself. `--workspace` also goes on the epic's
last line, so the Agent knows where the work is.

Onboarding's "Create their first Workspace" carries a subtask for this: when the person brought
in an existing project, Mika makes an Agent for it and starts `import-project` with `--to`.

## Where the results go

A template's results hang where every other document does. `import-project` writes
PROJECT_MAP.md and PROJECT_SUMMARY.html in the Workspace's main folder and attaches both to its
epic (`item attach`), so they show on the epic and in the Docs of the [tile](tile.md) of every
Agent holding it. Docs opens Markdown and HTML alike.

## Your own

A template is one Markdown file in `epic_templates/`. Put your own in `~/ronin/epic_templates/`:
a new name adds a template, a stock name replaces that one. Nothing else needs changing.

```text
# The epic's title
- **for:** when it is started, a few words
- **order:** 30

The epic's text: what the Agent walking it through does, and its rules.

## A task's title
Do: what done is, in one line.
Details: where the steps are: `ronin-help <topic>`, a screen, a tool's `--help`.
Check: how the Agent knows it is done.

### A subtask of that task
Do: … Details: … Check: …
```

Tasks are made in the file's order, each a Task under the epic; a `###` under a task is its
Subtask. A template never names an item id: the Agent finds the tasks as the epic's children,
by title. Point the Details at reference material, never at lines for the Agent to say.
