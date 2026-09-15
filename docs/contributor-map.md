# Contributor map — seven surfaces

Use this map after the root `AGENTS.md` route. It identifies the likely seams; it does not
replace the linked contracts. A change may cross several rows. Privacy, security, testing,
documentation, accessibility, failure recovery, migration, removal, and release remain
questions across all seven.

| Surface | Server and state | Browser | Contract and teaching | Test entry points |
|---|---|---|---|---|
| **Scope** — system, conditional, Agent composition, Agent-role composition | `src/instruction-cascade.ts`, `src/capabilities.ts`, `src/agent-defaults.ts`, `src/campaign-scope.ts` | selection is drawn by the owning form, not by scope itself | `docs/agent-composition.md`, `docs/installations.md`, capability `requires:` fields | `capabilities.test.ts`, `agent-defaults.test.ts`, `campaign-scope.test.ts` |
| **User interface** | owning `/api` route and state module | start at `public/js/README.md`; desktop boots through `main.js`, phone through `phone.js` | `docs/ui.md`, `docs/workbench.md`, `docs/RONIN_UTILITY.md` | matching client `.test.js`; explicit browser diagnostic for rendered behavior |
| **Runtime and state** | `src/session-*`, `src/tmux-client.ts`, `src/spawn-broker.ts`, `src/project-roots.ts`, `src/desks/`, `src/machine-settings.ts` | status/recovery in the owning surface | `docs/tmux-connection.md`, `docs/project-roots.md`, `docs/worktrees.md`, `docs/state-inventory.md` | `tmux-client.test.ts`, `spawn-broker.test.ts`, `desks.test.ts`, `worktree-runtime.test.ts`, machine-settings tests |
| **Services and connections** | `src/sockets.ts`, `src/parts.ts`, `src/activation/`, `src/credential-store.ts`; canonical parts in `ronin_services` | Cowork owns all service UI; missing routes are an off state | `docs/services-activation.md`; Services `connector-contract.md`, `install-contract.md`, `services.json` | `parts.test.ts`, `service-capability-runtime.test.ts`, `services-activation.test.ts`; Services `bin/verify` |
| **Agent composition** | `src/capabilities.ts`, `src/behaviours.ts`, `src/agent-defaults.ts`, `src/birth-readme.ts`, launch resolver | Campaign/Team/Agent forms supply editable inputs | `docs/agent-composition.md`, `docs/tool-surface.md`, `ronin_catalogs/{behaviours,capabilities,templates}/` | `capabilities.test.ts`, `behaviours.test.ts`, `templates.test.ts`, `session-boot.test.ts`, `birth-receipt.test.ts` |
| **Capabilities and tools** | `src/*-cli.ts`, `src/routes/cli-api.ts`, domain modules and guarded brokers | UI is a client, never tool authority | `docs/tool-surface.md`, `ronin_catalogs/capabilities/`, `ronin_catalogs/TOOLS.md`; executables in `ronin_bin/` | `routine-tools.test.ts`, `tool-bundle-dispatchers.test.ts`, `tool-only-*.test.ts`, domain tool tests |
| **Work and coordination** | `src/projects.ts`, `src/team-projects.ts`, work-record modules, messages, `src/desks/`, `src/promotion/` | `team-kanban.js`, work-record, roster, messages, wipeboard | `docs/work-record.md`, `docs/team-kanban.md`, `docs/worktrees.md`, `docs/coordination-trace.md` | project, work-record, message, desk, promotion, and Team Kanban suites |

## How to use the map

1. Name the visible outcome and affected rows.
2. Follow each row from its public contract to its one state authority and executable seam.
3. Add or change the smallest focused tests at those seams.
4. Use `npm run verify` for Cowork. For Services changes, also run that repository's
   `bin/verify --cowork /path/to/the/matching/ronin-cowork` from the Services desk.

Avoid a directory-wide tour. The owning document should answer which file comes next.
