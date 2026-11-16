# Integrations

How an outside service a user brings (hosting, a tracker, memory, research, any MCP server)
reaches Agents. This page has every decision in full. The brief model is
[brief.md](brief.md); this page is the services side of it. Decisions: KAN-586; plan:
`integrations-end-to-end` (Ordered 2026-11-16).

## The rule

**Integrations are reached at run time, never at launch.** No Agent's launch carries an MCP
server or a per-integration switch, Ronin's own tools included. Every integration is a command
the brief teaches and the Agent runs through its shell. A new integration changes nothing about
how Agents launch, and an Agent that is already running can use one connected after it started.

The brief's `mcp:` header (a bridge naming an MCP server for the launch) retires, with no
compat. gbrain becomes a command like the rest.

## Three ways in

All three are commands; Ronin holds the key and makes the network call, so an Agent never
handles a key.

| Way | The Agent sees | Who defines the calls | Example |
|---|---|---|---|
| **Hidden** | Ronin's own object; the provider is invisible | Ronin | Jira behind `item` |
| **Curated** | a few Ronin commands for the provider | Ronin, mapped to the provider's API | `netlify` |
| **Pass-through** | the provider's own MCP tools, as its server describes them | the provider | `mcp call <name> …` |

Pass-through comes first: one broker serves every MCP server with no code per provider. A
provider gets a curated bridge only when it earns one (answers too long, the same calls with the
same arguments, a Workspace fact to fill in). A curated bridge may call through the broker.

## The pieces

