# Capabilities

One Markdown definition per **capability bundle**: the tool documents an Agent is taught at
birth. A bundle is a document grouping — the question it answers, the actual tools that
answer it, and the teaching around them. It is not an executable: it may list several
tools, one, or none, and a tool may be surfaced by more than one bundle without being
renamed to either. A bundle with no tool is instructions plus authority, and it is still
selected and still on the newborn's shelf.

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
| Core | `edges.md` | cross-session and Team boundaries; tool TBD |
| Core | `work-record.md` | live personal record, document, and held-project tool |
| Core | `session.md` | live session inspection and lifecycle tools |
| Core | `worktree-desk.md` | managed-desk contract; tool TBD |
| Core | `machine-settings.md` | typed Campaign, installation, provider, and machine settings |
| Conditional | `team-lead.md` | live lead-only roster, Team-project, and member-status tools |
| Optional | `ronin-host.md` | selected Ronin Host operations |
| Optional | `ronin-services.md` | selected Ronin Services teaching and Mika launcher |
| Optional | `gbrain.md` | selected GBrain boundary teaching; tool TBD |
| Optional | `trello.md` | selected, connected Trello boundary teaching; tool TBD |
| Optional | `perplexity.md` | selected, connected Perplexity boundary teaching; tool TBD |

Ronin reads these files, applies each file's predicates, checks each listed executable,
and generates the virtual `YOUR TOOLS` overview from the selected definitions. The virtual
view is not a parallel catalog and is never maintained by hand.

| Key | Holds |
|---|---|
| `label` | the title shown in the birth overview and on the shelf |
| `blurb` | one sentence: the question this bundle answers |
| `class` | `cowork` (part of every Cowork Agent's vocabulary) · `feature` (an installed part of Ronin) · `integration` (a connected outside service) |
| `requires` | predicates, comma-separated, that must all hold (below); blank or `—` selects the bundle for every Cowork Agent |
| `order` | sort position in the overview |
| `hidden` | `yes` withdraws a definition without deleting the file |

## The `## Tools` table

One row per actual tool, columns found by name in any order:

| Column | Holds |
|---|---|
| `Tool` | the live executable as typed — `session_check`, or executable plus operation such as `machine-settings read`; the first word is what is projected onto PATH |
| `Authority` | what the tool may do, in a word or two: read · write · create · end · read/write |
| `Teach` | `priority` marks a tool taught in the birth overview; blank leaves it to `--help` |
| `Help` | the discovery route when it is not `<tool> --help` |

A nonexistent command belongs in prose as **TBD capability**, never in this table. A row
whose executable is absent from this particular box — not in the owner's tools store or
`ronin_bin/` — is projected and taught nowhere; the birth receipt names it under `missing`.

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

An unknown predicate never holds, so a misspelt requirement withdraws the bundle rather
than teaching it to everyone. Every fact is settled by the launch resolver before the Agent
process exists; none is a picker on a form.

## What a definition produces

At birth the resolver selects the definitions whose requirements hold, projects the listed
tools that exist on this box, and hands the compiler the selected files. The compiler
renders one virtual overview — title, blurb, the projected priority tools with their
authority, the help routes, and the path of the full document — and puts the full document
on the shelf as a card. The birth receipt records every definition with `selected`,
`reason`, `tools` and `missing`. `docs/session-boot.md` and `docs/birth-packet.md` own the
packet; `docs/installations.md` owns the cascade.
