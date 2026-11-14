---
title: 'Story 7.5: CI Quality Gate Workflow'
type: 'feature'
created: '2026-11-13'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Red-Green-Refactor policy in AGENTS.md is enforced only by memory; no automation runs the test suites on pull requests.

**Approach:** Add `.github/workflows/ci.yml` triggered on `pull_request` and pushes to `master`. A backend job installs `backend/requirements.txt` on Python 3.10+, sets `PYTHONPATH=backend`, and runs `pytest backend/app/tests/`. A frontend job runs `npm --prefix frontend ci`, `lint`, `test`, and `build`. Document the same commands in the README.

**Acceptance criteria (from epics.md Story 7.5):**
- Given a PR or push to `master`, then the backend and frontend jobs run the commands above.
- Given the CI environment, then no secrets are referenced, no live network calls are made, and `backend/.env` is never read or created.
- Given a failing job, then the failing check shows on the PR, and the README documents the local commands.

**Boundaries:** Branch protection (making the check required) is a manual GitHub setting and not part of this change. No new dependencies. No application code changes.

</frozen-after-approval>

## Implementation Notes

- Files: `.github/workflows/ci.yml` (new), `README.md` (new "Run the Checks" section).
- Python 3.11 and Node 20 are pinned (within the 3.10+/18+ requirements). pip and npm caching are enabled via `setup-python` and `setup-node`.
- Backend tests are run as `python -m pytest` so no console-script path is needed on Linux.
- Verification (local, not on GitHub): in a fresh venv created from `backend/requirements.txt` only, `pytest backend/app/tests/` gave 228 passed, so no `.venv` or `backend/.env` dependence. Frontend: `npm ci`, lint (exit 0, existing warnings only), test (379/379 across 34 files), and build all succeed.
- Not verified: the workflow itself has not run on GitHub Actions; the first PR run is the real check. Action versions (`checkout@v4`, `setup-python@v5`, `setup-node@v4`) are unverified against the current registry.
- Manual follow-up for the repo owner: enable branch protection requiring the `Backend tests` and `Frontend lint, test, build` checks.

## Review Triage Log

- Inline self-review, no findings. Nothing deferred.
