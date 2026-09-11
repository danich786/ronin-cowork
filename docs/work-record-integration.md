# Future Team work-record integration

> **Status: intended architecture, not current behavior or schema.** The current Agent work
> record is maintained with `read_tegami` and `write_tegami`. No Team work record, external-board
> synchronization, or fields proposed here should be presented as implemented.

This document defines the boundary for a future shared view across lead and Agent work records. It is
a design contract for later implementation work, not an Agent operating procedure. Birth reading,
generated record instructions, tools, macros, and SOPs must not teach these mechanics before they
exist. [The Agent's philosophy of Ronin](agent-philosophy.md) is normative for this design:
**structured by shared vocabulary, not forced through a shared workflow**—the virtual Team Kanban
projects independent Agent-owned records.

## The durable levels

A **Team roster**, keyed by Team, continues to hold the Team's identity, configuration, and
launch defaults. Live members are derived from session Team tags; this design does not add
membership storage to the roster. Mutable workflow does not belong in that record.

The Team lead's work record is a lightweight planning and coordination record in the existing
Team-owned store. Its inbox may hold a small idea card or a large assignment or project. The lead
may shape or decompose that work into recommended objective/assignment cards, obtain owner approval
when useful, and offer assignments to new or existing Agents. A large item may remain one assignment
when decomposition adds no value. This record is
conceptually distinct from roster identity and configuration, and it does not control Agent
execution ladders or require a new durability system.

Ronin provides a small shared vocabulary of recognizable gate and stage types with mechanical
Team-board or external-board mappings. It is interoperability guidance, not an exhaustive enum,
validator, or workflow engine. Each **Agent work record** owns the useful stages and ordered gate
instances for its card. A card uses only what helps its work; small work stays small.

On accepting an assignment, the Agent creates and owns one work card and record, links it back to
the lead's assignment or project as provenance, and takes its objective from that assignment. A
card never shares its execution record with another card, and a record never represents several
cards.
An Agent or persistent session may nevertheless own and actively manage multiple independent
card/record pairs concurrently. Agent identity is not card identity.

Each linked record carries that card's detailed execution: flexible phases and legs, active
position, useful stages and gates, repositories, tracked documents, and evidence. After accepting
an assignment, the Agent builds the simple execution ladder it needs and declares any shared
projection types that help represent it. The Agent advances each card through that plan. When
several records are active, a separate focus pointer may identify
which record the Agent is working on now; changing focus does not close, merge, or reassign the
others. Live Team membership, derived from session Team tags, subscribes an Agent to the Team work
record. Agent ladders are never mechanically merged into one Team ladder.

For a tiny assignment, the useful minimum is an objective, the assignment/provenance link, and a
truthful current item. More phases, gates, checks, and evidence appear only when the work produces
a reason for them.

If several Agents contribute to a larger outcome, each keeps separate cards and work records.
Their cards relate through a stable parent-outcome or grouping reference; they are not collapsed
into one multi-Agent card.

The **Team Kanban** is virtual. It reads the lead record's inbox, projects, and assignment cards
alongside the distributed Agent-owned work cards, then consolidates their current stages or gates,
upcoming gates, owners, outcomes, and concise evidence. An external Trello or Kanban card is an
optional adapter over that view. The linked Agent record remains authoritative for its execution
ladder and declared gates; neither the Team view nor an external platform is the workflow authority.

| Ronin concept | External projection |
|---|---|
| Lead planning record plus linked Agent records | The virtual Team board |
| Lead assignment/project | Card provenance or grouping |
| Agent work record | The one linked card's detailed execution record |
| Current focus | Which of an Agent's active cards is being worked now |
| `projection_state` | The card's workflow list |
| Owner | Card member |
| Team, type, priority, risk, blocked | Labels or card metadata, not workflow states |
| Durable commit, test, preview, and decision evidence | Card evidence or linked artifacts |
| Current meaningful gate | A held card with its required outside act |
| Optional `exit_check` | A lightweight expectation shown at the rung boundary |
| Shared projection type | A recognized, mechanically mapped board list/state |
| Agent-record gate instance | The identity-linked gate shown for that Team card |
| Agent phases and legs | Agent-local detail, not projected board movement |

## Shared projection vocabulary

Agent phase titles remain flexible descriptions of the local execution plan. An adapter must
never infer normalized projected state from text such as “Build,” “Review,” or “Done.” Similar
words can mean different things in different tasks, and renaming a phase is not a Team transition.

When useful, a future card may carry an explicit normalized `projection_state`. Recognizable
intake, stage, and gate names might include:

```text
UNASSIGNED
INBOX
SHAPING
ASSIGNED
READY
BUILDING
CODE_REVIEW
SHOW
PRODUCT_APPROVAL
RELEASE_APPROVAL
MAINLINING
FINISHED
```

These are design examples, not a current field, closed enum, mandatory route, or centrally imposed
ladder. An Agent uses the smallest useful plan: backend-only work may omit visual approval, visual
work may include it, and a tiny task may need almost no projected detail. A supported projection
type needs an explicit board mapping and stated semantics, but an Agent's local wording and extra
detail remain free. Routine legs and internal phase changes do not create cards, change
`projection_state`, or cause external-board churn.

The assigned Agent record owns each selected gate instance and its order. An assignment may
recommend a sequence, but accepting it does not surrender the Agent's plan to the lead. Stable
identity links a declared gate to its projection; an adapter never guesses from phase or gate text.
The Agent may add, revise, or drop local phases and optional gates as reality changes.

### Optional exit checks

A rung may carry one lightweight hint about whether the Agent is expected to consult someone
before leaving it:

```text
exit_check: NONE | TEAM_LEAD | OWNER
```

An absent `exit_check` leaves the choice to the Agent. `NONE` explicitly says no check is expected;
`TEAM_LEAD` and `OWNER` name the person the Agent is expected to check with. The hint belongs to
the exit from the rung, not to the work inside it.

This is supervision guidance, not a gate, approval record, or enforcement mechanism. It records no
response, approval, skipped check, violation, or consequence. If the Agent advances without making
the suggested check, the record simply advances. A real gate remains a separate Agent-owned rung
created only when an applicable work contract identifies an outside act without which work cannot
responsibly continue.

### Flexibility and non-enforcement

Projection sophistication must not become per-Agent ceremony. Cards need not traverse the same
stages, carry the same number of gates, or obey one shared state machine. The vocabulary exists so
independently useful records can be viewed together, not to force those records into identical
shapes. Detail is present only when it helps the work or records a real outside dependency. A
custom or local stage that has no recognized projection keeps its honest name and appears as local
detail or an `OTHER`-style fallback; the adapter does not guess a familiar state.

For a real gate, approval or rejection updates the virtual-board projection and the Agent-owned
gate coherently. The event binds the exact candidate, authorized actor, evidence, prior revisions,
and resulting revisions on both sides. A partial update is a conflict, not success. This does not
apply to an `exit_check`, which records no response. Not every Team state is a gate, and a purely
local investigative hold need not project to the Team card.

### The shared release-check convention

Team work commonly marks its final delivery rung with `exit_check: TEAM_LEAD` or
`exit_check: OWNER`. This makes the expected conversation visible while the rung is current; it
does not record whether the conversation happened or create a release-approval ledger.

Private checkpoint commits are always normal and ungated: a commit preserves work on the private
desk and publishes nothing. The exit check does not perform hand-in or imply that later review
passed.

The work-record, projection, and Tejun layers do not refuse commit or hand-in because an exit check
is absent or ignored. Both pedals remain with the Agent. Hand-in, Team-lead review, and later
promotion/integration verification remain distinct events under the Worktrees Routine. An actual
Git conflict or another operation that cannot safely be performed may still refuse for its own
existing reason and name the next action. Exact-candidate approval and its evidence belong to a
real gate only when a separate work contract actually requires one.

## Team-lead responsibility

The Team lead is responsible for maintaining the lightweight planning record and watching the
virtual Team view. That includes:

- capturing ideas as unassigned cards and shaping their outcomes enough for assignment;
- offering assignments to new or existing Agents and linking accepted Agent-owned cards;
- tracking an Agent's several independent cards and its explicit current focus without merging them;
- watching and accurately projecting the current and upcoming gates, progress, and evidence stated
  by linked Agent records;
- setting or recommending lightweight exit checks where useful without treating them as approval
  records or publication interlocks;
- managing coherent Team/Agent gate decisions against exact candidates and authorized actors; and
- resolving version, assignment, evidence, and transition conflicts without erasing an Agent's
  detailed source record.

These duties are not current tool behavior. After the mechanics exist, a Team-lead routine or SOP
must teach them, and linked-Agent guidance must teach how an Agent receives an assigned objective,
declares and advances its useful stages and gates, reports evidence, and retains its local ladder.
Contract-first means those operational instructions follow implementation rather than anticipating
it.

`PRODUCT_APPROVAL` does not automatically create a gate. A gate exists only when a named outside
actor must act before safe work can continue. The projected state describes the Team card; the
gate records the concrete hold within that card.

## Identity and versions

A future record needs durable identity before it can synchronize safely. The conceptual fields
are:

```json
{
  "record_id": "<immutable Agent execution-record identity>",
  "team_card_id": null,
  "external_refs": {
    "<adapter>": "<adapter-owned reference>"
  },
  "revision": 1
}
```

These names illustrate the contract; they are not authorization to add schema now.

- `record_id` is immutable across moves, restarts, and external synchronization.
- `team_card_id` is nullable while an Agent record is not linked to a Team deliverable.
- `external_refs` contains namespaced adapter references. An adapter reference never becomes
  Ronin's primary identity.
- `revision` increases monotonically on accepted change and participates in conflict detection.
- The Team card also needs its own stable identity and revision. A link binds identities; names
  and phase text do not.
- Related cards contributing to a larger outcome need a stable parent or grouping identity; that
  relationship never changes the one-card/one-record link.
- An Agent-level focus reference may point to one owned record without making that record the
  Agent's identity or limiting the Agent to one active card.

Every synchronized event records the source, actor, action, exact candidate or evidence, time,
prior revision, and resulting revision. A stale or competing update becomes an explicit conflict;
last-write-wins is not safe for approvals, objectives, assignments, or evidence.

## Coarse synchronization

Each Agent record projects upward as a concise summary of its own Team card:

- owner or owners;
- outcome;
- normalized projected state and upcoming Agent-record gates;
- the current rung's optional exit-check hint;
- current meaningful gate;
- durable evidence such as accepted commit, test receipt, preview, or approval; and
- linked execution-record identities and revisions.

The virtual Team board renders every card at its reported projected state or gate. Opening the linked
individual record shows the detailed phases, legs, and evidence used to reach its next declared
gate. Ordinary status flips, leg completion, phase retitles, tangents, and investigative notes do
not become external events.

Downward control is narrower still. A Team or external card transition reaches an Agent only
when it is recognized, explicitly mapped, authorized, identity-linked to the declared gate, and
based on the expected revisions. For example:

- moving a gated exact candidate into its defined approved state records the authorized approver,
  evidence, and time, completes that gate, and releases the Agent to continue; or
- returning a reviewed candidate to `BUILDING` records the reviewer and reason and reopens the
  defined build work.

Unrecognized moves remain presentation changes or conflicts; they do not rewrite Agent state.
No adapter may arbitrarily replace an objective, ladder, repository, tracked document, durable
evidence, or approval. An Agent-owned declared gate stays coherent in the Team projection and
Agent record; local investigative holds remain local unless a defined transition promotes one.

## One job and an acknowledgement

This mechanism observes, records, links, projects, and acknowledges work-record facts. It does not
decide how far the lead decomposes an idea, choose an Agent's plan, approve a candidate, commit,
hand in, or promote work. Each neighboring decision remains with its existing actor and tool.

Every recognized transition or synchronization attempt returns an acknowledgement that names:

- what changed, or what was only observed;
- the actor and source;
- the record's current position;
- the evidence and prior/resulting revisions involved;
- any stale write or other actual conflict and its consequence; and
- the next useful action, while leaving the choice to the Agent.

An incomplete ladder or absent exit-check hint is not a reason to refuse. A refusal belongs only to
an operation that cannot safely be performed, such as accepting a stale conflicting write. Even
then, the acknowledgement preserves both versions and names the recovery action. No synchronization
action silently discards a source record, link, evidence item, conflict, or real gate decision;
destructive behavior remains a separate explicit operation.

## Authority and conflicts

A safely actionable transition mapping states:

- who has authority to request it and, separately, who has authority to approve it;
- the entry facts that must already be true;
- the exit facts and Agent event it produces;
- the exact evidence being accepted or rejected;
- the expected Team-card and Agent-record revisions; and
- the conflict outcome when the board, Team record, or Agent record changed meanwhile.

An external platform's permissions are evidence about its actor, not sufficient Ronin authority
by themselves. Approval must bind the authorized actor to an exact candidate. Notifications,
labels, comments, and arbitrary list moves are not approval events.

On conflict, preserve both versions and hold the affected transition for resolution. Never erase
an Agent source record, discard evidence, silently move a gate, or infer intent from whichever
write arrived last.

## Deliverable lifecycle

The intended identity belongs to one deliverable card and its one execution record, not to an
Agent or terminal session. Before assignment, an idea, project, or recommended assignment exists
only in the lead's inbox or planning record. The lead owns intake, shaping, decomposition, and the
offer of work. On acceptance, the Agent creates and owns the one-to-one work card and execution
record, links it to the lead item as provenance, and takes the assignment outcome as its objective.
The Agent's simple plan, declared stages or gates, and current position then project into the
virtual Team view.

An Agent may create, adopt, and actively manage several independent card/record pairs at once.
Each has its own ladder and position. Completing one objective closes or archives only that card
and record; it neither closes the Agent's other work nor turns the pair into a different task.
Several Agents contributing to a larger outcome keep separate cards and records related by a
parent outcome or grouping identity.

The following policy choices remain open for the implementation design:

- Does an objective become immutable after assignment, or may an authorized transition revise it?
- What exact event closes an Agent work card, and which evidence is required before `FINISHED`?
- Can a closed record reopen, or must follow-up work receive a new identity and link?
- If a card's outcome materially changes, must that pair close and a new one begin, or may an
  authorized revision preserve its identity?
- How is current focus chosen and displayed when one Agent owns several active records?
- Which parent/grouping states and evidence are derived from related Agent cards, and which are
  maintained explicitly by the Team lead?
- What happens to links when an Agent leaves a Team or a Team is archived?

These questions must be settled explicitly before schema or synchronization is implemented.
The invariants above—one card per work record, one-to-many Agent ownership, explicit focus,
independent Agent source records, a non-enforcing shared projection vocabulary, Agent-owned useful
plans and optional exit-check hints, virtual Team aggregation, parent grouping
rather than multi-Agent card collapse, explicit authority, auditable events, and conflict-safe
revisions—must survive whichever policies are chosen.
