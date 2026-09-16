# New Team construction

For contributors. See [Start a Team](../using-ronin/new-team.md) for the owner journey.

`public/js/new-team-form.js` owns the form and draft. `new-team-draft.js` owns name
normalization; `new-team-check.js` checks proposed names against live sessions and each
other. `team-agents.js` converts the form's Agent rows to launch inputs;
`team-loader.js` launches them through the existing launch API.

The form reads templates and Campaign defaults, then lets the owner edit the Team and its
Agents. On Launch it reserves a browser tab and validates Agent names before the first
write. It creates the Team through `POST /api/team-rosters`; only a successful create
reaches the Agent loader. That prevents a rejected duplicate Team create from launching
another cast. Agent births are awaited in order.

If some births fail, the Team and successful Agents remain. The form reports successes
and failures and opens the Team so the owner can recover there. On full success it clears
the draft and opens the Team. The form does not roll successful births back after a later
failure, and it does not promise a cross-request transaction.

The Team record owns identity and defaults; live session tags own membership and leads.
See [Team workspace](team-workspace.md) and the [state inventory](../state-inventory.md).
No retired Team-role catalog is required to create or staff a Team.

Shared form controls use [Workspace Kit](workspace-kit.md) and `ask()`.
`public/css/launch-forms.css` owns feature styling; it does not override Kit geometry.
