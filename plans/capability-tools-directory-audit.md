# Directory and ownership audit before Agent composition

Status: review draft for Glen and the `capability-tools` team lead  
Project: `capability-tools/1`  
Scope: Ronin Cowork `dev` at `cea5efb045`, plus the accepted Ronin Services `dev`
source and its generated placement in the Cowork working checkout, inspected 2026-09-15.  
Decision boundary: layout and compatibility plan only. This audit makes no move, rename,
store mutation, or runtime change.

## Verdict

The current directories mostly defend distinct delivery stages, but their names alone do
not expose those stages. The migration should make the physical ownership layout tell the
truth in one atomic change: move the authored sources, update every consumer and document,
regenerate projections, and remove the superseded paths. Do not introduce a mapping layer,
dual-read resolver, alias registry, or staged compatibility taxonomy.

The canonical chain should be:

```text
authored resource (one owner, one semantic job)
  -> composition definition (installation / behaviour / capability)
  -> resolver (stock + owner shadow, provenance retained)
  -> birth projection / PATH projection / UI resource DTO
  -> per-session generated packet and receipt
```

Today that chain exists in pieces, but prose, filenames, and adapters can each imply a
different owner. The cutover must change the chain as one coherent unit; a partial move
would break owner shadows, template bundles, shelf coordinates, documentation links, and
the Services development sync boundary. Symlinks are acceptable only where the build or
composite mechanism requires one source to appear at a second physical coordinate. They
are not a general compatibility mechanism and must not preserve a retired taxonomy.

## Ownership rules the migration must adopt

1. **One semantic owner, many projections.** A feature may have several documents named
   `gbrain.md`, but each must declare a different `kind` and owner. Repetition by feature
   token is useful; repetition of assertions is drift.
2. **Behaviors own situational procedure.** Installation and capability definitions name
   resources; a scoped Behavior owns both its selection metadata and the procedure Agents
   follow in that situation. There is no first-class SOP/practices composition shelf in the
   target. A Behavior must not copy architecture or provider-native skill bodies.
3. **Generated material is never edited.** The birth packet, `CAPABILITIES.md`, rendered
   glossary, Services placement under Cowork `src/services/`, `dist/`, and staging output
   are projections with source receipts.
4. **Owner shadows move with their owners.** The cutover must migrate current owner files
   to the new physical coordinate in the same operation, preserving winner semantics and
   refusing collisions. It must not leave an old reader or alias behind.
5. **Runtime and presentation stay separate.** Services own their runtime snapshots and
   installers; Cowork owns generic sockets, adapters, HTTP composition, and all frontend
   rendering. A UI file is not the canonical definition of a capability.
6. **Provider-native skills remain provider-owned.** Ronin may point to an installed
   provider's resolver or skill package and record its version, but must not copy those
   skill bodies into Cowork catalogs, Behaviors, or boot shelves.
7. **Team is the capability; lead is a designation.** Team sits parallel to Agent/Session.
   The explicit team-lead assignment selects additional Team-management teaching but does
   not define a separate capability. Composite Team fork belongs beside Team create in the
   Team capability; it does not justify a `composite/` directory or mapping layer.

## Directory census and defence

Counts are a scale check, not an API: Cowork currently has 70 files under `docs/`, 60 under
`ronin_catalogs/`, 20 under `ronin_sops/`, 11 under `ronin_session_boot/`, 2 under
`ronin_library/`, 29 under `ronin_bin/`, and 143 public JS/CSS/brand files. The separate
Services checkout has 77 non-Git files.

### How bad is `docs/`?

Not very bad by directory count: **61 of 70 entries (87%) have a defensible single primary
role**. The debt is concentrated in eight mixed/current-plus-history pages and three
overlapping surface maps. The working tree inspected contains **67 Markdown files and 3
assets = 70**, not 72; if the review line reports 72, reconcile those two new entries before
using these counts as a migration gate.

The classification is mutually exclusive and based on what each file primarily owns:

