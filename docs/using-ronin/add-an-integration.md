# Add an integration

An integration is an outside service your Agents use: hosting, a tracker, mail, research,
any MCP server or web API. You add it once; every Agent in the Campaign can use it, and an
Agent that is already running picks it up without a restart. Ronin keeps its key, so no
Agent ever sees one.

## Which way in

| The service | How it is added |
|---|---|
| One Ronin has a bridge for (Jira, Netlify, gbrain, Perplexity) | Turned on for the Campaign: **Settings › Defaults**, Integrations |
| An MCP server | `mcp add <name> <address>`, or **Add MCP server** in **Settings › Integrations** |
| A web API | `api add <name> <base URL>` |
| Anything else | Noted on the Workspace; Agents use the service's own CLI or API |

An Agent can do the adding for you: tell it which services you use. A bridge is turned on by
you, on Settings.

## Signing in: now or later

Each service shows its state in **Settings › Integrations** (and in Setup's Integrations
step):

| State | What to do |
|---|---|
| **key needed** | Paste the key in the field on its row. It is saved as a file and never shown again. |
| **key saved** | Nothing: Agents can use it. Paste a new key there to replace it. |
| **sign in** | Press **Sign in**, finish in the new tab, then **Refresh**. |
| **ready** | Nothing: it needs no sign-in. |

Later is fine: the field stays on the row until you paste it. An Agent that needs the key
asks you for it with `secret ask`, on its tile.

## Remove one

**Remove** on its row in **Settings › Integrations**, or `mcp remove <name>` /
`api remove <name>`. The saved key stays until you remove it.

How it works inside: [Integrations](../architecture/integrations.md).
