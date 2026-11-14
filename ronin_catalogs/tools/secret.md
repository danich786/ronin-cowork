# Secret
- **seed:** How do I get a password or key from the owner without it passing through chat?
- **when:**
- **depth:** seed
- **serves:** integrations
- **order:** 85

Reach for this when work needs a password, token or key. Ask for it with `secret ask`: a
paste field opens on your tile, the owner pastes it, and you hear only `saved` or
`cancelled`. Use it by its file, never its value: `secret path <name>` gives the file to pass
as `--password-file` or to read inside your own script. Never print it, echo it, or put it on
a command line, in a reply, a log or a commit. A secret can carry an expiry: a date, or never. The owner
picks it beside the value, or you record it later with
`secret expires <name> <YYYY-MM-DD|<N>d|never|clear>`; `secret ls` shows it.
