# Machine settings
- **label:** Machine settings
- **blurb:** How do I read or change Campaign defaults, installation choices, providers, and Workspace Folders?
- **class:** cowork
- **requires:** campaign
- **order:** 50

Reach for the settings tool when the owner asks what this box has, what the Campaign has switched on, what a new Team starts from, which providers and models exist, or which Workspace Folders Ronin may work in — and when they ask you to change one of those. It is independent of Ronin Host: the host's own operations (survey, accounts, secrets, restart) are the Host bundle's, not these.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `machine-settings read` | read: one composed, secret-free answer | priority | `machine-settings --help` |
| `machine-settings campaign read` | read: the selected Campaign | priority | `machine-settings --help` |
| `machine-settings defaults read` | read: what a new Team starts from | priority | `machine-settings --help` |
| `machine-settings project-root list` | read: the Workspace Folders | priority | `machine-settings --help` |
| `machine-settings campaign write` | write: title, description, archive | | `machine-settings --help` |
| `machine-settings installations` | read/write: the catalog, proven state, and the Campaign's switches | | `machine-settings --help` |
| `machine-settings defaults write` | write: the typed default fields | | `machine-settings --help` |
| `machine-settings project-root` | read/write/create: named fields, archive, exclude | | `machine-settings --help` |
| `machine-settings provider` | read/write: providers and the default model | | `machine-settings --help` |
| `machine-settings machine` | read/write: name, location, monitor | | `machine-settings --help` |
| `machine-settings owner` | read/write: display name only | | `machine-settings --help` |
| `machine-settings session-defaults` | read/write: session maximum, desk profile, Mika level | | `machine-settings --help` |
| `machine-settings messages` | read/write: delivery timeout | | `machine-settings --help` |
| `machine-settings requirements` | read/write: wanted choices; needed is read-only | | `machine-settings --help` |

Bare `read` is the priority: one composed, secret-free answer that keeps four states
visibly apart — **catalogued** (definitions Ronin knows), **installed** (what a runtime
authority can prove present, loaded, parked, or activated; `unknown` where nothing
measures it, never "not installed"), **Campaign on/off** (the selected Campaign's switches),
and **defaults for new Teams** (what prefills the next form and never rewrites an existing
Team).

Every write reuses an existing typed route and its validation; there is no generic patch
door. "Installed" is observed, never set: changing it means running the applicable install,
activation, or restart operation and measuring again. Observed, status, needed, schema, and
measured facts are always read-only.

The selected Campaign is the current session's when `--campaign` is omitted; an ambiguous
or absent Campaign is reported, never guessed. Project-root writes keep the stable ID:
title and directory may change, the ID does not. Archive keeps the catalog entry and removes
it from launch choices; exclude removes only the entry and never deletes a directory or
hosted repository. Creation and repository-profile changes keep their inspection and
explicit confirmation steps.

Available session models are read dynamically from the canonical Campaign/provider model
catalog used by the UI dropdowns. This document carries no model list: installation and
configuration changes must appear without maintaining a second inventory.
`session_create --help` renders the current provider/model choices and defaults from that
same source.
