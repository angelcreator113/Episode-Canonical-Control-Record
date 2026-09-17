# F-Deploy-1 — Deploy-to-Development Freeze-Statement Conflict, MEASURED Read

**Basis:** `origin/main` at `33cbf0bd032d72b1123fcf128501d5c6b0b38e8d`, 2026-09-17.

```
$ git rev-parse origin/main
33cbf0bd032d72b1123fcf128501d5c6b0b38e8d
```

**Provenance:** Task #1499. Read-only. No dispatch performed. No host, AWS,
database, or Cognito contact made. Nothing ruled, nothing minted, nothing
ranked. This document quotes, side by side, every repository statement it
found about whether dispatching `Deploy to Development` is safe under the
production freeze, and records where they agree and where they conflict. It
takes no position on which statement governs.

---

## 1. The five quotes the issue named

### 1(a) `F-Deploy-1_PROD_SplitBrain_HAZARD.md` — header/status and Sec 3, in full

**This file lives at the repository root, not under `docs/audit/`** — confirmed
by `git ls-tree -r origin/main --name-only | grep -i splitbrain`, one hit:
`F-Deploy-1_PROD_SplitBrain_HAZARD.md`. `git cat-file -e
origin/main:docs/audit/F-Deploy-1_PROD_SplitBrain_HAZARD.md` exits 128 (path
does not exist there); `git cat-file -e
origin/main:F-Deploy-1_PROD_SplitBrain_HAZARD.md` exits 0. Recorded because
CLAUDE.md, PROJECT_CONTEXT.md, and DEVELOPMENT_WORKFLOW.md all cite this
filename without a path, and a reader who assumes `docs/audit/` will not find
it there.

**Header/status, lines 1–28, in full:**

