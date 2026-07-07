# Evidence Note -- main Branch Protection Bypass (2026-07-07)

Corroborates Finding_Main_BranchProtection_Bypass_2026-06-13.md.
Mints no FD number; changes no settings; forward-pointer only.
All reads live this session against the GitHub API and a push
observed first-hand.

## 1. Reproduction

The v1.22 push (f6e1485b..d96b0e62, 2026-07-07, operator account,
direct to main) emitted: "Bypassed rule violations for
refs/heads/main" -- "Changes must be made through a pull request"
and "3 of 3 required status checks are expected." Same pattern as
the v18/v19/56564d69 observations in the 06-13 finding. The
finding's s4 failure mode remains live.

## 2. Mechanism CONFIRMED -- refutes s2 hypothesis

The 06-13 finding s2 hypothesized a GitHub RULESET with a bypass
list, marked CONFIRM. Live reads 2026-07-07:

- GET /repos/.../rulesets -> [] (no rulesets exist)
- GET /repos/.../branches/main/protection -> CLASSIC branch
  protection, active:
  - required_status_checks (strict): "Cost Exposure Audit",
    "Tests", "Route Validation" (all app_id 15368 = Actions)
  - required_pull_request_reviews: present,
    required_approving_review_count: 0
  - enforce_admins: FALSE

The bypass mechanism is enforce_admins: false on classic
protection. The operator account is an admin; protection does not
apply to it. There is no bypass list because there is no ruleset.

## 3. Cross-reference to Fix Plan v1.22 (FD-5 status)

The three live required checks do NOT include "Validate" -- the
check FD-5 targets per v1.1 pre-flight s2.2. This protection set
was added outside the Fix Plan register and does not constitute
Phase A G2 / FD-5 execution. v1.22's statement that G2 remains
unexecuted stands. When Phase A G2 resumes, FD-5 work should be
reconciled against this live config (three existing checks +
whether Validate is added or the existing set is ratified as
FD-5-equivalent -- a G2 decision, not decided here).

## 4. Disposition

Unchanged from the 06-13 finding s5: Enforce / Accept / middle
path remains an OPEN operator decision. Interim practice adopted
this session pending that decision: docs/audit canon routes
through branch -> PR -> [skip-automerge] -> manual merge, matching
how the 06-13 finding itself was filed. This note is filed via
that ceremony.
