# Session
- **label:** Session
- **blurb:** How do I inspect or change an Agent's existence, and end my own safely?
- **class:** cowork
- **requires:** —
- **order:** 30

Reach for the session tools when the question is about an Agent's existence rather than its work: is a name live, change a session's Team or lead designation, fork a visible Ronin Agent, archive and restore, or end yourself safely. **Fork it** and **new session** always mean this visible-session path, never your CLI's internal sub-agent; **spawn it** means the internal sub-agent.

**Live tools:** every command in the table below ships in `ronin_bin/`.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `session_check` | read: one live session by exact name; `NO-SESSION` for an unused name | priority | `session_check --help` |
| `session_fork` | create: one context-inheriting visible Agent | priority | `session_fork --help` |
| `session_set` | write: an existing session's Team membership, lead designation, or project root | | `session_set --help` |
| `session_archive` | write: make one session resumable and leave desk custody unchanged | | `session_archive --help` |
| `session_restore` | create: restore one archived session | | `session_restore --help` |
| `session_end` | end: preflight custody and end this Agent only when safe | | `session_end --help` |

Creating a supporting Agent is the designated lead's authority and is taught by the Team
lead bundle; it is not a universal tool.

## Lifecycle boundaries

- **Fork** is the context-inheriting common path: write or link the handoff and project
  context first (the judgment lives in your work record and the Worktrees page), then the
  mechanical birth goes through the canonical launch route and reports `BORN` or `REFUSED`.
- **End** runs the custody preflight and ends this Agent only after every assigned desk is
  safe; nothing is discarded. **Archive** is distinct: it keeps the session resumable and
  leaves desk custody unchanged; **restore** brings one back.
