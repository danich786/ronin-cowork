# Workbench — construction and surface contract

This is the construction authority for Ronin Cowork Workbenches. The owner journey is
[Workbench — finding and arranging your work](../using-ronin/workbench.md); Workspace
Kit's lower-level primitives and lifecycle live in [Workspace Kit](workspace-kit.md).

A Workbench is one frame with a discovery column and two or four numbered workspaces.
It does not own feature data. It restores placement, creates independent surface
instances, and calls the placed instance's `show()` synchronously. The surface owns the
smallest reads needed to paint itself.

`public/js/phalanx.js` owns the shared Phalanx collection interaction: stones at rest,
a selected-stone rail beside its detail, focus return, Escape, and responsive geometry.
Consumers supply items and detail content; they do not recreate that movement privately.
A row may carry `items`. In full density pressing such a stone goes one level down: its
descendants become the rail's stones and the stone is the level's detail until one is
pressed. At rest in full density `branches` draws those items under their stone
(`'column'` stacks them; `'chart'` is one column per child with grandchildren stacked,
folded into a count past `CHART_DEPTH` until pressed). There is one way back from any
depth: Escape or the back stone returns to the top view, nothing selected, in the
density you were in. Switching density keeps the selection: a selected stone with items
becomes its level in full density, a level becomes its selected stone in compact, and
the stone open at that level returns with it. Consumers never restyle the rest geometry.

Trello view (`work.views`, `work-views-surface.js`) is the Cowork/Desk work-item card, over
GET `/api/work-items` (every item with its holder), with no phalanx, organised as a Trello board: its top-left button names the view and switches
it. Status lays one fixed-width list per stage, grouping under an underlined subtitle per
board that board's items (every descendant, `boardStages`) at that stage (one board alone has
no subtitle: its items sit straight in the list); Board lays one
list per board with a subtitle per stage it has items at. The lists are one drawing,
`createLists(root, scope)`, exported: the surface draws both views with it, and a board's
Open on a collection door draws that one board's stage lists with it (`board-overlay.js`;
owner 2026-10-08: the lists only, no nested surface, header or View-by). Each list carries its count at the
head and Add at the foot (the Add form, started in that list); Board view ends with Add board
(the Add form with New board chosen, held by the Team on a Team workbench). Board view puts
Unfiled last, in its own accent shade. On a Team, Add with no board of its own to start on
defaults to the Team's target board, read off `boards` and never stored: the oldest root the
Team holds, else the oldest its lead holds, else Unfiled. Cowork/Desk read
every item; a Team workbench draws the server's `?team=` reading `boards` (its boards and
Unfiled) and filters nothing in the browser. In Board view an item card drags onto another
board's list (one reparent call under that board; its children come with it) or onto empty
row space (reparent to none: a root); on a Team workbench a root made that way is then
assigned to the Team when it had no holder. In Status view an item card drags onto another
stage's list (one `POST /api/work-items/:id/stage` call with that stage). The store writes each move's trail line. Every press opens an overlay
from `work-details.js`, whose one utility sits top right: Save (only while there is
something to save), Assign, Add (the Add form as an overlay, placed where it was pressed),
Close. The Add form, the same wherever Add appears, asks title, objective, status and
board: an existing board, New board (`root: true` on the create route: a root of its own) or
Unfiled, the default. Assign holds the item by an Agent or a Team.

