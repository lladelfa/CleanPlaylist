# tools/github

Developer tooling for the repeatable git, GitHub, and worktree steps in CleanPlaylist.
This folder is not part of the app: nothing here is imported by `backend/`, `frontend/`, or `api/`, and Vercel does not deploy it.

## Files

- `gh-workflow.ps1` — the single entry point; one command per task.
- `tests/gh-workflow.Tests.ps1` — Pester 3 unit tests for the pure helpers.

## Commands

Run from the repo root (or a worktree of it):

```powershell
tools\github\gh-workflow.ps1 start -Name 7-3-custom-preset-copy-accuracy   # worktree + feature/<name> from origin/master
tools\github\gh-workflow.ps1 verify                                       # backend tests, frontend tests, lint, build
tools\github\gh-workflow.ps1 open-pr -Title "chore: ..." [-BodyFile body.md] # push branch, draft PR to master
tools\github\gh-workflow.ps1 ready -Pr 77                                 # verify, then mark PR ready
tools\github\gh-workflow.ps1 checkout-pr -Pr 77                           # PR branch in .claude\worktrees\pr-77
tools\github\gh-workflow.ps1 cleanup -Branch feature/7-3-...              # after merge: worktree, local + remote branch
tools\github\gh-workflow.ps1 status -Key 7-3-custom-preset-copy-accuracy -Status done
```

## Safety rules the script enforces

- Never works on `master` for `open-pr`, `ready`, or `cleanup`; never force-pushes.
- `start` refuses names that are not lowercase kebab-case, and refuses existing branches.
- `cleanup` refuses unless the branch has a merged PR, the worktree has no uncommitted or untracked changes, and the worktree is under `.claude\worktrees`.
- `cleanup` only removes the link at `frontend\node_modules` (with `rmdir`, never recursively). Any other link in the worktree stops the run.
- If `git worktree remove` fails with "Permission denied" (a Windows file lock), `cleanup` deletes the worktree directory directly, but only after the link check passes.
- `verify` needs `frontend\node_modules` in the worktree. Run `npm --prefix frontend ci` there, or create a junction to the main checkout's `frontend\node_modules` (`cleanup` removes that link safely).
- `status` edits `sprint-status.yaml` but does not commit. Commit it with the story's own PR.

## Running the tests

```powershell
Invoke-Pester tools/github/tests
```

The tests use only string and temp-file helpers: no `git`, no `gh`, no network.
