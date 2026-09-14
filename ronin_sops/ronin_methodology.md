# ronin_methodology — Ronin's method of development

> Stock SOP. Your own copy in the sops store (`ronin-store sops` →
> `ronin_methodology.md`) replaces this file whole — a default, not law.
> **Voice: agent.** How a session itself operates: a common methodology to use in the
> absence of other instruction, and the process to name when the owner asks how the
> work is being run.

Ronin sessions are disposable; the work is not. The method is to give every active piece
of work a small set of shared artifacts that Claude, Codex, or another agent can enter and
leave without asking one provider to imitate another.

Each stage below names the shared record or capability involved. Selected capability
documents teach the concrete tools; this method keeps the durable cross-session choices
without duplicating executable instructions.

A capability bundle is a knowledge layer, not an authority layer. Bundle selection changes
what the Build Brief teaches and emphasizes; it never grants, withholds, authorizes, or
forbids an installed tool or its `--help`.

## The lifecycle

### 1. Open the session in public

Set the ladder with `work-record update_record`: one objective in the owner's words, a
short ladder, one active rung, and the session job. Keep it current whenever the active
rung or shape changes, and list every live document with `work-record document add` so the
owner can open it without asking for a path. `work-record read` returns the visible status;
the work record is not the plan, a transcript, or a second build-out document.

A gate is how you ask for the owner. Put one wherever the work genuinely stops and needs a
person, and wait at it — that is the mechanism, and it is better than a question in prose
that scrolls away.

### 2. Give unfinished thinking one mortal document

A mandate of reach `plan` produces a document the owner can read and edit, and then
waits — no code is cut from it until they have been through it. The `buildout` behaviour
says how the house writes one. Iteration lives in `wip/`:
normally `wip/buildouts/<topic>.md`, or `wip/handoffs/<topic>.md` when another session
needs the context. A build-out holds the goal, remaining legs, constraints, verification
and definition of done. It is where the owner and agents riff on the work before and
during implementation.

Do not turn it into history. Remove completed items as they land, and do not preserve a
"done" section. Git records what changed; the working document says only what remains.
The exact document contract lives in `ronin_library/documents.md`.

### 3. Coordinate through shared edges

**Visible delegation — give the work its own session.** “Fork”, “fork it”, “launch”, and
“new session” all mean the universal `session_create` command: a **Ronin session** on the
roster, with its own tile, ladder, and life, addressable by name after this conversation
ends. “Spawn” alone means a CLI-internal sub-agent, invisible to the coworkspace and ending
with its answer; explicitly ask the owner for permission before spawning it.

`session_create <name> --prompt` carries the visible session's explicit purpose. The
newborn receives resolved Campaign/Team context—not this conversation—reads its own birth
packet, and leaves the caller unchanged. The command has no dial option.

**`edges send` — one message to one session.** `edges send` carries the rules: the dial on
the **target** governs, not yours; a refusal is an answer, never retried and never worked
around; a person's unsent draft is never typed over; and the message opens by saying who
it is from, or the other end answers the wrong person. It is one message and not a
conversation — the reply lands in that session's own tile, where the owner reads it.
Relaying it back through here makes this session a switchboard and hides which agent
said what.

**`edges wipeboard` — the group's shared thread.** Use it when several sessions are working one
problem and the record should be common rather than routed through the owner.
`edges wipeboard post` is append-only: read before posting so you answer what is there, never
rewrite another agent's words, never edit the Brief, and never enrol anyone — membership
is the owner's hand. A post notifies every other member, so it is heard rather than waited
on — which is exactly why you never post merely to acknowledge. Five "got it"s is how a
board turns into noise. A notice arriving in your own pane is the board speaking, not the
owner. When you need one particular session to *act*, use `edges send`.

**`edges read` — catching up on another session.** Read its **transcript**, not
its pane. A pane is a window: it shows whatever happens to be on screen at the moment you
looked, so an agent polling one is watching, not reading, and everything that scrolled is
simply gone. The transcript is the record, and you take as much of it as the question
needs. `work-record read --session <name>` answers the other question—where that session
is on its ladder, in its own words. `edges read` follows the target's Control value, and
an Agent never changes that value to obtain a different result.

The dial is checked before any of this, and it is checked on the session you are reaching
for. The work record answers *where that session is*; its transcript answers *what it has been
doing*; the build-out answers *what remains*; the wipeboard answers *what the group just
learned*.

