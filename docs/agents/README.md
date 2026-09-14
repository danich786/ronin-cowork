# Agent integrations

Each CLI has one maintained integration page:

- [Codex](codex.md)
- [Claude Code](claude.md)
- [Gemini CLI](gemini.md)
- [Grok](grok.md)
- [Hermes](hermes.md)

These pages own each CLI's Ronin-specific explanation and code map. Shared browser
shortcuts belong only to [Terminal controls](../terminal-controls.md).

The CLI and inference provider are separate: several inference providers can use one
CLI. Models, prices, launch rows and owner overrides belong to the
[provider catalog](../../ronin_catalogs/MODEL_PROVIDERS.md), parsed only by
`src/model-providers.ts`. Do not copy model tables into these pages.

`src/agents.ts` owns executable install/update/version/resume and control syntax.
The catalog currently owns additive launch-mode and MCP-disconnect flags. Integration
pages link those definitions rather than creating another executable command table.
Services own service installation/removal; their provider-specific registration syntax
is identified from the integration pages below. Moving that syntax across repositories
requires a separate versioned interface, not a second local command registry.

When a CLI changes: update its owning definition, this integration page's explanation
and tested version, and the focused behavior tests together. Unsupported behavior stays
explicit. Authentication SOPs express owner policy and link here for CLI mechanics.