| Class | Count | Files | Finding |
|---|---:|---|---|
| User journey | 9 | `README.md`, `USER_JOURNEY.md`, `get-started.md`, `hetzner-vm.md`, `how-ronin-protects-you.md`, `install.md`, `provider-sign-in.md`, `rent-a-machine.md`, `terminal-controls.md` | Defensible. The route index and installation journey deliberately address different moments. Risk is cross-link drift, not existence. |
| Implementation contract | 30 | `DEPENDENCY_BUNDLE_INSTALL.md`, `ability-pyramid.md`, `agent-install.md`, `archived-sessions.md`, `birth-packet.md`, `campaigns.md`, `customize.md`, `desk-state.md`, `desks.md`, `env.md`, `installations.md`, `kokugo.md`, `machine-settings.md`, `message-queue.md`, `operator-connection.md`, `project-roots.md`, `release.md`, `services-activation.md`, `session-boot.md`, `session-control-dials.md`, `session-identity.md`, `setup-workbench.md`, `shadowing.md`, `tarball.md`, `team-promotion.md`, `templates.md`, `tmux-connection.md`, `wanted-needed.md`, `work-record.md`, `worktrees.md` | Defensible as contributor law if each points to, rather than recopies, catalogs and measurements. Several need assertion cleanup but not relocation. |
| Architecture/reference | 19 | `agent-philosophy.md`; `agents/README.md`, `agents/claude.md`, `agents/codex.md`, `agents/gemini.md`, `agents/grok.md`, `agents/hermes.md`; `assets/readme/workbench/README.md` and its two WebP files; `campaign-scope.md`, `desk-profiles.md`, `feedback.md`, `jikan.md`, `lexicons.md`, `team-kanban.md`, `tile-control.md`, `ui-agents.md`, `wipeboards.md` | Defensible references or directly owned assets. Provider pages need review dates because their upstream facts move. |
| Mixed contract/history/open design | 8 | `gbrain.md`, `mika.md`, `model-providers.md`, `new-team.md`, `team-workspace.md`, `tile.md`, `ui.md`, `workspace-kit.md` | Primary cleanup target. These combine present contract with measurement diary, resume notes, review findings, planned behavior, or very broad component ownership. Split or delete stale history in place; do not create another shelf for it. |
| Overlapping surface maps | 3 | `RONIN_UTILITY.md`, `cowork-space.md`, `workbench.md` | All three can exist only if the boundary is enforced: quick user map, complete surface ontology, and workbench interaction contract. Repeated button/surface assertions should live in one and be linked from the other two. |
| Candidate retirement | 1 | `league.md` | The page calls itself “Teams collection view” while the filename preserves an internal retired/hidden name. Fold any unique contract into the Teams/Workbench owner and remove it in the cutover if code no longer cites it. |

Top offenders by risk, not merely length:

1. **`ui.md` (572 lines):** valuable frontend law mixed with a very wide inventory. It can
   remain the UI contract, but feature-specific behavior and historical decisions should
   move to their actual component owner or be deleted.
2. **`tile.md` (549 lines):** a legitimate vertical component contract, but it repeats
   session, output, Docs, Control, composer and Services assertions owned by narrower pages.
3. **`model-providers.md` (406 lines):** extension contract plus verification history and
   provider facts. `MODEL_PROVIDERS.md` must remain the only model inventory.
4. **`team-workspace.md` (274 lines):** explicitly a “current implementation and resume
   contract,” therefore time-bound by design and prone to colliding with `workbench.md`,
   `workspace-kit.md`, `new-team.md`, and the new Team capability owner.
5. **`gbrain.md` (213 lines):** architecture, owner rulings, live verification, open storage
   questions, UI specification and upstream summary in one page; it already contradicts
   the SOP and is the clearest example of assertion duplication.

The answer is targeted semantic editing, not deleting 70 files or moving all of them under
one new parent.

