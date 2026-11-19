# Writing a Workspace's Summary
- **for:** a Workspace whose doc has no Summary yet; one fresh Agent per Workspace
- **order:** 30

You were started to write one Workspace's Summary (its handle is this epic's last line), so other
Agents know what it is. Started for each Workspace that `workspace-doc list` shows with no summary
yet: `session_create <name>`, then `epic-template start assess-workspace --to <name> --workspace <handle>`.
The tasks are this epic's children; match each by its title, and work them in order.
Rules:
- Read; don't change their project. Nothing is moved, renamed, installed or committed.
- Done with a task: `item comment` on it "Done: <what>", then `item transition` it to "Done".

## Read the Workspace
Do: know what the Workspace is for and what is in each of its repositories and folders.
Details: `workspace-doc read <handle>` (its objective, each repository and folder with its directory, its doc); each one's README, docs and build files. A few minutes, not an audit.
Check: you can say in a line what each repository and folder is.

## Write its Summary
Do: write the Summary: a few plain lines on what the Workspace is for, then one line per repository and folder saying what it is.
Details: `workspace-doc summary <handle> -` with the text on stdin (`workspace-doc --help`).
Check: `workspace-doc list` shows it under the handle.

## End
Do: close this epic, then end yourself.
Details: `item transition` this epic to "Done"; then `session_end` (it archives you).
Check: you are gone.
