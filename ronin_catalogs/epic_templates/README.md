# Epic templates

One file per template: an epic with its tasks, that `epic-template start <name>` makes as real
work items and gives to an Agent to walk through (`ronin-help epic-templates`). A file of your
own in `~/ronin/epic_templates/` adds a template, or replaces a stock one by name. Nothing else
needs changing.

    # The epic's title
    - **for:** when it is started, a few words
    - **order:** 10

    The epic's text: what the Agent walking it through does, and its rules.

    ## A task's title
    Do: what done is, in one line.
    Details: where the steps are: `ronin-help <topic>`, a screen, a tool's `--help`.
    Check: how the Agent knows it is done.
    Open: `setup.providers` (optional): the surface the Agent opens with `show <tab> <surface>` to walk
    the person through it; on Setup, dragging the task's step pill opens it too.

    ### A subtask of that task
    Do: … Details: … Check: …

Tasks come in the file's order. A template never names an item id: the Agent finds the tasks
as the epic's children, by title. Point at reference material; never write lines for the Agent
to say. Ronin starts one template by itself (onboarding, from a hosted office's front door);
every other is the Agent's choice: `epic-template list`, then `epic-template start`.
