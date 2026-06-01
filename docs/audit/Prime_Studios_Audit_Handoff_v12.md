# Prime Studios Audit Handoff v12

**Authored 2026-06-01. Additive on v11; v11 (and v10 beneath it) remain canonical for anything v12 does not supersede.**

## Sec 0 -- Front matter

**What changed v11 -> v12 (all 2026-06-01):**
- **FD-31 reconciliation PRE-FLIGHT is COMPLETE.** All six pre-flight gates GREEN (Pre-Flight Plan v1.4). The reconciliation v11 framed as "the true next gate" is now fully planned, de-risked, and reduced in scope. What remains is the cutover EXECUTION (its own gated session).
- **Production was found HARD-DOWN (502) and RESTORED.** Discovered by manual check during cutover scoping -- no alert fired. primepisodes.com had been returning 502 for a multi-day window (root cause: the 2026-05-30 FD-35 reload left the prod-named app on dev port 3002, nothing on 3000; the saved PM2 dump perpetuated it). Restored via a reversible additive PM2 hotfix on 3000; dev never dropped; restore persisted (reboot-durable). Recorded in `docs/audit/F-Deploy-1_INCIDENT_2026-06-01_prod-502-restore.md` (PR #739).
- **Fix Plan advanced v1.6 -> v1.8. Register advanced FD-34 -> FD-37.** FD-35 (2026-05-30 auto-deploy incident), FD-36 (FD-31 Track A verified -- on-disk `.env` confirmed canon-only, data-swap landmine defused on disk), FD-37 (schema-fork + degraded-state legs).
- **Preservation artifact committed** (PR #737): `docs/audit/FD31-prod-only-schema-20260601.sql` -- schema-only dump of all 37 prod-only table definitions (incl. the 5 entangled stragglers, with column comments). Satisfies the FD-31 firm preservation requirement completely (the committed node-pg-migrate file covered only 8 of 37).
- **Track B ACTIVATED** (was parked since project open). The PM2 4-app naming/port topology is now a scoped plan: `docs/audit/Track_B_PM2_Topology_Formalization_Plan.md` v0.2 (PRs #740/#741). Target B (formalize the working topology), Minimal-B path, decisions DB-1/2/3 resolved.
- **New registry finding F-Deploy-G1-AJ (P1)** -- no production uptime alerting (the gap that hid the multi-day 502). Plan: `docs/audit/F-Deploy-G1-AJ_Monitoring_Plan.md` (PR #743). Recommends an ELB 5xx alarm -> dedicated SNS topic.
- **FD-31 / Track B boundary reconciled** (Pre-Flight v1.4): the prod restart + port flip + pm2-save (Sec 6.3 steps 5-6) are TRACK B work, not FD-31 cutover work. FD-31's cutover shrinks to credential rotation; the restart happens in a combined window with Track B.

**Day's PR run:** #737 (preservation artifact), #738 (Pre-Flight v1.3), #739 (incident), #740 (Track B v0.1), #741 (Track B v0.2), #742 (Pre-Flight v1.4), #743 (AJ monitoring plan).

**Supersedes v11 on:** Sec 2 (F-Deploy-1 sub-status), Sec 4 (next-gate framing -- pre-flight is now complete, prod is restored). Adds new Sec 3 subsections (3.11, 3.12) and a new finding (Sec 8). v11/v10 canonical elsewhere.

**Status-quo-explicit convention carried forward:** Sec 11 (Director Brain), Sec 12 (Episode 1), Sec 13 (C2C) remain explicit "unchanged" sections so silence is not misread as change.

## Sec 1 -- How to use this document

Carry-forward from v11 Sec 1 with amendments. The world moved substantially on 2026-06-01.

- **Wake-up sequence:** The reconciliation pre-flight is COMPLETE (not "the next gate to plan" -- it's planned). The true next EXECUTABLE action against the prod box is the **combined restart window** (FD-31 credential rotation + Track B topology align + route-bug fix, in ONE gated prod restart -- Pre-Flight v1.4 Sec 6.3, Track B plan). Everything downstream of F-Deploy-1 full-close remains blocked.
- **CRITICAL prod-state correction:** v11 said "prod box is frozen; a restart silently destroys prod data." That hazard is **resolved at the data layer** (FD-36: `.env` is canon-only, a restart now comes up on canon, not the empty DB). The freeze on canon DATA still holds, but the catastrophic data-swap landmine is defused. Prod is currently UP via the hotfix (restored 2026-06-01). The remaining prod work is topology + credentials, not data-safety.
- **Authorities:** `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root, data-layer hazard -- now largely mitigated per FD-36), Pre-Flight Plan v1.4, Track B plan v0.2, and the 2026-06-01 incident doc are current-state authorities. This handoff is orientation.

## Sec 2 -- Keystone status (SUPERSEDES v11 Sec 2 for F-Deploy-1)

- **F-AUTH-1** -- unchanged from v11: artifact on main (v2.37, PR #664), execution blocked behind F-Deploy-1 full close. Still the intended lead of the post-F-Deploy execution sequence.
- **F-App-1** -- unchanged: SHIPPED (incident-driven 2026-05-14), out of sequence, does not gate downstream.
- **F-Stats-1** -- unchanged: Phase A CLOSED; Phase B blocked behind F-Deploy-1 full close (effectively behind FD-31).
- **F-Deploy-1** -- ADVANCED. Fix Plans v1.0-v1.8 on main. Phase A CLOSED. Phase B G1 CLOSED. Phase B G2 still BLOCKED on FD-31, BUT FD-31 is now substantially advanced: reconciliation pre-flight COMPLETE (all six gates green, v1.4), data-swap landmine defused (FD-36), preservation captured (#737), cutover scoped+reduced. Register FD-1 through FD-37. The 2026-06-01 prod-502 incident + restore is folded in (Sec 3.11). New finding F-Deploy-G1-AJ (Sec 8). Prod is RESTORED (not frozen-down) but on an emergency hotfix topology pending Track B.
- **F-Reg-2, F-Ward-1, F-Ward-3, F-Franchise-1, F-Sec-3** -- carry-forward, all still queued behind F-Deploy-1 full close.

## Sec 3 -- What v11 missed / what moved (additive on v11 Sec 3)

Carries v11's Sec 3.1-3.10. Two new subsections:

### Sec 3.11 (NEW) -- The prod was already down; nobody knew

The 2026-06-01 cutover-scoping session discovered primepisodes.com returning 502 -- and had been, for a multi-day window. Root cause: F-Deploy-G1-H (ecosystem default-env = dev port 3002) made live by the FD-35 2026-05-30 reload, whose `pm2 save` persisted the wrong-port topology so every reboot/resurrect recreated it. The prod-named PM2 app ran on 3002; nginx proxies prod -> 3000; nothing served 3000; ELB 502. **The 4-app topology the ecosystem file describes had never been the running/saved reality.** Restored via additive hotfix (incident doc). The deeper finding: it was caught by luck, not monitoring -- there were zero availability alarms (only billing). That gap is F-Deploy-G1-AJ (Sec 8). Class lesson: a latent config defect (G1-H) plus an automated action that persists bad state (FD-35) plus no monitoring = a multi-day outage nobody sees.

### Sec 3.12 (NEW) -- FD-31 resolved to "data-safe; topology is Track B"

The 2026-06-01 work clarified the FD-31 scope that v11 left as one undifferentiated "split-brain." It separates cleanly into:
- **Data-safety axis (FD-31 proper):** RESOLVED. `.env` canon-only (FD-36), schema preserved (#737), pre-flight complete (v1.4), backups verified. A restart no longer swaps to the empty DB. This was the catastrophe; it is defused.
- **Topology axis (Track B):** the port/naming/4-app/target-group-port problems. NOT data-dangerous -- a correctness/availability matter. Handed to Track B (plan v0.2). The 2026-06-01 incident proved this axis was a live outage, moving Track B from "parked" to "scoped + justified."
- The two converge on ONE combined prod restart (FD-31 credential rotation + Track B align). v11's "frozen, do not restart, data loss" framing is superseded for the data axis; the remaining caution is ordinary topology care, not catastrophe avoidance.

## Sec 4 -- Fix sequence, current state (SUPERSEDES v11 Sec 4 next-gate framing)

v11's "true next gate is the gated reconciliation session" is updated: **the reconciliation PRE-FLIGHT is complete.** The next executable action is the **combined prod-restart window** (FD-31 credential rotation + Track B topology align + route fix, in one gated restart). After that, F-Deploy-1 can move toward full close (G2 Sec 4.2 memory gate still owed), and the downstream keystone sequence resumes.

Actual state:
- FD-31 pre-flight COMPLETE; cutover execution pending (combined restart window).
- Prod RESTORED (hotfix), reboot-durable, on emergency topology pending Track B.
- F-AUTH-1 / F-Stats-1 Phase B / the rest -- unchanged, still queued behind F-Deploy-1 full close.

Intended post-F-Deploy order (unchanged): F-AUTH-1 execution -> F-Stats-1 Phase B -> F-Ward-1 -> F-Reg-2 -> F-Ward-3 -> F-Franchise-1 (Director Brain) -> F-Sec-3.

The reconciliation-gated `world_events` backfill (Sec 10) remains a gated input, unchanged.

## Sec 5 -- Methodological patterns (additive on v11 Sec 5)

Carries v11's patterns (gated-finding discipline, two-layer protection, etc.). Two earned 2026-06-01:

- **Read-only entry ritual before irreversible action.** Before the cutover touched anything mutable, four read-only abort-gates were confirmed live: canon row counts vs catalog, snapshot available, verified dump on disk, prod-box state. The counts-match check is itself an abort condition. Confirming the safety net is real and CURRENT -- not trusted from a prior session -- is the precondition for any irreversible step.
- **Additive-over-destructive under outage pressure.** The prod restore used an additive hotfix (new process on 3000) rather than a delete-flip of the running process. Reversible (`pm2 delete`), zero dev-drop, no irreversible step during an outage. When prod is down, the instinct to "just restart it properly" is the dangerous one; the additive bridge restores service without betting the working process.

## Sec 6 -- Session PE Roster cross-reference (UPDATE v11 Sec 6)

Carry-forward from v11 (28 entries, highest PE #61). The 2026-06-01 session added pre-flight-completion, incident-response, and Track B PE pressure -- update the roster at next lockdown; the F-Deploy-1 cluster remains the heaviest single-keystone pressure.

## Sec 7 -- Decisions log (UPDATE v11 Sec 7)

Index of decisions/registrations folded in (detail in cited docs):
- **F-Deploy-1 register FD-35 through FD-37** (Fix Plan v1.8): FD-35 (auto-deploy incident), FD-36 (Track A verified / data-swap defused), FD-37 (schema-fork + degraded legs).
- **FD-31 canon decision** (Pre-Flight v1.1-v1.4): canon = `episode-control-dev`; 37 prod-only NOT ported, definitions preserved (#737); AI-video-editing feature rebuilds post-audit.
- **Target B + Minimal-B** (Track B plan): formalize the working topology; DB-1 (keep hotfix name), DB-2 (one shared worker), DB-3 (ecosystem `.env`-load verified).
- **Methodological precedents** (Sec 5): read-only entry ritual; additive-over-destructive.

## Sec 8 -- Findings registry (CARRY-FORWARD v11 Sec 8, + ONE new finding)

- **F-Deploy-G1-AJ (NEW, P1)** -- No production uptime alerting. One-line: "Only billing alarms exist in CloudWatch; zero alarms watch availability -- a multi-day prod 502 (2026-06-01) went undetected until a manual check." Cross-references the 2026-06-01 incident doc and the AJ monitoring plan. Recommended fix: ELB 5xx alarm -> dedicated SNS topic. Sub-finding surfaced by AJ: the `primepisodes-backend` target group health-checks port 3002 while prod serves 3000 -- handed to Track B (topology).
- Everything else carries forward unchanged (v8 audit findings, v9's 27 G1 findings, AB-AG, AI).

### Sec 8.1 (NEW) -- Registry reconcile: STILL OWED (v11 Sec 3.10 task carried forward)

v11 Sec 3.10 recommended v12 reconcile `F-Deploy-1_G1_Audit.md` (which tails at **AA**) to the live finding set. **This reconcile is NOT done in v12 and is explicitly carried forward.** The live finding set to fold into the canonical audit doc:
- **AB-AC** = FD-29/30 (Fix Plan v1.5).
- **AD-AF** = G2 v1.2 contract (no IAM profile on episode-backend; episode-backend-sg open 0.0.0.0/0; RDS SGs allow Postgres from 0.0.0.0/0 incl prod).
- **AG** = the prod split-brain (assigned v11).
- **AI** = (per current register; confirm exact assignment at reconcile -- noted in memory between AG and AJ).
- **AH** = VOID (the v1.6 off-by-one slip; never a real finding -- record as deliberately skipped).
- **AJ** = no prod monitoring (this handoff, Sec 8).
The canonical audit doc still reflects only through AA. **v13 / a dedicated reconcile pass owes: fold AB-AG, AI, AJ into `F-Deploy-1_G1_Audit.md`'s registry; record AH as void.** This is internal bookkeeping deferred deliberately (the narrative orientation was prioritized), not forgotten.

## Sec 9 -- Trust-the-prior-session checklist (UPDATE v11 Sec 9)

v11's checklist, with 2026-06-01 answers + the v13 author's new items:

Answered since v11:
- Reconciliation session happened? -- PRE-FLIGHT did (complete, v1.4). CUTOVER did not (still pending, combined restart window). v11 Sec 2/4 framing is now stale; this v12 supersedes it.
- Prod state? -- was found DOWN, now RESTORED (hotfix). v11's "frozen, restart = data loss" is superseded (data axis defused, FD-36).
- Registry reconcile? -- STILL OWED (Sec 8.1).

For the v13 author:
- [ ] Read v11 + this v12 for the deltas; v10 beneath for anything unsuperseded.
- [ ] Read the 2026-06-01 incident doc, Pre-Flight v1.4, and Track B v0.2 before any prod / F-Deploy work.
- [ ] Confirm whether the COMBINED RESTART WINDOW has happened -- if it has, prod topology + credentials changed and this Sec 2/4 framing is stale.
- [ ] Confirm whether AJ monitoring was IMPLEMENTED (the plan is on main; the alarm may or may not exist yet -- a docs PR is not a live alarm).
- [ ] Do the registry reconcile (Sec 8.1) -- still owed from v11.
- [ ] Confirm Episode 1 status before Sec 12 (still "Honey Table deprecated, replacement TBD").

## Sec 10 -- Outstanding housekeeping (UPDATE v11 Sec 10)

- **The combined prod-restart window** -- FD-31 credential rotation + Track B topology align + route-bug fix, ONE gated restart. The project's true next prod action. Top of housekeeping.
- **AJ monitoring IMPLEMENTATION** -- the plan is on main (#743); the live alarm is NOT yet created. A small gated additive AWS write. Worth doing soon -- prod still has no availability alerting.
- **Credential rotation** -- canon `-dev` DB password (exposed in-session, now also in the hotfix env), `-prod` master password (exposed, retire at `-prod` teardown), AWS static keys in `.env` (F-Deploy-G1-AD -> instance profile). At the combined restart / security sweep.
- **`-prod` teardown** -- the empty instance, post-cutover.
- **Registry reconcile** (Sec 8.1) -- still owed.
- **F-Stats-1 Phase B** -- still blocked behind F-Deploy-1 full close.

Parked working-tree items (carry-forward from v11, unchanged disposition):
- `migrations/20260807000000-add-source-profile-to-world-event.js` -- `world_events` backfill, RECONCILIATION-GATED, do not run/commit until cutover.
- `src/pages` (malformed React landing component) + `src/styles/LandingPage.css` -- parked frontend work.
- `dev_tables.txt`, `prod_tables.txt` -- the 2026-05-31 diff scratch lists; keep untracked.
- `docs/audit/F-Deploy-1_PhaseB_G1_Pre-drafted_Amendments.md` -- disposition still OWED (carry-forward).

Also carried forward unactioned: the **Frontend IA Audit dispositions** (the fixed `Frontend_IA_Audit_Findings_v1.WIP.bak` was never merged; the on-main version may lack the dispositions -- confirm and merge as a small PR).

## Sec 11 -- Director Brain design status (NEW, status-quo)

Unchanged from v11. Still deferred; resolution of F-Franchise-1 (eighth keystone); further blocked behind F-Deploy-1 full close. `migrations/20260725000000` (`OVERLAY_TYPES` -> `ui_overlay_types`) remains the migration template. The split-brain's script/editing schema-fork consideration (v11 Sec 11) stands. No design material added. Status-quo-explicit.

## Sec 12 -- Episode 1 status (NEW, status-quo with deprecation)

Unchanged from v11. The Honey Table is deprecated as SAL Episode 1; replacement not yet named in canon. `NEW_CHAT_ONBOARDING.md` has no Episode 1 reference (verified v11). Lockdown TODO carried forward: confirm whether a replacement has been named. Status-quo-explicit.

## Sec 13 -- Character to Currency (C2C) status (NEW, status-quo)

Unchanged from v11. Secondary product, architecturally separate, deferred until SAL has a following. No following benchmark crossed (Episode 1 under canon revision). No C2C content added. Anti-scope-creep reference. Status-quo-explicit.

---
*Prime Studios Audit Handoff v12. Authored 2026-06-01. Additive on v11. Headline: the FD-31 reconciliation pre-flight is COMPLETE and prod was found hard-down (502) and restored via an additive hotfix the same session; the catastrophic data-swap axis of FD-31 is defused (FD-36), leaving topology (Track B) and credentials as the remaining prod work, to be done in one combined gated restart window. Adds finding F-Deploy-G1-AJ (no prod monitoring). The G1 registry reconcile (v11 Sec 3.10) is carried forward as still-owed (Sec 8.1). v11/v10 canonical for anything v12 does not supersede. Working .md; .docx to follow on content sign-off.*
