# Tools and Agent capabilities

Therefore:

- **Tool** — Ronin executable authority.
- **Composite tool** — Ronin tool orchestrating multiple guarded operations.
- **Capability** — Ronin’s provider-neutral bundle describing which tools answer a
  question and teaching their use.
- **Behavior** — Ronin’s provider-neutral guidance for how an Agent works, including
  situational procedures.
- **Skill** — provider-native adaptation or teaching inside a provider shell.
- **UI** — a client of Ronin tools/APIs.
- **Internal module/API** — implementation behind those tools.

A skill may teach a provider how to use Ronin capabilities and tools, but it must not be
the sole home of Ronin business rules or unique authority. If another provider needs
equivalent help, it receives its own native representation derived from the same
Ronin-owned capability/behavior—not a copied source of truth.

Together, these definitions are Ronin's Tool surface.

The [Agent composition](agent-composition.md) places this surface beside behaviors,
mandate, provider-native skills, and assignment.

## Boundaries

Composite describes a tool's orchestration scope, not a second authority class. The
composite tool owns one typed contract and outcome while reusing the validation and audit
evidence of its guarded operations. A capability categorizes and teaches that tool; a
behavior governs the work and any procedure around it; a skill adapts the teaching for one
provider; and a UI calls the same contract. None copies the choreography.

**Macro**, **action**, and **SOP** are not Ronin architectural categories. “Action” remains
ordinary UI prose for something a person can do, and “procedure” may describe a step in
ordinary prose. Call a tool-centered teaching bundle a capability, working guidance a
behavior, and an executable bundle a composite tool.

Object kind does not determine layer. Creating a Team record and creating an Agent/session
are peer tool operations with parallel stacks:

| Object | UI client | Tool/API contract | Internal implementation |
|---|---|---|---|
| Team record | New Team | `team roster write` / Team roster API | Team route and roster modules |
| Agent/session | New Agent/session | `session_create` / session launch API | Session route, launch resolver, spawn broker, and launch ledger |

One may invoke or be composed with the other without becoming its presentation or
implementation layer.