| Directory | Canonical owner and material | Authored / generated | Shadow policy | Defence and exact drift risk |
|---|---|---|---|---|
| `docs/` | Cowork maintainers; user journeys, developer contracts, architecture and routing index | Authored | Stock only; not an owner customization surface | Keep as the explanation and contributor-contract layer. Risk: it restates live definitions and measured versions; `docs/gbrain.md` is already a large mixed architecture/review/history page. Links also name physical paths that a migration would invalidate. |
| `docs/agents/` | Cowork provider-adapter maintainers; CLI integration particulars | Authored, reviewed against installed/upstream CLIs | Stock only | Keep separate from the model catalog: CLI mechanics are not provider/model inventory. Risk: dated versions and native behavior drift upstream; pages must never become copied model tables or copied provider skills. |
| `docs/assets/` | Cowork documentation maintainers | Authored binary/reference assets | Stock only | Keep only assets directly consumed by docs. Risk: screenshots outlive UI contracts and have no machine-readable tie to the page or build that produced them. |
| `ronin_catalogs/` | Cowork composition-schema owners; stock definitions and global tables | Authored stock inputs | Mixed: table entry merge for global catalogs; per-file replacement for definition directories | Replace this mixed shelf with the target owner directories in the cutover. Risk: the root README says system scope and sometimes “shadows whole,” while `docs/shadowing.md` describes entry merge for tables and per-file replacement for definitions. The two mechanisms need distinct names. |
| `ronin_catalogs/installations/` | Installation-definition owner | Authored one-file definitions | Owner file with same token replaces whole definition; new token adds; `hidden` withdraws | Defends machine-level enablement, dependencies, supplied parts/readings, and provided behaviours. Risk: it is confused with the physical installer (for example Services `gbrain/`) and may duplicate feature claims. |
| `ronin_catalogs/behaviours/` | Behaviour-definition owner | Authored one-file definitions; body is also the behaviour page | Owner `ways/` same-name file replaces whole; new token adds | Defends Campaign/Team/Agent selectable composition. Risk: the body is both registry metadata and delivered prose, making schema changes content changes; the store is called `ways`, not `behaviours`, which hides equivalence. |
| `ronin_catalogs/capabilities/` | Agent-tool teaching owner | Authored definitions; input to generated overview | Owner same-name file replaces whole; new token adds | Defends question-oriented tool bundles and birth emphasis. Risk: capability is knowledge, not authority, but installation predicates can also govern tool placement. Missing executables silently disappear from teaching, so definition/PATH/catalog drift requires a receipt and test. |
| `ronin_catalogs/templates/agents/` | Agent-template owner | Authored stock presets | Owner same-name replacement/addition | Defends editable one-session launch seeds. Risk: `behaviours` values embed shelf prefixes and physical token conventions into portable bundles. |
| `ronin_catalogs/templates/teams/` | Team-template owner | Authored stock presets | Owner same-name replacement/addition | Defends editable casts and Team launch seeds. Risk: nested agent rows duplicate launch schema and can drift from the form/runtime schema. |
| `ronin_catalogs/desk_profiles/` | Presentation-default owner | Authored data | Owner same-name replacement/addition | Defends reusable Campaign presentation defaults. Risk: fields name lexicon, skin, theme, output view and workspace arrangement owned elsewhere; there is no declared referential-integrity boundary. |
| `ronin_catalogs/lexicons/` | User-visible wording owner | Authored data | Owner same-name replacement/addition with base fallback | Defends wording/translation independently of structure. Risk: `professional_en` is treated as generated-complete by a checker but is authored; UI literals outside `t()` and renamed keys drift silently. It must not supply Agent instruction vocabulary. |
| `ronin_sops/` | Legacy house-practice owner | Authored stock guidance | Owner same-name file replaces whole; new file adds | Does not defend a first-class target shelf under the latest owner law. Its situational procedures belong in scoped Behaviors. Risk: discovery is informal while behaviour definitions separately list SOP tokens; `ronin_sops/gbrain.md` contradicts `docs/gbrain.md` on the system of record and overstates “off” as no MCP for Codex. Migrate stock and owner shadows into Behaviors in the direct cutover, then remove this shelf. |
| `ronin_library/` | Tool/capability reference owner | Authored stock reference | Owner same-name file replaces whole; new file adds | Defends supporting pages explicitly fetched by instructions. It is intentionally sparse. Risk: only `documents.md` exists and the boundary from Behavior/reference is conceptual, not schema-enforced; references can become unreachable or point back to an old location. |
| `ronin_session_boot/` | Birth-composition owner | Authored shelf sources | Owner same-coordinate file replaces stock; new files add; levels are additive | Defends scoped, one-read teaching selected at birth. Risk: root README claims three universal sources while the tracked `all/` contains only two in this checkout; docs also count generated fragments inconsistently. Physical shelf coordinates are embedded in definitions. |
| `ronin_session_boot/all/` | Universal birth-contract owner | Authored source; glossary is rendered at birth | Same-coordinate replacement | Defends universal teaching only. Risk: `README.md` is documented as present but is absent from the repository tree examined; the compiled packet observed at birth sourced an `all/README.md`, so installed/store state and checkout source can diverge. |
| `ronin_session_boot/routine/` | Installation/behaviour reading owner | Authored scoped source | Same-coordinate replacement | Defends explicit `reading`/`reading_off` targets. Risk: token paths such as `routine/ronin_services/SERVICES_ABILITIES.md` are untyped strings duplicated in definitions and docs. |
| `ronin_session_boot/house/` | House-session bootstrap owner | Authored special-purpose source | Same-coordinate replacement where selected | Defends house Agent material that is neither universal nor an owner project root. Risk: `house/mika` mixes TOML rules/tips/start material and `house/atarashi/install.md` without a directory manifest explaining selection and ownership. |
| `ronin_session_boot/role/` | No current owner; empty/retired axis | None | None | Does **not** defend a live directory. Services’ capability contract explicitly says not to restore the retired session-role catalog. Preserve an empty compatibility placeholder only if a released resolver probes it; otherwise deprecate after measurement. |
| `ronin_bin/` | Cowork command/tool owner | Authored executables plus private helpers | Stock commands projected to PATH; owner `tools` store adds/replaces executable names | Defends stable Agent-facing command names. Risk: `TOOLS.md`, capability tool tables, actual executable files, and hidden helper files are separate inventories. `machine-settings` exists and is taught but has no row in the inspected `TOOLS.md`; helpers must be explicitly private rather than merely undocumented. |
| owner `tools` store | Owner | Authored owner executables | Same command name wins at projection | Defends durable owner extension without editing stock. Risk: an owner replacement can change semantics beneath stock capability teaching; receipts need executable origin and ideally content/version identity. |
| provider-native skill directories | Provider/upstream package, not Ronin | Authored upstream; installed/cached copies are package artifacts | Provider’s own rules; no Ronin file shadow | Defends provider-specific procedural dispatch. On this box gbrain’s package supplies `skills/*/SKILL.md` and `get_skill`; Ronin should retain pointers and package/version evidence only. Risk: cache paths are unstable, skills change with package upgrades, and copied Ronin summaries immediately drift. |
| `public/js/` | Cowork UI owner | Authored browser modules | Stock only | Defends rendering and interaction. `workspace-adapters.js`, `installation-map.js`, `behaviour-reader.js`, `customize-resources.js`, `gbrain*.js`, and other feature adapters consume DTOs; they do not own definitions. Risk: feature names and state derivations are duplicated across modules and APIs, and filename proximity invites treating UI adapters as domain owners. |
| `public/css/`, `public/style.css`, `public/workspace-kit.css` | Cowork UI owner | Authored presentation | Stock only | Defends presentation only. Risk: feature selectors can become an implicit schema and stale CSS survives retired surfaces. |
| `public/brand/` | Cowork brand owner | Authored vector/raster assets | Stock only | Defends distributable brand resources. Risk: source SVG and raster derivatives need an explicit generation/source relation. |
| `src/resources.ts` | Cowork store and generic shadow resolver owner | Authored runtime | Not shadowable | Canonical for store coordinates, file overlays, global section merge, and SOP/way listing. Risk: one file implements several distinct policies called “shadowing”; prose currently collapses them. |
| `src/resource-adapters.ts` | Cowork definition parser/DTO owner | Authored runtime adapter | Reads resolved stock/user definitions | Defends schema parsing for installations, behaviours, profiles, lexicons, capabilities, templates. Risk: `DefinitionKind` is a hard-coded parallel registry and permissive parsing turns typos into defaults or omission. |
| `src/session-readings.ts`, `src/birth-readme.ts`, `src/capabilities.ts` | Cowork birth projection owner | Authored compiler; output generated per session | Consume resolved sources | Defends generated packet, generated capability overview, glossary render, dedupe and receipt. Risk: generated views shown by APIs can use “everything” selection unlike a real birth; they must be labeled projections and never re-ingested as authored content. |
| `src/routes/catalogs.ts`, `docs-api.ts`, `library-api.ts` | Cowork resource-API owner | Authored adapters/routes | Serve resolved resources or project-root documents | Defends transport, not semantics. Risk: similarly named “Docs,” “library,” catalogs and template library routes represent different stores and ownership models. API names alone are not a taxonomy. |
| Ronin Services repository root | Services maintainers | Authored runtime and service contracts | Separate repository/release | Defends paid/optional service implementations. Risk: root mixes deployable part directories, contracts, build tools and long-lived planning docs; composition must distinguish them without making Cowork own them. |
| Services `counting/`, `kanban/`, `koe/`, `koshi/`, `machine/`, `michi/`, `rireki/` | Individual Services part owner | Authored runtime entries selected through `register.ts` | Release/working-line owned, not owner-shadowable | Defend independently loadable socket parts. Risk: an installation currently lists raw `parts` tokens; the move must update those definitions, runtime discovery, builds and tests together. |
| Services `_lib/` | Services shared-runtime owner | Authored shared code, deliberately non-activating | Not shadowable | Defends code shared by parts without selecting a part. Risk: underscore naming is a convention encoded in both sync and tests; it should become manifest metadata before migration. |
| Services `gbrain/`, `koshi_weights/` | Services installer owner | Authored installer/API plus pin data | Not owner-shadowable; durable data lives in resolved stores | Defend installable-service mechanics, health, pinning and secret-free snapshot. Risk: directory token overlaps installation/behaviour/capability/SOP/doc token but means physical provisioning only. |
| Services `docs/` | Services maintainers | Authored architecture, operations and plans | Stock in Services repo | Keep service-only implementation contracts close to their code. Risk: `capability-runtime.md` is a crucial cross-repo contract but is not copied by `dev-sync`, while older copied docs/contracts may be mistaken for canonical. Planning artifacts mixed here lack lifecycle markers. |
| Cowork `src/services/` | **No authoring owner**; generated by Services `bin/dev-sync` or release install | Generated placement, ignored by Cowork Git | Replaced/pruned by producer | Defends the development/runtime assembly seam only. Never edit it. Exact risk: it can contain stale unrelated non-runtime docs because sync prunes only qualifying runtime directories and leaves other target contents alone. The observed placed tree lacks newer Services docs such as `docs/capability-runtime.md`, proving it is not a documentation mirror. |
| `dist/`, `public-staging/`, Services `release/` | Build/release producer | Generated artifacts | Rebuilt/replaced | Defend executable or preview artifacts, never source. Risk: searches and audits can double-count stale generated code and tarballs as owners unless excluded. |

