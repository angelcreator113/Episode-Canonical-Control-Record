# Prime Studios Audit Handoff v11

**Authored 2026-05-30. Additive on v10; v10 remains canonical for anything v11 does not supersede.**

## Sec 0 -- Front matter

**What changed v10 -> v11:**
- F-Deploy-1 Phase A CLOSED (G4 soak clean, 2026-05-26).
- F-Deploy-1 Phase B G1 CLOSED (architectural lock, FD-26/27/28).
- F-Deploy-1 Phase B G2 BEGAN and is now BLOCKED on a P0 prod split-brain (FD-31), discovered during Sec 4.2 pre-execution inspection.
- Fix Plan advanced v1.3 -> v1.6. Register advanced FD-25 -> FD-34.
- A committed prod hazard record now exists at repo root (`F-Deploy-1_PROD_SplitBrain_HAZARD.md`, PR #723).
- F-App-1 confirmed shipped (incident-driven, 2026-05-14).
- F-Stats-1 Phase A shipped; Phase B now blocked behind F-Deploy-1's FULL close (further than v10's "Phase A close" gate, because of FD-31).
- New registry finding F-Deploy-G1-AG assigned (Sec 8).

**Supersedes v10 on:** Sec 2 (keystone status), Sec 4 (fix sequence). Adds new Sec 3 subsections. v10 canonical elsewhere.

**Status-quo-explicit convention:** Sec 11 (Director Brain), Sec 12 (Episode 1), Sec 13 (C2C) are explicit "unchanged" sections so silence is not misread as change. Future handoffs should carry this convention forward.

## Sec 1 -- How to use this document

Carry-forward from v10 Sec 1 with amendments reflecting that the world moved past what even the v11 brief (2026-05-20) anticipated.

