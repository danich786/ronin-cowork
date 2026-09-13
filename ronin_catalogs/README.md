# Adding macros & actions (TEJUN)

Repository verification is `npm run verify`. Installed user customization is checked with `npm run byoin`.

Entry point for the whole system: the TEJUN preamble of `MACROS.md`. This file: the choreography for
extending the two catalogs that live here.

> **Everything in this directory is SYSTEM SCOPE — an upgrade replaces it wholesale**
> (`docs/shadowing.md`). Nothing here may list the_owner's own things.
>
> That is why `PROJECT_ROOTS.md` here holds **only the project_root contract** and
> `MODEL_PROVIDERS.md` holds **the stock provider catalog** (a copy in your catalogs store
> shadows it whole). The directories a box actually works in are user scope and live outside every
> repo, in the catalogs store — `bin/ronin-store catalogs` prints where, and it is resolved
> per machine, never spelled by hand (`bin/ronin-store --all` lists them). Created by Ronin on first use, and
> untouched by any upgrade. Never add a `## <handle>` root block to the shipped file.

## Adding an ACTION (do this first — actions are the vocabulary)

1. Check ACTIONS.md — does an existing action (or composition) already cover it?
2. Tag it `action_kind: mechanical` (run it, no deliberation — usually has a tool) or
   `action_kind: judgement` (needs reasoning; no tool can do it). The step tracker shows the tag
   so an agent knows whether to think or just pull the lever.
3. Add a section to ACTIONS.md: name, one-line purpose, exact steps/commands, the
   failure modes you learned (this is where hard-won rules live — ghost-text, dial
   checks, separate-Enter).
4. Actions never reference macros. Compound actions may reference other actions.
5. If the action gets performed often, give it a tool (`../ronin_bin/README.md`) and add a
   `> Tool:` pointer at the top of its section.
6. Record the first real run in the lab's `wip/handoffs/RECIPES.md` — evidence, not hypothesis.

## Adding a MACRO (only after its actions exist)

1. A macro is an ordered table of CATALOGED actions — action 1, action 2, action 3.
   **No side jobs, no inline cleverness, no step that isn't in ACTIONS.md.** If a
   step doesn't exist as an action, STOP and add the action first (above).
2. Add a section to MACROS.md: name (short, sayable — the_owner will type
   `<name>: <args>`), one-line description (the panel shows it), params, the action
   table, and what to report when done — results must be SHOWN, not just performed.
3. Litmus: if your "macro" is one action the_owner would never say aloud, it's an
   action, not a macro.
4. The TEJUN panel and /api/macros parse MACROS.md live — adding the section IS
   shipping the macro. Test the pasteable form once for real before calling it done.

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
reading, SOPs, macros, actions, tools and MCP connection. `behaviours/<name>.md` is one
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
