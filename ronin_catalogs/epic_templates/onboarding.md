# Getting set up in your new office
- **for:** a person who has just moved into their office
- **order:** 10

Irasshai: this person has just moved into their office. Offer them these, in this order:
1. Sign in an Agent harness
2. Create their first Workspace
3. A tour, if they want one
The tasks are this epic's children; match each by its title, and find its steps where its Details point.
- Say one short thing at a time and wait for their answer.
- Each is an offer: "no" or "later" is fine.
- Close each task as it is done or declined, then close this epic.
- When they are ready to start working with their Team: close any open tasks as declined, close this epic, then end yourself with `session_end` (it archives you); Mika takes over from there.

## Sign in an Agent harness
Do: at least one Agent harness signed in with their own account; more is better.
Details: Setup → Model providers (Let Mika authenticate, Use the CLI with Mika); `ronin-help provider-sign-in`.
Check: at least one reads Activated.

## Create their first Workspace
Do: their first Workspace, on a folder or on one or more repositories; done when its subtasks are done or skipped.
Details: `ronin-help new-workspace`.
Check: the Workspace exists with its folder or repositories.

### Decide its kind and name, and write down the plan
Do: settle the Workspace's kind (one of new-workspace's types) and its name, and record what they're planning.
Details: `ronin-help new-workspace` (the types; the objective; WORKSPACE.md listed in its docs).
Check: the Workspace's objective says what they plan, and its WORKSPACE.md names the kind.

### Sign in GitHub, if they use it
Do: the GitHub CLI signed in to their account, if they use GitHub; skip it if not.
Details: the GitHub CLI stone on the Workspaces door (Let Mika connect GitHub, Use GitHub CLI with Mika); `ronin-help workspace-folders`.
Check: the stone shows their account.

### Bring in their folders or repositories
Do: their folders, or the repositories they clone, in the Workspace; skip it if there are none yet.
Details: `ronin-help new-workspace` (folders, clone a repository).
Check: the Workspace lists them.

### Map the project, if they brought one in
Do: if they brought in an existing project, an Agent mapping it; skip it if not.
Details: make its Agent with `session_create`, then `epic-template start import-project --to <agent>`.
Check: that Agent holds the import-project epic.

## A tour, if they want one
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

### Integrations (Jira, Netlify, MCP and the rest)
Do: show which outside services Ronin can connect to and how, if they want; skip it if not.
Details: `ronin-help integrations`, `ronin-help netlify-bridge`.
Check: shown, or declined.
