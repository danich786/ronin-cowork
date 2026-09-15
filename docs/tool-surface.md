# Tool surface

Therefore:

- **Tool** — Ronin executable authority.
- **Composite tool** — Ronin tool orchestrating multiple guarded operations.
- **Capability** — Ronin’s provider-neutral bundle describing which tools answer a
  question and teaching their use.
- **SOP** — Ronin’s provider-neutral procedural contract.
- **Skill** — provider-native adaptation or teaching inside a provider shell.
- **UI** — a client of Ronin tools/APIs.
- **Internal module/API** — implementation behind those tools.

A skill may teach a provider how to use Ronin capabilities and tools, but it must not be
the sole home of Ronin business rules or unique authority. If another provider needs
equivalent help, it receives its own native representation derived from the same
Ronin-owned capability/SOP—not a copied source of truth.

This is the Tool surface.

## Boundaries

Composite describes a tool's orchestration scope, not a second authority class. The
composite tool owns one typed contract and outcome while reusing the validation and audit
evidence of its guarded operations. A capability teaches that tool; an SOP governs the
procedure around it; a skill adapts the teaching for one provider; and a UI calls the same
contract. None copies the choreography.

**Macro** and **action** are not Ronin architectural categories. “Action” remains ordinary
UI prose for something a person can do. Call a teaching bundle a capability and an
executable bundle a composite tool.

Object kind does not determine layer. Creating a Team record and creating an Agent/session
are peer tool operations with parallel stacks:

| Object | UI client | Tool/API contract | Internal implementation |
|---|---|---|---|
| Team record | New Team | `team-lead roster write` / Team roster API | Team route and roster modules |
| Agent/session | New Agent/session | `session_create` / session launch API | Session route, launch resolver, spawn broker, and launch ledger |

One may invoke or be composed with the other without becoming its presentation or
implementation layer.