## Repeated feature names: `gbrain` as the worked example

The token is not itself the problem. The problem is that a reader must infer the resource
kind from its parent directory while assertions leak between kinds.

| Coordinate | It should own | It must not own |
|---|---|---|
| `ronin_catalogs/installations/gbrain.md` | availability of the provider installation and behaviours it offers | installation script, operating protocol, architecture narrative |
| `ronin_catalogs/behaviours/gbrain.md` | selectable contribution, scoped working procedure, reading, MCP and capability-selection facts | copied provider-native skill bodies or service health claims |
| `ronin_catalogs/capabilities/gbrain.md` | question/tool teaching and authority boundary | pretend tools; provider skill bodies; architecture |
| legacy `ronin_sops/gbrain.md` | migration input whose unique working procedure folds into the Behavior | a surviving first-class target resource |
| `docs/gbrain.md` | Cowork integration architecture and explicit ownership boundary | upstream manual, current machine status, an accumulated test diary |
| Services `gbrain/README.md` | installable service’s files, health/install contract and pin relationship | Agent working practice or Cowork launch semantics |
| upstream `gbrain/skills/*/SKILL.md` | provider-native operation and skill dispatch | Ronin ownership policy |

Concrete drift already visible:

- The SOP calls the Markdown cabinet “the system of record”; the Cowork architecture page
  says the deployed database is the brain and the cabinet is an import bay.
