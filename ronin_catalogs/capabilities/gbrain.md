# gbrain
- **label:** gbrain
- **blurb:** How do I use the selected gbrain capability without inventing a second memory system?
- **class:** feature
- **requires:** behaviour:gbrain
- **order:** 90

Reach for this bundle only when the launch resolver selected the gbrain behaviour. Project
facts still belong in the Work Record; the capability does not create a second project
record or make credentials visible.

## Tools

| Tool | Authority | Teach | Help |
|---|---|---|---|
| `tejun-recall` | read: project-scoped memories | priority | `tejun-recall --help` |
| `tejun-remember` | write: one project-scoped memory | | `tejun-remember --help` |

These are the only gbrain operations delivered to the Agent. They preserve the selected
project scope and never expose service credentials.
