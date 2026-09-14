# Grok in Ronin

CLI id: `grok`. Catalog provider: xAI. Reviewed 2026-09-14.
Version: **1.0.24**. Installed version checked; current upstream guide reviewed, not claimed to match every installed-version menu.

The initial brief is positional. Install/update/version operations are in the registry.
Resume syntax and exact conversation discovery remain unsupported; Archive refuses.
The catalog currently declares neither Dangerously nor disconnected mode. Explicit
requests for undeclared modes are refused rather than borrowed from another CLI.
Services' gbrain scripts do not implement Grok MCP registration.

Stop sends one Ctrl+C. Current upstream documentation says Escape does not cancel a
running turn. Ctrl+C can clear a concurrent draft first, and pressing again while
cancelling can escalate to quit. Ronin sends the owner's request once, without screen
classification or automatic repetition. Clear uses line-editing keys and never Ctrl+C;
browser drafts clear entirely locally. CLI multiline drafts clear the current line.
Native key customization and menus retain provider-specific behavior.

## Owning definitions and consumers

- `src/agents.ts`: this CLI's commands, availability, input/Stop/Clear and resume adapter.
- [Provider catalog](../../ronin_catalogs/MODEL_PROVIDERS.md): models, launch rows and additive mode flags.
- `src/spawn.ts` and `src/routes/launch.ts`: resolve the catalog and persist launch identity.
- `src/tmux.ts`, `src/session-archive.ts`, `src/routes/sessions-api.ts`: live identity and archive/resume.
- `src/terminal-controls.ts`: dispatch the intent using persisted CLI identity.
- [Terminal controls](../terminal-controls.md): all browser shortcuts and customization.
- [Provider contract](../model-providers.md): shared extension and owner-overlay rules.
- Tests: `tests/terminal-controls.test.ts`, `tests/model-providers.test.ts`,
  `tests/agent-prompts.test.ts`, and archive lifecycle tests. These do not certify
  a live CLI journey unless that journey is explicitly named above.

[Upstream reference](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/03-keyboard-shortcuts.md). Update the evidence/version when changing this integration.
