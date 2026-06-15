<!-- =================================================================== -->
<!-- SUPERSEDE BANNER (prepended 2026-06-15, additive). The text from     -->
<!-- this banner down to the "===== v1 NOTE BODY BELOW =====" separator   -->
<!-- supersedes the LOCUS INVENTORY of the v1 note. The v1 body is left    -->
<!-- intact below the separator as the at-filing record.                  -->
<!-- =================================================================== -->

# F-Deploy-1 [3] Master Runbook — FD-40 Reconciliation Readiness Note (Path A, Draft) — EXTENDED v2 (prepended)

> **SUPERSEDE BANNER (prepended 2026-06-15, additive)**
> This banner and the inventory below it supersede the five-anchor reconcile map in the v1 note body (preserved verbatim beneath the separator). The v1 body is **not** overwritten.
>
> **Why v2 exists — provenance, recorded honestly:** The v1 note keyed its reconcile map to five runbook anchors (L159, L300, L308, L354, L364) and worked from *paraphrases* of those lines. A live-text read of the runbook body found the paraphrase undercounted on the two highest-stakes loci — the credential model in Sec 7 steps 2–3, and the AF security-group label in Sec 7 step 8 (inverted) — and missed three stale loci entirely: the top-of-file BLOCKER, the Sec 3 phase-map Phase 0 row, and the Sec 4 section heading. A further read established that **PR #777 (merged 2026-06-11, "correct stale Phase 0 pointer")** corrected the Status row and Sec 0 via `[CORRECTED 2026-06-11]` blocks but did **not** touch the Sec 3 phase-map Phase 0 row or the Sec 4 heading — so those remain live in HEAD and are correctly in scope.
>
> The iteration is the lesson: each pass against live text caught what the prior pass's paraphrase smoothed over. This inventory is grounded in live runbook reads, not in the v1 note's descriptions. Same rule still applies — verify against live text at confirm-and-apply time; do not inherit this inventory as fact.

