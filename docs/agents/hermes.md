# Hermes in Ronin

CLI id: `hermes`. Catalog provider: Nous Research and other inference providers. Reviewed 2026-09-14.
Version: **not installed**. Documentation only; installed behavior is not certified.

Hermes can serve different inference providers. Its CLI identity is distinct from the
provider/model selected in the catalog. Ronin has no automated installer for it; a
manual installation can be detected. Update and declared resume arguments are registry
data, but exact conversation discovery is unsupported, so Archive refuses.

The initial brief is parked rather than positional. The catalog currently declares
neither Dangerously nor disconnected mode. Services' gbrain scripts do not implement
Hermes MCP registration; there is no implied provisioning from an on/off control.

Stop sends one Ctrl+C. Hermes documents interruption and force exit on a second press
within two seconds. Ronin never automatically repeats it. Clear sends line-editing keys,
never an interrupt/exit command; its CLI multiline behavior requires installed testing.
The browser composer always supports whole-draft Clear. Unknown native keymaps require
updating this adapter, not changes to browser shortcuts.

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

[Upstream reference](https://hermes-agent.nousresearch.com/docs/user-guide/cli). Update the evidence/version when changing this integration.
