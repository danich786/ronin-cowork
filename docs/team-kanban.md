# Team Kanban

Team Kanban is the five-column view of a Team's authored projects: Ideas, Planning,
Building, Landing, and Done. Open it from the Team Kanban card in the workspace selector
or the Kanban tab in Team Commons. Both surfaces render the same live board returned by
`GET /api/teams/:team/kanban`; Agents can read the same JSON with
`tejun-kanban <team>`.

The board is a read-time projection, not another store. It combines roster-held ideas
with projects in every live or archived work record tagged for the Team. The roster is
the holder for Ideas; an Agent name is the holder after a whole-project assignment or
Agent-authored creation. Bare legacy ladders remain readable by the work-record tools but
do not become phantom board cards. See [work records and projects](work-record.md) for the
canonical project shape, stages, ladder, exit, and status flags.

## Landing is derived

Planning and Building reflect the authored project. Landing and Done also use repository
evidence already kept by Ronin:

- An accepted hand-in receipt containing one of the project's evidence commits derives
  Landing, green, with the next exit at the Team lead.
- A completed Team promotion containing that hand-in remains Landing and changes the next
  exit to the user.
- Containment of the evidence in `master` derives Done, green.

The projection reads desk receipts, the promotion ledger, and Git containment; it writes
none of them. If there is no matching evidence, the authored stage remains truthful.

Dragging a card also does not mutate the board. It sends one move request to the current
holder—or to the lead for a lead action—and marks the request locally until a work record
or roster move changes the next read. Clicking an Agent holder opens that Agent's tile in
the workspace.

## Optional Trello adapter

Trello is an optional integration boundary, not the Team Kanban source of truth. An
adapter may project the five stages to lists, status and exit to labels, ladder legs to a
checklist, and evidence to attachments. It must consume the canonical board/project model
and must not make Trello required for reads, store a second board in Ronin, or replace the
roster, work records, receipts, promotion ledger, or Git containment.