Who (`collection.who`, `who-surface.js`) is the Teams door of the collections workbench,
built to the direction doc (samurai_lab `wip/buildouts/COLLECTIONS_DIRECTION.md`, owner
2026-10-04): the collection finds work, adds work and reassigns work; detail, configuration
and editing live on a workbench. Its reading is one request, GET `/api/collection`
(`src/collection-read.ts`), every chosen workspace as `?root=`; the browser joins nothing.
Two `ask()` questions: Workspace (a many-of, none is all) and Under each Team (Boards or
Agents, a one-of-two that flips on press). One stone per Team, name only; under it the
boards or the Agents as bars, title only. A Team pressed is the thin open beside the rail:
objective, Agents with 人 on the lead, boards by name, and one door, Launch, which opens the
Team's tab (Who is the only door that launches Team tabs). A bar pressed opens its read in a
partial overlay hung off the bar (`partial-overlay.js`; owner 2026-10-07, replacing the
expand in place; the fork hands the press to the consumer through `press(item, bar)`): an
Agent to its role, what it is working on now (the home row's work
record and stance) and the items it holds; a board to its objective and its items by title,
each a press to its description, status and holder, with one door, Open, inside the window,
which lifts it and lays that board's lists in a full overlay over Who (`board-overlay.js`;
owner 2026-10-08, one rule for every door: the board's title and Close at the head, under it
the stage lists side by side, Idea to Done, each holding the board's items at that stage as
cards with Add at the foot, a card dragged onto another list writing its stage — the Trello
view's own `createLists`, repainted by the collection push wanted with that board); an item to its description, status and holder. The same read opens
from the thin open's bars. The drags are a board onto another Team (`whoMove`:
assign), an Agent onto another Team (`whoMove`: join, one write through
`moveTeamMembership`, leaving the Team it was under; owner 2026-10-07) and the Add new question's stone (Board or Agent, a one-of-two beside Under each
Team; owner 2026-10-08) onto a Team stone (`whoMove`: add, carrying which), which
opens a partial overlay (`partial-overlay.js`: a small window inside the surface under its
anchor, Close, Escape or a press outside lifts it) holding the draft form for a new board held by the Team; Agent opens the existing New Agent form,
Team answered, in a full overlay over Who (`fullOverlay`, work-details.js); Launch creates the
Agent and the overlay closes, nothing opens, and the Agent appears under its Team by the push
(owner, 2026-10-08; an Agent that already runs joins by drag). The question's label
says to drag: "Drag new onto a Team". `who-rows.js` is the pure mapping, under test.

