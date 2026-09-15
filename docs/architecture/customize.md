# Customize construction

For contributors. The [usage guide](../getting-started/customize.md) explains what an owner
can browse and change. This page describes the implemented browser, not a future editor.

`public/js/main.js` installs `public/js/customize.js` at `#/customize`.
`customize-rail.js` owns the resource matrix; `customize-resources.js` reads and renders it;
`customize-handoff.js` explains the change path. Shared `provenance.js` owns origin marks.

| Resource | Read route | Current capability |
|---|---|---|
| Behaviors | `/api/ways` | Read-only, expandable text |
| Tools | None | Unavailable reader |
| Saved launches | `/api/saved-launches` | Read-only |
| Skins | `/api/skins` | Read-only |
| Desk profiles | `/api/desk-profiles` | Read-only |
| Lexicons | `/api/lexicons` | Read-only |
| Session readings | `/api/session-readings` | Read-only, expandable text |

There is no Team-role resource or separate procedure/macros catalog. Use the composition
terms in [KOTOBA](../../KOTOBA.md).

The resource matrix is executable in `customize-rail.js`. A missing read route is
unavailable, never an empty list. Counts come only from successful reads. A failed request
or malformed response is a failure, not an empty resource. The selection generation
counter prevents an old request repainting a newer selection; the rail guard prevents a
count repaint from recursively selecting again.

Customize uses [Workspace Kit](workspace-kit.md) for shared geometry and lifecycle.
It owns no terminal grid. Resource writes must use the format's validating API or documented
owner-store path; the generic file API is not a substitute for a catalog write contract.
Feature CSS follows [UI governance](ui.md). Proposed editors and visual review notes belong
in the creators' Lab, not in this current capability matrix.
