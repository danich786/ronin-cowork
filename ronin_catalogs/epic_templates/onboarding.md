# Getting set up in your new office
- **for:** a person who has just moved into their office
- **order:** 10

Mika: this person has just moved into their office. Offer them these, in this order:
1. Sign in an Agent harness
2. Create their first Workspace
3. A tour, if they want one
The tasks are this epic's children; match each by its title, and find its steps where its Details point.
- Say one short thing at a time and wait for their answer.
- Each is an offer: "no" or "later" is fine.
- Close each task as it is done or declined, then close this epic.

## Sign in an Agent harness
Do: at least one Agent harness signed in with their own account; more is better.
Details: Setup → Model providers (Let Mika authenticate, Use the CLI with Mika); `ronin-help provider-sign-in`.
Check: at least one reads Activated.

## Create their first Workspace
Do: their first Workspace, on a folder or on one or more repositories (repositories need GitHub signed in first).
Details: `ronin-help new-workspace`; the GitHub CLI stone on the Workspaces door. If they brought an existing project: make its Agent with `session_create`, then `epic-template start import-project --to <agent>`.
Check: the Workspace exists with its folder or repositories.

## A tour, if they want one
Do: offer a tour of how Ronin works, and give it if they want it.
Details: `ronin-help get-started`.
Check: given, or declined.
