# Codex in Ronin

CLI id: `codex`. Catalog provider: OpenAI. Reviewed 2026-09-14.
Version: **0.153.4**. Installed version and tagged upstream input source reviewed; no live turn interrupted.

Codex accepts the initial brief positionally. Ronin discovers the conversation from
matching rollout/writer-lock file descriptors and archives/resumes that exact identity.
The registry owns resume syntax. Settings/auth remain in the CLI's own configuration;
[the Codex account SOP](../../ronin_sops/codex.md) owns the default billing policy.

The catalog's disconnected mode disables the named gbrain server only. Other configured
MCP servers remain enabled. Configuration overrides merge; an empty server object is
not a reliable global disable. Dangerously adds the catalog's approval/sandbox bypass
flag for this launch; configured mode leaves the command unchanged.

Stop sends Escape. Native popups and some slash-input states can consume it. Clear
uses line-editing keys, never Codex's Ctrl+C: Ctrl+C can clear a draft, interrupt work,
or exit an idle CLI. Whole browser drafts clear locally.

Services' `gbrain/setup.sh`, `uninstall.sh`, and `doctor.sh` own gbrain registration,
removal and checks. The setup uses the Codex MCP command and token environment reference.
There is no generic all-server on/off mechanism in this integration.

## Sign-in particulars

Codex has a safe status command:

```bash
codex login status
```

If it already reports the arrangement the owner chose, change nothing. This command proves
only the login arrangement it reports. This repository does not establish whether an
OpenAI environment variable could take precedence in the launched Codex process; inspect
relevant variable names without values and report that precedence as **unknown** unless
separate current evidence settles it. For a ChatGPT subscription on a remote machine, the
supported device flow is:

```bash
codex login --device-auth
codex login status
```

The owner opens the URL, enters the displayed one-time code, and authorizes in their own
browser. Success for this route is `Logged in using ChatGPT`. Plain `codex login` is also
valid when its browser callback can return on the same machine.

API-key login is a separate billing choice. Use it only when the owner explicitly chooses
API billing. `codex login --with-api-key` reads standard input; the owner must supply it
directly, outside chat, documentation, wipeboards, shell history, and recorded tiles.


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

[Upstream reference](https://github.com/openai/codex/tree/rust-v0.153.4/codex-rs/tui/src). Update the evidence/version when changing this integration.
