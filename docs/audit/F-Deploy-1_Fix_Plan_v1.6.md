# F-Deploy-1 Fix Plan v1.6

**Phase B G2 Sec 4.2 re-characterized as BLOCKED -- prod split-brain (FD-31) discovered during Sec 4.2 pre-execution inspection; FD-31 through FD-34 registered; reconciliation planning recorded**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.5 (FD-29/FD-30 register-hygiene, merged via PR #720 lineage / `5067b976`) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Hazard record reference** | `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root, merged 2026-05-30 via PR #723, commit `9c7e706b`) |
| **G2 implementation doc reference** | `docs/audit/F-Deploy-1_PhaseB_G2_Implementation_v1.2.md` (main, PR #722) |
| **Author start date** | 2026-05-30 |
| **Author session** | Single session, post-hazard-doc-merge (PR #723) |
| **Status** | DRAFT v1.6 |
| **Gate transition** | None forward. v1.6 re-characterizes Sec 4.2 from "NOT REACHED" to "BLOCKED on FD-31." This is the recording of a discovered blocker, not a gate regression and not a gate advance. No gate closes; none moves position. |

## Sec 1 Purpose

v1.6 records into the decision register the finding set surfaced during F-Deploy-1 Phase B G2 Sec 4.2 pre-execution inspection (2026-05-29/30), re-characterizes the Sec 4.2 hard gate accordingly, and records the reconciliation as a planned-but-unauthorized future session. Specifically:

1. **Prod three-axis split-brain discovered and confirmed (FD-31, P0).** The Sec 4.2 memory-profile gate's pre-execution investigation -- begun to locate dev DB credentials after Secrets Manager was found empty -- surfaced that the production backend's running process and its on-disk `.env` disagree on database host, credentials, AND schema lineage, and that the two `episode_metadata` databases have forked (not drifted). Full detail in the committed hazard record (PR #723) and Sec 5 here.

2. **Sec 4.2 re-characterized from NOT REACHED to BLOCKED.** v1.5 Sec 7.3 listed Sec 4.2 as "NOT REACHED," accurate when v1.5 shipped but now misleading: it reads as merely next-in-line/executable. The inspection proved Sec 4.2 is not executable as the contract specifies it -- the credential mechanism it assumes does not exist, and the dev box's DB target cannot be safely chosen while the split-brain stands. v1.6 moves Sec 4.2's status to BLOCKED on FD-31. Detail in Sec 4 and Sec 7.

3. **FD-31 through FD-34 registered.** The four entries staged as "draft v1.6 register entries" in the hazard record graduate into formal register decisions: FD-31 (S4.2-A, split-brain P0), FD-32 (S4.2-B, Secrets-Manager assumption dead), FD-33 (S4.2-C, leaked secrets + rotation state), FD-34 (G1-AF, prod RDS internet-open). Detail in Sec 6.

4. **Reconciliation recorded as a gated future session, with a planning skeleton.** The split-brain resolution is sequenced, its hard prerequisite named (verified `episode-control-dev` backup first), and its open decisions framed -- explicitly as a plan, NOT as an execution authorization. Detail in Sec 8.

5. **Audit-gap assessed.** The G1 audit found shared compute but never shared database; v1.6 assesses this for a new F-Deploy-G1 sub-finding. Detail in Sec 9.

What v1.6 does NOT do:
- **Does not advance or close any gate.** Sec 4.2 moves from not-reached to blocked; no gate closes, none advances position. Phase B G2 close (G2 doc Sec 4.6) remains far off, now behind FD-31.
- **Does not authorize, schedule, or begin reconciliation.** Sec 8 is a plan. The hazard record Sec 6 and this doc Sec 8 both state: own deliberate session, fresh eyes, backup-verified-first, explicitly not in this session.
- **Does not touch, restart, reboot, deploy to, or edit `.env` on the prod box.** The freeze (hazard record, do-not list) is inherited and reaffirmed.
- **Does not carry Sec 4.2 memory-profile data or resolve FD-27 (t3.micro).** That data still does not exist -- Sec 4.2 cannot run until FD-31 resolves. Deferred, as in v1.5.
- **Does not revise the G2 contract.** The contract reconciliation (v1.3+: drop Secrets-Manager assumption, name on-disk creds, state dev-box DB target) is named as required (FD-32) but is its own artifact, drafted alongside reconciliation.
- **Does not close FD-34 (G1-AF) or change SG `sg-0164d0b20fbebacbb`.** Logged for the post-G2 security sweep; touching it now is out of scope.

## Sec 2 Reference documents

| Document | Section reference | Role in v1.6 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.5.md` (main, PR #720 lineage) | Sec 6 (FD-29, FD-30); Sec 7.3 (state-of-play table) | Immediate predecessor. v1.6 inherits the register through FD-30 and the gate state, and re-characterizes Sec 4.2 from v1.5 Sec 7.3's "NOT REACHED." |
| `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root, PR #723, `9c7e706b`) | Full doc | Canonical hazard record. Source of the FD-31-FD-34 finding detail. v1.6 formalizes its staged register entries into FD decisions. The hazard record is operative authority for the freeze; v1.6 does not duplicate the do-not list, it cites it. |
| `docs/audit/F-Deploy-1_PhaseB_G2_Implementation_v1.2.md` (main, PR #722) | Sec 4.1 (provisioning gate), Sec 4.2 (memory-profile hard gate), Sec 5.1 (creds assumption) | G2 contract under execution. The contract Sec 4.2 is what FD-31 blocks; Sec 4.1/Sec 4.2/Sec 5.1 are what FD-32 requires revised. |
| `docs/audit/F-Deploy-1_G1_Audit.md` (main, PR #698) | F-Deploy-G1-G (shared compute); F-Deploy-G1-AF (SG exposure) | Source audit. FD-31 attaches as sub-finding F-Deploy-G2-S4.2-A; the audit-gap (Sec 9) assesses whether shared-database warrants a new G1 sub-finding ID. |
| `docs/audit/Prime_Studios_Audit_Handoff_v10.docx` (main, PR #701) | Sec 4.2 (F-Deploy-1 keystone status) | Audit canonical state. Unchanged by v1.6; the audit-gap question (Sec 9) is flagged for the next handoff revision. |

**Git artifacts referenced in v1.6:**

| Artifact | What it is |
|---|---|
| PR #723 (squash commit `9c7e706b`) | Hazard record + onboarding pointer ship. Merged 2026-05-30 at mergeStateStatus CLEAN, all four checks green. The committed home of the FD-31-FD-34 finding detail. |
| `F-Deploy-1_PhaseB_G2_S4.2_BlockedFinding.md` (local, gitignored) | The 2026-05-29 first-pass note. Superseded by the hazard record (its Sec 3 left `-prod` contents UNVERIFIED; now resolved as empty). Retained locally as dated historical first-pass; not in version control. |

## Sec 3 What shipped between v1.5 and v1.6

### Sec 3.1 Read-only prod inspection (2026-05-29/30)

After v1.5 shipped, the Sec 4.2 pre-execution step -- confirming where dev DB credentials live, since the contract assumed a Secrets Manager secret -- was begun. Secrets Manager was found empty (FD-32). Tracing the real credential mechanism led to reading live process env and on-disk `.env` on the prod box, which surfaced the host/credential/schema disagreement. All inspection was read-only; no shared state on the prod box was changed. The prod RDS SG being internet-open on 5432 (FD-34) is the incidental reason the read-only inspection of `-prod` required no network change.

### Sec 3.2 Hazard record committed (PR #723)

The finding was promoted from the gitignored first-pass note into a committed root-level hazard record, `F-Deploy-1_PROD_SplitBrain_HAZARD.md`, with the freeze guardrail as its opening banner, plus a pointer from `docs/audit/NEW_CHAT_ONBOARDING.md` (banner + wake-up step 0). Merged via PR #723 (`9c7e706b`), CLEAN, four checks green. This ensures the freeze survives a context reset / fresh clone -- which the gitignored note could not. v1.6 is the register-layer counterpart: the hazard record protects the box; v1.6 protects the Fix Plan reader from treating Sec 4.2 as executable.

## Sec 4 Phase B G2 status at v1.6 -- Sec 4.2 re-characterization

Inherited from v1.5 Sec 4, with Sec 4.2 re-characterized:

- **G2 entry criteria**: satisfied (unchanged).
- **G2 implementation doc**: on main at v1.2 (PR #722).
- **Sec 4.1 provisioning**: the dev box (`episode-dev-backend`, `98.93.190.74`) exists and runs no app -- but Sec 4.1's gate criterion "IAM role can read `episode-metadata/dev/database`" cannot pass: that secret does not exist (FD-32). Sec 4.1 as written is itself blocked pending contract revision.
- **Sec 4.2 memory profile (hard gate)**: **BLOCKED on FD-31.** Previously "NOT REACHED." Sec 4.2 requires deploying a minimal build to the dev box and running a synthetic render workload, which requires a DB connection. The contract's creds mechanism (Secrets Manager) is dead (FD-32); the dev box's safe DB target cannot be chosen while the split-brain stands (a synthetic exercising write paths against `episode-control-dev` would write into the DB prod is live-serving); and the alpha dev/prod isolation premise is unestablished at the data layer (the audit isolated compute, not data -- Sec 9). Sec 4.2 is not executable until FD-31 resolves.

**Characterization, precisely:** Sec 4.2 did not regress. It was never open. The block was latent -- present since before v1.5 -- and the inspection surfaced it. v1.6 records a discovered blocker; it does not undo prior progress.

## Sec 5 The finding (summary; full detail in the hazard record)

v1.6 does not duplicate the hazard record. Summary for register context:

Production compute (`episode-backend`, `54.163.229.144`, `i-02ae7608c531db485`) runs a process last started pointed at the **dev-named** RDS instance `episode-control-dev`, which holds all real data (143 tables; episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605, ai_usage_logs 764). The on-disk `.env` points at the **prod-named** instance `episode-control-prod`, which is verified empty (171 tables, fully migrated, `count(*)` zero on all content tables). The two diverge on three axes -- host, credentials (distinct per-instance `postgres` passwords), and schema lineage (forked: 37 prod-only tables, 9 dev-only; neither a superset; dual migration frameworks; `decision_log`/`decision_logs` collision). A process reload (`pm2 restart`/reboot/deploy) reads the on-disk `.env`, connects cleanly to the empty prod DB, and serves empty with no error -- silent total data disappearance. Hence the freeze. Full provenance, table diff, do-not list: hazard record Sec 2-Sec 3.

## Sec 6 Decisions log -- additions FD-31 through FD-34

v1.5 ended at FD-30. v1.6 adds FD-31 through FD-34. Per the established convention, v1.6 records decisions surfaced during the Sec 4.2 inspection and cites the hazard record (PR #723) as their committed source, rather than claiming v1.6 originated them.

- **Decision FD-31: Production runs on `episode-control-dev`, which is the source of truth, and the prod box is frozen against any process reload until a gated schema-fork reconciliation resolves the split-brain. Sub-finding F-Deploy-G2-S4.2-A (P0).** The running prod process serves `episode-control-dev`/`episode_metadata` (143 tables, populated); the on-disk `.env` points at `episode-control-prod`/`episode_metadata` (171 tables, verified empty). The two databases are forked, not stale copies (37 prod-only tables -- a video/editing/script-tooling schema; 9 dev-only including a second migration framework; `decision_log`/`decision_logs` collision); neither is a superset. Any reload silently cuts production onto the empty prod DB; boots clean, serves empty, no error. This blocks Sec 4.2 (a synthetic workload cannot be safely targeted while the split-brain stands) and establishes the freeze: no `pm2 restart`/reload, reboot, deploy, or `.env` edit on `episode-backend`, and no modify/stop/delete/migrate on either RDS instance, until reconciliation. Resolution path: schema-canon decision + verified `episode-control-dev` backup taken first, in a dedicated gated session (Sec 8). (Hazard record PR #723, commit `9c7e706b`, Sec 2-Sec 3.)

- **Decision FD-32: The G2 contract's Secrets-Manager credential mechanism is abandoned; the real mechanism is on-box `.env`/process env with per-instance distinct passwords, and the contract (v1.3+) must be revised to match. Sub-finding F-Deploy-G2-S4.2-B (P1).** `aws secretsmanager list-secrets` returns empty; the assumed `episode-metadata/dev/database` secret does not exist (`ResourceNotFoundException`). The Sec 4.1 gate criterion "IAM role can read `episode-metadata/dev/database`" can therefore never pass as written, and Sec 4.2 inherits the block. Real credentials are supplied via on-box process env / on-disk `.env`; the two RDS instances have distinct `postgres` passwords. The contract revision must drop the Secrets-Manager assumption from Sec 4.1/Sec 4.2/Sec 5.1, name the on-disk mechanism, state the dev-box DB target (a DB that is neither the live `-dev` data nor an in-use instance), and record the per-instance credential split. The revision is drafted alongside the reconciliation (Sec 8), not in v1.6. (Hazard record PR #723, Sec 2.5.)

- **Decision FD-33: The `ANTHROPIC_API_KEY` exposed during inspection is rotated; the dev-instance `postgres` password rotation is deliberately deferred to the reconciliation cutover. Sub-finding F-Deploy-G2-S4.2-C (P1).** During the 2026-05-29 read-only inspection, the prod-process `DB_PASSWORD` (dev-instance `postgres`) and `ANTHROPIC_API_KEY` were exposed in plaintext in the session transcripts. The API key was **ROTATED 2026-05-30**. The dev-instance `postgres` password rotation is **deferred to the reconciliation cutover**: the working credential currently exists only in the running process's launched environment, with no on-disk file holding it (the on-disk `.env` carries the prod-instance password). Rotating now is safe for the live connection but would leave a stale credential in volatile process memory with nothing on disk to update, and the box is frozen against restart regardless. Folding the rotation into the gated cutover -- where a durable credential location is established -- avoids introducing a stray moving part before then. This is a sequencing decision, not an ignored exposure. (Hazard record PR #723, Sec 2.5 / Sec 4.)

- **Decision FD-34: Prod RDS internet-exposure (F-Deploy-G1-AF) is confirmed live and logged for the post-G2 security sweep; the SG is not changed now. Sub-finding F-Deploy-G1-AF (P0 exposure).** `episode-control-prod`'s SG `sg-0164d0b20fbebacbb` allows 5432 ingress from `0.0.0.0/0` -- the production DB port is reachable from the entire internet, gated only by password auth. This confirms the G2 contract Sec 9.7 AF prediction as live. It is the sole reason the read-only inspection of `-prod` required no network change. The SG is NOT changed in this session: a live SG change adjacent to a frozen prod box is out-of-band scope, and AF already ranks at the top of the contract's post-G2 security sweep (above AD/AE). Logged as a register decision so it cannot be dropped between now and the sweep. Incidentals for the sweep: `108.216.160.136/32` (specific public IP with prod-DB access -- confirm current/not stale); `10.2.0.0/16` (stale deleted-VPC route -- dead allow-list cleanup). (Hazard record PR #723, Sec 2.4.)

## Sec 7 What v1.6 unblocks / does not unblock / state of play

### Sec 7.1 What v1.6 unblocks

Nothing downstream. v1.6 records a blocker; it does not clear one. Its practical effect is protective: a future session reading the Fix Plan will see Sec 4.2 as BLOCKED on a named P0, not as the next executable step.

### Sec 7.2 What v1.6 does NOT unblock

**Phase B G2 close, Sec 4.2, Sec 4.1** -- all now gated behind FD-31 resolution (reconciliation). **F-Stats-1 Phase B G2 pilot, F-AUTH-1 fix execution, and the downstream keystone sequence** (F-App-1 -> F-Ward-1 -> F-Reg-2 -> F-Ward-3 -> F-Franchise-1/Director Brain -> F-Sec-3) -- all remain blocked behind F-Deploy-1's full close, now further behind FD-31. **Sec 6.5.1 route-table audit** -- deferred, unchanged.

### Sec 7.3 State of play at v1.6 close

| Tier | Item | Status |
|---|---|---|
| Phase A | Overall | CLOSED (inherited) |
| Phase B G1 | Gate close | CLOSED (inherited) |
| Phase B G2 | Implementation doc | AUTHORED -- on main at v1.2 (PR #722) |
| Phase B G2 | Sec 4.1 provisioning | BLOCKED -- Secrets-Manager creds criterion cannot pass (FD-32); dev-box DB target unsafe pending FD-31 |
| Phase B G2 | Sec 4.2 memory profile (hard gate) | **BLOCKED on FD-31** (was: NOT REACHED) |
| Phase B G2 | alpha implementation overall | BLOCKED behind FD-31 reconciliation |
| Phase B G2 | CI/CD posture (FD-29/FD-30) | CLOSED (inherited) |
| Reconciliation | Schema-fork resolution | PLANNED, gated, unauthorized -- own session, backup-first (Sec 8) |
| Phase C | All gates | NOT STARTED (blocked behind Phase B) |
| Register | FD entries | FD-1 through FD-34 (v1.6 adds FD-31-FD-34) |
| Prod box | `episode-backend` | FROZEN -- no restart/reboot/deploy/`.env` edit (hazard record; FD-31) |

**Path A discipline note:** FD-31-FD-34 add no scope to the fix cycle. They are findings surfaced during F-Deploy-1 Phase B G2 execution, recorded with the same recording-not-originating discipline v1.5 applied to FD-29/FD-30. FD-31 is a data-layer extension of the F-Deploy-G1-G shared-compute finding (see Sec 9); FD-34 is the confirmed-live form of the already-filed F-Deploy-G1-AF. No new keystone, no redesign.

## Sec 8 Reconciliation -- planning skeleton (NOT an execution authorization)

**This section is a plan, not a go-ahead.** Reconciliation is the resolution of FD-31. It executes in its own deliberate session, with fresh eyes, and only after its hard prerequisite is met. Nothing in Sec 8 authorizes any action on the prod box or either RDS instance now. The freeze stands.

### Sec 8.1 Hard prerequisite (gate-zero)

A **verified** backup of `episode-control-dev` (the live data) taken and confirmed-restorable **before any cutover action**. "Verified" means: backup taken, and its restorability confirmed (e.g. test-restore to a throwaway instance, row-count match against the live counts in Sec 5) -- not merely "a snapshot was triggered." No reconciliation step proceeds until this is green. Note: this is itself careful work on a populated production database and is the first action of the reconciliation session, not a precondition to be rushed through.

### Sec 8.2 The decisions reconciliation must make (framed, not made here)

1. **Schema canon.** Which schema is authoritative -- the live `-dev` (143 tables, the data) or the migrated `-prod` (171 tables, the superset-ish but empty)? The data lives on `-dev`; the fuller schema is on `-prod`. Neither is a clean superset, so this is a merge decision, not a pick.
2. **Fate of the 37 prod-only tables.** The video/editing/script-tooling cluster exists only on `-prod` (empty). Per table-group: abandoned (drop), or needs-porting-to-live (migrate the schema onto `-dev`)? Requires knowing whether that feature schema is live-roadmap or dead.
3. **The `decision_log` / `decision_logs` collision.** Singular on `-dev`, plural on `-prod`. Decide canonical name; reconcile any data.
4. **Dual migration frameworks.** `-dev` carries both `pgmigrations` and `SequelizeMeta`; `-prod` only `SequelizeMeta`. Decide the single canonical framework and reconcile bookkeeping so future migrations are deterministic. (This is a master-pattern-40-adjacent finding -- schema-source ambiguity -- worth flagging to the audit.)
5. **The cutover itself.** Once canon is decided: how running-state and on-disk-config are made to agree safely -- almost certainly correcting `.env` to match the chosen canon, at a planned moment, with a tested rollback and the verified backup in hand. This is the only step that touches the frozen box, and it is a full Rule 7 Draft -> Confirm -> Execute boundary in its own right.
6. **Dev-box Sec 4.2 target.** Separately: choose a DB target for the Sec 4.2 synthetic that is neither the live data nor an in-use instance, so the memory profile can eventually run without writing into production.

### Sec 8.3 Contract revision (FD-32), folded in

The G2 contract v1.3+ revision (drop Secrets-Manager, name on-disk creds, state dev-box target, record credential split) is drafted alongside Sec 8.2, since both turn on the same resolved facts.

### Sec 8.4 What Sec 8 explicitly is not

Not a schedule, not an authorization, not a step list to execute now or in this session. The sequencing (backup -> decide -> cutover) and the discipline (fresh session, gated, rollback-ready) are the point. The hazard record Sec 6 and this section agree: explicitly not now.

## Sec 9 Audit-gap assessment

The F-Deploy-1 G1 audit identified shared **compute** (single EC2, single PM2 process group -- F-Deploy-G1-G). Nothing in the audit set, Planning doc, or G2 contract addressed prod and dev sharing -- or being entangled across -- a **database**, or prod reading a dev-named instance. The compute-focused audit under-described the actual coupling: the alpha/beta isolation premise (separate-EC2 alpha) was built on isolating compute, but the data layer was never confirmed separate, and in fact is forked-and-cross-wired.

**Assessment:** this warrants a new F-Deploy-G1 sub-finding. Proposed ID **F-Deploy-G1-AH** (next free after AG), one-line: "Data-layer coupling unaddressed by audit -- prod runs on dev-named RDS instance; the two `episode_metadata` databases are forked; alpha/beta isolation premise was compute-only." This is flagged for the next audit handoff revision (v11) to formally assign and fold into the keystone narrative; v1.6 records the assessment but does not amend the v10 handoff. Cross-reference: FD-31.

## Sec 10 Ship plan

v1.6 ships in this order, all Rule 7 gates observed:

1. **v1.6 PR** on branch `claude/f-deploy-1-fix-plan-v1-6`, new file `docs/audit/F-Deploy-1_Fix_Plan_v1.6.md` alongside v1.0-v1.5 per versioned-retention, commit tagged `[skip-automerge]`, FD-21-checked message.
2. Checks green (Cost Exposure Audit, Tests, Route Validation; merge-to-dev skips per FD-30) -> confirm -> squash-merge.
3. **Open item (not part of the v1.6 commit):** the uncommitted working-tree edits to `F-Deploy-1_Fix_Plan_v1.5.md` (Sec 5 inspection update + Sec 5.1 draft entries) are now redundant with the hazard record and v1.6. Disposition -- revert (treat v1.5 as frozen-on-merge) or keep (treat latest revision as living) -- is a separate deliberate call per the versioned-retention convention, made after v1.6 lands. Flagged, not actioned here.

---
*Fix Plan revision v1.6. Records FD-31-FD-34 from the Sec 4.2 pre-execution inspection (hazard record PR #723); re-characterizes Sec 4.2 as BLOCKED on FD-31; sequences reconciliation as a gated future session. Advances no gate, authorizes no prod-box action. The freeze stands.*