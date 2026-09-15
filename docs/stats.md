# Stats

Stats is a registered Ronin Services feature. The free build does not collect or submit
these counts. Services registers the local command-count hook only when its entitlement
credential is present; the existing HQ sender also requires that credential.

Stats gives a rough picture of which Ronin tools get used and who uses them. It is a
usage-mix report, not an audit log or a measure of work quality.

The Desk shows a numeric tool-call table. Choose a capability card to display those
same rows in one Mekko. Column width represents calls; colours represent Agent,
User desktop, User mobile, Trello, and System. Trello is restricted to Work record.
System and Trello stay at zero until their integrations explicitly emit counts.
Where the browser has a delete operation with no corresponding command, the table
uses its actual API signature rather than inventing a CLI tool name.

## What is counted

Public Cowork command entry points increment a tiny per-session local tally. No HTTP
request is made for that increment. Nested helpers inherit a marker so one command
does not multiply into several counts. Help requests are skipped. A call is counted
when invoked; it need not succeed. Shell aliases and arbitrary programs outside the
Ronin command entry points are not tracked.

Browser mutations carry desktop/mobile on their existing request. Recognised action
routes increment the same kind of counter in Ronin. Roster polling, terminal input
and output, page views and scrolling are not tool calls. No prompts, arguments, code,
filenames, team names or session names are included in submissions.

## Active days and collection

An active day is a UTC date with at least one counted tool call. Several sessions
working on the same date contribute one active day, not several. The weekly schedule
is merely when to collect; it is not the metric.

On agent close, Ronin collects local tallies and resets them. Otherwise it collects
when roughly seven days have passed. Reading Stats also reads outstanding tallies,
without resetting them. Collection and increment share a brief local file lock.

After a month offline, the next run collects and submits one accumulated batch with
its actual date range and active-day count. It does not invent four weeks of activity
or create empty backfill packets. Counters are deliberately best effort: a broken
counter or abrupt shutdown may lose some counts and must not block the user's work.

## Submission

Ronin Services builds a body-schema-2 batch and places it in the existing outbound
outbox. The existing HQ rail handles entitlement authentication, egress records,
receipts and retries. Pending packets survive downtime. There is no new outbound
service or per-call network stream. Registration linkage comes from the existing
entitlement; registration data is not copied into the packet.

HQ body-schema-2 support was deployed first on 15 September 2026. The counting service
now prepares packets by default. Set `RONIN_TOOL_STATS_SCHEMA2=0` to keep counts local. The old body-schema-1 intake
remains supported. Collection data lives under the resolved telemetry store:
`tool-counters/` for agent tallies, `tool-counts/totals.json` for the collected bucket,
and the existing `outbox/` and `receipts/` directories for submission.

Implementation: `ronin_bin/tool-count.sh`, Services `counting/tool-count.py`,
`src/tool-call-api.ts`, and Services `counting/tool-counts.ts`.
