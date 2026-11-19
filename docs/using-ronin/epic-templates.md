# Epic templates

An epic template is a ready-made epic with its tasks: a piece of work that comes up again and
again, such as welcoming a person to a new office or mapping a project they bring in. Starting
one makes the epic and its tasks as real [work items](work-items.md), gives them to an Agent,
and tells it to walk the epic through.

## The templates

`epic-template list` prints what this install has, your own included.

## Who starts one

An Agent starts one when it fits the work in front of it: it reads `epic-template list` and
starts it:

```text
session_create mapper
epic-template start import-project --to mapper --workspace my_site
```

`--to <agent>` gives it to another Agent; a new one is made first with `session_create`. Without
it, the Agent starting it walks it through itself. `--workspace` also goes on the epic's
last line, so the Agent knows where the work is.

## A template changed after it was started

An epic started from a template is its own work items from then on. The Helpful Assistant's
onboarding epic is the exception: each time she is made, it is brought up to the template as it
now reads. Each task is found by its title and its text updated; a task the template adds is made
new. Nothing done is undone and nothing is removed.

## Where the results go

A template's results hang where every other document does. `import-project` writes
PROJECT_MAP.md and PROJECT_SUMMARY.html in the Workspace's main folder and attaches both to its
epic (`item attach`), so they show on the epic and in the Docs of the [tile](tile.md) of every
Agent holding it. Docs opens Markdown and HTML alike. `assess-workspace` writes one Workspace's
Summary into its doc (`workspace-doc`, [Workspaces](workspaces.md)); its Agent then ends itself.
The Helpful Assistant starts one per Workspace with no Summary yet.

## Your own

A template is one Markdown file in `epic_templates/`. Put your own in `~/ronin/epic_templates/`:
a new name adds a template, a stock name replaces that one. Nothing else needs changing. The
file's format: [epic_templates/README.md](../../ronin_catalogs/epic_templates/README.md).
