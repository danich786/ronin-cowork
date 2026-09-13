# Ronin Host
- **label:** Ronin Host
- **blurb:** How do I inspect or operate the machine underneath Ronin?
- **class:** feature
- **requires:** behaviour:ronin_host
- **order:** 70

Reach for this bundle when work concerns the host itself: measured machine facts, account
state, secret presence, a Ronin restart, or host maintenance. Machine and Campaign
configuration belongs to Machine settings; Host authority does not grant that settings
authority and settings authority does not grant Host operations.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `tejun-survey` | read: measured machine facts | priority | `tejun-survey --help` |
| `tejun-account` | read: secret-free account state | | `tejun-account --help` |
| `tejun-secrets` | read: secret presence, never values | | `tejun-secrets --help` |
| `tejun-machine-restart` | write: restart Ronin through its guarded operation | | `tejun-machine-restart --help` |

Measurements are observations, not Machine Settings fields. Never turn an observed fact
into a configuration write, and never print credential values.
