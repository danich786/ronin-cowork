# epic-template
- **seed:** list the epic templates and start one: its epic and tasks, given to an Agent to walk through
- **when:**
- **depth:** seed
- **serves:** project-management
- **order:** 42

## Usage

`epic-template list` names each template; `epic-template start <name> [--to <agent> | --new <agent>] [--workspace <w>]` makes its epic and tasks, held by that Agent (you, unless named; `--new` makes one with session_create), and tells it to walk the epic through. Taught by `ronin-help epic-templates`; `epic-template --help`.