- Wake-up sequence: Phase A is CLOSED. F-AUTH-1 execution was expected next -- BUT F-Deploy-1 is NOT fully closed. Phase B G2 is blocked on FD-31 (prod split-brain). The true next executable gate is the gated reconciliation session (Sec 4), not F-AUTH-1. Everything downstream of F-Deploy-1 full-close remains blocked.
- Authorities: the committed `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) and Fix Plan v1.6 are current-state authorities; this handoff is orientation.

## Sec 2 -- Keystone status (SUPERSEDES v10 Sec 2.1)

- **F-AUTH-1** -- artifact on main (v2.37, PR #664). Per the Sec 3.2 vocabulary, "KEYSTONE CLOSURE" = artifact on main, NOT executed against production. Execution status NOT re-verified this session (prod is frozen). Execution was queued behind F-Deploy-1 Phase A close; that gate is now superseded -- F-AUTH-1 execution is blocked behind F-Deploy-1's FULL close, itself blocked on FD-31 reconciliation. Still the intended lead of the post-F-Deploy execution sequence.
- **F-App-1** -- SHIPPED via incident-driven deployment 2026-05-14 (Path A, v1.1 Sec 12.15). Out of sequence; does not gate downstream (schema-as-JS removal has no upstream keystone dependency).
- **F-Stats-1** -- Phase A CLOSED (PR #684, `30f10fe7`). Phase B BLOCKED, and the blocker is stricter than v10 framed: Decision #98 gated it on F-Deploy-1 "Fix Plan Phase A close," but FD-31 means even with Phase A closed, the data layer is unsafe to touch until reconciliation. Effectively blocked behind FD-31.
- **F-Deploy-1** -- Fix Plans v1.0-v1.6 on main. Phase A CLOSED (G4 soak, 2026-05-26). Phase B G1 CLOSED (FD-26/27/28). Phase B G2 IN PROGRESS but BLOCKED on FD-31 (prod three-axis split-brain + schema fork). Sec 4.2 memory-profile gate re-characterized NOT REACHED -> BLOCKED. FD-1 through FD-34 across v1.0-v1.6. New finding F-Deploy-G1-AG assigned (Sec 8). A committed hazard record governs the prod box freeze.
- **F-Reg-2, F-Ward-1, F-Ward-3, F-Franchise-1, F-Sec-3** -- carry-forward from v10, all queued behind F-Deploy-1 full close. Verify no drift at lockdown.

## Sec 3 -- What v10 got wrong / missed (and what the v11 brief missed)

Carries the v11 brief's Sec 3.1-Sec 3.7 (F-App-1 status drift, commit-vocabulary glossary, closure-semantics vocabulary, gate-strictness drift, enforce_admins reconciliation, identity-drift status, read-the-source methodological lesson). Two new subsections this session adds:

### Sec 3.8 (NEW) -- Prod split-brain: the data-layer coupling the audit never surfaced

The G1 audit found shared COMPUTE (F-Deploy-G1-G, single EC2/PM2). It never found that prod and dev share -- and have forked across -- a DATABASE. Prod runs on the dev-NAMED RDS instance `episode-control-dev` (143 tables, live, populated); the on-disk `.env` points at the prod-named instance `episode-control-prod` (171 tables, verified empty). The two `episode_metadata` databases are forked (37 prod-only tables, 9 dev-only; dual migration frameworks; `decision_log`/`decision_logs` collision), neither a superset. A restart/reboot/deploy reloads the on-disk `.env` and silently swaps prod onto the empty DB -- boots clean, serves nothing, no error. Highest-severity miss-class item the project has produced; re-blocks G2 Sec 4.2; gates everything downstream. Committed in `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (PR #723); registered FD-31. The alpha/beta isolation premise was compute-only -- data isolation was never established.

### Sec 3.9 (NEW) -- The v11 brief itself drifted

The brief (drafted 2026-05-20, G4 soak day 1) describes F-Deploy-1 as "v1.0-v1.3, Phase A closed, Phase B G1 next, FD-1-25." By authoring time (2026-05-30) reality was v1.6 / G2-blocked / FD-34. This is the brief's own Sec 3.7 lesson applied to itself: a planning artifact is accurate at its evidence state and drifts after. Not a defect -- a freshness gap. v11 authoring resolved it by reading current committed state (v1.6, hazard doc) rather than the brief's placeholders.

### Sec 3.10 (NEW) -- G1 sub-finding registry drift

The canonical audit doc (`F-Deploy-1_G1_Audit.md`) tails at finding F-Deploy-G1-AA. But live sub-findings run AB-AF, filed in the Fix Plans (AB/AC = FD-29/30 in v1.5) and the G2 v1.2 contract (AD/AE/AF), never folded back into the audit registry. Symptom: Fix Plan v1.6 Sec 9 proposed "F-Deploy-G1-AH (next free after AG)" -- but AG was never assigned anywhere (verified by tracked-text grep), so the proposal was an off-by-one against a nonexistent letter. v11 corrects this (Sec 8): the split-brain finding is assigned F-Deploy-G1-AG (filling the real next-free letter), and v1.6's "AH" is recorded as a slip. Recommendation: v12 reconcile the audit doc to the actual committed finding set (AB-AG), since the audit registry no longer reflects reality. This is a live instance of the Sec 3.7 verify-before-lockdown lesson -- a finding ID proposed on faith was off by one; verification against the registry caught it.

## Sec 4 -- Fix sequence, current state (SUPERSEDES v10 Sec 4)

v10's linear framing (F-AUTH-1 -> F-Deploy-1 -> F-App-1 -> ...) is superseded. Stated plainly:

**The project's true next executable gate is the gated reconciliation session, NOT F-AUTH-1.** F-Deploy-1 gates everything downstream and is not closed -- it is stuck mid-Phase-B-G2 on FD-31 (prod split-brain). No keystone executes until F-Deploy-1 fully closes, and F-Deploy-1 cannot close until reconciliation resolves the split-brain (verified `episode-control-dev` backup first, own gated session).

Actual ship state:
- F-AUTH-1 artifact shipped (execution pending, gated behind F-Deploy-1 full close).
- F-App-1 shipped out-of-order (incident-driven) -- does not break sequence.
- F-Stats-1 Phase A shipped; Phase B blocked behind F-Deploy-1 full close (effectively behind FD-31).

Intended post-reconciliation order (unchanged once F-Deploy-1 closes): F-AUTH-1 execution -> F-Stats-1 Phase B -> F-Ward-1 -> F-Reg-2 -> F-Ward-3 -> F-Franchise-1 (Director Brain) -> F-Sec-3.

New reality the sequence must absorb: the untracked `world_events` backfill migration is a reconciliation-gated INPUT, not a free commit (Sec 10).

## Sec 5 -- Methodological patterns (NEW)

Carries the brief's candidates (evidence-state-relative tracking, removal-sufficient closure, incident-driven Path A, backtick-fencing test). Two this session earned:

- **Gated-finding discipline.** When investigation surfaces a P0 in shared/production state: document the hazard in durable committed form FIRST, register the finding, and defer the fix to its own gated session -- explicitly NOT fixing it on the momentum of having found it. The prod split-brain is canonical: found during Sec 4.2 inspection, but reconciliation was deliberately NOT attempted in the discovery session. Discovery and remediation are separate sessions when the failure mode is catastrophic and irreversible.
- **Two-layer protection for catastrophic-but-latent hazards.** Protect both the ACTOR and the READER. The hazard doc (committed, freeze-banner-first, onboarding-pointed) protects whoever might restart the box; Fix Plan v1.6's Sec 4.2 re-block protects whoever reads the plan to pick the next step. One artifact alone leaves a gap: a hazard doc nobody is directed to, or a Fix Plan that still reads "Sec 4.2 not reached / next." Both layers, or the protection has a hole.

## Sec 6 -- Session PE Roster cross-reference (UPDATE v10 Sec 13)

The roster holds 28 distinct PE entries: PE #1, #27, #31, and a continuous run #37-#61 (the low end is non-contiguous -- #1/#27/#31 then the #37+ run -- not missing entries). Highest is PE #61. v10 reflected through ~#49; v11 reflects through #61. The soak and post-soak G2 work surfaced more than the brief's "at minimum 19" estimate. PE-to-keystone pressure: F-AUTH-1 pressure grew (pre-flight inputs); F-Deploy-1 pressure dominates (the split-brain PE cluster is the heaviest single-keystone pressure in the roster).

## Sec 7 -- Decisions log (UPDATE v10 Sec 7)

Index of decisions folded in (detail lives in the cited docs; v11 does not restate):
- **F-Deploy-1 register FD-13 through FD-34**, never surfaced into the handoff's main log: FD-13-15 (v1.1), FD-16-20 (v1.2), FD-21-25 (v1.3), FD-26-28 (v1.4, Phase B G1 architectural lock), FD-29-30 (v1.5, CI/CD posture), FD-31-34 (v1.6, the split-brain finding set). Pointer to Fix Plans v1.1-v1.6 for detail.
- **Decision #105** -- F-App-1 Path A acceptance (v1.1 Sec 12.15.4); predates v10 by 2 days, never captured.
- **Methodological precedents** (Sec 5): gated-finding discipline and two-layer protection named as canonical patterns.

## Sec 8 -- Findings registry (CARRY-FORWARD v10 Sec 11, + ONE new finding)

- **F-Deploy-G1-AG (NEW, P0)** -- Data-layer coupling unaddressed by the G1 audit. One-line: "Prod runs on the dev-named RDS instance; the two `episode_metadata` databases are forked (37 prod-only / 9 dev-only, neither a superset, dual migration frameworks); the alpha/beta isolation premise was compute-only -- data isolation was never established." Cross-references FD-31 and `F-Deploy-1_PROD_SplitBrain_HAZARD.md`. Gates G2 and everything downstream. NOTE: Fix Plan v1.6 Sec 9 proposed this as "F-Deploy-G1-AH (next free after AG)" -- an off-by-one against an unassigned AG (see Sec 3.10). v11 corrects the ID to AG (the real next-free letter). A future reader hitting both docs: v1.6 says AH, v11 says AG-correcting-AH; v11 is authoritative.
- First registry addition since v9's 27 F-Deploy-G1 findings; v10 added none. Everything else (v8 audit findings, v9's 27 G1 findings, AB-AF filed in Fix Plans / G2 contract) carries forward unchanged.

