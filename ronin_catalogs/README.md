# Ronin catalogs

Repository verification is `npm run verify`. Installed user customization is checked with `npm run byoin`.

This shelf defines system-scope catalogs and the capability documents that select and
teach agent-facing tools.

> **Everything in this directory is SYSTEM SCOPE — an upgrade replaces it wholesale**
> (`docs/shadowing.md`). Nothing here may list the_owner's own things.
>
> That is why `PROJECT_ROOTS.md` here holds **only the project_root contract** and
> `MODEL_PROVIDERS.md` holds **the stock provider catalog** (a copy in your catalogs store
> shadows it whole). The directories a box actually works in are user scope and live outside every
> repo, in the catalogs store — `bin/ronin-store catalogs` prints where, and it is resolved
> per machine, never spelled by hand (`bin/ronin-store --all` lists them). Created by Ronin on first use, and
> untouched by any upgrade. Never add a `## <handle>` root block to the shipped file.

## Adding an agent-facing tool

Add one executable in `ronin_bin/`, one row in `TOOLS.md`, and one capability document
that states when the tool is selected and how it is taught. The capability's `requires:`
facts are the only delivery gate. Keep operating rules in the capability document or a
named SOP; there is no compiled instruction layer.

[`docs/tool-surface.md`](../docs/tool-surface.md) owns the architectural vocabulary and its composite tool boundary.
Do not introduce “macro” or “action” as a competing category.

Creating a Team record and creating an Agent/session are peer tool operations with
parallel UI → tool/API → internal-module stacks. Connecting or composing them does not put
them on different layers. Capability documents and UIs must call a composite tool instead
of copying its guarded choreography.

## Adding a DESK PROFILE or a LEXICON (data, one file each)

`desk_profiles/<name>.md` is the owner's standing defaults for the surfaces they work at
(R38): templates copied into Campaign-owned settings: `skin` (a `SKINS.md` entry),
`theme`, `lexicon` (a `lexicons/` entry),
`rireki_view`, `team_arrangement`. `lexicons/<name>.md` is the words a surface uses —
keys to strings with a `base:` to fall through to. Both shadow whole-file by name
(`docs/shadowing.md`); each directory's README carries the format. The rule for words:
`professional_en` is the floor and complete, a lexicon says only what it changes, and
`scripts/check-lexicon.mjs` keeps the floor honest. `docs/desk-profiles.md`, `docs/lexicons.md`.

## Adding an INSTALLATION, a FEATURE, or a BEHAVIOUR

`installations/<name>.md` is one machine installation: `effect` is `system` (its reading,
tools and parts join every Cowork Agent birth) or `provider` (it `provides`
behaviours). `behaviours/<name>.md` is one selectable behaviour: its `installation`,
reading, SOPs, tools and MCP connection. `behaviours/<name>.md` is one
short page on how ordinary work is done. Each directory's `README.md` carries the exact
format; `docs/installations.md` owns the cascade and birth behaviour. Membership is
listed once, in the definition; do not add an owner field to each member.

## Adding a CAPABILITY (a bundle of tools, taught at birth)

`capabilities/<name>.md` is one capability bundle: the question it answers, a `## Tools`
table of the actual tools that answer it (each with its authority, whether it is taught at
birth, and its help route), and the teaching around them. `requires:` names the launch facts
that select it — an installation on, a behaviour selected, a managed desk, a connection, a
Campaign, a Team, the lead designation — and blank selects it for every Cowork Agent. A
bundle may list several tools, one, or none; the birth overview is rendered from the
selected documents and names only tools that exist on this box. `capabilities/README.md`
carries the exact format; `docs/installations.md` owns the birth behaviour.
