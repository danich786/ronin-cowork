# Claude Code in Ronin

CLI id: `claude`. Catalog provider: Anthropic. Reviewed 2026-09-14.
Version: **2.1.270**. Installed version checked; provider input documentation reviewed.

Claude accepts the initial brief positionally. Ronin allocates a conversation UUID at
launch and uses it for archive/resume; the registry owns the arguments. Credential
locations are registry data. [Provider sign-in](../provider-sign-in.md) owns the owner
handoff and credential-handling rules.

Dangerously and disconnected mode use the catalog's additive flags. Disconnected is
coarse: it excludes other MCP servers as well as gbrain. Connected means the CLI's own
configuration applies; it does not install or authenticate a server.

Stop sends Escape; Claude may consume it to dismiss a dialog or decline a permission
request. Clear sends line-editing keys, never interrupt/quit. Multiline CLI input clears
the current logical line; the Ronin browser composer clears its whole draft locally.
Vim/custom keybindings may alter native dialog behavior.

`hostside/claude-settings.py` owns the narrow theme/status-line configuration merge;
`hostside/statusline-ronin.sh` emits the context reading consumed by `src/ctx.ts`.
Services' `gbrain/setup.sh`, `uninstall.sh`, and `doctor.sh` own user-scope MCP
registration, removal and checks. Preserve unrelated owner settings.

## Sign-in particulars

Use Claude Code's own current login/status surface and follow the interactive instructions
it displays. This repository does not carry a provider-neutral command that proves Claude
subscription versus API billing, so do not translate “CLI installed” into “signed in.”

Before launch, use `ronin-host secrets` to check whether `ANTHROPIC_API_KEY` or
`ANTHROPIC_AUTH_TOKEN` is in force without revealing its value. Those variables outrank an
OAuth/default profile and can silently move work to per-token billing. If the safe evidence
cannot distinguish the active account, report **unknown** and let the first interactive
launch request owner-controlled authorization.


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

[Upstream reference](https://code.claude.com/docs/en/interactive-mode). Update the evidence/version when changing this integration.