## Sec 9 -- Trust-the-prior-session checklist (NEW)

For the v12 author (next-Claude or future-Evoni):
- [ ] Read v10 in full before authoring v12.
- [ ] Read this v11 doc + the v11 brief for the deltas.
- [ ] Read `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) FIRST if any prod / F-Deploy work is contemplated -- the prod box is frozen; a restart silently destroys prod data.
- [ ] Verify F-Deploy-1 state on main: Fix Plans v1.0-v1.6, register FD-1-34, Phase A closed, Phase B G1 closed, G2 BLOCKED on FD-31.
- [ ] Confirm whether the reconciliation session has happened -- if it has, this Sec 2 / Sec 4 framing is stale and v12 supersedes it.
- [ ] Spot-check keystone status against main.
- [ ] Confirm Episode 1 status before Sec 12 (still "Honey Table deprecated, replacement TBD" per memory).
- [ ] Reconcile the G1 sub-finding registry (Sec 3.10) -- audit doc tails at AA, live findings run AB-AG.

## Sec 10 -- Outstanding housekeeping (NEW), and parked working-tree items

- **The reconciliation session** -- the project's true next gate (Sec 4). Backup-first, own session, gated. Top of housekeeping.
- **F-AUTH-1 Sec 5.1 pre-flight grep** -- deliverable on main (`F-AUTH-1_Preflight_Grep_Deliverable.md`, `f-auth-1_preflight_grep.ps1`). Folds into F-AUTH-1 execution (post-reconciliation).
- **F-Stats-1 Phase B** -- blocked behind F-Deploy-1 full close (effectively behind FD-31).

Parked working-tree items (2026-05-30 disposition):
- `migrations/20260807000000-add-source-profile-to-world-event.js` -- a `world_events` backfill migration (adds `source_profile_id` FK, backfills from `canon_consequences->automation->host_profile_id`). RECONCILIATION-GATED: do NOT run or commit until canon DB is decided. The backfill only does work against the populated `-dev` DB; which DB it targets is itself the reconciliation question. Recorded so it is not run blind or forgotten.
- `src/pages` -- a malformed React landing-page component (extensionless path; should be `src/pages/LandingPage.jsx`), paired with untracked `src/styles/LandingPage.css`. Frontend feature work, separate effort. Parked; fix the path when picked up.
- `docs/audit/F-Deploy-1_PhaseB_G1_Pre-drafted_Amendments.md` -- pre-drafted alpha/beta cost-amendment scope (NAT topology is the dominant cost lever; t3.small at 0.74% CPU; ~$320/mo bill; 4 unused NAT gateways). Header is STALE ("parent does not yet exist") -- Phase B G1 has since been authored and closed. DISPOSITION OWED (lockdown TODO): read `F-Deploy-1_PhaseB_G1_Planning.md` to determine whether these amendments landed in the closed Phase B G1 work or are orphaned; then fold or retire.

## Sec 11 -- Director Brain design status (NEW, status-quo)

Still deferred. Carries v10's framing. Director Brain is the resolution of F-Franchise-1 (eighth keystone). No upstream prerequisite has shipped in execution form, and all are now further blocked behind FD-31. v11 introduces no design material. Implementation reference preserved: `migrations/20260725000000` (the `OVERLAY_TYPES` -> `ui_overlay_types` DB-table precedent) is the template for migrating DREAM_CITIES, ARCHETYPES, SEED_GOALS, EVENT_TEMPLATES, phase titles, etc. into `franchise_brain`.

Sharpening v11 adds: the split-brain bears directly on Director Brain. The 37 prod-only forked tables include a script/editing schema; `franchise_brain` consolidation will have to account for which schema-fork the franchise canon tables live in. Flagged as a consideration, not design work.

Status-quo-explicit so future readers do not misread silence as a status change.

## Sec 12 -- Episode 1 status (NEW, status-quo with deprecation)

The Honey Table is no longer Episode 1 of Styling Adventures with Lala (SAL) -- confirmed deprecated; the replacement is not yet named in canon. v11 records the deprecation; the new Episode 1 to be captured in v12 or via onboarding update when confirmed. Sweep target is narrower than the brief assumed: `NEW_CHAT_ONBOARDING.md` contains NO Episode 1 reference (verified), so staleness lives only in userMemories and any in-code "Honey Table" / "pilot" / "first episode" references. Lockdown TODO: confirm whether a replacement has been named since memory was written.

## Sec 13 -- Character to Currency (C2C) status (NEW, status-quo)

Still deferred. Carries v10. C2C is Prime Studios' secondary product, architecturally separate (own DB, auth, repo, domain charactertocurrency.com). Deferred until SAL has an established following. SAL is not shipping episodes publicly (Episode 1 itself under canon revision, Sec 12); no following benchmark crossed. v11 introduces no C2C content and maintains v10's omissions explicitly. Doubles as the anti-scope-creep reference.

---
*Prime Studios Audit Handoff v11. Authored 2026-05-30. Additive on v10. Records the F-Deploy-1 prod split-brain (FD-31 / F-Deploy-G1-AG) as the headline v10-miss; re-characterizes the project's next gate as the reconciliation session; assigns one new P0 registry finding; carries the v11 brief's Sec 3 vocabulary forward. v10 canonical for anything v11 does not supersede. Working .md; .docx to follow on content sign-off.*