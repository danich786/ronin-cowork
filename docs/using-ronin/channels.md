# Channels: connect a shared Ronin conversation to Slack

Team Commons → **Channels** contains persistent conversations. A channel belongs to a Team
and can have several subscribed Agents; replacing an Agent does not replace the channel
or its Slack connection. Channels can also be used locally without Slack.

A channel message does not itself stop an Agent's current work. When **Notify** is on,
Ronin creates a small pointer in the ordinary Messages queue; that queue's normal delivery
policy decides when the Agent sees it. With **Notify** off, the Agent receives no pointer
and can still read the channel later. In either case, reading does not turn a message into
an assignment and Ronin does not automatically choose which Agent should answer.

## Inputs needed for a live Slack connection

For the TeamSkip workspace, choose a dedicated test channel and a Slack app you have
permission to install. You need:

- A bot token (`xoxb-…`) for that installed app.
- An app-level token (`xapp-…`) from the same app, with `connections:write`.
- The Slack channel ID, such as `C0123456789`, and the bot invited to that channel.
- The Ronin Team and Agents that should subscribe.

Never paste tokens into chat, Wipeboards, issues, source files, or Agent prompts.
The workspace name alone is not enough to connect. The connector discovers the workspace
ID using `auth.test`; binding a channel verifies workspace identity and bot membership.

## Create the Slack app

Create an app from [the supplied manifest](../assets/slack-channel-manifest.json) in
Slack's [app management page](https://api.slack.com/apps). Install it in TeamSkip.
If you change scopes later, reinstall the app.

The manifest enables Socket Mode, subscribes to `message.channels` and `message.groups`,
and requests bot scopes `channels:history`, `groups:history`, `channels:read`,
`groups:read`, and `chat:write`. Private channels require inviting the bot.
The read scopes allow binding validation; history scopes permit message events.

Under **Basic Information → App-Level Tokens**, generate an app token with
`connections:write`. Obtain the bot token under **OAuth & Permissions**.

Socket Mode uses an outbound WebSocket; no public webhook URL or signing secret is
needed. The host needs outbound HTTPS and WSS access to Slack. See
[Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/) and
[chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage/).

## Configure the Ronin operator

Using a local editor, create a JSON file outside the repository, for example
`/absolute/private/path/slack-channel.json`:

```json
{
  "bot": "xoxb-REPLACE-LOCALLY",
  "app": "xapp-REPLACE-LOCALLY"
}
```

Restrict the file to its owner:

```bash
chmod 600 /absolute/private/path/slack-channel.json
```