What (`collection.what`, `what-surface.js`) is the boards door of the collections tenant
(lead 2026-10-08, to PATTERNS.md's "Collections (What)" rows): Who's shape over boards. It
hears the collection push (`collection-reading.js`), wanted with its questions' answers, and
requests, filters and joins nothing. Three questions: Workspace, as Who's (a many-of, none is
all, `root` on the want); Status (a many-of the six stages, none is all, `stage` on the want;
owner 2026-10-08); and Under each board: Items or Agents (the two-answer flip). One stone per board, name only, Unfiled last; under it the board's items by title,
or the Agents on it. A board pressed is the thin open: objective, its items and Agents as bars
(labels in sentence case, muted), and one door, Open, which lays that board's lists in a full overlay over What
(`board-overlay.js`, as Who's). A board pressed into swaps that board's children for its statuses
(`whatStatuses`, never the rest children) and goes down, so the rail lists the statuses the
board has items at, in stage order; back at the top the items return (owner, 2026-10-08).
A status pressed narrows the thin open to that status's items, pressed again it shows all;
the Status question narrows the rail too, through the want. An item bar in the thin open, or
an Agent bar, opens its read in the partial overlay: an item's description, status and
holder; an Agent's items on this board. The drags are an item bar onto another board stone
(`whatMove`: reparent, one write) and a board stone onto a Team stone on Who in the other
workspace, which assigns the board to that Team through Who's own drop handler. Every
collection drag carries the one payload (`collection-drag.js`: `{ kind, id, team?, board? }`
under one type), so a Team stone and a board stone each read the same thing and their rules
say what it means there (owner, 2026-10-08). `what-rows.js` is the pure mapping, under test.

**The phalanx and its fork** (owner ruling, 2026-10-03). `phalanx.js` is the stone work
surface as it was, its geometry untouched: Settings (Presets, Workspace Folders, Model
Providers, Setup), Team Chart, Work Items and the Trello view's overlays draw with it. Escape
lifts only the layer it is pressed in: an item overlay inside a board's overlay leaves the
board's overlay standing (2026-10-08).
`collection-phalanx.js` is the fork for the collection doors, built on `createPhalanx`
(the same stones, rail, detail and way back, nothing copied): blocks centred at wide
spacing, each stone's children stacked under it as one-line bars (no connector line), an empty
stack drawing nothing, grandchildren folded away (`data-cph-depth`, set by the fork through
`attrs`), a header that fits its question, and a bar pressed expanding in place through the
consumer's `expand(item, host)` instead of selecting or going a level down; what is expanded
survives a repaint.
Its root wears `.cph` and its host `.cph-host`; every rule is under that prefix. Who draws
with the fork; What and Where will.

Task Manager keeps its board and status/Project drill-downs for the Agent's Task Manager;
its selector card is no longer offered on the Cowork, Desk or Team workbenches. The older
Work Items board (`work-items`) stays on the Team workbench beside Trello view and in the
Agent's; Team reads its selected Team, Agent filters to Projects held by that Agent.

Work Items mounts `createPhalanx` directly in the standard surface content seat. Each
Project is a selectable stone in Ideas, Planning, Building, Landing, Done order. Selection
moves all groups into the left rail and renders the Project inside the same `sws-detail`;
it never opens another numbered workspace. `project-reading.js` holds the canonical
Project reading used by both presentations, with each supplying its own styling classes.
Work Items keeps normal Phalanx furniture, density controls, explicit holder opening,
and message-only stage drops. It does not use Task Manager's board or beige furniture.

The shared Phalanx accepts ordered `grouped.groups`, group/item event callbacks, item
actions, and `setDensity`; Work Items stones deliberately supply no action callback,
so the normal selection, rail, detail, Escape, and focus-return behavior applies.

## Library, profile, tenant, instance

`public/js/workbench.js` owns the shared library and frame.
`public/js/workbench-catalog.js` is the canonical registration and profile catalog for
Ronin Settings, New Project, Cowork, Team, and Agent. Destination modules provide tenant
data and surface factories through their environment; they do not register another copy
of those types or profile lists. Ronin Setup's ordered journey profile remains with its
Setup controller because journey progress, rather than destination choice, determines it.

`workbenchView(appearance, options)` in `public/js/workspace-contract.js` is the one
application-chrome declaration. It supplies the shared header capabilities and one of the
explicit Campaign, Setup, New Project, Cowork, Team, or Agent appearances; a view may also
supply its dynamic-island reading. `workspace-header.js` applies that declaration, while
surface factories remain ignorant of header colour.

Header content has two declared seats: `header.leading` appears before the centred
dynamic island and `header.actions` appears with the right-side controls. Both accept
elements or primitives exposing `.el`; the ViewHost alone places them. Standard controls
remain capability flags (`shape`, `ram`, `services`, and `feedback`), so a Workbench turns
one off in its declaration rather than hiding it with local CSS or querying header DOM.

- A **library definition** gives one stable type a header kind, discovery reading, and
  `create(context)` factory.
- A **profile** lists the library types one destination may place.
- A **tenant** supplies scope such as a Desk, Teams collection, or Team. It filters and
  parameterizes definitions; it does not create another Workbench implementation.
- An **instance** belongs to one workspace and optional resource key. The same type in
  two workspaces creates two rendered instances; data authorities may still be shared.
- `place(type, workspace, detail)` is the only placement path used by clicks, drag/drop,
  restoration, and programmatic openings.
- The frame owns the selector's compact/expanded action and persists `selectorDensity`
  beside shape, selection, arrangement, and seats. Profiles do not build another toggle.

A surface's header ends with its window control, −, which the Workbench seats. A surface
that returns `menu: () => groups` from `create()` also gets **メ** seated before −: the same
menu as a tile's (`js/menu.js`, the PATTERNS location "menu"), hung over that surface.
Configuration items (Board, Team, Workspace) hang off it; a surface that returns no `menu`
shows no メ.

The definition's `create()` draws the stable shell. Its returned `show()` or `enter()`
starts only that surface's reads. `leave()` parks active work and `destroy()` releases
surface-lifetime resources. See [the common lifecycle](workspace-kit.md#lifecycle-contract).

## The tenant frame and thin tenants (the new workbench)

Owner ruling, 2026-10-06 (samurai_lab `wip/buildouts/UI_STRUCTURE.md`, `WORKBENCH_SKELETON.md`):
one workbench format, and a named workbench is a **tenant** that exposes cards. The build
stands beside the old destinations and replaces them tenant by tenant; `cowork-view.js`,
`desk-view.js` and `agent-view.js` are not edited meanwhile and go when replaced.

Three layers:

1. **Kit frame**, `workbench.js`, as above: selector, cells, placement, arrangement, memory.
2. **Tenant frame**, `tenant-frame.js`, built once: the four terminal seats and their warm
   pools, placing a session or a surface into a cell and remembering it for refresh, the
   common cards (terminal, document, feedback), the bar's place and the tab title. Lifted as a copy
   from `cowork-view.js`. Not in it: Mika, the arranger, Commons; a tenant that needs one
   adds it.
3. **A thin tenant file** over it, tens of lines: `key` (the destination id, which is also
   the appearance), `profile`, `glyph`, `label`, `name`, `homeCard`, `firstOpen(param)`,
   `cards(frame)` (its environment entries), optional `sessions(param)`, `selectorFilter`
   and lifecycle hooks. `collections-view.js` is the first; `team-next`, `board` and
   `workspace` follow, one hand-in each.

**The server resolves the tenant, into the store** (w12, both halves landed 2026-10-07). A
tenant's reading is the collection reading (`src/collection-read.ts`) narrowed by campaign,
team, board or root, or the work-items reading for a Team or a board. A consumer subscribes
through `collection-reading.js`, the one seam, with its filter; the store sends
`{t:'want', resource:'collection', campaign?, team?, board?[], root?[], stage?[]}` or
`{t:'want', resource:'work-items', team?, board?}` on `/events` (the table in
[the tmux connection](tmux-connection.md)) and holds the answer under
`readingKey(resource, filter)`, the server's own spelling: the resource, then the filter's
JSON in field order, trimmed, empties dropped, roots deduped. The server pushes the reading
again to every connection holding that filter whenever an input moves; an absent campaign is
the one machine campaign, and Teams, folders and boards outside it are left out. The browser
requests, filters and joins nothing; no new file may name `/api/collection` or
`/api/work-items` (`tests/tenant-frame.test.js`). Who and the Trello view still read those
routes on entry until their rows are ordered.

**Collections** (`collections`, param the campaign; the one machine campaign when absent):
first open is Who in workspace 1 and workspace 2 dismissed. Its profile is Who, Where, New
(`collection.new`, `collection-new.js`: one ask.js question, the kind, mounting the existing
form for it — `draftItem`, `draftItem` on New board, the embedded New Agent and New Team as
Setup's Launch your own mounts them; Add's form takes the boards the opening surface holds
off its collection reading, `boards`, and reads no route: owner, 2026-10-09, one reading per
tenant), Document and Feedback; the Trello view is never a card here
(a board's Open lays the board's lists over the door, `board-overlay.js`). **Where**
(`where-surface.js`, type `collection.where`) reads the unfiltered collection push: folder
stones, and under each its Teams or its boards (a one-of-two question, as Who's); a folder
pressed is its thin open (name, path); a bar pressed opens its read in a partial overlay with
Workspace WS1's reads (`boardRead`, `teamRead`), a Team's door Launch, a board's door Open
laying that board's lists over the surface (`board-overlay.js`, as Who's). Nothing adds or moves on Where. Launch on Who opens
the old Team tab until `team-next` stands.

**Team** (`team-next`, param the Team; it takes the `team` word when it replaces the old
Team) is `team-view.js` over the frame: the members' tiles with the lead pinned hot and
seated on a first visit, the Commons as one self-painting surface (`team-commons-surface.js`,
lifted from `cowork-view.js`), Team Chart, **Work** (`work-surfaces.js`: one surface, one
header; owner, 2026-10-09. Two questions at its head, as Who's: View, Trello view or Work
Items, the two-answer flip; and Board, Who's Workspace question copied — a many-of over every
board, from the unfiltered collection reading, answered at first with the Team's boards from
the Team's collection reading and changeable to any, none is all. The body draws the chosen
boards' items with the engines and no nested surface: `createLists` for the Trello view, its
Status view, or `createItemsBoard`, the Work Items board's own drawing exported from
`work-items-surface.js`, stones by stage with the drag that asks the holder to move an item.
It reads the collection push only (one reading per tenant): unfiltered for the question's
boards and the Team's own, and wanted with the chosen boards for the body — `board` is a
list on the collection want — and requests nothing), the Team profile as a card, New Agent, and the composition
reader the roster opens. Not yet on it: Mika's help, the arranger (`edges page`), Task
Manager. Who's Launch opens this Team. On every tenant of the frame the bar's LEFT
breadcrumb is navigation (owner, 2026-10-09): the brand's link worded **Home**, then where
you are — `Team: <title>`, `Board: <title>`, `Workspace: <title>`, `Collections` — in the
`#viewcrumb` slot where the old workbenches show Teams. The frame composes the words once
from the tenant's `name` (`tenant-frame.js` `place`; the name of nothing is the kind word)
and `workspace-header.js` draws them. The centred island is the editable tab name on the
frame tenants as on the old Team; the old workbenches are untouched.

**Board** (`board`, param the board's item id) opens on the Board pattern: `work-views-surface.js`
with a `board` scope, WS1, that one board drawn by status or as its one list, its reading
arriving by push (the collection reading narrowed to `board=[id]`, its `boards[].stages`
carrying the items with their holders; owner, 2026-10-09: one reading per tenant) and repainting on every change, Add
starting on it and no Add board (PATTERNS.md, "Board tenant: the board itself"; owner,
2026-10-07). The bar name is the board's title off that reading. **Board configuration** is
an item on that surface's メ (the menu, `menu.js`, seated by the Workbench when a surface
hands over `menu: () => groups`) opening the full overlay (`fullOverlay`, `work-details.js`)
with Grey form rows (`saveRow`, `save-row.js`) for title and objective, each saving itself
by `PUT /api/work-items/:id`; the push repaints the board after. `configuration-overlay.js`
is the one glue for that, shared by Board, Workspace and Team. **Workspace configuration** is the
same on the Teams and boards surface's メ: rows for title, remit, memory, match, docs and plans, each
`PUT /api/project-roots/:name` with that one field (the store merges field by field; lists are
comma strings), seeded from the folder catalog the page holds and re-read after a save
(`loadProjects`, `home.js`; the catalog carries `memory` since 892f0aba). **Team configuration** on
`team-next` is the same on the Commons' メ, replacing the Commons' Configuration tab there
(the old Team keeps its tab): rows for title, purpose, kind, where it works, model, mandate
and launch mode, the enumerations as `ask()` question rows that commit on change, each row
its own `PUT /api/team-rosters/:name` (the store merges a roster field by field and writes
`agent_defaults` whole, so those rows send the merged object).

**Workspace** (`workspace`, param the folder name) opens on **Teams and boards**
(`workspace-teams-surface.js`, type `workspace.teams`) in workspace 1 and **Docs and repos**
(`workspace-docs-surface.js`, type `workspace.docs`) in workspace 2. Teams and boards is
the collection push for `root=<folder>` drawn with the collection phalanx and Who's mapping
(`who-rows.js`). Stones are the Teams whose folders include this one; bars are their boards;
a Team pressed opens its thin open (objective, one door, Launch); a bar pressed opens its
read in a partial overlay (`partial-overlay.js`, as on Who: a board's objective and items by
title, an item's description, status and holder).
Docs and repos is two lists of title-only rows (`itemLine` with `bar: false`): the folder's
registered docs and plans, and the repos its Teams list, both carried on the reading's
`roots` (`docs`, `repos`).

Each later row of their tables in the Lab's `PATTERNS.md` is its own hand-in that adds one
card.

**The Next root** (`next`, `next-home.js`) is the temporary door to the new set: Ronin
Home's shape with four doors, Collections, Team, Board, Workspace, and under each the names
it can open from the unfiltered collection reading. A door whose tenant is not registered
yet is closed and says so; `main.js` names the standing ones. Ronin Home carries one
**Next** link beside Settings. Root, route and link go in one commit when the four tenants
replace Home's three doors.

## The surface map and live arrangement

The surface map in the app bar is a miniature live model of the whole Workbench, not
merely a visibility menu. Each block represents an arrangement slot: a workspace column
or the discovery column. Its order and proportional width match the full Workbench.

The one arrangement state is `{ order, hidden, widths }`:

- **Show or hide:** click a map block. The last visible slot cannot be hidden, so the
  Workbench can never become an empty page.
- **Reorder:** drag a map block past a neighbor's midpoint. With the keyboard, focus a
  block and use Shift+Left or Shift+Right. The full columns move immediately, including
  their contents; surfaces are not destroyed or recreated.
- **Resize:** drag the divider between full-size Workbench columns, or focus that divider
  and use Left or Right. The adjacent column yields symmetrically. Minimum widths and the
  70% maximum trim the movement rather than refusing it. The surface map redraws during
  the drag, so its block proportions are the live resizing readout rather than a separate
  approximation.
- **Remember:** widths are stored by slot name, not position. A reordered slot carries
  its width; a hidden slot returns at its previous width; refresh restores the complete
  arrangement.

Visible widths are normalized across the remaining slots, and the frame writes each
slot's `compact` or `full` width class from its measured pixels. This lets a surface adapt
its reading without owning layout geometry. On phones the same ordered arrangement
becomes the responsive stack; desktop divider dragging is not imitated as a touch-only
second control.

`public/js/workspace-arrangement.js` owns the pure state transitions,
`public/js/workspace-layouts.js` owns column geometry and accessible dividers, and
`createLayoutMap()` in `public/js/workspace-primitives.js` renders the map. The ViewHost
mounts it for any active view exposing `arrangement`. A destination supplies slot names
and content only; it must not implement its own hiding, ordering, resizing, or persistence.

## Paint and data rule

A Workbench entry restores its shape and seats before network reads complete. A surface
paints saved or already-known values immediately when possible, then enriches choices or
status as its own reads return.

1. A destination must not await a catalog needed only by an unopened surface.
2. Discovery summaries may read a light index because the discovery column displays
   them. They must not use a detail, repository-analysis, or launch-assembly route.
3. A placed surface asks only for the data it displays or edits. It does not reuse a
   larger endpoint merely because that endpoint contains the required field.
4. Shared loaders may cache and deduplicate the same catalog. Caching may not broaden
   the request or turn it into a page-wide readiness gate.
5. Failure belongs to the requesting surface. One slow or failed read must not keep
   another workspace blank.
6. Async enrichment must not discard edits made after the first paint. Generation or
   ownership checks prevent stale responses from repainting replaced surfaces.

Campaign Defaults is the reference case. Its saved values are already in
`campaign.config.defaults`, so it paints them immediately. Model choices come from the
provider catalog and selectable Behaviors come from `/api/campaign-default-options`.
It does not call `/api/launch-seed`: that endpoint assembles a prospective Agent from a
Desk, Team, Workspace Folders, Agent defaults, Installations, and Behaviors, most of which
the Defaults surface neither displays nor edits.

## Entry, refresh, and intentional launch

A Workbench **tab instance**, not a destination or tenant, owns its current setup. The
open request names the destination and tenant, chooses shape and initial seats, and gets a
fresh tab-instance id. `openWorkbenchTab()` and ordinary Workbench doors use this path;
the destination's declared defaults complete any omitted fields. A direct route with no
request also creates a fresh default request. No new open recalls another tab's shape,
seats, selection, or presentation preferences.

On refresh (or browser history return), the same tab-instance id restores its entire
snapshot: tenant, arrangement, shape, selected workspace, seats, and preferences. The
one-shot request is consumed after the first entry and cannot replay over later edits.
`public/js/workspace.js` owns request, id, snapshot, and resolution through
`openWorkbenchTab()` and `workbenchEntry()`. A new tab receives a new id even if its
browser cloned the source tab's `sessionStorage`; that clone is not a refresh.

- **Replace:** the request replaces the default seat map and names its requested shape.
- **Overlay:** the request changes named seats and shape fields over destination defaults,
  never over a prior tab's state.
- **Refresh:** the saved snapshot wins in full. It is not merged with a fresh open request
  or a destination's first-open floor.

Destinations validate every requested type against their profile. Malformed or mismatched
requests fall through to destination defaults, not another tab's last setup. Feature code
must not copy another tab's storage, temporarily mutate a source view, or add link-specific
restoration branches.

| Destination | First open | Notable structured opening |
|---|---|---|
| Ronin Settings | Defaults in workspace 1; Workspace Folders in workspace 2 | **Desk defaults** replaces the seats with Defaults and Launch your own |
| Desk | Teams overview in workspace 1; Trello view in workspace 2 | Status and Project drill-downs retain the Desk tenant |
| New Project | New Agent in workspace 1 | Links may replace or overlay New Agent/New Team and carry prompt or template detail |
| Ronin Setup | Garden in workspace 1; active journey surface in workspace 2 | Journey actions select a Setup surface without another restoration path |
| Cowork / Team | Fresh empty/member seating rules; refresh restores this instance | Team Configuration, documents, commons tabs, and New Agent may be addressed in seat detail |
| Agent | Self in workspace 1; Documents in workspace 2 | A successful standalone launch replaces the seats and focuses the authoritative returned Agent as Self |

## Surface inventory and required data

This records the implemented boundary. Update it in the same change that adds a surface,
changes its dependency, or changes a Workbench profile.

### Ronin Settings (`campaign` profile)

Entry reads the Desk record because it is the tenant and uses the light Workspace Folder
index for the discovery count. Nothing waits on either read before seats paint. The former
page-wide progressive gate is deleted.

| Surface | Required data and owner |
|---|---|
| Desk | selected Desk record already held by the tenant |
| Desk profile | selected Desk record; skin catalog enriches choices after paint |
| Defaults | `campaign.config.defaults` immediately; provider catalog and Campaign-default options afterward |
| Workspace Folders | its own root-detail read; repository facts belong here, not in its discovery summary |
| Installations | installation catalog and installed facts; Desk values come from the tenant |
| Model providers | provider runtime/catalog owned by `provider-surface.js` |
| Machine | the selected cowork-commons tab owns its read; unopened tabs do no work |
| Register / Launch your own | registration or embedded launch-form reads owned by that shared Setup surface |
| Mika / terminal | readiness and terminal transport only when placed or deliberately prewarmed |
| Document / Feedback / Password | each shared surface owns its operation |

### New Project (`launch` profile)

Entry performs no form catalog read. It restores and places the requested form first.

| Surface | Required data and owner |
|---|---|
| New Agent | Agent templates, Team roster index, Workspace Folder details, and selected Team/Desk launch seed |
| New Team | Team templates, Workspace Folder index, and Desk launch seed; live sessions only for the final name-collision gate |
| Help | local reading and currently seated form context |
| Document / Feedback | the shared surface's own read or submission |

### Ronin Setup (`setup` profile)

The Garden and selected journey surface seat immediately. Garden content, setup runtime,
and small registration/GitHub completion facts hydrate the journey and discovery column
independently.

| Surface | Required data and owner |
|---|---|
| Garden | static garden catalog; selected scene only |
| Register | registration and user-introduction records |
| Model providers | provider runtime/catalog owned by the shared provider surface |
| Workspace Folders | Workspace Folder details and GitHub connection state |
| Installations | Desk record, installation catalog, and installed facts |
| Password | authentication state owned by the shared Password surface |
| Bounty Program | registration/GitHub facts and the explicit preference it writes |
| Launch your own | no launch data until Agent, Team, or Preset is selected; that embedded form then owns its reads |
| Presets | preset catalog plus provider/root choices required by the selected preset |

### Desk, Cowork, and Team (`desk`, `cowork`, and `team` profiles)

Desk is a first-class Workbench profile and tenant with its own restoration namespace and
first-open map; it is not a renamed Cowork entry. Desk and Cowork reuse aggregate surface
implementations, while Team addresses one Team. Sessions and Team records are legitimate
entry data because they are the discovery cards and seats. Optional feature status is
independent and must not hold the frame.

| Surface | Required data and owner |
|---|---|
| Team roster / Team profile | Team records and live session-derived membership; the roster's Phalanx is Cowork/Desk's only discovery of Teams (no per-Team selector cards); its detail, a placed Team profile and Who's stone detail paint one body, `createTeamProfile` in `team-profile.js` (owner, 2026-10-03: one Team profile format): head with Launch; Agents, each a block with 人 and name (its stance the line's title, no bullet), the items it holds as lines beneath (status word beside the bar, no holder) and the Launch mark at the right, the name opening the Agent's composition reader in place under it; the blocks rebuild only when members, held items or an open profile moved, so a store push never flashes an open profile or the plus's picker; one section per board the Team works on (its collection reading, `?team=`), its items as lines; Configuration with Delete team; no numbering; the plus adds an Agent. An item line pressed selects the item's stone on Who and opens the item overlay on a surface |
| Team Chart | Selected Team membership and lead designation; Phalanx owns collection and selection geometry, and its in-place detail embeds the canonical Agent composition reader plus the secondary Launch action |
| Team roster (`cowork.session-roster`) | `js/roster.js` restored as consumed before the Phalanx port: Team records, live sessions and pushed home rows; its desk column stays empty now that desks are read when the ladder opens |
| Agent terminal | selected session plus terminal transport; other sessions are not mounted for it |
| Commons | only the selected tab enters: Roster, Docs, Wipeboard, Messages, Configuration, or another registered room |
| Task Manager | Desk scope aggregates the canonical per-Team Project readings; Team scope reads the selected Team; status and Project drill-downs are independently placeable surfaces carrying the same tenant |
| Cron jobs | scheduled messages for the addressed Team or collection scope |
| New Agent / New Team | canonical launch form and its dependencies listed above |
| Archived sessions | archive manifests when shown |
| Presets / Document / Feedback | the shared surface's own reads |

### Agent (`agent` profile)

The route parameter is the tenant Agent. Its terminal can paint before Team and optional
service reads finish. Team membership and Task Manager choices enrich independently.

| Surface | Required data and owner |
|---|---|
| Self | route Agent plus the shared terminal host and transport |
| Agent Documents | the Agent's tracked documents in one untabbed work surface |
| Agent Task Manager | the route Agent's Projects across its current Teams, filtered by the canonical holder returned with each Team Project reading |
| Team membership | Team records and live session tags from `team-controller.js`; writes use the canonical session-membership route |
| Status / Project drill-down | the same Agent tenant and Team reads as Task Manager; each is an independently placeable surface and writes no Project data |
| Document / Feedback | each shared surface's own read or submission |

## Change checklist

When adding or changing a Workbench surface:

1. Register one stable type and include it only in profiles that may expose it.
2. Record its tenant input, discovery-summary input, first-paint input, and async
   enrichment input above.
3. Keep requests in the returned surface lifecycle unless data visibly belongs to the
   discovery column or defines the tenant/seats.
4. Define first-open placement separately from structured launches.
5. Verify refresh restores remembered state and does not replay a launch.
6. Verify a slow surface does not delay another surface or the frame.
7. Remove the superseded loader, route branch, cache, and test; never retain two entry or
   readiness mechanisms.

The visible-surface index in [`public/js/README.md`](../../public/js/README.md) maps each
surface to routes, state authority, and focused checks.
