# Visual staging
- **seed:** Put visual work on one disposable Team preview for fast owner feedback.
- **when:**
- **depth:** none
- **order:** 40

Visual work can go on one disposable Team preview before hand-in, so the owner presses on
the real thing and says what is wrong in minutes.

1. **The lead owns the preview:** one disposable staging branch and worktree, one preview
   process on its own port, apart from the live service. Nobody else serves, restarts or edits it.
2. **You offer a commit, never a file:** tell the lead your session, the repo, the exact
   commit, what it changes and what it supersedes. A message, not a hand-in.
3. **The lead merges candidates one at a time** into the preview; `/api/version` names the
   commit on display.
4. **After each, one wipeboard line:** `NEW VIEW — <what changed> — <commit> — <URL>`.
5. **The owner says what is wrong**, the owning desk commits a narrow fix, the lead
   recomposes and posts the next view. Owner corrections override earlier rulings.
6. **Rejecting** rebuilds only the preview; your commit stays. No cherry-picks, per-candidate
   servers or file copies.
7. **Approval changes no Git line:** finished work is still handed in with `worktree-desk
   hand-in` and promoted by the lead; staging never promotes.
8. **At the end** the lead stops the preview and records the last commit beside the
   promotion receipt.
