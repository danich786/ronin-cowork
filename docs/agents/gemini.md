# Gemini CLI in Ronin

CLI id: `gemini`. Catalog provider: Google. Reviewed 2026-09-14.
Version: **0.55.1**. Installed version and bundled cancellation code inspected; complete Ronin launch/resume journey remains unverified.

The initial brief is positional. The registry declares resume syntax but exact live
conversation identity discovery is unsupported; Ronin refuses Archive before stopping
the session. Installation and update arguments are in the registry.

The catalog declares a Dangerously option. It declares no disconnected-mode flag, so
an explicit disconnected launch is refused. No Gemini MCP registration adapter is
implemented in Services' gbrain setup. Do not treat connected as provisioned.

Stop sends one Ctrl+C. Gemini handles cancellation itself and repeated Ctrl+C can exit;
Ronin does not retry or repeat a held shortcut. Clear uses only line-editing keys, not
Gemini's Ctrl+C clear/cancel/quit multiplexing. Browser drafts clear entirely locally;
CLI multiline drafts clear the current logical line. Escape and menu behavior remain
native inside CLI dialogs.

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

[Upstream reference](https://geminicli.com/docs/reference/keyboard-shortcuts/). Update the evidence/version when changing this integration.