- The SOP says off means no MCP servers at all; the architecture page records that Codex
  can disable named gbrain while other user MCP servers may still ride through.
- The architecture page points first to upstream `brain-ops`, `query`, and `capture`, while
  the capability definition says no callable tool and the behaviour points to a connected
  shelf that stock does not supply. Those statements can all be true only if a service seed
  receipt proves the provider-native resolver exists.
- Capitalization alternates between `gbrain` and `GBrain`. Use `gbrain` consistently in
  source and keep any display wording in the presentation owner; do not add a token map.

The target directories should therefore make the kind physical and unambiguous. A file may
remain named `gbrain.md` under installation, Behavior and capability owners; the legacy SOP
copy is reconciled into the Behavior and removed. References point directly to the owner
directory rather than passing through a token map.

## Exact cross-cutting drift risks

1. **Shadow-policy ambiguity.** Global Markdown tables use entry merge, definition
   directories use whole-file replacement by filename, Hotwords uses copy-on-write, and
   boot/SOP/library shelves use coordinate replacement. Calling all four “file-for-file
   shadowing” makes migration code likely to select the wrong compatibility behavior.
2. **Coordinate strings without validation.** `reading`, `reading_off`, `sops`, `tools`,
   `mcp`, `parts`, template `behaviours`, lexicon bases, profile references and provider
   flags are strings owned by different loaders. A rename can degrade to omission rather
   than fail verification.
