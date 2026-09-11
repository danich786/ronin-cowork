# Future Team work-record integration

> **Status: intended architecture, not current behavior or schema.** The current Agent work
> record is maintained with `read_tegami` and `write_tegami`. No Team work record, external-board
> synchronization, or fields proposed here should be presented as implemented.

This document defines the boundary for a future shared workflow above Agent work records. It is
a design contract for later implementation work, not an Agent operating procedure. Birth reading,
generated record instructions, tools, macros, and SOPs must not teach these mechanics before they
exist.

## The durable levels

A **Team roster**, keyed by Team, continues to hold the Team's identity, configuration, and
launch defaults. Live members are derived from session Team tags; this design does not add
membership storage to the roster. Mutable workflow does not belong in that record.

The existing Team-owned store already supplies durable Team persistence. The mechanical design
must either extend that durable Team-owned shape or add a Team-keyed companion record in the same
store. It must not invent a second durability system. Whichever representation is chosen, the
**Team work record** remains conceptually distinct from roster identity and configuration.

The Team work record owns the canonical shared workflow: its ordered lists or states, transition
rules, gates and approval requirements, and assignment cards. It is the Team's board, not merely
a rollup of Agent activity. Every active Agent has one visible card for its current work record,
and every such card represents one meaningful assigned outcome.

Assigning an outcome creates or links one **Agent work record** and one Team card, supplies the
record's objective from the card's outcome, and establishes a one-to-one link while that work is
current. One Agent record links to zero or one Team card—never several—and a current assignment
card links to exactly that Agent record. The record carries the Agent's detailed execution:
flexible phases and legs, active position, gates, repositories, and tracked documents. The Agent
advances the linked card through Team-defined canonical states while keeping local detail between
the shared transition gates. Live Team membership, derived from session Team tags, subscribes an
Agent to the Team work record. Agent ladders are never mechanically merged into one Team ladder.

If several Agents contribute to a larger outcome, each keeps a separate card and work record.
Their cards relate through a stable parent-outcome or grouping reference; they are not collapsed
into one multi-Agent card.

An external Trello or Kanban card is an optional projection of the Team card. The Team work
record remains canonical so Ronin's coordination does not depend on an external platform.

| Ronin concept | External projection |
|---|---|
| Team work record | The Team board |
| Assignment card | One outcome/deliverable card |
| Agent work record | The one linked card's detailed execution record |
| `projection_state` | The card's workflow list |
| Owner | Card member |
| Team, type, priority, risk, blocked | Labels or card metadata, not workflow states |
| Durable commit, test, preview, and decision evidence | Card evidence or linked artifacts |
| Current meaningful gate | A held card with its required outside act |
| Team-required transition gate | The same identity-linked gate in Team card and Agent record |
| Agent phases and legs | Agent-local detail, not projected board movement |

## Stable projected state

Agent phase titles remain flexible descriptions of the local execution plan. An adapter must
never infer canonical Team-card state from text such as “Build,” “Review,” or “Done.” Similar
words can mean different things in different tasks, and renaming a phase is not a Team transition.

The future Team card instead carries an explicit normalized `projection_state`. Candidate values
are:

```text
INBOX
SHAPING
READY
BUILDING
CODE_REVIEW
SHOW
PRODUCT_APPROVAL
MAINLINING
FINISHED
```

This is a candidate vocabulary, not a field in the current schema. A Team may use the smallest
applicable workflow in its presentation, but every supported transition needs one explicit
mapping and stated entry and exit rules. Routine Agent legs and internal phase changes do not
create cards, change `projection_state`, or cause external-board churn.

The Team work record defines which states and transitions apply. Assigning an outcome tells the
linked Agent which canonical card it advances; the Agent does not derive that state machine from
its own phase names or invent Team-wide approval requirements.

When a Team transition requires a gate, assignment must instantiate or link that gate in the
Agent work record as part of its high-level backbone. A required Team gate has a stable gate or
transition identity shared with the Team card. It is never matched by phase title or gate text.
The Agent may add and revise local phases and legs between shared gates, but it cannot omit a
required gate, rename it away, or independently mark it satisfied.

