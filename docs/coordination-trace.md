# Coordination trace — objective to completion

This is the shortest complete path through Ronin's work model. The linked mechanisms remain
separate authorities; the Team Kanban derives a view rather than becoming a workflow store.

1. **Objective enters the Team.** The Team lead records an idea or Project in the Team roster.
   The Project has stable identity, outcome, stage, and provenance.
2. **Assignment is accepted.** A visible Agent is launched or assigned with the objective,
   Campaign/Team context, Workspace Folder handle, mandate, behaviors, capabilities, and repository
   placement resolved before birth.
3. **The Agent owns its work.** `work-record project create/write` establishes the Agent's
   Project and detailed execution record. The Team-held Project is provenance, not a shared
   mutable checklist.
4. **Work produces evidence.** The Agent keeps its record current and commits coherent desk
   checkpoints. Tests, documents, decisions, and exact commits become evidence.
5. **Hand-in publishes to Team review.** `worktree-desk hand-in` admits the committed candidate
   to the Team line or returns an isolated conflict. A private commit alone publishes nothing.
6. **Review and promotion remain distinct.** The Team lead reviews the exact candidate. Team
   promotion verifies and admits the Team line to global `dev`; release review later moves
   `dev` to the stable line.
7. **The virtual board derives state.** Team Kanban combines Team-held and Agent-held Projects
   with hand-in, promotion, and Git-containment evidence. It never guesses from phase prose.
8. **Completion closes the right records.** The Project moves to Done only when its definition
   of completion is met. Standing truth lands in code/docs; finished temporary plans are
   removed; desk and session cleanup follow their own explicit lifecycle.

For a bounty, GitHub adds the public issue, pull request, and maintainer review around this
trace. GitHub does not replace the contributor's local work record, and Ronin does not expose
their private task progression merely to prove activity.
