# Getting set up in your new office
- **for:** a person who has just moved into their office
- **order:** 10

Irasshai: this person has just moved into their office. Offer them these, in this order:
1. Agent Harness
2. Workspace
3. Integrations
4. Ronin Tour
5. Meet your Agents
The tasks are this epic's children; match each by its title, and find its steps where its Details point. Setup lists them as its steps; a press on one asks you to take it.
- Say one short thing at a time and wait for their answer.
- Each is an offer: "no" or "later" is fine.
- Close each task as it is done or declined.
- Meet your Agents is the end: close any open tasks as declined, close this epic, then end yourself with `session_end` (it archives you); Mika takes over from there.

## Agent Harness
Do: at least one Agent harness signed in with their own account; more is better.
Details: Setup → Model providers (Let Irasshai authenticate, Use the CLI with Irasshai); `ronin-help provider-sign-in`.
Check: at least one reads Activated.

## Workspace
Do: their first Workspace, on a folder or on one or more repositories; done when its subtasks are done or skipped.
Details: `ronin-help new-workspace`.
Check: the Workspace exists with its folder or repositories.

### Decide its kind and name, and write down the plan
Do: settle the Workspace's kind (one of new-workspace's types) and its name, and record what they're planning.
Details: `ronin-help new-workspace` (the types; the objective; WORKSPACE.md listed in its docs).
Check: the Workspace's objective says what they plan, and its WORKSPACE.md names the kind.

### Sign in GitHub, if they use it
Do: the GitHub CLI signed in to their account, if they use GitHub; skip it if not.
Details: the GitHub CLI stone on the Workspaces door (Let Irasshai connect GitHub, Use GitHub CLI with Irasshai); `ronin-help workspace-folders`.
Check: the stone shows their account.

### Bring in their folders or repositories
Do: their folders, or the repositories they clone, in the Workspace; skip it if there are none yet.
Details: `ronin-help new-workspace` (folders, clone a repository).
Check: the Workspace lists them.

### Start Team 1
Do: once the Workspace exists, its first Team's lead started in the background: given the import-project epic if they brought in an existing project, else left to make its own assessment.
Details: the Team with `team roster write <team> --workspace <handle>`, its lead with `session_create <lead> --team <team> --role lead`, then `epic-template start import-project --to <lead>`; `ronin-help new-workspace`.
Check: the lead is running in the Workspace, holding the import-project epic or doing its own assessment.

## Integrations
Do: show which outside services Ronin can connect to and how, if they want; nothing to set up here; skip it if not.
Details: `ronin-help integrations`, `ronin-help netlify-bridge`.
Check: shown, or declined.

## Ronin Tour
Do: offer a tour of how Ronin works, and give it if they want it.
Details: `ronin-help get-started`.
Check: given, or declined.

### Behaviours
Do: show how behaviours shape what their Agents are told, and help them write one if they want; skip it if not.
Details: `ronin-help customizing`.
Check: shown, or declined.

### Project management
Do: show how work items let them see their Team's work, and how to give one out, if they want; skip it if not.
Details: `ronin-help project-management`, `ronin-help work-items`.
Check: shown, or declined.

## Meet your Agents
Do: show them Team 1 and take them to it; then close this epic and end yourself.
Details: the Teams door on Home; `show <tab-id> <surface>`; `session_end`.
Check: they are on Team 1's page.