Approval or rejection updates the Team-card transition and the linked Agent gate coherently. The
event must bind the exact candidate, authorized actor, evidence, prior revisions, and resulting
revisions on both sides. A partial update is a conflict, not success. Not every Team state is a
gate, and a purely local investigative hold need not project to the Team card.

## Team-lead responsibility

The Team lead is responsible for maintaining the overall Team work record. That includes:

- shaping work into meaningful one-Agent outcome cards and parent groupings where needed;
- maintaining the ordered states, transition rules, gates, and approval requirements;
- creating, assigning, moving, and closing cards;
- watching concise progress and evidence rolled up from linked Agent records;
- ensuring required Team gates are identity-linked into assigned Agent records;
- managing coherent Team/Agent gate decisions against exact candidates and authorized actors; and
- resolving version, assignment, evidence, and transition conflicts without erasing an Agent's
  detailed source record.

These duties are not current tool behavior. After the mechanics exist, a Team-lead routine or SOP
must teach them, and linked-Agent guidance must teach how an Agent receives an assigned objective,
advances canonical card state, reports evidence, and retains its local ladder. Contract-first means
those operational instructions follow implementation rather than anticipating it.

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
  relationship never changes the one-card/one-current-Agent-record link.

Every synchronized event records the source, actor, action, exact candidate or evidence, time,
prior revision, and resulting revision. A stale or competing update becomes an explicit conflict;
last-write-wins is not safe for approvals, objectives, assignments, or evidence.

## Coarse synchronization

Agent progress projects upward as a concise Team-card summary:

- owner or owners;
- outcome;
- normalized projected state;
- current meaningful gate;
- durable evidence such as accepted commit, test receipt, preview, or approval; and
- linked execution-record identities and revisions.

The detailed Agent ladder stays local. Ordinary status flips, leg completion, phase retitles,
tangents, and investigative notes do not become external events.

Downward control is narrower still. A Team or external card transition reaches an Agent only
when it is recognized, explicitly mapped, authorized, identity-linked to the required gate, and
based on the expected revisions. For example:

- moving a gated exact candidate into its defined approved state records the authorized approver,
  evidence, and time, completes that gate, and releases the Agent to continue; or
- returning a reviewed candidate to `BUILDING` records the reviewer and reason and reopens the
  defined build work.

Unrecognized moves remain presentation changes or conflicts; they do not rewrite Agent state.
No adapter may arbitrarily replace an objective, ladder, repository, tracked document, durable
evidence, or approval. A Team-required gate stays coherent in the Team card and Agent record;
local investigative holds remain local unless a defined transition promotes one.

## Authority and conflicts

Each mapped transition must define:

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

The intended identity belongs to an Agent's current assigned deliverable, not to a terminal
session. Completing an objective closes or archives that card and execution record rather than
turning either into the next task. A persistent session may create or adopt successive records,
each with its own one-to-one Team card. Several Agents contributing to a larger outcome keep
separate cards and records related by a parent outcome or grouping identity.

The following policy choices remain open for the implementation design:

- Does an objective become immutable after assignment, or may an authorized transition revise it?
- What exact event closes a Team card, and which evidence is required before `FINISHED`?
- Can a closed record reopen, or must follow-up work receive a new identity and link?
- If execution moves to a different outcome, must the old card and record close before a new pair
  begins, or may the existing pair be reassigned while preserving its identity?
- Which parent/grouping states and evidence are derived from related Agent cards, and which are
  maintained explicitly by the Team lead?
- What happens to links when an Agent leaves a Team or a Team is archived?

These questions must be settled explicitly before schema or synchronization is implemented.
The invariants above—one current Agent record per visible assignment card, independent Agent source
records, canonical Team gates and states, parent grouping rather than multi-Agent card collapse,
explicit authority, auditable events, and conflict-safe revisions—must survive whichever policies
are chosen.
