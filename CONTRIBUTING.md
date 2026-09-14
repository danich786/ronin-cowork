# Contributing to Ronin Cowork

Thank you for helping improve Ronin. Issues are open to everyone. Start with an issue so
the problem, intended outcome, and eventual change remain connected and discoverable.

## 1. Open or choose an issue

Before writing code:

1. Search the [open issues](https://github.com/ronincowork/ronin-cowork/issues) for an
   existing report or proposal.
2. If none matches, open an issue describing the current behavior, the desired outcome,
   and enough detail to reproduce or evaluate it.
3. For a substantial feature or architectural change, wait for a maintainer to confirm
   the direction before investing in an implementation.

Anyone may create an issue. A pull request must reference its issue. Use a GitHub closing
keyword in the PR description—for example, `Closes #77`—so GitHub closes the issue when
the accepted PR is merged. A bare `#77` reference links the work but does not close it.

## 2. Work from `dev` and open the PR to `dev`

Create a topic branch from the current `dev` branch. Keep the change focused on the linked
issue and do not mix unrelated cleanup into it.

External contributor PRs target **`dev`**, not `master`. `master` is Ronin's release line;
the only ordinary PR into it is the maintainers' rolling, promotion-receipt-backed
`dev → master` PR. A maintainer may retarget a contribution opened against `master`.

## 3. Verify the change

Install dependencies and run the repository verdict:

```bash
npm ci
npm run verify
npm run byoin
```

`npm run verify` runs the TypeScript and behavior-test verdict. Add or update focused tests
that demonstrate the bug without the fix and pass with it.

`npm run byoin` checks that current user-customization stores still surface correctly. A
box with no customization may report that there was nothing to check; say so rather than
presenting that result as proof against customized data. If your change affects an
installed box, user stores, setup, upgrades, or rendered customization, also follow the
relevant installation or diagnostic instructions and report exactly what was exercised.

Playwright and visual suites are explicit diagnostics, not a substitute for the repository
verdict. Run the relevant one when the issue concerns rendered or interactive behavior,
and include screenshots or a precise manual check when visual judgment is involved.

## 4. Open the pull request

The PR description must include:

- `Closes #<issue>` (or another GitHub closing keyword) for the issue it resolves;
- a concise explanation of what changed and why;
- the exact checks run and their results, including whether BYOIN examined customization
  or reported that none existed;
- any visual evidence, migration concern, shared-file overlap, or decision a reviewer
  should not have to discover.

Opening a PR is a request for review, not acceptance into the release line. Maintainers may
ask for changes, reproduce the issue, combine the contribution with concurrent work, or
decline a change that does not fit the product direction.

## 5. Maintainer integration

A maintainer reviews the issue, scope, code, tests, and contributor evidence. They may assign
accepted work to a Ronin Team or Agent to reconcile it with current `dev` and concurrent work,
use provisional visual staging when applicable, then follow the ordinary
[hand-in and Team Lead promotion](docs/worktrees.md#save-commit-hand-in-and-promotion) path to
global `dev`. The later receipt-backed `dev → master` release PR remains maintainer-owned.

Merging to `master` does not update an installed Ronin. Releases and installation remain
separate deliberate acts described in [`docs/release.md`](docs/release.md).