### 4. Commit privately, hand in deliberately, let the lead promote

Under the reviewed arrangement (declared in each repository's `RONIN_REPO`),
Ronin's product repositories use:

```text
team/<team>/<session>   your desk — a private branch and its worktree, one per repo you change
team/<team>/dev         the team's line — a funnel point: handed in to, never edited
dev                     the repository-wide pool, and the live app — moves by team promotion
master                  reviewed/released line — moves by PR from dev
```

Three scopes, kept distinct. **Commit** preserves: a checkpoint on your desk, as often as
coherent, partial ones included; nothing propagates and no gate runs. **Hand-in**
publishes: `worktree-desk hand-in` admits your committed range to the team line by mechanical
admission (merge, conflict check, near-instant invariants) — a conflict is contained in a
candidate, the line is untouched, and the lead adjudicates. **Team promotion** is the
lead's or compiler's act: the team line admitted to `dev` on a candidate that passed the
first full repository BYOIN, with a receipt for the exact SHA; `dev` restarts. The second
full BYOIN runs at `dev → master`; neither runs at a commit or hand-in
(`docs/test-protocols.md`).

A mandate of reach `execute` builds from the agreed build-out, deleting each item from
the doc as it lands. Where the work lands follows the Workspace Folder's arrangement: in a
worktree root (`ronin_sops/worktree-root.md`) the session works at its desk and *offers* a
hand-in at each DONE leg — the session decides when its work is coherent for the team,
and a tool never decides that for it; in a checkout (`ronin_sops/checkout.md`) it commits
to the repository's declared line and invents no desk state. Neither opens a pull request.

#### Visual staging: one disposable Team preview

Visual work may take a provisional lane before ordinary hand-in: the Agent offers exact
commits as candidates, the lead composes and serves one disposable preview, and approval
changes no Git line. The procedure is `ronin_sops/visual_staging.md`; the `visual_staging`
behaviour gives it to an Agent, whose first act is to tell the Team and the lead to read it.

Accepted state reaches a desk when its Agent chooses `worktree-desk sync`, which merges
current local `dev`. Status reports the distance; 20 commits behind is a notice, not a
block. Read pending and overlap notices before you go on.

The final review is one pull request from `dev` to the stable line, opened by the release
process with the promotion receipt, never by an ordinary session, and never merged by an
agent. A Ronin repository under the direct arrangement instead publishes to its declared
`main` or `master`: no desk, no ordinary PR, and published history is not rewritten.

### 5. Land the state, then retire the session

Finishing the work of a session, before it ends, leaves no essential knowledge in a pane
or in `wip/`:

- delete the work's build-out and handoff documents, and remove them with
  `work-record document remove`;
- write or update a state-as-is page in `docs/`, or the README beside the thing, saying
  what exists and how it works now;
- add the single manifest pointer when the project uses a manifest — one line, an index
  entry and not a history;
- close every finished desk explicitly after `worktree-desk hand-in --assignment`; hand-in
  does not close one, and the live session stays ready at the project root for later work;
  under direct publishing, use ordinary Git instead;
- report the paths, what was handed in, what was closed, and the manifest line **before**
  `harakiri`, not after.

The standing document is not a retrospective. Decisions that still constrain the system
belong there; conversation, abandoned options and a chronology do not. A scratch session
that produced nothing worth retaining may simply be deleted, but a session with an
artifact, finding, uncommitted change or commit not yet handed in must land instead.

## The provider boundary

Ronin owns the shared edges, not the agent's mind. Claude continues to follow the
repository's `CLAUDE.md` and `CLAUDE.local.md`; Codex continues to follow `AGENTS.md`, its
active plan, skills and native session conventions. Other providers keep their own
equivalents. Provider-native context, planning and delegation may help that session
execute, and none of it is Ronin's to redesign — but none of it replaces the cross-session
record above, because none of it is visible to anyone outside that session.

When the two layers overlap:

- repository instructions and the owner's current direction govern the implementation;
- an ordinary request to delegate or plan may use the provider's native capability;
- durable project truth goes to code, `docs/`, README, or the Work Record's project
  read/write tools; it does not belong only in a provider transcript.

This keeps the protocol common without flattening Claude into Codex or Codex into Claude:
each may reason in its own way, while either can recover the work from the same files,
branches and session surfaces.
