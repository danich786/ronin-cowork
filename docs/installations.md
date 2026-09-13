# Installations and behaviours — what a new Agent is equipped with

Ronin settles what is installed on the machine before it asks how one Agent should
behave. Machine facts stay off Team and Agent forms; behaviours are the one kind of
addition chosen there.

## Three session types

| Session type | What starts | What Ronin adds |
|---|---|---|
| Terminal | A shell, no Agent CLI. | Nothing. |
| Bare-metal Agent | The provider CLI directly in the tmux session. | Nothing: no reading, work record, desk, or receipt. |
| Cowork Agent | The provider CLI through the unified birth transaction. | Everything Ronin is on this box: identity, work record, base reading, commands, the birth receipt, and every enabled system installation. |

A Cowork Agent is one thing. There is no floor or base switch; bare metal is the way to
have none of Ronin.

## System settings: installations and defaults

| Card | Holds | Reaches |
|---|---|---|
| **Installations** | each installed component, on or off | the whole machine; never a Team or Agent question |
| **Defaults** | the behaviours a new Team starts from | the next New Team form and a teamless Agent form; existing Teams are untouched |

An installation definition (`ronin_catalogs/installations/<name>.md`) has one of two
effects. A `system` installation contributes its reading, tools, server parts, and
connections to every Cowork Agent when on, and its `reading_off` page when off. A
`provider` installation makes its named behaviours available to choose. The
effect name is implementation vocabulary; the owner still sees an Installation.

An installation may require another. Unmet requirements grey it out and name the
requirement. Turning one off changes the next birth; server parts follow at Ronin
restart, and a running Agent never changes.

## The cascade: behaviours

Campaign defaults → Team → Agent carries one kind of choice: a **behaviour**. A behaviour
can say how ordinary work should be done or add a facility and its taught practice. Its
definition in `ronin_catalogs/behaviours/<name>.md` may name an installation and carry
reading, SOPs, macros, actions, tools, and an MCP connection.

An installation-gated behaviour appears on forms only while its installation and every
requirement are on. A launch request naming an unavailable behaviour is born without it;
the birth receipt names it as undelivered and birth still succeeds. Providerless
behaviours are always on offer.

The stock shelf includes `mandates` (on by default), `buildout`, `recruit`,
`write_it_down`, `more_checkpoints`, `report_before_fixing`, `visual_staging`,
`ronin_host`, `gbrain`, `trello`, and `perplexity`. A Team's required behaviours cannot
be removed on an Agent form. Every form uses the same tall, wrapping behaviour stone;
its separate read glyph opens the definition page without changing the choice.

There is no inherit control and no reach-down. A Campaign default fills the next form;
a Team saves complete selected and required lists; an Agent launch may supply its own
complete list. A template clobbers only the fields it carries.

## Conditional instructions

Some reading follows a fact set elsewhere and is never a picker: Team lead status, Team
membership, and whether the Workspace Folder's `RONIN_REPO` declares a worktree root or
a checkout. The birth packet points at the relevant Team and repository pages.

## Resolution

One resolver runs before the Agent process exists:

1. Installations contribute system material and decide which behaviours are available.
2. Campaign defaults answer for a teamless Agent.
3. A Team's complete selected and required behaviour lists answer for its Agents.
4. An Agent's launch list, when present, answers for that Agent.
5. Root arrangement, lead status, and Team membership add conditional reading.
6. One packet and receipt record the result, with `stated_by` naming
   `installation · campaign · team · agent · conditional`.

The same result feeds the birth README, command directory, MCP connections, and receipt.

## Catalog authority

Definitions live in `ronin_catalogs/installations/` and `ronin_catalogs/behaviours/`, one
Markdown file per name; each directory's README carries the format. The owner's stores
shadow a stock definition whole. Campaign and Team records hold only switches and names.

A definition is enablement, not a security boundary. Off means Ronin does not teach,
offer, or place its tools in the Agent's normal command lookup.
