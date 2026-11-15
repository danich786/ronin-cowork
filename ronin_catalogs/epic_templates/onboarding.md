# Getting set up in your new office
- **for:** a person who has just moved into their office
- **order:** 10

Mika: this person has just moved into their office. Walk them through these, in this order:
1. Sign in the model providers they want
2. Sign in GitHub, if they use it
3. Set up their first Workspace
4. A tour of how Ronin works
5. Customise Ronin with their own behaviours
6. Turn to Mika to set defaults
The tasks are this epic's children (`item read` on this epic lists them); match each by its title.
Rules:
- Say one short thing at a time, never a wall of text, and wait for their answer.
- Each is an offer. "No" or "later" is fine; never push.
- For each: `item read` the task, and find the steps where its Details point. Done or declined: `item comment` on the task "Done: <what>" (or "Declined"), then `item transition` it to "Done".
- When all six are closed: `item transition` this epic to "Done", and tell them in two or three lines what is set up.

## Sign in the model providers they want
Do: get each Agent harness they want installed and signed in with their own account.
Details: `ronin-help provider-sign-in`; Settings → Model providers (Let Mika authenticate, Use the CLI with Mika); `machine-settings provider read`.
Check: each one they chose reads Activated.

## Sign in GitHub, if they use it
Do: connect the GitHub CLI to their GitHub account, if they use GitHub.
Details: `ronin-help workspace-folders` (Bring in a GitHub repository); Workspaces door → GitHub CLI stone (Let Mika connect GitHub, Use GitHub CLI with Mika).
Check: the GitHub CLI stone shows their account.

## Set up their first Workspace
Do: set up their first Workspace from the project type and variants that fit.
Details: `ronin-help new-workspace`. Syncthing here starts with `systemctl --user enable --now syncthing`; if the unit is not found, it isn't on this office yet.
Check: the Workspace has its objective and its folders, and its WORKSPACE.md if they settled anything else.

### Map a project they brought in
Do: if they brought in an existing project (a repository or folders), start import-project with a new Agent in that Workspace; otherwise close this as not needed.
Details: `epic-template start import-project --new <name> --workspace <workspace>`; `epic-template --help`.
Check: the new Agent holds the import-project epic.

## A tour of how Ronin works
Do: show them, with their own Workspace, how to start an Agent, start a Team in a Workspace, and give out a work item.
Details: `ronin-help get-started`, `ronin-help new-team`, `ronin-help work-items`; Settings → Launch your own; the Teams door.
Check: their Team is running and its lead has answered.

## Customise Ronin with their own behaviours
Do: help them write a behaviour of their own and apply it.
Details: `ronin-help customizing`; the Behaviors panel on their Workspace's page (Customize Behaviors → New Behavior; Add).
Check: "An Agent here is told" on that page lists it.

## Turn to Mika to set defaults
Do: show that you can set their defaults (provider and model, your model level, a new Team's defaults), and set one with them.
Details: `machine-settings --help`, `machine-settings defaults --help`; Settings → Models > Defaults.
Check: `machine-settings read` shows the new value.
