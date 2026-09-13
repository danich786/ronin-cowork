# Installations, features, and behaviours — what a new Agent is equipped with

Ronin settles what is installed on the machine before it asks how one Agent should
behave. That order keeps machine facts off the Team and Agent forms and leaves only real
choices there.

## Three session types

| Session type | What starts | What Ronin adds |
|---|---|---|
| Terminal | A shell, no Agent CLI. | Nothing. |
| Bare-metal Agent | The provider CLI directly in the tmux session. | Nothing: no reading, no work record, no desk, no receipt. |
| Cowork Agent | The provider CLI through the unified birth transaction. | Everything Ronin is on this box: identity, the work record, the base reading, macros, actions, tools, messaging, the shelf map, the birth receipt, and every system installation that is on. |

A Cowork Agent is one thing. There is no separate floor, no base switch, and no Cowork
Agent with everything off; bare metal is the way to have none of it.

## System settings: installations and defaults

The Campaign holds two cards.

| Card | Holds | Reaches |
|---|---|---|
| **Installations** | each installed component, on or off | the whole machine; never a Team or Agent question |
| **Defaults** | the features and behaviours a new Team starts from | the next New Team form, and a teamless Agent's form directly; existing Teams are untouched |

An installation declares one of two effects in its own definition
(`ronin_catalogs/installations/<name>.md`):

| Effect | When on | Examples |
|---|---|---|
| **system** | its reading, tools, server parts and connections join every Cowork Agent birth; nothing downstream can decline it. When off, the birth carries its `reading_off` page instead: what the owner is working without, and where the switch is | Ronin Services |
| **feature provider** | it makes one or more features selectable; nothing reaches an Agent until a Team or Agent chooses | gbrain, Trello, Perplexity |

An installation may require another. One whose requirement is not met is shown greyed
with the requirement named (Trello and Perplexity read *Ronin Services required*).
Turning an installation off removes its contribution or its features from the next
birth; server parts follow the switch at Ronin restart; a running Agent never changes.

## The cascade: features and behaviours

Two things cascade, Campaign defaults → Team → Agent. A default lands in the next form
already filled in and can be changed there; there is no inherit control and no
reach-down; a template clobbers only the fields it carries.

| Kind | The question | Where it is defined |
|---|---|---|
| **Feature** | What extra facility or taught practice does this Agent have? | `ronin_catalogs/features/<name>.md`: its provider installation (blank for a prompt-only feature), reading, SOPs, macros, actions, tools, MCP connection |
| **Behaviour** | How does the owner want otherwise ordinary work done? | `ronin_catalogs/behaviours/<name>.md`, one short page each; the owner's `ways` store shadows a stock page whole |

**The installations decide what is on offer.** A feature is on the Team and Agent forms
only while its provider is installed and on; otherwise it is absent and cannot be chosen.
That is a browser rule: the launch seed (`GET /api/launch-seed`) lists `available`, and
the forms render from it. The server refuses nothing. A launch body naming a feature
that is not on offer, or one whose live service cannot be reached at birth, is born
without it; the receipt names it under `undelivered`, and the caller sees it on the
`BORN` line of `tejun-fork`.

Stock features: `gbrain` (provider: the gbrain installation) and `ronin_host`, a
system-admin toolkit with no provider: the machine SOPs, `tejun-survey`, `tejun-account`,
`tejun-secrets` and `tejun-machine-restart`. An Agent without Ronin Host is refused by
the guard shims when it reaches for `systemctl`.

Stock behaviours: `mandates` (on by default: one page, one line per reach, recruit and
output value, naming the behaviour that holds the how), `buildout`, `recruit`,
`write_it_down`, `more_checkpoints`, `report_before_fixing`. On means delivered at birth;
off means not delivered; the shelf is readable either way, so the mandates page can
point at a behaviour that is off. A Team's *required* behaviours cannot be removed on an
Agent form.

## Conditional instructions

Some reading follows a fact set elsewhere. Nobody chooses it and no form shows it.

| Fact | Set where | How it reaches the Agent |
|---|---|---|
| the session is the Team lead | the roster, by hand | decided at birth: the lead reading (`ronin_sops/teams.md`) is in the packet or not |
| the session is on a Team | the launch | decided at birth: the Team's objective in its work record; its wipeboard |
| the Workspace Folder is a worktree root or a checkout | the folder's `RONIN_REPO` | pointed at: the base reading says a repository is one or the other and names the page for each (`ronin_sops/worktree-root.md`, `ronin_sops/checkout.md`); the packet names the birth root's arrangement; `tejun-desk open` names any other root's. The desk actions and tools are in the Agent's command lookup only in a worktree root |

## Resolution

One resolver, once per birth, before the Agent process exists:

1. **Installations.** Each system installation contributes its on-page or its off-page.
   Each feature provider that is on makes its features available.
2. **Campaign defaults.** A teamless Agent reads these directly.
3. **Team.** Its complete lists, as saved.
4. **Agent.** Its sparse overrides from the launch body.
5. **Conditionals.** Root arrangement, lead flag, Team membership.
6. **One birth packet**, with `stated_by` naming the layer that answered every fact:
   `installation · campaign · team · agent · conditional`.

The same result feeds every delivery: the compiled birth README, the macro roster, the
per-session command directory, MCP connections, and the receipt, which records what was
enabled, why, and what was delivered. An unavailable feature never blocks a birth.

## Catalog authority

Definitions live in `ronin_catalogs/installations/`, `ronin_catalogs/features/` and
`ronin_catalogs/behaviours/`, one Markdown file per name; each directory's `README.md`
carries the format. The owner's catalog store shadows a stock definition whole. Campaign
and Team records hold only on/off maps and name lists; nothing about membership is copied
into them.

A definition is enablement, not a security boundary. Off means Ronin does not teach,
offer or place a tool in the Agent's normal command lookup.