| Piece | Where | Says |
|---|---|---|
| A **bridge** (curated or hidden) | a behaviour file with `when: integration:<name>`, and its tools ([brief.md](brief.md#integrations-and-bridges)) | what the bridge is for and when to reach for its commands |
| An **MCP server** | a record, `~/ronin/catalogs/integrations/<name>.md` | how the server is reached, how it signs in, which secret holds its key, which Campaigns are offered it |
| The **keys** | secrets, `~/ronin/services_secrets/<name>-<key>`, made with `secret ask` | nothing readable: a value is never printed |
| The **link** | the Workspace record's `integrations` entry, `{provider, …facts}` | the facts a bridge needs for that Workspace (Netlify's `site`) |

## The MCP server record

One Markdown file per server, in the owner's store (it survives updates). `mcp add` writes it,
`mcp remove` deletes it, and the owner may edit it by hand. The name is the file name:
lowercase letters, digits and `-`.

```markdown
# Wispr Flow
- **description:** Voice dictation and transcripts.
- **reach:** https://mcp.example.com/mcp
- **sign-in:** key
- **secret:** wispr-flow-api-key
- **send:** Authorization: Bearer {secret}
- **campaigns:** home_machine, client_x
```

| Field | Means |
|---|---|
| title (`#`) | the label Settings shows |
| `description:` | one line: what the server is for. Taken from the server at `mcp add` (its `instructions`, else its title), editable. The brief prints it; the brief build never calls a server |
| `reach:` | a URL (`http://`, `https://`: MCP's streamable HTTP), or the command that starts a local server (MCP over its stdin and stdout) |
| `sign-in:` | `key` (a pasted key), `oauth` (a sign-in whose token the broker keeps and renews), or `none` |
| `secret:` | the secret that holds the key or the OAuth token, `<name>-<key>`. Blank with `sign-in: none` |
| `send:` | how the key goes on each call: a header, `Header-Name: … {secret} …` (default `Authorization: Bearer {secret}`), or for a local server an environment variable, `env NAME` |
| `campaigns:` | the Campaigns it is offered to, comma-separated. Blank: every Campaign |

There is no `bridge:` field: every record here is an MCP server. A record whose name is also
a bridge's (`netlify`) is that bridge's way through the broker: the bridge behaviour teaches
it, and the MCP list does not show it.

## Who has it

- **Offered is on.** A server is on for every Agent in the Campaigns its record lists, or in
  every Campaign when the list is blank. There is no Campaign switch for it.
- **Narrowing.** A Workspace, Team or Agent can turn an integration off for itself and below,
  through its brief settings. That is the brief model's rule, on at the top and blocking the
  only way down, applied to integrations. Today integrations only add down the layers; the
  block is built in Team behaviours' epic (w676).
- **Curated bridges** stay as they are: turned on at a Campaign, Workspace, Team or Agent.
- **What the broker allows.** It refuses a call only outside the record's Campaigns. Inside
  them, the layers decide what the brief teaches, not what the broker runs: a call from an
  Agent that does not have the server on still runs, and its log line says so. *Pending the
  owner's word (web_lead, 2026-11-16).*

## What Agents are told

- **One behaviour for every MCP server,** `behaviours/mcp.md`, at seed depth, in play when at
  least one MCP record is on for the Agent. Its seed is generated: one line per record that is
  on, `<name>: <description>`, then how to call (`mcp tools <name>`, then `mcp call <name>
  <tool> --json …`). `tools/mcp.md` is the command's tool file.
- **A provider's tool list never goes into the brief.** The Agent fetches it with
  `mcp tools <name>` when the work needs it.
- **Running Agents hear of a change.** A record added, removed, offered or narrowed refreshes
  every brief it touches, as the Jira pairing does, so a running Agent gets it as a brief update.
- **A curated bridge** keeps its own behaviour file and gets no line in the MCP list.

## The broker

The Services part `mcp` is an MCP client. It keeps no connection between calls: each call
connects, asks and closes.

| Command | Route | Does |
|---|---|---|
| `mcp list` | `GET /api/mcp` | the servers offered to the caller's Campaign, each with whether it is on for the caller and whether its key is saved |
| `mcp tools <name>` | `GET /api/mcp/tools?name=` | the server's tools: name, what it does, the arguments it takes |
| `mcp call <name> <tool> --json '<args>'` | `POST /api/mcp/call` | runs the tool and prints its answer |
| `mcp add <name> <reach> [--sign-in key\|oauth\|none] [--secret <n>] [--send <s>] [--campaigns <list>] [--description <d>]` | `POST /api/mcp/add` | connects, reads the server's description, writes the record. A key not yet saved: the command asks for it with `secret ask <secret>` and tries again |
| `mcp remove <name>` | `POST /api/mcp/remove` | deletes the record; its secret stays until the owner removes it |
| (Settings › Integrations) | `POST /api/mcp/campaigns` `{name, campaigns}` | rewrites only the record's `campaigns:` line (blank: every Campaign); connects to nothing |
| (the owner, in the browser) | `GET /api/mcp/oauth/start?name=` | an `oauth` record's sign-in: Ronin registers itself with the server's authorization server and comes back to the address the browser used; the tokens go in the record's secret and the broker renews them |

On every call the broker reads the record and the secret, attaches the key as `send:` says,
logs the caller and the tool (never the arguments' secrets, never the key), stops after 60
seconds, and answers `{ok, lines}`: the tool's text, cut at 400 lines with a note of what was
cut. An image or audio is saved to a file under the system temp folder (`ronin-mcp/<caller>/`)
and its path is printed. A failure is one line: what is missing (409, with what to set), what the
server said (502), or that the part is not running (404: use the provider's own way).

## Settings › Integrations

One list: every bridge and every MCP server, each with its description, the secret names
saved for it (never a value), the Campaigns it is offered to, the Workspaces that link it and
whether its Services part runs. The list is `integrationsState` (`src/integrations.ts`): it
reads the record files, never a server; a record named like a bridge shows as that bridge.
An MCP row carries `mcp: {reach, sign_in, secret, saved, campaigns}`; a bridge's is null.

The panel (`public/js/integrations-panel.js`) works an MCP server through the broker's routes,
so it answers only while the `mcp` part runs:

- **Add MCP server** (the surface's action): name, address, sign-in, through `POST /api/mcp/add`,
  the same record `mcp add` writes. A key not saved yet opens the paste field for the secret
  the broker names; saving it adds again.
- **The key** of a `key` record: a paste field on its row saves it with `POST /api/secrets/<secret>`,
  the route `secret ask` answers through; the field is cleared the moment it is sent.
- **Sign in** on an `oauth` record opens `/api/mcp/oauth/start?name=<name>` in a new tab; Refresh
  shows it signed in.
- **Campaigns** are ticked on the row and saved with `POST /api/mcp/campaigns`; none ticked is
  every Campaign.
- **Remove** is one press (`POST /api/mcp/remove`); the secret stays.

## Order of work

1. This page.
2. The broker, MVP: one hosted server that takes a key; `mcp add`, `list`, `tools`, `call`
   from a running Claude or Codex session, with no restart.
3. A local server (a start command), then OAuth sign-in.
4. The brief (Team behaviours, w676): `mcp.md` and `tools/mcp.md`, narrowing, the refresh,
   and the `mcp:` header retired.
5. Settings › Integrations shows MCP records; gbrain moves off launch.
