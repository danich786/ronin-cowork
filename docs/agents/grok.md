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
classification or automatic repetition. Whole-draft CLI Clear is unverified and its adapter is disabled;
browser drafts clear entirely locally.
Native key customization and menus retain provider-specific behavior.

Shared [code ownership and test boundaries](README.md#code-ownership) apply to this CLI.

[Upstream reference](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/03-keyboard-shortcuts.md). Update the evidence/version when changing this integration.
