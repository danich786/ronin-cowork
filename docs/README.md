# Ronin documentation — start with the question

Two short maps define the Agent-facing system:

- [Tools and Agent capabilities](architecture/tool-surface.md) defines Tool, Composite tool,
  Capability, Behavior, Skill, UI, and internal implementation. The actual capability
  files and their tools are indexed in
  [`ronin_catalogs/capabilities/README.md`](../ronin_catalogs/capabilities/README.md).
- [What a Cowork Agent receives](architecture/agent-composition.md) explains how those capabilities sit
  beside Behaviors, mandate, provider-native Skills, and the Agent's assignment. “Agent
  composition” is only the name for that complete resolved package.

## Terminal controls

|Input|Codex|Claude|Gemini|Grok|Hermes|
|---|---|---|---|---|---|
|Escape — Stop|Escape|Escape|Ctrl+C|Ctrl+C|Ctrl+C|
|Ctrl+Shift+Backspace — Clear|Ctrl+C|Escape|Ctrl+C|Ctrl+C|Ctrl+C|
|Ctrl+Shift+X — Close|Confirm|Confirm|Confirm|Confirm|Confirm|
|Ctrl+C|Blocked|Blocked|Blocked|Blocked|Blocked|

Clear: entire draft. Confirm: Ronin dialog. Copy:
Option-drag, Cmd+C (Mac); Shift-drag, Ctrl+C (Windows/Linux).
[Controls](using-ronin/terminal-controls.md); [Agents](agents/README.md).

## Before Ronin is running

| Question | Route |
|---|---|
| What authority does Ronin have on this machine? | [How Ronin protects your machine and work](getting-started/how-ronin-protects-you.md) |
| Is this machine suitable, or should the user rent one? | [Rent or prepare a machine](getting-started/rent-a-machine.md) |
| How do I install without disturbing existing tmux work? | [Install Ronin](getting-started/install.md) |
| How do I finish first use and launch one working Agent? | [Get started](getting-started/get-started.md) and [Ronin Setup](getting-started/setup-workbench.md) |
| Which providers are offered, installed, and ready to sign in? | [Model providers](architecture/model-providers.md) and [Provider sign-in](getting-started/provider-sign-in.md) |

## Once the coworkspace is running

| Question | Route |
|---|---|
| How do I find and arrange work, and type into a session from a phone? | [Workbench](using-ronin/workbench.md) and [The tile](using-ronin/tile.md) |
| Why are Teams or New Project unavailable? | [Ronin Setup](getting-started/setup-workbench.md#activate-a-provider) |
| How do I add or change a Workspace Folder? | [Workspace folders](architecture/project-roots.md) |
| How do parallel Agents avoid colliding in the same files? | [Ronin Worktrees](architecture/worktrees.md) |
| What is installed, what a Team or Agent can add, and how a new Agent is equipped? | [Installations and behaviours](architecture/installations.md) |
| How should an Agent plan and maintain its work record? | [Keep a useful work record](using-ronin/work-record.md) |
| What is a tool, composite tool, capability, Behavior, skill, UI, or internal API? | [Tools and Agent capabilities](architecture/tool-surface.md) |
| How does a Team's five-stage Kanban derive projects and Landing? | [Team Kanban](using-ronin/team-kanban.md) |
| How do I Stop, Clear, Close or Copy, and change shortcuts? | [Terminal controls](using-ronin/terminal-controls.md) |
| Where are each Agent CLI's integration particulars? | [Agent integrations](agents/README.md) |
| How do session Control settings work? | [Session Control](architecture/session-control-dials.md) |
| What does a new Agent read at birth, and why does it fit one read? | [The birth packet](architecture/birth-packet.md) |
| What does Ronin let an Agent do, and what does it only tell it? | [The Agent's philosophy: a gas pedal and a brake pedal](architecture/agent-philosophy.md) |
| What makes up an Agent's tools, guidance, boundaries, native teaching, and assignment? | [What a Cowork Agent receives](architecture/agent-composition.md) |
| How do I customize Ronin without editing shipped files? | [Customize](getting-started/customize.md) and [shadowing](architecture/shadowing.md) |
| What is a template, and how does my agent keep mine? | [Templates](architecture/templates.md) |
| What has Ronin connected to? | [Services activation and the egress record](getting-started/services-activation.md) |
| How do command tools find the running operator? | [Live operator connection](architecture/operator-connection.md) |
| How do I inspect configuration and the running copy? | [Machine configuration](architecture/machine-settings.md) and `bin/ronin-doctor` |

## If you are changing Ronin itself

Start with [`AGENTS.md`](../AGENTS.md), then the relevant implementation contract.

| Question | Route |
|---|---|
| How do I check or preview a change? | Run `npm run verify`; use Playwright for UI diagnostics or [visual staging](development/ronin-methodology.md#visual-staging-one-disposable-team-preview). |
| How does the server use tmux, start programs, and switch Services? | [The tmux connection, the spawn broker, and parked parts](architecture/tmux-connection.md) |
| Which code, UI, state, contracts, docs, and tests belong to the surface I am changing? | [Contributor map](contributor-map.md) |
| Which words name Ronin concepts, and which words should an Agent say? | [Vocabulary](../KOTOBA.md) and [Agent glossary](../KOTOBA_GLOSSARY.md) |
| Where does Ronin persist each kind of durable truth? | [Durable-state inventory](state-inventory.md) |
| How does one objective become Agent work, evidence, review, and completion? | [Coordination trace](coordination-trace.md) |

## Shelves

| Shelf | Contains |
|---|---|
| `ronin_session_boot/` | the reading assembled for a new session |
| `ronin_catalogs/` | tools, capabilities, project roots, definitions and presentation resources |
| `ronin_library/` | supporting reference pages used by tools and capabilities |
| `ronin_catalogs/behaviours/` | scoped Agent teaching: floor, conditional, selected, and sought |
| `ronin_bin/` | executable tools listed in `ronin_catalogs/TOOLS.md` |

The owner's stores shadow shipped resources file-for-file. `bin/ronin-store --all` lists
their resolved locations. Capability documents name the selected tools; machine facts
are measured with `ronin-host inspect`, `ronin-host account`, or the relevant tool.

## Coworkspace

[RONIN_UTILITY](architecture/RONIN_UTILITY.md) covers workbenches, Tile controls, Locked/Unlocked,
and copy/paste.

The home page opens Machine Settings, Coworks, or New Project. The bar opens the Campaign,
the current Cowork, a quick new session, the cowork commons, and the two-or-four workspace
layout. On a phone, choose the Cowork, choose the Agent, then use its full-screen tile.

A terminal tile provides the live terminal, composer, output view, Control value, and work
record. Commons provides Roster, Docs, Wipeboard, Messages, Cron jobs, and Configuration.
Cowork commons provides account, appearance, release, voice, Services, project-root, and
archive controls. Campaign commons provides Campaign configuration, roots, Coworks,
templates, installations, and defaults.
