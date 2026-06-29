# F-Deploy-1 — AG Gate Write-Quiescence Finding (2026-06-27)

**Status:** DRAFT — filed 2026-06-27.  
**Feeds:** Fix Plan revision. No FD number self-minted; authority for number assignment rests with the Fix Plan register.  
**Gate authority:** `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` Sec 7 Phase 2B Step 5 (AG gate) and the SUPERSEDED-ARCHIVED Combined Restart Master Runbook's "Integrity gate — counting method (per FD-38)" block.  
**Discovered:** Phase 2A construction session 2026-06-27, during write-up of Step 5 (parallel process canon verification) and the post-Step-5 runbook read.

---

## Blocker Status

**Does NOT block Phase 2A.** Phase 2A is complete as of this session.

**DOES block the [3] window opening cleanly.** A cold session priming [3] will reach the AG gate post-restart, under time pressure, with a snapshot-restore decision immediately in front of them and no documented basis for interpreting what a count deviation means. That is the worst moment to reconstruct this analysis. This annotation must land in the runbook — and this document must be discoverable by the Session B operator — before [3] is primed.

---

## Finding

The Phase 2B Step 5 post-restart AG gate (FD-38 counting method) reads verbatim:

> PASS iff ALL of:  
> `db = episode_metadata; server = 10.0.20.224`  
> `shows = 10, episodes = 72, assets = 64, world_events = 53, wardrobe = 40, social_profiles = 444, franchise_knowledge = 605`  
> **Any deviation = ABORT + restore from snapshot. Do NOT fix forward.**

This is written as an unconditional hard stop on any count deviation. The gate rests on an **undocumented assumption**: that the seven fingerprint tables are write-cold during the Phase 2B execution window, so no legitimate application write lands between the step-1 count confirmation and the step-5 restart. The assumption is operationally well-founded (see Evidence, below), but it is not stated anywhere in the runbook.

**The ambiguity:** without the documented assumption, a cold session operator at the AG gate cannot distinguish:

- A write that corrupted or mis-routed canon data during the restart (what the gate is for → correct ABORT + restore)
- A legitimate application write (e.g. a user-created social profile) that landed on one of the seven tables during the steps 1–5 execution window, before the restart quiesced the writers (not corruption → the gate would abort-and-restore a valid write, discarding canonical user data, without investigation)

These two cases require different responses. The gate currently forces the same response for both.

---

## Quiescence Mechanism

The [3] cutover uses **restart-as-quiesce**. The Phase 2B step-5 restart stops the serving processes (id 0 `episode-api`, id 3 `episode-api-prod-hotfix`), which removes the primary writers from canon. The AG gate runs immediately after restart and is therefore the post-quiesce fingerprint. This is a legitimate design for this platform's operating pattern.

**What is NOT a gap:** the mechanism. No new drain or traffic-stop step is needed.  
**What IS the gap:** the assumption is undocumented, so the gate's "any deviation = ABORT" cannot be correctly interpreted by a cold session operator without reconstructing the full analysis.

---

## Exposure Window

Phase 2B step 1 ("re-confirm live counts match Sec 5") runs while both serving processes remain online. The restart happens at step 5. The intervening steps:

- Step 2: no-op (rotation already executed 2026-06-12/06-15)
- Step 3: confirm `.env` against SSM v2 — requires SSH to box + AWS SSM API call + live auth probe; substantive real-world operations
- Step 4: no-op (schema port)

Each step is a Rule 7 boundary (draft → confirm → execute). Sec 11 of the master runbook describes Session B as "deliberate, backup-first" and explicitly not a momentum-continuation. The window between step 1 and the restart is therefore **human-paced by design**: estimated minimum ~15–30 minutes of focused operator execution, unbounded above. This is not a tight automated block.

During this window, id 0 and id 3 remain online and serving. Canon can accept writes through normal application operation.

**Mitigation within the current mechanism (no new step required):** The operator can collapse this exposure window to near-zero at zero additional cost — re-run the count check as the last action immediately before the restart. This is the same read-only psql query as step 1, takes under a minute, and shrinks the gap between "confirmed baseline" and "quiescence begins" to effectively zero. This should be the **default last action before executing the restart**, always — and is mandatory if the window stretched for any reason (SSM discrepancy, operator paused, any interruption). Do not arrive at the restart with a count baseline that is more than a few minutes old.

---

## Evidence Supporting the Write-Cold Assumption

The seven fingerprint tables have shown zero delta across every baseline comparison in this incident's history:

| Date | Source | Method | Delta vs prior |
|---|---|---|---|
| 2026-05-31 | Verified logical dump | pg_restore catalog | baseline origin |
| 2026-06-26 | Sec 5 live re-verify | read-only psql workstation→RDS | 0 — all 7 match |
| 2026-06-27 | Phase 2A Step 5 (this session) | read-only psql box→RDS, gated creds | 0 — all 7 match |

