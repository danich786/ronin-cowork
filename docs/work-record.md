# Keep a useful work record

The work record is the owner's durable account of what an Agent is trying to achieve,
where the work stands, and which working materials belong to it. It follows the session
even when its terminal is not in view. A reader should be able to answer these questions
without asking the Agent:

- What outcome is this session responsible for?
- What is it doing now, what is finished, and what is expected next?
- Has work genuinely stopped for an outside decision or action?
- Which documents and repository checkouts are in use?

This is a communication record, not an activity log, a speculative project plan, or an
SOP. Keep it short enough to scan and true enough to steer by.

## One record, two sides

Internally, Ronin calls the saved source **TEGAMI** and its tile presentation **SHINGO**.
Agents may encounter those names in code and builder contracts. They are not two records:
the source holds the facts, and the presentation turns its ladder and current position
into the chip and expandable view on the tile.

With an ordinary user, call both of them the **work record**. Say “I updated my work
record” or “open the work record on my tile,” not “TEGAMI,” “SHINGO,” or “ladder” unless
the user is discussing the implementation itself.

Read your source with `read_tegami`. Change it through `write_tegami`; do not find or edit
its backing file. `write_tegami --help` is the current command reference.

## Build the ladder from the objective

Start with one sentence that describes the deliverable and its important boundary. Prefer
an outcome that can become true over a restatement of the activity:

> Add an indexed work-record guide, verify the documentation change, and hand it in.

For planning purposes, think of one Agent's work record as one deliverable card. Its ladder
is the Agent's local checklist, not a shared board schema:

| Work-record part | Kanban meaning |
|---|---|
| The whole record | One card: the deliverable owned by this Agent |
| Objective | The card's outcome |
| Phase rung | A flexible Agent-local section of work |
| Legs under a phase | Outcomes or checklist items within that local section |
| Active position | Where the Agent is working in its detailed local ladder |
| Tracked materials and reported receipts | Evidence attached to the card |
| Gate | A required outside act before the card may transition |

Labels such as team, type, priority, risk, or blocked describe the card; they are not
workflow states. The work record does not have to reproduce a board's labels or custom
fields to preserve that distinction.

Derive the ladder in three passes:

1. Name the few **phases** that organize the Agent's route from the current situation to
   done. Use titles that fit the work, such as “Reconcile the contracts,” “Draft the guide,”
   or “Verify and deliver.” Do not use phases for teams, priorities, risk labels, or vague
   periods such as “Later.”
2. Under the phase you can see, add **legs** for its observable exit criteria or checklist
   outcomes. “Guide covers gates and revision” is useful; “Work on docs” is not. A phase
   with no legs is honest when its exit criteria are not knowable yet.
3. Stop planning where knowledge stops. Add later legs when investigation makes them real.
   An undetermined future rung is omitted rather than guessed.

A leg should normally fit one meaningful work interval and end in a result another reader
can recognize. Split it when it hides distinct outcomes, decisions, owners, or verification.
Combine it when separate entries would merely narrate keystrokes. The right granularity is
the smallest set of steps that helps the owner understand and steer the work.

A product task might use local phases that resemble a familiar workflow:

```text
Inbox → Shaping → Ready → Building → Code review → Show / preview
      → Product approval → Mainlining → Finished
```

Use only the states the objective will actually cross. “Ready” means the acceptance criteria
are clear; “Building” means active work exists; “Code review” requires a commit and test evidence;
“Show / preview” requires the exact preview under consideration; “Mainlining” covers integration
and its verification; and “Finished” means the result has landed and cleanup is complete.
These facts are exit criteria and evidence, not more workflow states. For smaller work, three
phases may communicate the same flow better than nine.

These names remain local descriptions, not stable external states. The work record is not a
formal state machine. Ronin does not enforce entry and exit rules for its phases; the Agent's
judgment and the applicable work contract do. When reality sends work backward—for example,
review rejects a change—revise or reactivate the relevant build work instead of pretending the
review passed. Keep work in progress narrow: finish or revise the active item before accumulating
partially active legs across the ladder.

Useful editing forms are:

```text
write_tegami --objective "<one-sentence outcome>"
write_tegami --phase "<phase title>" --leg N "<first leg>"
write_tegami --leg N "<another leg>"
write_tegami --rung N "<new title>" --leg N.M "<new title>"
```

`read_tegami --rungs` shows the current position numbers. Gates occupy rung numbers too,
so read the current numbering instead of assuming that phase 2 is always rung 2.

## Status and active position

Statuses mean exactly this:

- `PLANNED`: expected work that has not started.
- `ACTIVE`: the one gate or leg being worked now.
- `DONE`: an outcome actually reached, not merely attempted.

Maintain exactly one `ACTIVE` item while work is underway. Before activating the next leg,
finish, revise, or return the previous one to `PLANNED`. Never mark work done to make the
record look tidy, and never leave an earlier step active while working somewhere else.

The position marker and the active status are related but distinct implementation facts.
The marker may be maintained by Ronin or a team lead; the Agent maintains truthful statuses.
After changing the ladder's shape, re-read it because Ronin clears a position that could
now point at the wrong item. If you temporarily step outside the ladder, use
`write_tegami --on_tangent`, then `--on_track` when you return. A tangent is not permission
to let the ladder go stale.

Typical transitions are:

```text
write_tegami --done 2.1 --active 2.2
write_tegami --status 2.2 PLANNED --active 1
```