**Date:** 2026-06-15
**Mode:** Path A drafting and confirmation only (no box touch, no shared-state mutation, no runbook-body edit)
**Target artifact:** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (PR #762, merged)
**Intent:** Reconcile mixed-era language to one FD-40-era voice before any [3] cold session opens, across the full live-grounded locus set.

## 0) Why this note exists (restated)

The current [3] master runbook contains both FD-40-era and pre-FD-40 language. The risk is **internal contradiction read under restart pressure** by a cold-open operator who is then forced to adjudicate live — which is exactly what readiness should remove.

This note is a draft step only (Rule 7). It proposes reconciliation edits for a later confirm-and-apply PR. **It does not edit the runbook body in this session.**

## 1) Full reconcile map — live-grounded, 8 loci (7 replace + 1 preserve)

Priority is top-down: row 1 is read first by a cold operator and is the highest-stakes stale hard-stop.

### 1.1 Replace targets

| # | Anchor | Current text (live read, paraphrased) | Contradiction / staleness | Reconciled replacement (draft for future PR) |
|---|---|---|---|---|
| 1 | Top-of-file BLOCKER (2026-06-14) | "Canon credential confirmed exposed; treated as compromised. [3] cannot open until rotation completes and the put-parameter gate closes against the rotated credential." | Rotation completed and gate closed in FD-40 (PR #799, gate 2.5 GREEN, verified 06-15). Stale hard-stop at the very head of the file — first thing a cold operator reads. Highest priority. | Convert to a RESOLVED-supersede block (additive, Sec 0 `[CORRECTED]` style): exposure remediated by rotation, gate 2.5 closed durable on main via PR #799 on 06-15, SSM Parameter Store backup-of-record. State plainly this BLOCKER no longer gates [3]. Leave original text beneath the resolved banner as at-filing record. *(Filing-shape note: because this is read first under restart pressure, confirm at PR time whether resolved-banner-over-original or removal-with-pointer better serves a cold reader — see §2 item 6.)* |
| 2 | Sec 3 phase-map, Phase 0 row | "RE-OPENED 2026-06-12 — gate 2.5 RED (credential gap); rotation → .env update required before [3] proceeds." | Gate 2.5 is GREEN/closed (FD-40, PR #799). **#777 corrected Sec 0 + Status row but not this phase-map row** — confirmed still-live in HEAD. | Rewrite Phase 0 row to GREEN/closed: gate 2.5 re-marked green, credential reconciled and rotated, closed durable via PR #799 (FD-40). Point to Sec 0 correction blocks + FD-40 record for evidence rather than restating. |
| 3 | Sec 4 section heading | "Sec 4 — PHASE 0: ... — **the next executable step**" + "Run the existing ...Credential_Reconcile_Runbook.md (#750) verbatim." | Presents a CLOSED gate as "the next executable step." #750 MERGED (2026-06-02); Phase 0 executed, gate 2.5 re-marked GREEN by #751 (2026-06-02) per Sec 0. **#777 did not touch this heading.** | Remove "the next executable step." Reframe Sec 4 as a CLOSED-phase record: Phase 0 executed via #750/#751, gate 2.5 green, re-confirmed/superseded by FD-40. Keep #750 reference as historical authority for *what was done*, not a forward instruction. |
| 4 | Sec 3 phase-map, Phase 2 row | "Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep" | Credential rotation executed/closed in FD-40 (not remaining cutover payload). Route fix landed — PR #773 (F-CW-1) merged. | Rewrite Phase 2 row to remove credential rotation and route-fix payload. Phase 2B reads: restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep only. |
| 5 | Sec 7 Step 2 | "[FD-31] Rotation — ALREADY EXECUTED 2026-06-12, do NOT repeat... re-rotating would strand the box `.env` and the pm2 memory on different credentials." | **Both the no-repeat direction AND the strand warning are mechanically correct post-FD-40 and must be preserved.** The strand warning holds for the same topology reason as locus 6: box `.env` is in the live credential chain (PM2 resurrect reads `.env`), so re-rotating at cutover → RDS expects new password → `.env` still holds the FD-40 value → restart fails. What is stale is only the *authority reference*: "06-12 / value-held-in-`.env`" framing. **Open carry-forward:** one-vs-two-rotation count (06-12 vs 06-15) is unresolved — see §3. | **Preserve no-repeat semantics AND the strand warning** (both mechanically correct — `.env` is in the chain). Change the **authority reference only**: re-anchor "post-06-12 / box `.env`" to "FD-40 rotation / SSM v2 backup-of-record." Do not demote `.env` — the strand warning is *why* `.env` matters. Carry the one-vs-two rotation count as open; do not assert it. |
| 6 | Sec 7 Step 3 | "[FD-31] Confirm the box `.env` holds the post-06-12 `DB_PASSWORD`... already written. `DB_HOST` is already canon." | Pre-FD-40 model frames "what's in box `.env`" as its own authority. Box `.env` is still in the live credential chain (AG gate greps `DB_PASSWORD` from `.env`; PM2 resurrect reads `.env`) — `.env` is **not** bypassed. FD-40 changed the *authority for the correct value*: SSM v2 is source-of-truth; `.env` framed as self-authorizing is superseded. | **Two checks, not one.** (a) Verify box `.env` holds the post-FD-40 rotation value, confirmed *against SSM v2 as the authority* — not by assuming `.env` is already correct. (b) Confirm canon DB auth succeeds (live probe). Keep `DB_HOST`-is-canon confirmation (Phase 0 established). Verification step, not a write. **Load-bearing:** `.env` must match SSM v2 and is verified against it — not bypassed, not self-authorizing. |
| 7 | Sec 7 Step 8 | "...close `0.0.0.0/0` on the RDS SGs (F-Deploy-G1-AF on fork-side SG `sg-0164d0b20fbebacbb`, plus canon-side SG `sg-002578912805d1930`...)" | **AF label inverted.** v20: AF is the **canon** RDS SG `sg-002578912805d1930`; `sg-0164d0b20fbebacbb` is **the fork's**, NOT canon. Step attaches AF to the fork SG and demotes canon to "plus." | Correct AF attribution: **AF = canon RDS SG `sg-002578912805d1930`** (byte-exact). Reframe `sg-0164d0b20fbebacbb` as fork comparator / anti-confusion guard, not the AF target. Preserve box-SG line (AE = `sg-05c3a6ed6eee7b3a6`) and AD instance-profile / snapshot-encryption items as written. |

### 1.2 Preserve / guard targets

| # | Anchor | Live verification outcome | Guard rule for future PR |
|---|---|---|---|
| 8 | Sec 7 Step 6/7 — `episode-api-prod-hotfix` identity | Live read confirms no remaining "unidentified hotfix" prerequisite language. References are operational re-confirm prompts; prod ingress identity is known. | Preserve closed-identity framing: prod ingress identity is `episode-api-prod-hotfix` on port 3000. Do NOT reintroduce open-finding language. |

## 2) Additional readiness deltas to carry in the reconciliation PR

1. **PR #777 scope, recorded:** corrected Status row + Sec 0 `[CORRECTED]` blocks; did NOT touch Sec 3 Phase 0 row (locus 2) or Sec 4 heading (locus 3). The reconciliation PR completes what #777 began. Cite #777 in the PR body to make the boundary explicit.
2. **PR #773 / F-CW-1 is landed (merged).** Any [3] step framing route-fix as pending cutover payload → post-merge verification wording only (locus 4).
3. **PR #752 remains parked, now readiness-relevant.** Open. Policy unchanged: parked outside routine sessions; active when [3] priming begins. Track in readiness/checklist context, not folded into runbook execution steps unless explicitly re-scoped.
4. **#750 / #751 MERGED (2026-06-02).** Phase 0 executed, gate 2.5 re-marked GREEN; recorded in Sec 0. #750 reference is historical authority for what was done, not a forward instruction (locus 3).
5. **FD-38 fingerprint numbers remain un-inlined.** Do not inline counts or fingerprint constants. Point [3] start to the authoritative source; require a live read at cold-session open.
6. **BLOCKER filing-shape decision (locus 1) deferred to PR time:** resolved-banner-over-original (Sec 0 convention) vs. removal-with-pointer. A top-of-file hard-stop is read first under restart pressure, so the choice is a real one, not cosmetic. Decide at confirm-and-apply with operator.

## 3) Open carry-forward (explicitly NOT resolved by this note)

- **06-12-vs-06-15 rotation count.** Whether the canon credential was rotated once (06-12, documented retroactively at 06-15 close) or twice (06-12 emergency + 06-15 gate-close) is unresolved. The 06-12 event is real (`F-Deploy-1_Canon_RDS_Password_Rotation_2026-06-12.md`, Sec 0 block). The 06-15 FD-40 evidence (CloudTrail `ModifyDBInstance` → SSM v2 write) reads as possibly a second rotation. **Resolution requires reading the FD-40 record itself** (PR #799 gate record + #801 verification note). This note re-anchors Step 2/3 to FD-40 authority regardless of count; it does not assert the count.

## 4) Byte checks completed for this draft

- Canon SG verified byte-correct as `sg-002578912805d1930` in target runbook line (Step 8).
- Fork SG comparator confirmed `sg-0164d0b20fbebacbb`.
- Box SG (AE) confirmed `sg-05c3a6ed6eee7b3a6` (Step 8).
- Confirmed live: AF label attached to fork SG in Step 8 (inversion vs v20) — locus 7.
- Confirmed live: top-of-file BLOCKER present and stale — locus 1.
- Confirmed live: Sec 3 Phase 0 row + Sec 4 heading not touched by #777 — loci 2, 3.
- Confirmed live: Sec 7 Step 2/3 carry pre-FD-40 `.env`/06-12 credential reference; Step 2 strand warning verified mechanically correct (`.env` in chain) — loci 5, 6.

## 5) Scope boundary

This note does not: start [3]; perform abort re-verify; touch prod box `54.163.229.144`; mutate the runbook body; change PM2 state, secrets, or SGs; resolve the 06-12-vs-06-15 rotation count.

This note is the draft artifact for a later confirm-and-apply reconciliation PR. The runbook body is edited in that PR, not here.

<!-- =================================================================== -->
<!-- ===================== v1 NOTE BODY BELOW ========================== -->
<!-- Preserved verbatim as the at-filing record. The banner above        -->
<!-- supersedes the LOCUS INVENTORY only; v1's Rule-7 discipline,         -->
<!-- intent, and scope boundary are unchanged.                           -->
<!-- =================================================================== -->

# F-Deploy-1 [3] Master Runbook - FD-40 Reconciliation Readiness Note (Path A, Draft)

**Date:** 2026-06-15  
**Mode:** Path A drafting and confirmation only (no box touch, no shared-state mutation)  
**Target artifact:** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (PR #762, merged)  
**Intent:** Reconcile mixed-era language to one FD-40-era voice before any [3] cold session opens.

## 0) Why this note exists

The current [3] master runbook contains both updated and pre-FD-40 language. The risk is not simple staleness; it is internal contradiction under restart pressure.

Primary contradiction class:
- A cold-open operator can read a phase-map row that still advertises cutover credential rotation, then later read an execution step that says rotation already executed and must not be repeated.
- This pushes live adjudication into the restart window, which is exactly what readiness should remove.

This note is a draft step only (Rule 7). It proposes reconciliation edits for a later confirm-and-apply PR. It does not edit the runbook body in this session.

## 1) Reconcile map (line-keyed)

### 1.1 Replace targets

| Anchor | Current text (paraphrase) | Contradiction / staleness | Reconciled replacement (draft for future PR) |
|---|---|---|---|
| L159 | Phase 2 row says cutover includes credential rotation + restart-align + route fix + security sweep. | Conflicts with FD-40 closure state and with 2026-06-15 CloudTrail ordering (`ModifyDBInstance` then SSM v2 write) that records gate-close rotation in FD-40 session, not as remaining [3] payload. This is the load-bearing contradiction and highest-priority fix. | Rewrite Phase 2 row to remove credential rotation entirely. Phase 2B should read as restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep only. Remove route-fix payload wording (PR #773 is merged). |
| L300 | Section preface still says restart and rotation commands are left un-templated for session-time assembly. | Mixed-era wording implies live rotation still exists in [3], despite FD-40 gate closure and replacement of SSM v1 with v2 in 2026-06-15 close evidence. | Keep un-templated mutation discipline, but scope wording to remaining live mutations only (restart-to-align and cutover-adjacent actions). Explicitly state rotation is out of scope because already executed and closed in FD-40. |
| L308 | Step 2 says rotation already executed on 2026-06-12; do not repeat at cutover. | Direction is correct (do not repeat), but the date anchor is not the FD-40 close authority. FD-40 evidence records decisive gate-close rotation activity on 2026-06-15 (CloudTrail `ModifyDBInstance` then SSM v2 write). | Keep no-repeat semantics, but re-date and re-cite this step to FD-40 closure authority (PR #799 gate record + verification note evidence chain). Treat 06-12 wording as correction target, not as reconciliation anchor. |

### 1.2 Preserve / guard targets

| Anchor | Current text (paraphrase) | Verification outcome | Guard rule for future PR |
|---|---|---|---|
| L354 | Topology language references `episode-api-prod-hotfix` naming in restart context. | Targeted scan in this runbook found no remaining "unidentified hotfix" prerequisite language. Existing references are operational re-confirm prompts, not open identity findings. | Preserve closed-identity framing: prod ingress identity is known and referenced explicitly as `episode-api-prod-hotfix` on 3000. |
| L364 | Post-cutover sweep line names fork SG and canon SG; canon shown as `sg-002578912805d1930`. | Byte-checked in target line. Canon SG string is correct. | Preserve canon SG value byte-for-byte as `sg-002578912805d1930`. Preserve fork comparator `sg-0164d0b20fbebacbb` as not-canon anti-confusion guard. |

## 2) Additional readiness deltas to carry in reconciliation PR

1. **#773 / F-CW-1 is landed**
- PR #773 is merged.
- Any [3] step text that frames route-fix as pending cutover payload should be removed or rewritten to post-merge verification wording only.

2. **#752 remains parked, now readiness-relevant**
- PR #752 is open.
- Keep policy as: parked outside routine sessions; becomes active when [3] priming begins.
- This should be tracked in readiness/checklist context, not folded into runbook execution steps unless explicitly re-scoped.

3. **FD-38 fingerprint numbers remain un-inlined**
- Do not inline table counts or fingerprint constants into this note.
- Continue pointing [3] start to the authoritative source and require live read at cold-session open.

## 3) Byte checks completed for this draft

- Canon SG string in target runbook line is byte-correct as `sg-002578912805d1930`.
- Fork SG comparator remains `sg-0164d0b20fbebacbb`.
- Contradiction confirmed between phase-map rotation wording and later no-repeat rotation rule.

## 4) Scope boundary

This note does not:
- start [3],
- perform abort re-verify,
- touch prod box `54.163.229.144`,
- mutate runbook body,
- change PM2 state, secrets, or SGs.

This note is the draft artifact for later confirm-and-apply reconciliation.
