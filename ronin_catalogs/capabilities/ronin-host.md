# Ronin Host
- **label:** Ronin Host
- **blurb:** How do I inspect or operate the machine underneath Ronin?
- **class:** feature
- **requires:** —
- **order:** 70

Reach for this bundle for measured machine facts, account state, secret presence, restart,
or maintenance. Machine configuration belongs to Machine settings; neither authority grants the other.

**Live tool:** `ronin-host --help` renders its fixed inspect, account, secrets, and restart subcommands.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `ronin-host` | inspect/account/secrets: read; restart: guarded write | priority | `ronin-host --help` |

Measurements are observations, not settings fields. Never write them or print credential values.
