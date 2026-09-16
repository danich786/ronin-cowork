# codex — the account that pays for a Ronin coding session

Related reference: [Agent controls and integration](../agents/codex.md).

> **Voice: agent.** How the agent sets the account that pays for a session — not a walkthrough to relay.
> **Tool: `ronin-host secrets [path]`** — establish whether a project names an OpenAI key
> before advising on credentials. It reports names and exposure state, never values.

For an interactive Codex session in Ronin, use the owner's **ChatGPT subscription
account**. That is the normal account for coding work in a tile; it keeps the session on
the plan the owner chose instead of quietly creating per-token API charges.

## Establish first

Run `codex login status` before changing anything. It says whether Codex is using
ChatGPT or an API key without showing a credential. If the answer already matches the
owner's choice, leave it alone.

When a project may need an OpenAI key, run `ronin-host secrets [path]` before the
conversation as well. `OPENAI_API_KEY` is a project credential, not evidence that an
interactive Ronin tile should use API billing.

## Signing in to the owner's ChatGPT account

Follow the [Codex integration page's sign-in procedure](../agents/codex.md#sign-in-particulars).
That is the maintained home for CLI syntax and callback/device-flow details. This page
owns the billing choice, not a second copy of those commands.

## API keys are the exception

Use an API key only when the owner explicitly wants API billing — for example,
programmatic API work, a distinct billing boundary, or a provider configuration that
requires it. State that consequence before changing the login. The key belongs in the
secret mechanism described by `secrets.md`, never in a prompt, a session transcript, a
document, or source control.

`codex login --with-api-key` reads a key from standard input. An agent must never ask
the owner to paste that value into the chat or expose it while diagnosing an account.
After any change, `codex login status` is the only confirmation needed.

## When the status is wrong

Do not guess from the model name, a browser tab, or an invoice. Read the status, inspect
the project's secret *names* with `ronin-host secrets` when applicable, then ask the owner
which account should pay. Use the device-code flow to return an interactive tile to the
owner's ChatGPT account; use API-key login only after the owner has deliberately chosen
that exception.