~27 days of zero delta with both serving processes running and the application live. Both serving processes (id 0 on port 3002, id 3 on port 3000) have been online continuously throughout this period.

This is operational evidence, not a proof. A write could land at any time. But the 27-day stability on these specific content tables — which are maintained by deliberate authorial action on a literary fiction platform, not by automated or user-generated writes — is meaningful evidence that the accepted risk is small in practice.

---

## Identity Check (prior to and independent of count analysis)

If the query returns `db` ≠ `episode_metadata` or `server` ≠ `10.0.20.224`: **ABORT immediately. Do not proceed to count analysis.**

Identity mismatch is not a count deviation to interpret. It means the query ran against the wrong database — the seven count values are data from the wrong server and are irrelevant. There is no investigative frame for a wrong identity; there is only abort-and-restore. This fires before the count deviation frame below and is structurally separate from it.

---

## Deviation Interpretation Frame (counts only; identity confirmed above)

The gate's "any deviation = ABORT" treats all count deviations identically. They are not identical. The following frame is provided for the cold Session B operator who reaches the AG gate with identity confirmed clean.

**The burden of proof runs toward abort, not toward proceeding.** Restore is cheap and reversible. Proceeding on a misread of a count deviation on an irreversible operation is catastrophic and not recoverable. The investigation below does not exist to license proceeding — it exists to understand what you are aborting over. The rule is: abort unless you can *definitively* establish both (a) the deviation is a legitimate application write AND (b) proceeding is safe given that write. If you cannot establish both with certainty — not plausibility, certainty — abort. A deviation that *looks* legitimate is not sufficient. When in genuine doubt, abort is not the fallback; it is the rule.

**Deviation shapes consistent with the accepted risk (legitimate write during the steps 1–5 window):**
- Small positive delta (+1 to low single digits) on a table that receives application writes in normal operation (`social_profiles`, `episodes`, `assets`, `wardrobe`, `franchise_knowledge`)
- Plausibly correlated with the timing of the cutover window (a user-created piece of content)
- Recommended response: **investigate to understand, not to license proceeding** — verify the delta is directionally consistent with a write, identify the specific row if possible, confirm no other anomalies. Then: abort-and-restore remains the default. You move off it only if you can definitively establish (a) AND (b) above. If the investigation leaves any genuine ambiguity, abort.

**Deviation shapes that are categorically NOT legitimate writes (hard abort, no investigation needed):**
- **Negative delta on any table** — rows in these paranoid/soft-delete tables cannot be hard-deleted by normal application operation; a negative count means rows are missing, which is a corruption or wrong-DB signal
- **Large delta** (any magnitude suggesting bulk write, bulk delete, or mass operation)
- **Delta on `shows`** — show definitions are not created by normal user interaction; a count change here is not an application-layer write

**The gate's hard-abort default is the correct safety posture.** This frame does not change the gate mechanism or recommend softening it. It provides the interpretive context so the operator knows whether they are in "investigate-to-understand" territory or "abort without question" territory — and in either case, abort is the default unless certainty is achieved.

---

## What This Finding Is Not

- Not a request for a new drain/quiesce step or traffic-stop mechanism. Restart-as-quiesce is sufficient for this platform.
- Not a challenge to the AG gate's existence, FD-38 counting method, or hard-abort default.
- Not a claim that the write-cold assumption is wrong. The evidence supports it.
- Not a Phase 2A blocker. Phase 2A is complete as of this session (2026-06-27).

---

## Recommended Action

1. **Additive annotation in `F-Deploy-1_[3]_Master_Runbook_DRAFT.md`**: insert a `[NOTE 2026-06-27]` block immediately after the AG gate's "Any deviation = ABORT + restore from snapshot. Do NOT fix forward." line, referencing this document and summarizing: (a) restart-as-quiesce mechanism is intentional, (b) seven tables are write-cold assumption with evidence, (c) deviation-interpretation frame. Preserve the gate text verbatim — annotate, do not rewrite.

2. **Feed to Fix Plan revision**: for FD number assignment and carry-forward into the register. This finding is in the same class as the parallel-tree-construction gap (Sec 7A runbook gap) filed this session.

3. **Session B operator check**: before priming [3], confirm this document has been read and the AG gate annotation is in place. Do not open the [3] window with the gate text in its current unannotated form.

---

*Filed 2026-06-27. Discovered during Phase 2A Step 5 runbook read, post-Step-5 write-quiescence analysis. Phase 2A: COMPLETE. No FD number self-minted. Feeds Fix Plan revision.*