3. **Parallel registries.** Directory names, adapter unions, installation `parts`, tool
   catalog rows, capability tables, API DTOs and frontend maps all enumerate related
   objects independently.
4. **Authored/generated confusion.** The generated capability overview and rendered
   glossary appear as session readings; `src/services/` looks like source; `dist/` and
   release tarballs contain code. A migration tool must refuse generated origins as input.
5. **Store cutover.** Owner content survives upgrades specifically because its current
   physical coordinate is stable. A move must relocate it transactionally with collision
   checks; otherwise stock reappears over an orphaned owner shadow. Aliasing would hide,
   not solve, that incomplete migration.
6. **Bundle portability.** Template bundles carry shelf-prefixed resource names. Changing
   names or stores without schema versioning breaks existing downloaded bundles.
7. **Services split-brain.** Cowork controls sockets and UI; Services controls runtime
   implementations and snapshots. Putting a shared feature manifest in only one repo can
   make the other unable to validate a release independently.
8. **Provider-native volatility.** Provider skill files are installed package content, not
   Ronin resources. Absolute cache paths and copied excerpts are invalid compatibility
   anchors; package identity, version/ref, resolver capability and live discovery are.
9. **Documentation as hidden state.** Dated “verified live” findings and open design
   questions in canonical architecture pages become stale facts with no expiry or test.
10. **Empty legacy axes.** `ronin_session_boot/role/` can be accidentally revived merely
    because it exists. Empty compatibility directories need an explicit deprecation record
    or removal gate.
11. **Team capability fragmentation.** Team operations are currently scattered across
    `edges team`, `session_create`, `session_set`, `team-lead`, Work Record project
    operations, Team routes, and UI modules. The file/tool name `team-lead` wrongly makes a
    designation look like a capability boundary. Composition could then invent a separate
    lead or composite namespace instead of one Team capability with designation-selected
    teaching.

## Simple target layout

Pressure check: the earlier `agent-resources/` mega-directory was physical churn without a
matching ownership gain. Most existing top-level shelves already have defensible owners.
Keep them, make the two semantic corrections that matter, and do not move files merely to
make the tree look uniform:

```text
ronin-cowork/
  docs/                         # user journeys + contributor contracts/reference
  ronin_catalogs/
    installations/             # machine availability/composition
    behaviours/                # selection metadata + scoped situational procedure
    capabilities/              # question/tool teaching; Team parallel to Agent/Session
    templates/                 # editable launch seeds
    desk_profiles/ lexicons/   # presentation data
  ronin_session_boot/           # universal and launch-scoped birth source
  ronin_library/                # tool/capability-fetched supporting reference
  ronin_bin/                    # stock Agent-facing commands
  src/                          # resolvers, validation, projections and API adapters
  public/                       # UI consumers only

ronin-services/
  <part>/                       # independently loadable runtime entries (keep current names)
  _lib/                         # non-activating shared runtime
  gbrain/ koshi_weights/        # installers that also expose service parts
  docs/                         # Services-only contracts
```

The physical changes implied here are deliberately small: fold `ronin_sops/` procedures
and owner shadows into `behaviours/`, replace the false Team Lead capability boundary with
Team, and remove empty/retired axes once proven unused. Everything else is primarily an
ownership/content correction in place. When implementation begins, stock sources, owner
stores, loaders, bundle paths, docs, tests and build inputs affected by those moves change
together; the old paths are removed in that change.

## Compatibility migration: one cutover

Compatibility means preserving the owner's material and working composites, not preserving
obsolete paths. The implementation change should do all of the following atomically:

