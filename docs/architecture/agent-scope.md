# An Agent's temp and processes

Everything an Agent writes to temp and every process it starts are its own. They live on disk
under its session and in its own process group, and they go when it ends. This holds for every
Agent and every provider, and for plain shells too, because each one is born through
`createSession` (`src/tmux.ts`) and `processLaunch` (`src/launch-binding.ts`). The code is in
`src/agent-scope.ts` (w624).

For contributors. For what an operator sees, read [tmux server](../operating/tmux-server.md#each-agents-processes-and-temp).

## Why

On a 16 GB box, `/tmp` is tmpfs, so it sits in RAM. It held 4.9 GB, much of it rigs left by
Agents that had already ended. Processes started by ended Agents (test servers, copyparty, a
52-day-old test tmux server) ran on with ppid 1, and swap filled. That is how one Agent's test
took the box down (15 Nov 2026).

## Temp

At launch the Agent's environment gets `TMPDIR` and `CLAUDE_CODE_TMPDIR`, both pointing at
`<session store>/<key>/tmp`. Node, Rust (Codex) and most tools read `TMPDIR`. Claude Code puts
its scratchpad under `CLAUDE_CODE_TMPDIR`/`claude-<uid>/`. A launch's own `env` still wins.

The folder goes when the session folder goes: [retention](session-archive.md#retention-of-closed-session-folders),
Hard Delete, or [archive expiry](session-archive.md#expiry). An archive keeps it, along with
the rest of the folder.

A unix socket path is at most 108 bytes, and tools append to the temp root (`tmux-<uid>/default`,
`claude-<uid>/…`). So a root longer than `TEMP_ROOT_MAX` (72) is replaced by a short one,
`<data root>/tmp/<sha256(key)[:16]>`, and `<session folder>/tmp` links to it. The start sweep
removes any short root whose session folder is gone.

`TMUX_TMPDIR` is never set: the Agent's own `tmux` calls must still reach the live server.

## One process group per Agent

tmux starts every pane in its own systemd user scope, `tmux-spawn-<uuid>.scope`. The scope's
Description reads `tmux child pane <pane pid> launched by process <server pid>`. A child stays
in its scope however it detaches (`setsid`, `nohup`, double fork, ppid 1). So the scope is the
Agent's process group, and Ronin acts on it by cgroup, never by a name pattern.

- **At launch** `ownScope` reads the pane's cgroup. It records the scope as `@ronin-scope` on
  the session and as `scope` in the session folder, sets the memory ceiling, and adds
  `pane-died` and `pane-exited` hooks that run `systemctl --user stop --no-block -- <scope>`.
  So a pane whose CLI exits on its own takes its children with it.
- **At every kill**, `killSession` is the single path for `session_end`, archive, Delete, Hard
  Delete and restore rollback. It reads the session's scopes, kills the session, then stops
  those scopes. The stop also takes the panes of any tmux server running inside them: a rig an
  Agent started is the Agent's (`withNested`). Viewers (`grid_*`) are skipped, because they
  share the base session's pane.
- **Never stopped:** the scope of a live pane (which protects grouped sessions), and the scope
  holding this Ronin process. `tmux-server.service` and `ronin.service` are services, not pane
  scopes, so they are never candidates.

## Memory ceiling

`memoryCeiling()` sets these limits from the box's RAM (`os.totalmem()`):

| Property | Value | 16 GB box | 4 GB box |
|---|---|---|---|
| `MemoryMax` | a fifth of RAM, never under 1 GiB | 3.2G | 1G |
| `MemoryHigh` | 85% of MemoryMax: reclaim and throttle start here | 2.7G | 0.85G |
| `MemorySwapMax` | a quarter of MemoryMax, so one Agent cannot fill swap | 0.8G | 0.25G |

They are set with `systemctl --user set-property --runtime`, so they last for the scope's
life. A runaway is OOM-killed inside its own scope, not anywhere else on the box. These
numbers come from measurements on the 16 GB box: an Agent's scope peaked at 2–3 GB counting
page cache, which `MemoryHigh` reclaims first. Its own memory stayed well under 1 GB.

## The start sweep

`sweepLeftovers` runs once at service start (`src/index.ts`) and logs `[scope] …` lines saying
what it stopped and removed. It stops:

1. Scopes whose Description names **this Ronin's tmux server** and whose pane is not live.
2. Scopes recorded in a session folder (`scope`) whose pane is not live. This covers scopes
   left from before a tmux server restart.
3. The panes of tmux servers running inside either of those (`withNested`).

It never stops a scope from a tmux server Ronin did not start. That server belongs to the
user, whether or not it is still running. The sweep runs only when Ronin is a systemd service.
A Ronin started from an Agent's pane (a rig, a test) never sweeps, so a rig cannot reach the
box's Agents. Without systemd, or off Linux, every step does nothing.

## Proof

The proof scripts used for w624 run on an isolated tmux socket with temp `RONIN_*_ROOT`s. A
fake Agent writes 8 MB to temp, starts a `setsid` child, and starts a rig tmux server whose
pane starts one more.

- **Old code:** temp lands in `/tmp` and stays. Both children outlive the Agent's end.
- **New code:** temp is in the session folder, the scope carries the ceiling, both children
  are gone at the end, and temp goes with the folder in the retention sweep.
- **The start sweep** stops the old code's two leftover scopes.
- **A pane that exits on its own** takes its child with it.

The unit floor for this is `tests/agent-scope.test.ts`.
