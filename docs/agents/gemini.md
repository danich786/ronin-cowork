# Gemini CLI in Ronin

CLI id: `gemini`. Catalog provider: Google. Reviewed 2026-09-14.
Version: **0.55.1**. Installed version and bundled cancellation code inspected; complete Ronin launch/resume journey remains unverified.

The initial brief is positional. The registry declares resume syntax but exact live
conversation identity discovery is unsupported; Ronin refuses Archive before stopping
the session. Installation and update arguments are in the registry.

The catalog declares a Dangerously option. It declares no disconnected-mode flag, so
an explicit disconnected launch is refused. No Gemini MCP registration adapter is
implemented in Services' gbrain setup. Do not treat connected as provisioned.

Stop and Clear send Ctrl+C once. The official keyboard reference documents `edit.clear`
as clearing all input text. The same key can interrupt a request or quit on empty input;
Ronin leaves that native behavior to Gemini. Browser drafts clear entirely locally.


Shared [code ownership and test boundaries](README.md#code-ownership) apply to this CLI.

[Upstream reference](https://geminicli.com/docs/reference/keyboard-shortcuts/). Update the evidence/version when changing this integration.
