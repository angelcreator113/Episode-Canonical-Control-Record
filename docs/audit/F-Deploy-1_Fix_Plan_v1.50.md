| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Deploy to Development ruling.* |
| --- |

**Document version**

v1.50 — confirmed newest at basis: `ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -3` →
```
F-Deploy-1_Fix_Plan_v1.47.md
F-Deploy-1_Fix_Plan_v1.48.md
F-Deploy-1_Fix_Plan_v1.49.md
```
v1.49 is newest; this revision is next.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RULED. This revision rules the conflict `docs/audit/F-Deploy-1_DeployDev_FreezeStatement_Conflict_2026-09-17.md`
recorded and left open. **F-Deploy-1 remains CLOSED.** Nothing below reopens
it, changes a gate, or amends a finding. Mints no FD, XK, or PE number.

---

# F-Deploy-1 Fix Plan v1.50 — Deploy to Development ruling

## 1. What is quoted, verbatim

### 1.1 Hazard doc (`F-Deploy-1_PROD_SplitBrain_HAZARD.md`, repository root) Sec 3, items 7 and 9

> 7. Do **not** deploy the dev box pointed at either instance.

> 9. Do **not** re-enable the `Deploy to Development` or `Auto-merge to Dev`
>    workflows (both DISABLED 2026-05-30). They reach THIS box via shared compute;
>    an untagged `claude/**` PR auto-deploys to prod. The `[skip-automerge]` commit
>    tag is NOT a sufficient guard -- the disabled workflows are the real guard.
>    Re-enabling is a reconciliation-gated decision. See Sec 7.

### 1.2 `F-Deploy-1_DeployDev_FreezeStatement_Conflict_2026-09-17.md` §3.2, §3.2b, §3.4

**§3.2, in full:**

