# Provider sign-in — establish one Agent without exposing credentials

Related reference: [Agent controls and integration](../agents/README.md).

The goal is one usable provider, not every integration. The owner chooses the account and
billing arrangement and performs credential-bearing authorization. An Agent may inspect
safe status, explain consequences, run a login command with approval, and verify the result;
it never asks the owner to paste a key into chat or a recorded tile.

## First establish what exists

Use **Ronin Setup → Model providers**. It distinguishes absent, installable, installed,
login-open, and activated states without pretending to inspect account health. For an
advanced shell check, inspect from the same login shell a Ronin tile receives:

```bash
for command in claude codex gemini grok hermes; do
  command -v "$command" 2>/dev/null || true
done
```

This proves only whether a CLI is found. Ronin deliberately does not treat installation as
authentication. The provider catalog (`ronin_catalogs/MODEL_PROVIDERS.md`) lists every
provider and model Ronin offers; beside each, Ronin Setup shows what this machine has. The
Google, xAI and Nous rows are written from their vendors' CLI references and have not yet
been launched end to end through Ronin.

An installed provider whose own credential file is on this machine (Claude Code's
`~/.claude/.credentials.json`, Codex's `~/.codex/auth.json`, Gemini CLI's
`~/.gemini/oauth_creds.json`, Grok Build's `~/.grok/auth.json`) shows as **Signed in**; Ronin
reads only that the file exists. Otherwise **Authenticate** starts a temporary native setup
session in a tile. The owner completes any credential, billing, device-login, or trust step
there. **Done** records activation and closes the session; **Close** closes without
activation. Both measure the machine again and write the Campaign's provider summary.
Ronin does not continuously recheck the native account afterward: the summary is dated,
and the Model providers surface measures again whenever it is opened.

## Choose billing before login

Ask the owner whether this Agent should use an existing subscription login or separately
billed API access. Do not infer the answer from a model name.

Environment variables can override a subscription session, but precedence is
provider-specific. Inspect names without printing values and do not claim a universal
credential winner. For Claude/Anthropic, `ronin-host secrets` reports the Anthropic credential
that would win in the shell it checks and never prints its value; the spawned tile may
inherit a different service environment. Resolve a conflict with the owner rather than
dismissing the CLI warning.

## CLI-specific sign-in

Use the maintained [Codex](../agents/codex.md#sign-in-particulars) or
[Claude Code](../agents/claude.md#sign-in-particulars) integration page for exact CLI
mechanics. This page owns the shared owner handoff and credential-handling rules.

## Other Agent CLIs

Gemini CLI, Grok Build, and Hermes have rows in the provider catalog and rows in the Agent
registry, but a catalog row and safe authentication evidence are not the same thing. Do not invent a sign-in command or normalize one provider's status output into
another's. Follow current first-party CLI instructions, keep credentials with the owner,
and report unsupported or unknowable states plainly. Hermes currently has no safe automatic
installer in Ronin.

## Verify without reading a secret

A status command proves only what it explicitly reports. The universal end-to-end proof is
a real launch through Ronin followed by the harmless exchange in
[Get started](get-started.md#prove-one-working-agent). Record provider/model and observable
success, not a token, account identifier, or authentication artifact.