> ```
> # [STOP] PROD SPLIT-BRAIN HAZARD -- DO NOT RESTART `episode-backend`
>
> > **FREEZE.** Do **not** `pm2 restart`/`pm2 reload`, reboot, deploy to, or edit
> > `/home/ubuntu/episode-metadata/.env` on the prod box `episode-backend`
> > (`54.163.229.144`, `i-02ae7608c531db485`) until the gated reconciliation
> > session has run. The running process serves the live populated database; the
> > on-disk `.env` points at a verified-empty one. Any process reload silently
> > swaps prod onto the empty DB -- boots clean, serves nothing, throws no error,
> > total silent data disappearance. The "wrong-looking" current state IS the safe
> > state. If a fresh session proposes a restart, an SG change, or an `.env` fix,
> > that proposal is wrong -- read this whole doc first.
> >
> > **UPDATE 2026-05-30 -- the freeze was BREACHED by automation.** An untagged
> > `claude/**` PR triggered Auto-merge to Dev -> Deploy to Development, which
> > reaches THIS box via shared-compute wiring and reloaded the frozen process. No
> > data lost (the reload landed on the live DB by luck). Both workflows are now
> > DISABLED. The freeze covers AUTOMATED triggers too, not just manual ones.
> > Re-enabling the workflows is gated behind reconciliation. Full record:
> > `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md`.
>
> | | |
> |---|---|
> | **Parent keystone** | F-Deploy-1, Phase B G2 |
> | **Status** | ACTIVE HAZARD -- blocks Sec 4.2 memory-profile hard gate. NOTE: box reloaded by the 2026-05-30 incident; now on port 3002 with a route-loading bug. Sec 1's "never restarted" description is pre-incident; see Sec 7. |
> | **Severity** | P0. Confirmed catastrophic-on-restart. |
> | **First surfaced** | 2026-05-29 (read-only inspection), refined 2026-05-30 |
> | **Resolution** | Gated schema-fork reconciliation in its own session; verified `episode-control-dev` backup taken first |
> | **Supersedes** | `F-Deploy-1_PhaseB_G2_S4.2_BlockedFinding.md` (local/gitignored first-pass; its Sec 3 "contents UNVERIFIED" is now resolved -- see Sec 2.3 here) |
> ```

**Sec 3, lines 119–146, in full:**

> ```
> ## Sec 3 What must NOT be done before reconciliation
>
> Each is a real shared-state change and a Draft -> Confirm -> Execute (Rule 7)
> boundary. None is taken inside an investigation. Prod is stable (2-day+ uptime,
> 0 restarts) but **fragile** -- the highest-risk action is anything that reloads the
> on-disk config.
>
> 1. Do **not** `pm2 restart` / `pm2 reload` `episode-api` or `episode-worker`.
>    This is the single most dangerous action available.
> 2. Do **not** reboot the prod box or let a deploy run against it (deploy restarts
>    PM2 -> same switch).
> 3. Do **not** edit `/home/ubuntu/episode-metadata/.env` -- neither to "fix" it to
>    `-dev` nor otherwise. Editing then restarting is the same hazard; editing
>    without restarting just adds a third disagreeing state.
> 4. Do **not** `pm2 save` -- it doesn't capture env values anyway, and if a saved
>    list already exists, a reboot replays the process but **re-reads `.env` at
>    boot** -> same switch. Treat reboot as equivalent to restart for risk.
> 5. Do **not** modify, stop, or delete either RDS instance.
> 6. Do **not** migrate or copy data between instances.
> 7. Do **not** deploy the dev box pointed at either instance.
> 8. Do **not** change SG `sg-0164d0b20fbebacbb` as a "fix" -- AF is logged for the
>    post-G2 sweep; touching it now is out-of-band scope and unnecessary (the box
>    already reaches `-prod` fine; the only barrier is the password).
> 9. Do **not** re-enable the `Deploy to Development` or `Auto-merge to Dev`
>    workflows (both DISABLED 2026-05-30). They reach THIS box via shared compute;
>    an untagged `claude/**` PR auto-deploys to prod. The `[skip-automerge]` commit
>    tag is NOT a sufficient guard -- the disabled workflows are the real guard.
>    Re-enabling is a reconciliation-gated decision. See Sec 7.
> ```

**MEASURED. Last touched 2026-05-30** (two commits that date; see §4 below) —
**never revised since**, including through the 2026-07-10 rewrite and the
2026-07-14 re-enablement recorded elsewhere in this document.

### 1(b) `PROJECT_CONTEXT.md` §7 "What is safe today" and §0 item 8

**§0 item 8, line 18, in full:**

> 8. **Branch protection on `main`** requires three checks (Cost Exposure Audit, Tests, Route Validation), zero reviews, and admins can bypass. Auto-merge to `dev` and Deploy to Production are `disabled_manually`. Deploy to Development is active but `workflow_dispatch` only, via SSM.

**§7, lines 337–353 (table rows for the two boxes and the workflow row, plus
the freeze-rules and safe-today lines), quoted in full:**

> ```
> | Prod box `episode-backend` | `i-02ae7608c531db485`, 54.163.229.144, t3.small, Ubuntu 22.04, no IAM instance profile (so no SSM). Runs `episode-api-prod-hotfix` on :3000 (process started 2026-07-11 by an unrecorded actor) and `episode-worker` (stopped). Code on disk is debris from failed deploy-dev run 28289269164 (2026-06-27), before the Aug auth fixes; the login disable was hand-applied 2026-08-22. |
> | Dev box `episode-dev-backend` | `i-016395bb5f7a51a0b`, EIP 54.87.253.45, t3.small, SSM-managed, role `episode-dev-backend-role`; deployed by manual `workflow_dispatch` of `deploy-dev.yml` (OIDC role `episode-gha-deploy-dev`, artifact via S3, DB creds from Secrets Manager `episode-metadata/dev/database`). |
> ...
> | Workflows (MEASURED via API) | `Validate` active; `Deploy to Development` active, dispatch-only; `Deploy to Production` and `Auto-merge to Dev` `disabled_manually`; a Copilot cloud agent workflow exists with no file in the tree. |
> ...
> **Freeze rules (from the hazard doc Sec 3):** no `pm2 restart/reload/save/delete`, no reboot, no deploy, no `.env` edit, no RDS modification, no data copy between instances, no SG "fixes", no re-enabling the disabled workflows. Reconciliation is its own gated session with a verified canon backup first.
>
> **What is safe today:** local development against Docker Postgres; cloud sessions and laptop CLI on branches; PRs to `main`; dispatching `Deploy to Development` (Evoni, from a browser, Rule 7).
> ```

**Line 351 cites "the hazard doc Sec 3" and, in the same breath, lists "no
re-enabling the disabled workflows" as a freeze rule** — while line 353,
immediately below it, names dispatching `Deploy to Development` as safe. Both
lines are read together in §3 below.

### 1(c) `DEVELOPMENT_WORKFLOW.md` — every row about Deploy to Development, dev deploys, or workflow dispatch

Two hits from `## 7. What stays human (Evoni-only), and the safe way to do it`,
lines 243–248, and one from line 45:

> ```
> | Action | Why it is not for an agent | Safe procedure |
> |---|---|---|
> | Anything on the production box (`episode-backend`, 54.163.229.144): process manager, reboot, `.env`, deploy | Split-brain: the running process serves the populated canon RDS instance; the on-disk `.env` points at the empty one. A reload silently swaps prod onto empty. | Only inside the gated reconciliation session described in `F-Deploy-1_PROD_SplitBrain_HAZARD.md`, with a verified backup first. |
> | Any AWS CLI or console action | Amd30 §AF2.6: an agent session ran an AWS enumeration that was authorized for Evoni personally; ruled a crossing. | You run it in your own terminal, paste the output into a session if it needs to be recorded, and the session files it as ATTESTED. |
> | Dispatching `Deploy to Development` (workflow_dispatch, SSM path) | Authorized manual lever (F-Deploy-1 v1.49). Needs a browser (GitHub Mobile cannot dispatch). | Rule 7: draft the reason in the session, confirm, dispatch from the github.com Actions tab yourself. |
> | Enabling `Deploy to Production` or `Auto-merge to Dev` | Both `disabled_manually`; re-enabling is reconciliation-gated. | Not before the reconciliation session. |
> ```
>
> Line 45: `| **GitHub Mobile** on the phone | Review diff, approve, squash-merge, comment, create issues. It cannot dispatch `workflow_dispatch` workflows (use a browser). | |`

**The citation "(F-Deploy-1 v1.49)" does not verify.** `grep -n -i "Deploy to
Development\|workflow_dispatch\|dispatch" docs/audit/F-Deploy-1_Fix_Plan_v1.49.md`
returns no matches; that document (§4 below) is about the dev-deploy
transport rewrite's second effect (eliminating cross-environment write), and
never uses the phrase "Authorized manual lever" or names re-enablement.
Recorded as a citation that does not resolve to the text it points at — not
adjudicated further here.

### 1(d) `CLAUDE.md`'s freeze bullet

Line 11, in full:

> - **Production is FROZEN.** No `ssh`, `scp`, `pm2`, RDS connections, server `.env` edits, or workflow enable/dispatch from any agent session, ever. Evoni does those herself. See `F-Deploy-1_PROD_SplitBrain_HAZARD.md`.

**This statement is about who may act (never an agent session), not about
whether the action is safe when Evoni performs it.** It groups "workflow
enable" and "workflow dispatch" together as agent-forbidden, without
distinguishing re-enabling a `disabled_manually` workflow from dispatching an
already-`active` one — a distinction DEVELOPMENT_WORKFLOW.md's table (§1(c)
above) does draw.

### 1(e) `F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` — database and credential-source statements

§7, lines 190–226, in full:

> ```
> 2. The on-box script (§6.4, step 11), against whatever database
>    `scripts/print-db-env.js` resolves at deploy time via the instance role
>    (per the workflow's own header comment, this reads the Secrets Manager
>    secret named `episode-metadata/dev/database` — a name, not a host or
>    endpoint this document verifies):
>    ```bash
>    if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
>      echo '⚠ Migration failed — trap will still restart PM2 so the site stays up'
>      MIGRATION_FAILED=true
>    fi
>    ```
>
> **What this step actually writes schema against is NOT VERIFIABLE FROM
> REPO.** `print-db-env.js`'s output is resolved at runtime from that secret;
> this document does not read that script's body and has made no Secrets
> Manager call (guardrail: no AWS contact). The secret's *name* contains
> `dev`, but a name is not a target:
>
> ```
> $ git show origin/main:CLAUDE.md | grep -n -i "rds\|episode-control-dev\|neon"
> 19:- Backend: Node 20, Express 5, Sequelize 6, PostgreSQL 15 on **AWS RDS** (canon instance is misleadingly named `episode-control-dev`; not Neon). `src/app.js` composes everything. PM2 on EC2, nginx.
> ```
>
> `CLAUDE.md` line 19, read at this same basis, records that this project's
> one canon PostgreSQL RDS instance carries the name `episode-control-dev`
> and calls that naming "misleading." Nothing read here establishes that
> `episode-metadata/dev/database` resolves to that instance, and nothing
> read here rules it out — the standing is NOT VERIFIABLE FROM REPO, on
> both ends of the question.
> ```

§12, lines 391–400, in full:

> ```
> ## 12. What this document does not do
>
> Mints no FD, XK, or PE number. Rules nothing. Proposes no remedy. States no
> opinion on whether dispatching `deploy-dev.yml` now would be safe. Makes no
> host, AWS, database, or Cognito contact — every claim above is either a
> `git show`/`git cat-file`/`grep` read against the cloned repository at the
> stated basis SHA, or a direct quotation of that read. **Prod FROZEN**,
> unaffected by anything in this document (this workflow targets
> `episode-dev-backend`/the `development` GitHub environment only; no path in
> it touches production).
> ```

**This is the one document among the five that explicitly declines to say
whether dispatch is safe**, while also stating (§12) that the workflow's own
*trigger and target* are the `development` GitHub environment / instance tag
`episode-dev-backend` — not production — leaving only the on-box migration's
ultimate database target as NOT VERIFIABLE FROM REPO.

---

## 2. Broader sweep — `grep -rn -i 'deploy to development\|deploy-dev' --include='*.md' .` (excluding `docs/archive/`)

**Command and count:**

```
$ grep -rn -i 'deploy to development\|deploy-dev' --include='*.md' . | grep -v '/docs/archive/' | wc -l
400
```

400 hits across the register, most of them procedural mentions from the
2026-06 through 2026-07-10 planning/implementation window (the `deploy-dev.yml`
retargeting project, `F-Deploy-1_PhaseB_G2_Implementation*.md`,
`F-Deploy-1_Fix_Plan_v1.0`–`v1.42`), which describe *how* the workflow was
being rebuilt rather than asserting a current safety/permission standing. The
full raw grep output (400 matched lines) has been preserved for this task and
is available in the working session; it is not reproduced line-for-line here
because the great majority are non-adjudicative procedural references already
superseded by their own later revisions in the same chain. **Every hit that
makes a standing safety or permission statement — i.e., asserts whether
dispatching is currently allowed, dangerous, or targets prod — is quoted
below, in date order, none omitted.**

| Date | File | Statement |
|---|---|---|
| 2026-05-30 | `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md:19` | `"Deploy to Development" SSHed to `EC2_HOST` -- which resolves to the **prod box** `episode-backend` (`54.163.229.144`), NOT a separate dev box. This is the shared-compute wiring: the "dev" deploy targets prod compute.` |
| 2026-05-30 | `F-Deploy-1_Fix_Plan_v1.7.md:51` (FD-35) | `The Auto-merge to Dev -> Deploy to Development workflow chain reaches the prod box episode-backend via shared-compute wiring... both workflows DISABLED... Re-enabling them, and gating them so they cannot reach the prod box, is a reconciliation-gated decision.` |
| 2026-07-09 | `F-Deploy-1_Fix_Plan_v1.26.md:120` (§3.5) | `Deploy to Development (224506682) is likewise disabled_manually, in addition to its YAML-layer disablement.` |
| 2026-07-10 | `F-Deploy-1_Fix_Plan_v1.30.md:36` | `Review conclusion: deploy-dev.yml at HEAD is not a re-enable-in-place candidate. The file is written for the shared-box topology throughout... Re-enablement without rewrite re-arms R3 onto .144.` (this is the document that specs the SSM/separate-instance rewrite, FD-57) |
| 2026-07-14 | `F-Deploy-1_Fix_Plan_v1.43.md:67` (§2) | `Enabling ≠ running: workflow_dispatch is the only trigger. Executed: gh workflow enable 224506682; verified active; prod and auto-merge untouched.` |
| 2026-08-22 | `Prime_Studios_Audit_Handoff_v23.md:155–162` | ``Deploy to Development` (224506682) is `active` at the API layer. F-Deploy-1 v1.26 Sec 3.5 records it as `disabled_manually`; it is not... The file was rewritten 2026-07-10 under F-Deploy-1 v1.30 Sec 5 / FD-57... **the transition is recorded in no document read for v23.**` |
| 2026-08-22 | `F-Deploy-1_Fix_Plan_v1.49.md` | `The present path cannot do this [write to production]. It addresses an instance tag, not a host; it targets a dedicated development instance; and there is no host secret for a misconfiguration to point at the wrong box. A failed development deploy can no longer write to production.` |
| 2026-08-22 | `FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md:218` | `Deploy to Development` is **active**, manual-dispatch-only, and per v2.60 its latest verified end-to-end run was against `1844e56b`.` |
| 2026-08-27 | `F-AUTH-1_Fix_Plan_v2.60.md:108–118` (§2.3) | `v1.43 §2 records the Rule 7 re-enablement decision and execution... "Enabling ≠ running: workflow_dispatch is the only trigger." Deploy to Development changed from disabled_manually to active while Auto-merge to Dev and Deploy to Production remained disabled.` (this is the document that answers v23's "recorded in no document" gap) |
| 2026-08-27 | `Prime_Studios_Audit_Handoff_v25.md:228` | `Deploy to Development | deploy-dev.yml | active (2026-07-14) | workflow_dispatch only — no push trigger` |
| 2026-08-28 | `v25_Owed_Index_Amd11_2026-08-28.md:370,383` | `Deploy to Development | .github/workflows/deploy-dev.yml | active | workflow_dispatch only`; `deploy-dev.yml is active and cannot fire without a human.` |
| 2026-09-02 | `DEVELOPMENT_WORKFLOW.md:247` | quoted in full at §1(c) above — "Authorized manual lever." |
| 2026-09-03 | `Prime_Studios_Audit_Handoff_v26.md:327` | `Deploy to Development     active              .github/workflows/deploy-dev.yml (workflow_dispatch only)` |
| 2026-09-12 | `F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` | quoted in full at §1(e) above — declines to state a safety opinion; MEASURED that trigger/target is `development`/`episode-dev-backend`, migration target NOT VERIFIABLE FROM REPO. |
| 2026-09-16 | `PROJECT_CONTEXT.md:353` | quoted in full at §1(b) above — "dispatching `Deploy to Development` (Evoni, from a browser, Rule 7)" listed as safe today. |

**Not included in the table above** (procedural/planning references, not
safety or permission statements): every hit inside
`F-Deploy-1_PhaseB_G2_Implementation*.md` (v1, v1.1–v1.4) describing the
retargeting *plan* before it shipped; hits inside `F-Deploy-1_Fix_Plan_v1.0`
through `v1.42` that record intermediate prerequisite states
(`disabled_manually, unchanged`, IAM/OIDC provisioning, etc.) already
superseded by the 2026-07-14 re-enablement; `F-Deploy-1_G1_Audit.md`'s
findings (F-Deploy-G1-A through -U), which describe the pre-rewrite failure
modes the 2026-07-10 rewrite was built to close; and mentions in
`.github/agents/deploy.agent.md`, `.github/prompts/deploy-dev.prompt.md`,
`README.md`, and `.claude/desktop/PROMPT_LIBRARY.md` that either point at
other documents or are themselves named STALE by `PROJECT_CONTEXT.md` §9 and
`CLAUDE.md`'s stale-files list (not adjudicated here on that basis — recorded
only that they exist).

---

## 3. Agreement and conflict, MEASURED by text only

### 3.1 What every current (2026-07-14 or later) source agrees on

Every document dated 2026-07-14 or later that states the workflow's API
state agrees: **`Deploy to Development` is `active`, `workflow_dispatch`
only, no `push` trigger** (v1.43, v23, v1.49, FD-69, v2.60, v25, Amd11, v26,
PROJECT_CONTEXT, DEVELOPMENT_WORKFLOW). None of these documents describes it
as reaching the prod box.

### 3.2 The conflict

**`F-Deploy-1_PROD_SplitBrain_HAZARD.md` Sec 3 item 9** (§1(a) above, dated
2026-05-30, never revised) states: *"Do not re-enable the `Deploy to
Development` ... workflow[]. They reach THIS box via shared compute; an
untagged `claude/**` PR auto-deploys to prod... Re-enabling is a
reconciliation-gated decision."*

**`PROJECT_CONTEXT.md` §7** (§1(b) above, dated 2026-09-16) states, in the
same breath as citing "the hazard doc Sec 3": *"no re-enabling the disabled
workflows"* as a freeze rule (line 351) — then two lines later lists
*"dispatching `Deploy to Development` (Evoni, from a browser, Rule 7)"* under
*"What is safe today"* (line 353).

**These two statements, read together, disagree on the current status of the
same workflow.** The hazard doc's text treats `Deploy to Development` as one
of "the disabled workflows" that must not be re-enabled; PROJECT_CONTEXT.md's
own MEASURED workflow table (line 347, same document) records it as
`active`, not `disabled_manually`, and separately calls dispatching it safe.
**What would resolve it:** whether the hazard doc's Sec 3 item 9 is read as
referring to the *pre-2026-07-10* `deploy-dev.yml` (the version that,
per Fix Plan v1.30 §2, ran over SSH against the shared box) or as a standing
prohibition that survives the 2026-07-10 rewrite and 2026-07-14
re-enablement regardless of what the workflow file now does. The hazard doc
itself does not say, because it has not been touched since 2026-05-30 (§4
below) — this is a textual absence, not a resolution.

### 3.2b A second conflict: Sec 3 item 7 against the same PROJECT_CONTEXT.md line

**Sec 3 item 7** (§1(a) above, line 88, dated 2026-05-30, never revised)
states: *"Do **not** deploy the dev box pointed at either instance."*

**PROJECT_CONTEXT.md §7 line 353** (§1(b) above, dated 2026-09-16) states,
within *"What is safe today"*: *"dispatching `Deploy to Development` (Evoni,
from a browser, Rule 7)."*

**This is a conflict separate from §3.2's item 9 conflict.** Item 9's stated
rationale is shared compute — *"They reach THIS box via shared compute; an
untagged `claude/**` PR auto-deploys to prod"* — a rationale Fix Plan v1.49
states the 2026-07-10 rewrite (Fix Plan v1.30, FD-57) addresses: the dev box
is now a dedicated instance (`episode-dev-backend`), not the shared box.
**Item 7's text carries no such rationale and does not depend on shared
compute.** It says "the dev box pointed at either instance" — either RDS
instance, `-dev` or `-prod` — a statement about which *database* a dev
deploy is pointed at, not which *EC2 host* it runs on. Nothing in the
2026-07-10 rewrite that separated the EC2 hosts speaks to which RDS instance
the dev box's deploy targets.

**What would resolve it is the same open question named at §3.4 item 2.**
`F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` §7 states the on-box
migration's actual database target — resolved at deploy time from the
Secrets Manager secret `episode-metadata/dev/database` — is NOT VERIFIABLE
FROM REPO, and `CLAUDE.md` line 19 separately records that the canon
(production) RDS instance is *named* `episode-control-dev`. **Item 7's text
names "either instance"** — the hazard doc's own Sec 2.2 and Sec 2.3 (same
document as §1(a), not quoted there in full) name the two as
`episode-control-dev` ("the real, live data store") and
`episode-control-prod` ("verified EMPTY"); `PROJECT_CONTEXT.md` §7 (lines
343–344, not quoted at §1(b) above) names the same two RDS instances by the
same names. **If the dev secret resolves to either of those two, item 7's
prohibition is implicated on dispatch; only a database that is neither of
them falls outside its text.** This document does not resolve which.

### 3.3 The narrower, resolved-by-date sub-question: was the re-enablement itself ever recorded?

`Prime_Studios_Audit_Handoff_v23.md` (2026-08-22) states the transition
"is recorded in no document read for v23." `F-AUTH-1_Fix_Plan_v2.60.md`
(2026-08-27, five days later) states it was: `F-Deploy-1_Fix_Plan_v1.43.md`
§2 (2026-07-14) — quoted in the table at §2 above — records `gh workflow
enable 224506682` as an executed action. **These two do not conflict on the
same date-ordered reading**: v23 did not find the record; v2.60, checking
after v23, found it in a fix-plan revision v23 apparently had not read.
Recorded because it bears on why the hazard doc's silence (§3.2) persisted
through v23's own audit pass without correction — v23 flagged the gap and
did not close it; nothing in this document adjudicates whether v2.60's later
find should have prompted a hazard-doc banner (register immutability, per
`CLAUDE.md`, permits only additive banners, not silent edits — no such
banner exists on the hazard doc at this basis, per §4 below).

### 3.4 What would resolve 3.2, restated as questions this document does not answer

1. Does a document dated 2026-05-30, naming a *specific* workflow
   configuration ("shared compute," pre-rewrite), continue to govern after
   that configuration was rewritten (2026-07-10) and the register's own
   later documents (§2 table) describe the new configuration as not reaching
   prod? Or does Sec 3 item 9's prohibition attach to the *workflow name*
   regardless of implementation?
2. `F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md` §7 states the on-box
   migration's actual database target is NOT VERIFIABLE FROM REPO — the
   Secrets Manager secret name (`episode-metadata/dev/database`) is not
   itself evidence of which RDS instance it resolves to, and `CLAUDE.md`
   line 19 separately records that the canon (production) RDS instance is
   *named* `episode-control-dev`. Resolving this requires reading that
   secret's value or the resolved connection at deploy time — both are
   guardrailed against in this task and were not done here.
3. Does the `F-Deploy-1 v1.49` citation in `DEVELOPMENT_WORKFLOW.md:247`
   need correcting to point at the document that actually contains the
   "Rule 7 re-enablement decision and execution" language — `F-Deploy-1_Fix_Plan_v1.43.md`
   §2 (§2 table above), not `v1.49`?

None of these three is resolved here.

---

## 4. Dates

```
$ git log -1 --format='%H %ad' --date=short -- F-Deploy-1_PROD_SplitBrain_HAZARD.md
2af896e673fb783995a8854cce9eb4654db59b6f 2026-05-30

$ git log -1 --format='%H %ad' --date=short -- PROJECT_CONTEXT.md
4b173440d34b7bfbce40f2d637caa8e6ec53bd72 2026-09-16

$ git log -1 --format='%H %ad' --date=short -- DEVELOPMENT_WORKFLOW.md
cc8661ab01076a3fb0b9de68c6ead5de7358bfd4 2026-09-02

$ git log -1 --format='%H %ad' --date=short -- CLAUDE.md
237da78408b2edc358e3e232a312a94831ef1565 2026-09-16

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_DeployDev_DispatchRead_2026-09-12.md
9c41479d50a115aff3f963341a60876b2a0a4a95 2026-09-12

$ git log -1 --format='%H %ad' --date=short -- F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md
16398df480ebcb7ce7469d0dc891d7fe6b69fa5f 2026-05-30

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_Fix_Plan_v1.7.md
b6e7eb5fb1280c01f1843a1eb37384c711f33f29 2026-05-30

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_Fix_Plan_v1.26.md
404740f6f807d6a15ea757ab22585278e6745e0c 2026-07-09

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_Fix_Plan_v1.30.md
edc51c1f3e0acb87594b6736a45fc46a9cd16a2c 2026-07-10

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_Fix_Plan_v1.43.md
9f3986f492645737d2e22419243d0ed55f420c59 2026-07-14

$ git log -1 --format='%H %ad' --date=short -- docs/audit/Prime_Studios_Audit_Handoff_v23.md
4318a9840e8b782c3a7b544e725a8fd0473c1a94 2026-08-22

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-Deploy-1_Fix_Plan_v1.49.md
4998ac91022d84cd6857856abc04dea1fba5ff2c 2026-08-22

$ git log -1 --format='%H %ad' --date=short -- docs/audit/FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
a5dfe4672796f6538ffc22f1641ede4abce621a7 2026-08-22

$ git log -1 --format='%H %ad' --date=short -- docs/audit/F-AUTH-1_Fix_Plan_v2.60.md
9d4ea804c3524a05862cf7ac3a248723ba49e815 2026-08-27

$ git log -1 --format='%H %ad' --date=short -- docs/audit/Prime_Studios_Audit_Handoff_v25.md
9d4ea804c3524a05862cf7ac3a248723ba49e815 2026-08-27

$ git log -1 --format='%H %ad' --date=short -- docs/audit/v25_Owed_Index_Amd11_2026-08-28.md
bed437b1db4f58c8fc7f751cb1d7d009a8eb0d97 2026-08-28

$ git log -1 --format='%H %ad' --date=short -- docs/audit/Prime_Studios_Audit_Handoff_v26.md
ee522f1c70e1e5f5a7f1b22646de30a89a1d16e1 2026-09-03
```

**`git log --follow --format='%H %ad %s' --date=short -- F-Deploy-1_PROD_SplitBrain_HAZARD.md`
shows two commits, both 2026-05-30, and none since:**

```
2af896e673fb783995a8854cce9eb4654db59b6f 2026-05-30 docs: hazard doc - freeze now covers automated deploy path; record 2026-05-30 breach (Sec 7) [skip-automerge] (#730)
9c7e706b958f0a6f06995f02f43f8942a38a4694 2026-05-30 docs: add prod split-brain hazard record + onboarding pointer (F-Deploy-G2 S4.2) [skip-automerge] (#723)
```

**Does `PROJECT_CONTEXT.md`'s statement postdate the hazard doc's Sec 3?
Yes** — `PROJECT_CONTEXT.md` was last touched 2026-09-16; `F-Deploy-1_PROD_SplitBrain_HAZARD.md`
was last touched 2026-05-30, 109 days earlier, and Sec 3 was part of that
2026-05-30 filing (both commits shown above predate every other file's date
in this document). `CLAUDE.md`, `DEVELOPMENT_WORKFLOW.md`, and every §2-table
document dated 2026-07-10 or later likewise postdate it.

---

## 5. What this note does not do

- **Does not rule which statement governs.** It does not decide whether the
  hazard doc's Sec 3 item 9 still binds `Deploy to Development` after the
  2026-07-10 rewrite, or has lapsed by supersession. That is for a ratifying
  revision or for Evoni directly.
- **Does not authorize or forbid a dispatch.** Nothing here is a Rule 7
  decision, and this document does not proceed toward one.
- **Does not edit `PROJECT_CONTEXT.md`, `CLAUDE.md`, `DEVELOPMENT_WORKFLOW.md`,
  or `F-Deploy-1_PROD_SplitBrain_HAZARD.md`.** No existing file is modified.
  Per the register's immutability rule, if the hazard doc needs a correction,
  that is an additive, dated banner filed separately — not done here.
- **Does not resolve which database `episode-metadata/dev/database` points
  at.** That requires a Secrets-Manager or host read, both out of scope and
  guardrailed against for this task.
- **Does not correct the `DEVELOPMENT_WORKFLOW.md:247` citation of "F-Deploy-1
  v1.49."** §3.4 item 3 names the discrepancy; fixing the citation is a
  separate edit to a live document, not performed here.
- **Mints no FD, XK, or PE number.** Ranks no source above another.
- Made **no host, AWS, database, or Cognito contact.** Every claim above is a
  `git`/`grep` read against the cloned repository at the basis SHA above, or
  a direct quotation of such a read.
- **Prod FROZEN.** Nothing in this document changes that standing, and this
  document does not itself touch production or the dev box.

---

**Type:** Standalone MEASURED read. **Rules:** nothing. **Mints:** nothing.
**Host/AWS/DB/Cognito contact:** none. **Prod FROZEN.**
