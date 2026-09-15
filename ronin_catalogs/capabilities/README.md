# Capabilities

One Markdown definition per **capability bundle**: the tool documents an Agent is taught at
birth. A bundle is a document grouping — the question it answers, the actual tools that
answer it, and the teaching around them. It is not an executable: it may list several
tools, one, or none, and a tool may be surfaced by more than one bundle without being
renamed to either. A bundle with no tool is knowledge and teaching, and it is still
selected and still on the newborn's shelf.

A capability bundle is a knowledge layer, not an authority layer. Selection changes what
the Build Brief teaches and emphasizes for that Agent; it does not grant, withhold,
authorize, or forbid an installed tool or its help.

Capabilities may teach primitive and composite tools alike. The canonical boundaries are
in [`docs/tool-surface.md`](../../docs/tool-surface.md).

The folder is the catalog. Ronin reads every definition here and in the owner's
`<catalogs store>/capabilities/` (a file of the same name shadows the shipped one whole; a
new name is added). Ronin Host, Ronin Services, gbrain, Trello, Perplexity and any later
add-on are one file each, gated by their own `requires:` line; nothing in the resolver
knows a bundle by name.

## The definition

`- **key:** value` lines under the title, an optional `## Tools` table containing only live
executables, then the full teaching as ordinary Markdown. The first prose paragraph after
the keys is the card text a newborn sees on its shelf: say when to reach for this bundle.

## Shipped file index

These exact files are the source catalog for the virtual `YOUR TOOLS` view:

| Group | File | Scope |
|---|---|---|
| Core | `edges.md` | live cross-session and Team communication/read tool |
| Core | `work-record.md` | live personal record, document, and held-project tool |
| Core | `session.md` | live session inspection and lifecycle tools |
| Core | `worktree-desk.md` | live desk tool, with managed-desk teaching selected by arrangement |
| Core | `machine-settings.md` | typed Campaign, installation, provider, and machine settings |
| Conditional | `team-lead.md` | lead-workflow knowledge emphasizing roster, Team-project, status, and visible delegation |
| Optional | `ronin-host.md` | selected Ronin Host operations |
| Optional | `ronin-services.md` | selected Ronin Services teaching and Mika launcher |
| Optional | `gbrain.md` | selected GBrain boundary teaching; tool TBD |
| Optional | `trello.md` | selected, connected Trello boundary teaching; tool TBD |
| Optional | `perplexity.md` | selected, connected Perplexity boundary teaching; tool TBD |

Ronin reads these files, applies each file's predicates to teaching, checks each listed
executable, and generates the virtual `YOUR TOOLS` overview from the selected definitions.
The virtual view is not a parallel catalog and is never maintained by hand.

| Key | Holds |
|---|---|
| `label` | the title shown in the birth overview and on the shelf |
| `blurb` | one sentence: the question this bundle answers |
| `class` | `cowork` (part of every Cowork Agent's vocabulary) · `feature` (an installed part of Ronin) · `integration` (a connected outside service) |
| `requires` | predicates, comma-separated, that must all hold for the document to be taught (below); blank or `—` selects it for every Cowork Agent |
| `order` | sort position in the overview |
| `hidden` | `yes` withdraws a definition without deleting the file |

## The `## Tools` table

One row per actual tool, columns found by name in any order:

| Column | Holds |
|---|---|
| `Tool` | the live executable as typed — `session_check`, or executable plus operation such as `machine-settings read`; the first word is a delivery candidate |
| `Authority` | the tool's one job, in a word or two: read · write · create · end · read/write; never a caller category |
| `Teach` | `priority` marks a tool taught in the birth overview; blank leaves it to `--help` |
| `Help` | the discovery route when it is not `<tool> --help` |

A nonexistent command belongs in prose as **TBD capability**, never in this table. A row
whose executable is absent from this particular box — not in the owner's tools store or
`ronin_bin/` — is delivered or taught nowhere; the birth receipt names it under `missing`
when its class is eligible for delivery.

## `requires:` — the launch facts a bundle may read

| Predicate | Holds when |
|---|---|
| `installation:<name>` | that system installation is on for this birth |
| `behaviour:<name>` | that behaviour is selected and available for this birth |
| `arrangement:managed` | the resolved assignment holds a managed desk, or any work location is a managed worktree — the birth root alone does not decide |
| `arrangement:checkout` | the Agent works in checkouts only |
| `connected` | MCP is on |
| `campaign` | born into a Campaign, so Machine and Campaign settings are a surface this Agent has |
| `team` | born onto a Team |
| `lead` | born as that Team's designated lead |

An unknown predicate never holds, so a misspelt requirement omits that teaching rather
than adding it to the Build Brief. Every fact is settled by the launch resolver before the Agent
process exists; none is a picker on a form.

## Teaching and availability

At birth the resolver selects definitions for teaching. Predicates about role or work
context — `lead`, `team`, `campaign`, and `arrangement` — never withhold an installed
Cowork tool: every shipped tool in a `cowork` definition is callable by every Cowork Agent.
The `installation`, `behaviour`, and `connected` predicates on `feature` and `integration`
definitions still govern tool placement because they represent whether that feature is
enabled or connected; Ronin Host therefore remains conditional. Role or work-context
predicates on the same document still affect teaching only.

The compiler renders one virtual overview from selected definitions — title, blurb,
priority tools with their jobs, help routes, and the full-document path — and puts the
full document on the shelf as a card. The birth receipt records every definition with
`selected`, `reason`, `tools` and `missing`. `docs/session-boot.md` and
`docs/birth-packet.md` own the packet; `docs/installations.md` owns the cascade.