Set only the file path in the operator environment (or the installation's `.env`):

```text
RONIN_SLACK_CREDENTIALS_FILE=/absolute/private/path/slack-channel.json
```

Restart the operator using your normal installation workflow. A browser reload alone
does not load credentials. Credentials are read once at startup, so token rotation also
requires an operator restart. The tokens stay in the connector and are not added to
Agent environments or API responses. Processes running as the same OS user still share
that user's file access; this is not OS-level credential isolation.

Channels shows connector state, workspace ID, and recoverable errors. No credentials
means local channels remain usable and Slack stays disabled.

### Testing with `npm run dev`

Development does not bind the installed operator's socket. To let Agents reach an
authenticated development server without copying browser credentials, add a private
socket path to this checkout's `.env`, for example:

```dotenv
RONIN_DEV_SOCKET=/absolute/path/to/checkout/.ronin-dev/run/operator.sock
```

Restart the development server and confirm it prints `agent tools answer at ...`.
The directory and socket are created with modes 0700 and 0600. `.ronin-dev/` is ignored
by Git. The installed socket is not replaced. New Agents inherit this address; for an
existing Agent, explicitly point every read/post command at the development socket:

```bash
RONIN_URL= RONIN_SOCKET=/absolute/path/to/checkout/.ronin-dev/run/operator.sock edges channel read slack-test
```

Do not disable HTTP authentication or start a system service to resolve this development
connection issue. A separate socket does not isolate shared message queues or other stores.
If an Agent receives `EPERM` or `EACCES`, its sandbox or OS permissions may deny socket
access even while Ronin is running. Request approval for that command to access the
socket; do not make the socket world-accessible or restart Ronin to fix a permission denial.

## Understand the Channels screen

- **Slack connected** reports connector health and the workspace ID. It does not mean the
  selected Ronin channel is already linked to a Slack conversation.
- **Current channel** chooses a persistent Ronin conversation. **New Ronin channel** is a
  collapsible creation form.
- **Slack connection** shows whether this channel is local-only or linked and contains
  the connect/disconnect controls.
- **Agent access** lists exact Agent subscriptions. Reading is granted by subscribing;
  **Can reply** and **Notify** are separate options. Press **Save subscription** after
  choosing them.
- **Conversation** shows the newest 100 messages, direction, author, local time, thread
  status, and outbound delivery status. The count can be larger than the visible window.
- **Send a message** writes as the owner. Choose an earlier externally delivered message
  in **Post as** to reply in its Slack thread. Ordinary Agent terminal output is never
  copied here or to Slack.

The page refreshes every two seconds only while the Channels tab is open. A temporary
network failure shows a reconnecting message and clears automatically after recovery.

## Use it

1. Open the desired Team's Commons → **Channels**.
2. Expand **New Ronin channel**, enter a display name, and review its generated Ronin
   channel ID. The Ronin ID is the lowercase command handle, such as `support`; it is not
   the uppercase Slack channel ID.
3. Create the channel. In **Slack connection**, enter the Slack channel ID from the end
   of its Slack URL and select **Connect Slack**.
4. Select each Agent and save its subscription. Choose whether it can publish replies
   and whether new messages should notify it. Read-only and quiet subscriptions work.
5. Write a message in Slack. It appears in the Ronin channel. Subscribed Agents with
   notifications enabled receive a pointer through the ordinary Messages queue.
6. Give the replying Agent an assignment such as: “Monitor support requests on channel
   support; answer questions within this project's scope and explicitly post replies.”

Agents use:

```bash
edges channel list
edges channel read support
edges channel post support "Here is the update."
edges channel post support --reply-to MESSAGE_ID "Here is the answer in that thread."
edges channel unsubscribe support
```

`list` shows channels belonging to the Agent's Teams and whether this exact Agent birth
is subscribed. Reading and posting require a subscription; posting additionally requires
**Can reply**. `unsubscribe` can remove the calling Agent's own subscription, while only
the owner can grant or change access.

`read` returns up to 100 unread messages and acknowledges that batch after printing it.
Each Agent has its own cursor. Reading does not imply accepting or completing a task.
Only explicit `post` calls publish to Slack; terminal output is not mirrored. Several
Agents may read a request, so assign responsibility to avoid duplicate answers.

The owner's Channels composer also publishes to the connected Slack conversation.
Use its reply selector to continue an existing external thread.

Channel commands normally resolve the Agent automatically from the projected `edges`
command path. If a development command must provide identity explicitly, use the internal
session name shown by Ronin, including underscores—for example `test_agent_2`, not the
display label `Test Agent 2` and not a guessed `test-agent`:

```bash
RONIN_URL= \
RONIN_SOCKET=/absolute/path/to/checkout/.ronin-dev/run/operator.sock \
RONIN_SESSION=test_agent_2 \
edges channel read support
```

## Recovery and lifecycle

Queued outbound messages survive restart. Slack rate limits are retried automatically.
Definite failures remain visible with **Retry delivery** and **Dismiss outbound delivery**.
If a request may already have reached Slack, its state is **uncertain**: check Slack
before retrying, because a second copy is possible.

**Archive channel** pauses delivery and rejects new posts; restoring resumes queued work.
Slack messages received while archived are ignored. **Disconnect Slack** removes the
external binding, preserving messages and subscriptions. Resolve pending outbound work
first. Dismissing outbound delivery preserves the local message.

When a session is replaced, explicitly subscribe the new session, even if its name is
unchanged. Team membership is checked on read/write and notification dispatch.

## Troubleshooting

| Message or symptom | Meaning and action |
|---|---|
| **Invalid channel ID** | The Ronin ID must be 1–64 lowercase letters, numbers, hyphens, or underscores. Do not paste the Slack `C…`/`G…` ID into the creation form. |
| **Slack: `invalid_arguments`** | Confirm the destination is a real Slack channel ID from its URL, not its name. The connector uses the configured workspace; reconnect after correcting the ID. |
| **Invite the Slack bot to that channel first** | Add the installed Ronin app to the Slack channel, then connect again. Private channels always require an invitation. |
| **Use a channel ID from the configured Slack workspace** | The ID has the wrong form or belongs to a different workspace/app installation. Check the workspace badge and Slack URL. |
| **Cannot resolve a live Agent session** | Run the projected `edges` command from the Agent tile. Remove a stale `RONIN_SESSION`; for an explicit development command use the exact internal name, such as `test_agent_2`. |
| **Owner must subscribe this Agent…** | In **Agent access**, select that exact live Agent, choose permissions, and press **Save subscription**. A replacement Agent needs a new subscription. |
| Socket says nobody is listening | Confirm `npm run dev` printed the configured `RONIN_DEV_SOCKET`, and restart the development server after changing `.env`. Do not split the socket path across lines. |
| Socket access denied (`EPERM`/`EACCES`) | Approve access for the command or adjust the Agent sandbox. Do not weaken the 0600 socket permissions. |
| Slack shows disconnected | Check outbound HTTPS/WSS, token validity, app scopes, and whether the credential path points to a mode-0600 JSON file; then restart Ronin. The connector retries automatically. |
| Message is visible but the Agent was not notified | Save the subscription with **Notify** enabled. A quiet subscriber must poll with `edges channel read`; old notices are not regenerated. |
| Reply is not in Slack | Confirm **Can reply** is saved, the channel is Slack linked, and the Agent used `edges channel post`. Terminal prose is private. Inspect the delivery badge for failed or uncertain state. |

## Current limits and verification

- One Slack workspace/app per operator; multiple channels in that workspace.
- One external binding per Ronin channel. No implicit Slack-to-Telegram forwarding.
- New human messages, thread replies, and attachment links are supported. File downloads,
  uploads, edits, deletions, reactions, DMs, and bot-originated messages are not mirrored.
- Messages sent while the operator is disconnected are not backfilled through history.
  Slack may retry events, but this is not a guarantee of gap-free offline history.
- Channels retain up to 10,000 messages; reaching that limit requires archiving and
  creating another channel. The owner view shows the most recent 100; Agent reads page
  through unread messages in batches of 100. Messages are not silently reaped.
- Session notices use the existing Messages delivery policy, including its two-minute
  preflight override. Disable notifications for Agents that should only poll.

Automated integration test:

```bash
node --import tsx --test tests/channels.test.ts tests/cli-http.test.ts
```

Explicit browser diagnostic (requires Playwright and Chromium installed):

```bash
node --import tsx scripts/channels-ui.mjs
```

Both use local Slack HTTP/WebSocket fixtures, temporary stores, and simulated session
identities; they do not contact Slack or control live tmux sessions. The CLI test runs
the real Agent command client. They cannot establish that your Slack installation is
configured correctly or that an LLM will obey an assignment.

For live acceptance, perform the six UI steps above in TeamSkip, confirm two subscribed
Agents each see the message independently, have one Agent post a threaded reply, and
verify it appears once in the Slack channel. Verify a non-subscriber is not notified.
See [architecture and adapter extension](../architecture/channels.md).
