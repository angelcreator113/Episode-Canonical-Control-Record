| **PRIME STUDIOS** **F-DEPLOY-1 RULING** *Evoni's Rule 7 decision on agent access to production: deploys and migrations run only through an approved Deploy workflow. A ruling note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register document. It is not a Fix Plan revision, and it
amends no filed document. No banner is added to any filed document by this
filing (§3).

Basis: `origin/main` at `557452b626593fcaf41bbac2d3da49316a8b78ba` (#2832),
read 2026-10-10.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

**RULED** (§1). Standings used here:
- **RULED**: Evoni's decision, quoted verbatim.
- **MEASURED**: this repository, cited by `file` and section at the basis
  above.

Task #2834. The filing session made no host, AWS, database or Cognito
contact.

---

## §1. The decision — RULED

Evoni, verbatim:

> Rule 7 decision, Evoni, on agent access to production.
> 1. Agent sessions never hold production credentials and never contact a production host, AWS account, database, or Cognito directly. This part of the earlier rule stands.
> 2. Database migrations and deploys to production run only through the repository's Deploy workflow.
> 3. The Deploy workflow runs only in the protected "production" GitHub environment, and only after Evoni approves that run. Agent sessions may write and change the workflow through reviewed pull requests, but may not dispatch, approve, re-run, or enable it.
> 4. Before running migrations, the workflow takes a database snapshot and stops if the snapshot fails.
> 5. The workflow authenticates to AWS with a short-lived role limited to: creating and describing that snapshot, and running the deploy and migration commands on the application server. It has no Cognito permissions. Database credentials stay on the server and are never given to the workflow.
> 6. Cognito changes, server .env changes, and anything outside the workflow remain Evoni's own actions.
> 7. This decision takes effect when Evoni has completed the one-time AWS and GitHub setup and approved the first workflow run. Until then, the earlier rule applies in full.

## §2. What the decision supersedes, for this scope — MEASURED, citation only

The decision speaks for itself; this section only points at the register
entries it bears on. None of them is edited, and none is superseded before
the decision's own item 7 is met.

- **The agent no-contact rule.** `CLAUDE.md`, Non-negotiables (agent
  sessions never `ssh`, `scp`, run `pm2`, connect to RDS, edit a server
  `.env`, or enable/dispatch workflows; Evoni performs every production
  action herself), as restated in `F-Deploy-1_Fix_Plan_v1.53.md` §3 ("Agent
  sessions still never touch hosts, AWS, RDS, or Cognito") and in every
  register footer since. Decision item 1 keeps the no-contact part.
- **The bounded `aws` read allowlist.** `F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md`
  and its Amendments 1 and 2. The decision does not mention the allowlist;
  this document draws no conclusion about it.
- **F-Deploy-1, on how production is deployed.**
  - `F-Deploy-1_Fix_Plan_v1.50.md` §2 (2026-09-17: `Deploy to Development`
    is not dispatched).
  - `F-Deploy-1_Fix_Plan_v1.53.md` §1 (freeze lifted) and §3 (no disabled
    workflow re-enabled; every deploy is Evoni's own action, outside any
    agent session).
  - `F-Deploy-1_Fix_Plan_v1.54.md` §5 (the existing Deploy to Production
    workflow, `.github/workflows/deploy-production.yml`, is
    `disabled_manually`).
  - `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repository root), Sec 3's freeze
    rules, already lifted by v1.53 §1.

**Which workflow "the repository's Deploy workflow" is.** At this basis
`.github/workflows/` holds `auto-merge-to-dev.yml`, `deploy-dev.yml`,
`deploy-production.yml`, `pr-validation-block-check.yml` and `validate.yml`.
None of them is the workflow the decision describes. The task to write it is
#2837, and the read that comes first is #2836. This document does not decide
whether `deploy-production.yml` is replaced or retired.

**Until item 7 is met,** the earlier rule applies in full (decision item 7):
every deploy and migration stays Evoni's own action outside any agent
session, and every citation above stands as written.

## §3. Banners — none added

Filing this decision adds no banner. Task #2834 limits the change to this
one new file, and the decision does not take effect until its item 7 is met.
Pointer banners on `F-Deploy-1_Fix_Plan_v1.53.md` and on
`F-Deploy-1_PROD_SplitBrain_HAZARD.md` (whose v1.53 banner is still owed) may
be added later, additively, by a separate task. This document does not file
them. The agent-rule text in `CLAUDE.md`, the task form and the PR template
is #2835.

## §4. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

---

## What this document does not do

- It adds nothing to the decision. §1 is Evoni's text, unedited.
- It edits no filed document and adds no banner (§3).
- It mints and reopens nothing. F-Deploy-1's keystone standing is unchanged.
- It enables, dispatches, approves or re-runs no workflow.
- The filing session made no host, AWS, database or Cognito contact.

*Type: ruling note. Rules: Evoni's Rule 7 decision on agent access to
production (§1), effective on its own item 7. Mints: nothing. Host/AWS/DB/
Cognito contact by the filing session: none. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).*
