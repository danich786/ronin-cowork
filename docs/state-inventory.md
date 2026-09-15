# Durable-state inventory

One fact has one authority. Browser caches are presentation; API aggregates are projections;
neither silently becomes another store.

| Durable truth | Authority | Main readers/writers | Removal or migration boundary |
|---|---|---|---|
| Machine, Campaign, installation, provider, and default settings | machine settings through `src/machine-settings.ts` and its schema | settings/setup APIs and Campaign surfaces | schema migration belongs with the reader/writer; `npm run byoin` checks owner overlays |
| Registration and Services activation | `src/activation/registration.ts`, activation state, protected activation secrets | Setup Register and Services activation routes | registration deletion and entitlement recovery are explicit; secrets never enter browser projections |
| Workspace Folders | project-root catalog via `src/project-roots.ts` | launch, folder, Campaign and desk resolution | archive/remove through project-root operations; never infer ownership from a path alone |
| Repository arrangement | each root's `RONIN_REPO` | `src/desks/arrangement.ts`, launch and desk tools | repository-owned declaration; no branch-name inference |
| Live session identity and runtime facts | tmux options through `src/tmux-client.ts`/`src/tmux.ts` plus session identity records | roster, WebSocket, launch, archive | tmux access only through the control client; session lifecycle owns cleanup |
| Archived sessions | session archive manifests | archive/restore APIs and Archived UI | explicit restore or removal; not a live tmux session |
| Team identity, membership, defaults, and held Projects | Team roster store | Team APIs, launch, roster and Team tools | Team operations own membership/project transitions |
| Agent work, documents, and Projects | per-session work record | `work-record`, work-record APIs, Team Kanban projection | the Agent-authored record is authoritative; projections do not write it |
| Messages, wipeboards, and schedules | their domain stores | Edges/tools and Team commons APIs | each domain owns retention and delivery state |
| Managed desks, assignments, hand-ins, promotions, and settlements | desk lifecycle ledger and receipt stores under `src/desks/` and `src/promotion/` | worktree tools, Team lead, promotion and Kanban evidence | append-only evidence; recovery projects state from events rather than rewriting history |
| Credentials and outbound grants | `src/credential-store.ts` and feature-specific protected stores | server-side connectors only | never return through settings/home APIs or process arguments |
| Services data | the store named by each row of `ronin_services/services.json` | that service's canonical implementation | service install/uninstall contract must state what is removed and kept |
| Browser preferences and drafts | explicit browser storage owned by the relevant client module | UI only | presentation convenience; never authority for server operations |

When adding durable state, update this inventory in the same change. Name its schema,
permissions, owner, projection, migration, backup/retention expectation, and removal path in
the nearest implementation contract.
