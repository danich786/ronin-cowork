# Ronin documentation — start with the question

## Terminal controls

|Input|Codex|Claude|Gemini|Grok|Hermes|
|---|---|---|---|---|---|
|Escape — Stop|Escape|Escape|Ctrl+C|Ctrl+C|Ctrl+C|
|Ctrl+Shift+Backspace — Clear|Ctrl+C|Escape|Ctrl+C|Ctrl+C|Ctrl+C|
|Ctrl+Shift+X — Close|Confirm|Confirm|Confirm|Confirm|Confirm|
|Ctrl+C|Blocked|Blocked|Blocked|Blocked|Blocked|

Clear: entire draft. Confirm: Ronin dialog. Copy:
Option-drag, Cmd+C (Mac); Shift-drag, Ctrl+C (Windows/Linux).
[Controls](terminal-controls.md); [Agents](agents/README.md).

## Before Ronin is running

| Question | Route |
|---|---|
| What authority does Ronin have on this machine? | [How Ronin protects your machine and work](how-ronin-protects-you.md) |
| Is this machine suitable, or should the user rent one? | [Rent or prepare a machine](rent-a-machine.md) |
| How do I install without disturbing existing tmux work? | [Install Ronin](install.md) |
| How do I finish first use and launch one working Agent? | [Get started](get-started.md) and [Ronin Setup](setup-workbench.md) |
| Which providers are offered, installed, and ready to sign in? | [Model providers](model-providers.md) and [Provider sign-in](provider-sign-in.md) |

## Once the coworkspace is running

| Question | Route |
|---|---|
| How do I find and arrange work, and type into a session from a phone? | [Workbench](workbench.md) and [The tile](tile.md) |
| Why are Teams or New Project unavailable? | [Ronin Setup](setup-workbench.md#activate-a-provider) |
| How do I add or change a Workspace Folder? | [Workspace folders](project-roots.md) |
| How do parallel Agents avoid colliding in the same files? | [Ronin Worktrees](worktrees.md) |
| What is installed, what a Team or Agent can add, and how a new Agent is equipped? | [Installations and behaviours](installations.md) |
| How should an Agent plan and maintain its work record? | [Keep a useful work record](work-record.md) |
| How does a Team's five-stage Kanban derive projects and Landing? | [Team Kanban](team-kanban.md) |
| How do I Stop, Clear, Close or Copy, and change shortcuts? | [Terminal controls](terminal-controls.md) |
| Where are each Agent CLI's integration particulars? | [Agent integrations](agents/README.md) |
| How do session Control settings work? | [Session Control](session-control-dials.md) |
| What does a new Agent read at birth, and why does it fit one read? | [The birth packet](birth-packet.md) |
| What does Ronin let an Agent do, and what does it only tell it? | [The Agent's philosophy: a gas pedal and a brake pedal](agent-philosophy.md) |
| How do I customize Ronin without editing shipped files? | [Customize](customize.md) and [shadowing](shadowing.md) |
| What is a template, and how does my agent keep mine? | [Templates](templates.md) |
| What has Ronin connected to? | [Services activation and the egress record](services-activation.md) |
| How do command tools find the running operator? | [Live operator connection](operator-connection.md) |
| How do I inspect configuration and the running copy? | [Machine configuration](machine-settings.md) and `bin/ronin-doctor` |

## If you are changing Ronin itself

Start with [`AGENTS.md`](../AGENTS.md), then the relevant implementation contract.

| Question | Route |
|---|---|
| How do I check or preview a change? | Run `npm run verify`; use Playwright for UI diagnostics or [visual staging](../ronin_sops/ronin_methodology.md#visual-staging-one-disposable-team-preview). |
| How does the server use tmux, start programs, and switch Services? | [The tmux connection, the spawn broker, and parked parts](tmux-connection.md) |

## Shelves

| Shelf | Contains |
|---|---|
| `ronin_session_boot/` | the reading assembled for a new session |
| `ronin_catalogs/` | tools, capabilities, project roots, definitions and presentation resources |
| `ronin_library/` | supporting reference pages used by tools and capabilities |
| `ronin_sops/` | situation-specific operating guidance |
| `ronin_bin/` | executable tools listed in `ronin_catalogs/TOOLS.md` |

The owner's stores shadow shipped resources file-for-file. `bin/ronin-store --all` lists
their resolved locations. Capability documents name the selected tools; machine facts
are measured with `ronin-host inspect`, `ronin-host account`, or the relevant tool.

## Coworkspace

[RONIN_UTILITY](RONIN_UTILITY.md) covers workbenches, Tile controls, Locked/Unlocked,
and copy/paste.

The home page opens Machine Settings, Coworks, or New Project. The bar opens the Campaign,
the current Cowork, a quick new session, the cowork commons, and the two-or-four workspace
layout. On a phone, choose the Cowork, choose the Agent, then use its full-screen tile.

A terminal tile provides the live terminal, composer, output view, Control value, and work
record. Commons provides Roster, Docs, Wipeboard, Messages, Cron jobs, and Configuration.
Cowork commons provides account, appearance, release, voice, Services, project-root, and
archive controls. Campaign commons provides Campaign configuration, roots, Coworks,
templates, installations, and defaults.