> **`F-Deploy-1_PROD_SplitBrain_HAZARD.md` Sec 3 item 9** (§1(a) above, dated
> 2026-05-30, never revised) states: *"Do not re-enable the `Deploy to
> Development` ... workflow[]. They reach THIS box via shared compute; an
> untagged `claude/**` PR auto-deploys to prod... Re-enabling is a
> reconciliation-gated decision."*
>
> **`PROJECT_CONTEXT.md` §7** (§1(b) above, dated 2026-09-16) states, in the
> same breath as citing "the hazard doc Sec 3": *"no re-enabling the disabled
> workflows"* as a freeze rule (line 351) — then two lines later lists
> *"dispatching `Deploy to Development` (Evoni, from a browser, Rule 7)"* under
> *"What is safe today"* (line 353).
>
> **These two statements, read together, disagree on the current status of the
> same workflow.** The hazard doc's text treats `Deploy to Development` as one
> of "the disabled workflows" that must not be re-enabled; PROJECT_CONTEXT.md's
> own MEASURED workflow table (line 347, same document) records it as
> `active`, not `disabled_manually`, and separately calls dispatching it safe.
> **What would resolve it:** whether the hazard doc's Sec 3 item 9 is read as
> referring to the *pre-2026-07-10* `deploy-dev.yml` (the version that,
> per Fix Plan v1.30 §2, ran over SSH against the shared box) or as a standing
> prohibition that survives the 2026-07-10 rewrite and 2026-07-14
> re-enablement regardless of what the workflow file now does. The hazard doc
> itself does not say, because it has not been touched since 2026-05-30 (§4
> below) — this is a textual absence, not a resolution.

**§3.2b, in full:**

> **Sec 3 item 7** (§1(a) above, line 88, dated 2026-05-30, never revised)
> states: *"Do **not** deploy the dev box pointed at either instance."*
>
> **PROJECT_CONTEXT.md §7 line 353** (§1(b) above, dated 2026-09-16) states,
> within *"What is safe today"*: *"dispatching `Deploy to Development` (Evoni,
> from a browser, Rule 7)."*
>
> **This is a conflict separate from §3.2's item 9 conflict.** Item 9's stated
> rationale is shared compute — *"They reach THIS box via shared compute; an
> untagged `claude/**` PR auto-deploys to prod"* — a rationale Fix Plan v1.49
> states the 2026-07-10 rewrite addresses: the dev box is now a dedicated
> instance (`episode-dev-backend`), not the shared box. **Item 7's text
> carries no such rationale and does not depend on shared compute.** It says
> "the dev box pointed at either instance" — either RDS instance, `-dev` or
> `-prod` — a statement about which *database* a dev deploy is pointed at, not
> which *EC2 host* it runs on. Nothing in the 2026-07-10 rewrite that
> separated the EC2 hosts speaks to which RDS instance the dev box's deploy
> targets.
>
> **What would resolve it is the same open question named at §3.4 item 2.**
> `F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` §7 states the on-box
> migration's actual database target — resolved at deploy time from the
> Secrets Manager secret `episode-metadata/dev/database` — is NOT VERIFIABLE
> FROM REPO, and `CLAUDE.md` line 19 separately records that the canon
> (production) RDS instance is *named* `episode-control-dev`. **Item 7's text
> names "either instance"** — the hazard doc's own Sec 2.2 and Sec 2.3 (same
> document as §1(a), not quoted there in full) name the two as
> `episode-control-dev` ("the real, live data store") and
> `episode-control-prod` ("verified EMPTY"); `PROJECT_CONTEXT.md` §7 (lines
> 343–344, not quoted at §1(b) above) names the same two RDS instances by the
> same names. **If the dev secret resolves to either of those two, item 7's
> prohibition is implicated on dispatch; only a database that is neither of
> them falls outside its text.** This document does not resolve which.

**§3.4, in full:**

> 1. Does a document dated 2026-05-30, naming a *specific* workflow
>    configuration ("shared compute," pre-rewrite), continue to govern after
>    that configuration was rewritten (2026-07-10) and the register's own
>    later documents (§2 table) describe the new configuration as not reaching
>    prod? Or does Sec 3 item 9's prohibition attach to the *workflow name*
>    regardless of implementation?
> 2. `F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` §7 states the on-box
>    migration's actual database target is NOT VERIFIABLE FROM REPO — the
>    Secrets Manager secret name (`episode-metadata/dev/database`) is not
>    itself evidence of which RDS instance it resolves to, and `CLAUDE.md`
>    line 19 separately records that the canon (production) RDS instance is
>    *named* `episode-control-dev`. Resolving this requires reading that
>    secret's value or the resolved connection at deploy time — both are
>    guardrailed against in this task and were not done here.
> 3. Does the `F-Deploy-1 v1.49` citation in `DEVELOPMENT_WORKFLOW.md:247`
>    need correcting to point at the document that actually contains the
>    "Rule 7 re-enablement decision and execution" language — `F-Deploy-1_Fix_Plan_v1.43.md`
>    §2 (§2 table above), not `v1.49`?

### 1.3 `PROJECT_CONTEXT.md` §7, current "What is safe today" sentence

> **What is safe today:** local development against Docker Postgres; cloud
> sessions and laptop CLI on branches; PRs to `main`. **Whether dispatching
> `Deploy to Development` is permitted is unresolved, not settled as this
> line previously stated it** — `docs/audit/F-Deploy-1_DeployDev_FreezeStatement_Conflict_2026-09-17.md`
> §3.2 records a conflict between the hazard doc Sec 3 item 9 text above ("no
> re-enabling the disabled workflows," dated 2026-05-30, never revised) and
> this file's own prior "safe today" framing, and §3.2b records a second,
> separate conflict against Sec 3 item 7 above ("no dev-box deploy pointed at
> either instance") that does not depend on item 9's shared-compute rationale.
> The note takes no position on which statement governs and does not say
> dispatch is forbidden; see §6.5 for the open ruling.

## 2. Ruling — Evoni, 2026-09-17

**Sec 3 items 7 and 9 govern.** `Deploy to Development` is not dispatched
until the gated reconciliation session has run. Neither item lapsed through
the 2026-07-10 rewrite (Fix Plan v1.30, FD-57) or the 2026-07-14
re-enablement (Fix Plan v1.43 §2). **The former `PROJECT_CONTEXT.md` §7
safe-today framing is superseded** — dispatching `Deploy to Development` is
not permitted under this ruling.

**Conflict note §3.4 Q1, answered:** Sec 3's prohibition governs regardless
of the workflow's implementation.

**Conflict note §3.4 Q2, answered with the read:** see §3 below. The read
Q2 called for — the secret's resolved target — has now been performed by
Evoni outside any agent session and is recorded ATTESTED at §3. It resolves
to the canon instance, which places dispatch squarely inside item 7's "the
dev box pointed at either instance."

**§3.4 Q3 is not answered here** — the `DEVELOPMENT_WORKFLOW.md:247` citation
correction is a separate edit to a live document, not performed by this
revision (§5).

## 3. Evidence — ATTESTED, Evoni's console read, outside any agent session

Evoni performed the following read directly in the AWS console, outside any
agent session, and reports it here for the record. No agent session made
AWS, host, database, or Cognito contact for this revision. Only instance and
secret **names** are recorded below — no endpoint, hostname, username,
password, or database name.

- RDS, `us-east-1`: exactly two instances listed, `episode-control-dev` and
  `episode-control-prod`. No third instance.
- Secrets Manager secret `episode-metadata/dev/database` exists, created
  **2026-07-11**, last retrieved **2026-09-04**. Its host field names
  **`episode-control-dev`**.

## 4. Consequence, not a new finding

`CLAUDE.md` line 19 already records that `episode-control-dev` is the canon
(production) instance, "misleadingly named." Given §3's read, **the current
configuration means an on-box `db:migrate` dispatch would target the canon
instance.** This is a consequence of the configuration §3 reads, stated here
because the ruling at §2 depends on it — it is not itself a new finding, and
mints nothing.

## 5. Deploy to Development — disabled, verified

**ATTESTED:** Evoni disabled `Deploy to Development` on 2026-09-17, outside
any agent session.

**MEASURED**, GitHub API, this session, at time of writing:

```
$ [github API] get_workflow(deploy-dev.yml)
{
  "id": 224506682,
  "name": "Deploy to Development",
  "path": ".github/workflows/deploy-dev.yml",
  "state": "disabled_manually",
  "updated_at": "2026-09-17T08:25:41-04:00"
}
```

State is `disabled_manually`, consistent with the ATTESTED claim above; not
stopped. **Re-enabling is reconciliation-gated** (hazard doc Sec 3 item 9,
§1.1 above).

## 6. Deploy to Development runs — MEASURED, newest first

```
$ [github API] list_workflow_runs(deploy-dev.yml), default (newest-first) order
total_count: 2961
newest run: id 29841468909, created_at 2026-07-21T14:55:26Z
```

**No run exists on or near 2026-09-04** — the
newest run is 45 days earlier than the secret's 2026-09-04 retrieval date
recorded at §3. **The secret retrieval is not explained by a `Deploy to
Development` run, and its source is not established.** Nothing further is
speculated here about what did retrieve it.

## 7. What this revision does not do

- Does **not** start reconciliation.
- Does **not** choose a schema.
- Does **not** modify the secret or either RDS instance.
- Does **not** correct the `DEVELOPMENT_WORKFLOW.md:247` "F-Deploy-1 v1.49"
  citation (§3.4 Q3 above names the discrepancy; the fix is a separate edit).
- Does **not** edit `PROJECT_CONTEXT.md`. A context refresh reflecting this
  ruling is separate work, not performed here.
- **Mints no FD, XK, or PE number.** The FD, XK, and PE tails remain
  unminted.
- Made no host, AWS, database, or Cognito contact from any agent session.
  §3's evidence is Evoni's own console read, reported here, not reproduced
  by this session.
- **F-Deploy-1 remains CLOSED. Prod FROZEN.**

---

**Type:** Ruling. **Rules:** the Deploy to Development conflict (conflict
note §3.2, §3.2b). **Mints:** nothing. **Host/AWS/DB/Cognito contact (this
session):** none. **Prod FROZEN.**
