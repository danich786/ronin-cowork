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

Stop sends Escape. Native popups and some slash-input states can consume it. Whole-draft CLI Clear is unverified and its adapter is disabled. Codex's Ctrl+C
can clear a draft, interrupt work, or exit an idle CLI, so it is not a safe generic
Clear mapping. Whole browser drafts clear locally.

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


Shared [code ownership and test boundaries](README.md#code-ownership) apply to this CLI.

[Upstream reference](https://github.com/openai/codex/tree/rust-v0.153.4/codex-rs/tui/src). Update the evidence/version when changing this integration.
