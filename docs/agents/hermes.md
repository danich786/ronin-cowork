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

Stop and Clear send Ctrl+C once. The official [TUI README](https://github.com/NousResearch/hermes-agent/blob/main/ui-tui/README.md#main-chat-input)
documents interruption during activity, clearing the current draft, and exit when nothing
is pending. This mapping follows that documented TUI behavior; Hermes is not installed
here. The classic CLI guide separately documents Ctrl+C interruption and double-press
force exit. Ronin adds no state classification. Browser drafts clear entirely locally.


Shared [code ownership and test boundaries](README.md#code-ownership) apply to this CLI.

[Upstream reference](https://hermes-agent.nousresearch.com/docs/user-guide/cli). Update the evidence/version when changing this integration.