The second example is appropriate only when rung 1 is a real gate.

## Gates are genuine stops

A gate is a rung kind, not a fourth status and not a label for difficulty. Add one only
when the work cannot responsibly continue until a specific outside person or event supplies
a decision, approval, credential, artifact, authority, or other necessary action. A good
gate names the actor, the required action, and the reason no safe in-scope route can continue:

> Owner decides whether the public guide may name the experimental feature; publishing
> either version before that decision could disclose a feature the owner has not made public.

Sit at that gate by making it `ACTIVE`. When the needed event occurs, mark the gate `DONE`
and activate the work that follows.

Ordinary uncertainty is not a gate. Investigate it. A failing test, an unfamiliar code path,
a recoverable tool error, or a blocker with another safe route is not a gate while useful
in-scope work can continue. Report material problems in the normal conversation and revise
the ladder if they change the plan.

Likewise, **blocked** is normally a condition on the current work, not a workflow phase or a
gate of its own. Keep the affected work in its truthful phase, report the blocker with evidence,
and pursue another safe route when one exists. Create a gate only when resolving the condition
requires the named outside act and there is no safe in-scope progress left.

An approval is a gate only when policy, authority, risk, or the owner's explicit instruction
requires the Agent to stop for it. A notification is not an approval: tell the owner and keep
working when no decision is required. Do not invent review gates, “check-in” gates, or owner
decisions merely to make a plan look controlled. Conversely, do not hide a real owner choice
inside a work leg and continue by guessing. The question is whether safe progress must stop,
not whether the owner would appreciate visibility.

Review, preview, and mainlining are ordinary workflow phases. “Product approval” is also an
ordinary phase while the Agent is preparing evidence or a preview; it becomes a gate only when
the exact candidate is ready and work is now waiting for the owner's experiential or visual
decision. The repository and tracked-document fields identify working materials. Commit SHAs,
test receipts, preview URLs, reviews, and approvals are supporting evidence: report or keep them
in the relevant tracked document or conversation. The ladder should summarize the state and its
exit criteria rather than duplicate an evidence log.

Add a genuine stop with:

```text
write_tegami --gate "<the concrete outside action you are waiting for>"
```

## Revise the record when reality changes

The ladder is a current account, not a promise to preserve the first forecast.

- Retitle a phase or leg when its outcome becomes clearer.
- Add newly discovered work when it becomes concrete.
- Drop planned work that is obsolete or outside the objective.
- Replace a mistaken route with the route now being taken.
- Preserve completed facts that still explain the delivered result; do not rewrite history
  to imply that abandoned work succeeded.

Use `write_tegami --drop N[.M]` for an obsolete rung or leg. For a substantial reordering,
read the record, prepare the complete authored block carefully, and pass it to
`write_tegami`; the same shape validation applies. After any structural edit, re-read the
result and set the one active item that reflects reality.

## Track documents and repositories

List a working document as soon as you create or adopt it:

```text
write_tegami --doc docs/work-record.md
write_tegami --undoc docs/retired-draft.md
```

The listed path is what lets the owner open the document from the session's Docs surface.
Remove a document when it is deleted, renamed, handed off, or no longer part of the work.
Use these commands rather than editing the record's stored doc data; Ronin preserves and
maintains that field across other record updates.

Keep one repository entry for every checkout the session is actively using, including its
current branch. A managed desk also carries its worktree and team-line coordinates so the
owner can distinguish the live private checkout from supporting Git detail. Add or remove
entries as the work crosses repositories:

```text
write_tegami --repo ronin_cowork:team/example/guide
write_tegami --unrepo ronin_services:team/example/guide
```

Repository entries describe where the work is; they do not replace the repository's commit,
hand-in, or verification contract.

## Good and bad ladders

A useful ladder treats the record as one deliverable moving through the smallest useful workflow.
Its legs say what becomes true as the deliverable progresses:

```text
Objective: Publish an indexed guide that reconciles the existing work-record contracts.

Shaping
  DONE    Required contracts reconciled
  DONE    Outline and contradictions accepted
Building
  ACTIVE  Canonical guidance covers every acceptance criterion
  PLANNED Guide is linked from the documentation index
Review
  PLANNED Documentation checks and repository verification pass
  PLANNED Exact commit and hand-in receipt are reported
```

This ladder is poor:

```text
Objective: Work on docs.

Team A
  DONE    Think about it
High priority
  ACTIVE  Do the work
[GATE] Owner approval
Blocked
  PLANNED Fix anything
  PLANNED Finish everything
```

Its objective has no deliverable, its legs reveal no result, its gate invents an approval
without a stopping reason, and its rungs mix owner, priority, and blocked labels into workflow
states. Its future claims also pretend to know work that has not been discovered. “Do the work”
is too large to show useful movement.

## Maintenance rhythm

Keep the record current at five moments:

1. **Start:** set the objective, visible phases, first concrete legs, and the active item.
2. **Change:** revise it immediately when scope, route, repository, or working documents change.
3. **Stop:** add an active gate only for a genuine outside dependency that halts progress.
4. **Turn:** at the end of each turn, check that status and position still describe now.
5. **Finish:** mark achieved work done, remove stale docs and repositories, and leave the
   record matching what was actually delivered.

Use `read_tegami` for the final truth check. A short current record is better than a complete-looking
record that the owner cannot trust.