1. Stop the running writer, inventory the exact stock and owner inputs, and refuse any
   source/destination collision that cannot be resolved from declared precedence.
2. Move the authored stock SOP procedures and corresponding owner `sops` content into their
   scoped Behavior owners. Preserve meaning, owner precedence and permissions; refuse an
   owner Behavior/SOP collision for explicit review rather than guessing.
3. Update every loader, definition reference, template bundle path, build input, API adapter,
   UI consumer, test, documentation link and executable projection to the new coordinate.
4. Put Team create and composite Team fork together under Team; make lead designation only
   a selector for additional Team teaching. Rename the `team-lead.md`/tool surface as part
   of this cut if Glen chooses the final command name—do not leave both concepts live.
5. Keep defensibly owned directories in place. Make Services `dev-sync` place only generated runtime and emit source revision/file hash
   provenance. If a composite/build requires a second coordinate, create a symlink to the
   canonical source and test it; do not copy or hand-maintain the second tree.
6. Regenerate disposable outputs (birth packets, capability overview, glossary, `dist/`,
   staging, release payloads) from the moved sources. Never move an old generated output.
7. Run cross-reference, executable/catalog, owner-shadow, bundle, Services independent-part,
   `npm run verify`, and `npm run byoin` checks against the final layout.
8. Delete the old authored paths and stale generated placements before restarting. A final
   search must show no legacy reads, writes, documentation links, bundle references or
   duplicate owners.

No general alias table, compatibility reader, dual-write period, staged namespace, or
lingering deprecated directory is recommended. Before the cutover, a read-only validation
must measure every affected owner shadow and bundle; during it, those files are moved or
refused explicitly. A symlink is used only when a build/composite must expose the same
canonical source at a second coordinate.

## Review gates before any move or rename

- [ ] Glen approves the semantic-owner matrix and the four distinct overlay policies.
- [ ] Team lead assigns one Cowork resolver owner and one Services manifest owner.
- [ ] A validator reports zero unresolved resource references on stock plus a representative
      owner-shadow fixture.
- [ ] `gbrain` claims are reconciled, with upstream skills treated as external/provider-owned.
- [ ] `ronin_session_boot/all/README.md` source discrepancy is explained and tested.
- [ ] `TOOLS.md` versus executable/capability inventory is reconciled, including
      `machine-settings` and explicitly private helpers.
- [ ] Team is represented as one capability parallel to Agent/Session; lead-only teaching
      is selected by the explicit designation, and composite Team fork creates no directory.
- [ ] Services placement has revision/hash provenance and cannot be mistaken for source.
- [ ] Bundle and birth-receipt readers/writers are changed with the paths in the same cut;
      existing owner bundles are explicitly migrated or refused, never silently remapped.
- [ ] `npm run verify` and Services capability/dev-sync tests pass on the final coordinates,
      with a search proving no legacy consumer remains.
- [ ] `npm run byoin` proves current owner customization still wins after the compatibility
      layer is introduced.

## Suggested ownership assignments (no recruitment performed)

The current three-person team already maps cleanly onto the next review pass:

- `directory_czar`: semantic-owner boundaries, target directories, docs and shadow contracts.
- `tejun_skills`: command/capability/provider-native skill boundary and tool inventory.
- `cleaner`: generated-placement hygiene, retired directories, stale references and
  validation gates.

If the team lead wants a fourth specialist, propose a Services manifest owner from the
`ronin-services` maintainers; do not make a Cowork-only Agent infer installer/part
compatibility across repositories.

## Decisions requested

1. Approve the target physical ownership layout and one atomic cutover, with no mapping,
   aliases, dual reads or staged compatibility directories.
2. Approve the four named overlay policies and require every resource kind to declare one.
3. Decide whether definition Markdown bodies remain dual-purpose delivered prose or split
   into manifest plus referenced reading in a later phase.
4. Confirm that provider-native skills are external dependencies discovered live and
   receipted, never copied into Ronin’s authored shelves.
5. Confirm that `src/services/` is generated placement with no documentation authority.
6. Confirm the owner decision that Team—not Team Lead—is the capability identity, and pick
   the final Team command/document naming so the old `team-lead` concept can be removed in
   the same change.

Until those decisions and gates land, no documentation/configuration directory should be
moved or renamed.
