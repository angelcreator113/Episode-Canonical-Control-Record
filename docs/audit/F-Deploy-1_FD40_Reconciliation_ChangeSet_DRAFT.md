## Session Delta — 2026-06-15 — Path A prerequisite drafting (FREEZE)

**Anchor:** origin/main HEAD `957ca12e` (no commit landed this session)
**Session type:** Path A forensic continuation, prerequisite-only. No box touch. No shared-state mutation. No runbook-body mutation.

**Artifacts produced (uncommitted drafts, docs/audit/):**
- F-Deploy-1_FD40_Reconciliation_ApplyPlan_DRAFT.md
- F-Deploy-1_FD40_Reconciliation_ChangeSet_DRAFT.md
- F-Deploy-1_FD40_Reconciliation_Runbook_Hunks_DRAFT.patch

**Resolutions recorded this session:**
- AF label direction -> canon RDS SG; fork RDS SG kept as separate active-sweep close item (NOT AF-labeled)
- Count-neutral wording enforced for loci 5/6
- Apply method hardened for wrapped blocks (anchor + bounded replace); anchor hit counts preflighted singular

**Pre-apply gates (MUST clear before any apply / execution card):**
1. AF label direction — VERIFY against merged PR #799 body + v20 handoff AF line before propagating; close only if primary text explicitly states AF = canon SG `sg-002578912805d1930` and NOT fork SG `sg-0164d0b20fbebacbb`. Do not collapse AD/AE/AF; keep fork SG as a separate real-exposure sweep item.
2. Encoding normalization — scoped OUT this session; carry-forward item.
3. [3] / combined restart window — untouched. Box remains FROZEN. No priming performed or implied.

---

# F-Deploy-1 — FD-40 Reconciliation CHANGE SET (Path A, DRAFT — confirm-and-apply)

**Date:** 2026-06-15
**Mode:** Path A — draft-only. Producing this change set touches nothing: no box, no shared state, no runbook-body edit. The edits below are applied by Evoni in a separate confirm-and-apply step (Rule 7: Claude drafts, Evoni runs).
**Target file (future edit):** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (on `origin/main`).
**Supersedes:** the earlier planning doc `F-Deploy-1_FD40_Reconciliation_ApplyPlan_DRAFT.md` (gates were open there) **and** any in-place patched copy. This is the single source of truth for the edit pass — reconcile the other copies to it.

---

## Evidence freeze (primary-text, this session)

| Gate | State | Primary evidence |
|---|---|---|
| **Evidence #3 — FD-40 closure** | **GREEN** | PR #799 (MERGED 2026-06-15T15:03:33Z): "Gate 2.5 CLOSED 2026-06-15"; CloudTrail PutParameter v2 09:53:10 (evoni-admin); `SSM_LEN=38 ENV_LEN=38 EQUAL=TRUE`; canon probe `episode_metadata\|143\|10.0.20.224`; in-memory cleared. PR #801 MERGED 2026-06-15T16:39:32Z. |
| **Evidence #4 — #773 / F-CW-1** | **GREEN** | PR #773 MERGED 2026-06-11T03:01:05Z. |
| **Stop Gate #2 — AF attribution** | **RESOLVED → canon SG** | PR #799 body + v20 handoff both: "AF-label correction on record: canon SG is `sg-002578912805d1930`, not `sg-0164d0b20fbebacbb`." Explicit dated correction; supersedes the original `G1_Audit.md` AF (filed against fork sg-0164). **See locus-7 scope caveat below.** |
| **Stop Gate #1 — rotation count** | **OPEN (by design)** | PR #799 shows PutParameter (SSM write), byte-equal to existing `.env`, **no ModifyDBInstance** in body → leans one-rotation (06-12 rotation + 06-15 SSM backup), not conclusive. Owned by credential-remediation session. Loci 5/6 stay count-neutral. |

**Locus-7 scope caveat (the one substantive refinement over the note):** the AF *label* moves to canon, but `G1_Audit.md` verifies the **fork** SG `sg-0164d0b20fbebacbb` is itself open to `0.0.0.0/0` on 5432, and PR #799 only relabels it — it does not close it. So the fork SG stays in the security sweep as a real exposure that is *not* the AF finding. The note's draft wording dropped it; this change set keeps it.

**Encoding scope decision (new finding, explicit):** the live runbook body on `origin/main` contains mojibake (`â€”` where a clean `—` would be; FD-39 encoding-drift class). This reconciliation pass **scopes encoding out** and remains content/voice-only. Hunks are authored encoding-consistent with current body bytes to avoid partial normalization-by-side-effect. File-wide UTF-8 normalization is deferred to a dedicated pass with its own byte-check gate.

**Operator touchpoints at apply (2):** (1) locus 1 filing-shape — resolved-banner-over-original vs. removal-with-pointer; (2) locus 7 — confirm the fork SG's disposition (close vs. decommission) at fold-in.

**Carry-forward (explicit):** runbook mojibake normalization remains open and is not performed in this change set.

---

## Apply order & method (Evoni runs, after a fresh wake-up)

`git fetch origin` → `git log --oneline -1 origin/main` → `gh pr list --state open` first; live beats this doc. Then, one locus per edit, top-down: lock the on-disk line with the `Select-String` anchor, edit via `[System.IO.File]::ReadAllText`/`WriteAllText` with `UTF8Encoding($false)` matching dash bytes exactly, re-read after each edit (prior view goes stale). `git diff --cached --stat` (runbook file only) before commit. Commit `[skip-automerge]`, no closing keywords; push; verify `git log --oneline origin/main..HEAD`; `gh pr create --body-file`.

---

## Locus 1 — Top-of-file BLOCKER · READY (filing-shape = operator)

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'BLOCKER \(2026-06-14\)'`

**OLD:**
> **BLOCKER (2026-06-14):** Canon credential confirmed exposed; treated as compromised. [3] cannot open until rotation completes and the put-parameter gate closes against the rotated credential. See `docs/audit/F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14_DRAFT.md`. If that finding is later promoted off `_DRAFT`, update this pointer in the same PR.

**NEW (resolved-banner-over-original — additive; original retained beneath):**
> **[RESOLVED 2026-06-15 — supersedes the BLOCKER below.]** The canon-credential exposure has been **remediated**: the credential was rotated and gate 2.5 closed durable on `main` via PR #799 (FD-40, 2026-06-15), with AWS SSM Parameter Store (v2) as backup-of-record and box `.env` byte-equal to SSM at close. **This BLOCKER no longer gates [3].** Two honest carry-forwards: (a) the forensic "was the exposed credential ever used" question is **unresolvable from available evidence** (PR #799) and stays open; (b) rotation-count (one vs. two) is **not** asserted here — see FD-40 note §3. Original text retained below as the at-filing record.
>
> _(original BLOCKER text follows, unchanged)_

**Authority:** PR #799 (gate 2.5 closed; was-it-used unresolvable). **Apply note:** default shape is resolved-banner-over-original; confirm vs. removal-with-pointer with operator (read first under restart pressure).

---

## Locus 2 — Sec 3 phase-map, Phase 0 row · READY

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'gate 2\.5 RED \(credential gap\); rotation'`

**OLD** (Session-column cell):
> **RE-OPENED 2026-06-12 — gate 2.5 RED (credential gap); rotation → `.env` update required before [3] proceeds. See Sec 0 and Sec 7 step 2.**

**NEW:**
> **GREEN / CLOSED — gate 2.5 re-marked green; credential reconciled and rotated, closed durable via PR #799 (FD-40, 2026-06-15). See Sec 0 correction blocks and the FD-40 record for evidence. Phase 0 is CLOSED.**

**Authority:** PR #799; #777 corrected Sec 0 + Status row but not this row (still live in HEAD — self-evidenced).

---

## Locus 3 — Sec 4 section heading · READY

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'the next executable step'` (confirm the hit is the `## Sec 4 — PHASE 0:` H2, not Sec 0 prose).

**OLD (two adjacent edits):**
1. `## Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — the next executable step`
2. `**Run the existing` `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` `(#750) verbatim.**`

**NEW:**
1. `## Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — CLOSED-phase record`
2. > Phase 0 was **executed** via #750/#751 (2026-06-02), gate 2.5 re-marked GREEN (re-verified 2026-06-11), and the credential subsequently rotated + gate 2.5 closed durable in FD-40 (PR #799, 2026-06-15). `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750) below is retained as the **historical authority for what was done**, not a forward instruction.

**Authority:** runbook's own Sec 0 `[CORRECTED 2026-06-11]` block + PR #799 (FD-40 supersession clause now safe to include, Evidence #3 green).

---

## Locus 4 — Sec 3 phase-map, Phase 2 row · READY

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'cred rotation \+ restart-to-align \+ route fix'`

**OLD** ("What" cell):
> Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep

**NEW:**
> Cutover (Phase 2B): restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep

**Authority:** PR #799 (rotation executed/closed — no longer cutover payload); PR #773 MERGED 2026-06-11 (route fix landed).

---

## Locus 5 — Sec 7 Step 2 · READY · count-neutral (Stop Gate #1)

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'ALREADY EXECUTED 2026-06-12, do NOT repeat'`

**OLD:**
> 2. **[FD-31] Rotation - ALREADY EXECUTED 2026-06-12, do NOT repeat.** The canon `-dev` rotation that FD-31 §6.3 step 2 deferred to cutover was performed early as gap-recovery (see Sec 0 and `F-Deploy-1_Canon_RDS_Password_Rotation_2026-06-12.md`). The box `.env` already holds the new value. **Do NOT rotate again at cutover** - re-rotating would strand the box `.env` and the pm2 memory on different credentials. This step is now a no-op; proceed to step 3 confirmation.

**NEW (preserve no-repeat + strand warning; re-anchor authority only; no count asserted):**
> 2. **[FD-31] Rotation — ALREADY EXECUTED, do NOT repeat.** The canon `-dev` rotation that FD-31 §6.3 step 2 deferred to cutover has already been performed; authority of record is the **FD-40 rotation close (PR #799, 2026-06-15)** with **SSM Parameter Store v2** as backup-of-record. The box `.env` holds the post-rotation value. **Do NOT rotate again at cutover** — re-rotating would strand the box `.env` and the pm2 memory on different credentials (`.env` is in the live credential chain: PM2 resurrect reads it). This step is a no-op; proceed to step 3 confirmation.

**Authority:** PR #799; SSM v2. Strand warning preserved (mechanically correct). **Stop Gate #1:** count-neutral — the "2026-06-12" date is removed as the authority anchor; no one-vs-two rotation claim.

---

## Locus 6 — Sec 7 Step 3 · READY

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'post-06-12'`

**OLD:**
> 3. **[FD-31] Confirm the box `.env` holds the post-06-12 `DB_PASSWORD`** (§6.3 step 3): already written. `DB_HOST` is already canon (Phase 0 confirmed). No edit is needed unless verification fails.

**NEW (two checks; `.env`-against-SSM-v2, not self-authorizing):**
> 3. **[FD-31] Verify the box `.env` `DB_PASSWORD` against SSM v2, then confirm canon auth** (§6.3 step 3): (a) confirm the box `.env` holds the post-rotation value, verified **against SSM Parameter Store v2 as source-of-truth** — at FD-40 close the two were byte-equal (`SSM_LEN=38 ENV_LEN=38 EQUAL=TRUE`, PR #799), but **re-verify live at [3] cold-open**, do not assume `.env` is still correct or self-authorizing; (b) confirm canon DB auth succeeds via a read-only live probe. `DB_HOST` = canon is already confirmed (Phase 0). This is a verification step, **not a write.** **Load-bearing:** `.env` must match SSM v2 and is verified against it — `.env` is in the credential chain, not bypassed.

**Authority:** PR #799 (byte-equality at close; SSM v2 source-of-truth). Fresh re-verify required at [3] per cold-open discipline.

---

## Locus 7 — Sec 7 Step 8 (AF attribution + sweep scope) · READY · CORRECTED wording

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'F-Deploy-G1-AF on fork-side SG'`

**OLD:**
> 8. **Post-cutover security sweep** (FD-31 §6.3 step 8): close `0.0.0.0/0` on the RDS SGs (F-Deploy-G1-AF on fork-side SG `sg-0164d0b20fbebacbb`, plus canon-side SG `sg-002578912805d1930`; confirm dev/staging SGs too) and on the prod box SG sg-05c3a6ed6eee7b3a6 (F-Deploy-G1-AE); encrypt the insurance snapshot (currently unencrypted); migrate the box off static `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD).

**NEW (label corrected to canon; fork SG KEPT in sweep — not dropped):**
> 8. **Post-cutover security sweep** (FD-31 §6.3 step 8): close `0.0.0.0/0` on the RDS SGs. **F-Deploy-G1-AF = the canon RDS SG `sg-002578912805d1930`** (label corrected on record per FD-40 / PR #799 and the v20 handoff — *not* the fork's `sg-0164d0b20fbebacbb`); this is the P0. **Also** close `0.0.0.0/0` on the fork RDS SG `sg-0164d0b20fbebacbb` — `G1_Audit.md` verified its 5432 ingress open; it is **not** the AF finding but is a real exposure in its own right, so it stays in the sweep (confirm its disposition if the fork is being decommissioned). Confirm dev/staging SGs too. Close `0.0.0.0/0` on the prod box SG `sg-05c3a6ed6eee7b3a6` (F-Deploy-G1-AE). Encrypt the insurance snapshot (currently unencrypted). Migrate the box off static `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD). **Standing escalation trigger** (v20): treat `0.0.0.0/0` or `3.94.166.174/32` reappearing on the canon SG `tcp/5432` ingress as an escalation, not routine.

**Authority:** PR #799 + v20 (AF = canon, explicit dated correction); `G1_Audit.md` (fork sg-0164 verified open → kept in sweep); v20 (escalation trigger). **The two refinements over the note:** (1) fork SG retained in the lockdown list, not demoted to comparator-only; (2) escalation trigger added — both flagged for operator confirmation.

---

## Locus 8 — Sec 7 Step 6/7 (`episode-api-prod-hotfix` identity) · PRESERVE / no edit

**Anchor:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'episode-api-prod-hotfix'`

**Verified:** closed-identity framing present (`DB-1 keeps the episode-api-prod-hotfix name`); no "unidentified hotfix" open-finding language remains. **No change.** Guard rule: do not reintroduce open-finding language during the edit pass.

---

## PR body (for the edit pass)

**Commit message:**
```
docs(audit): reconcile [3] master runbook to FD-40-era voice (8 loci per FD-40 note) [skip-automerge]
```

**Body:**
```
## What
Reconciles mixed-era language in docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md to one
FD-40-era voice, per FD-40 readiness note (957ca12e). Doc-only. No box action, no shared-state
mutation, [3] not primed.

## Loci (values per the FD-40 note / change set; not inlined here)
- 1 BLOCKER -> RESOLVED banner (additive; rotation + gate 2.5 closed, PR #799; was-it-used carried open).
- 2 Sec 3 Phase 0 row -> GREEN/CLOSED.
- 3 Sec 4 heading -> CLOSED-phase record.
- 4 Sec 3 Phase 2 row -> remove cred-rotation + route-fix payload (#773 merged).
- 5 Sec 7 Step 2 -> re-anchor authority to FD-40/SSM v2; preserve no-repeat + strand warning; COUNT-NEUTRAL.
- 6 Sec 7 Step 3 -> verify .env against SSM v2 + live auth probe; not self-authorizing.
- 7 Sec 7 Step 8 -> AF label corrected to canon sg-002578912805d1930; fork sg-0164 KEPT in sweep
  (G1_Audit verified open); escalation trigger added.
- 8 Sec 7 Step 6 -> preserve episode-api-prod-hotfix closed identity (no edit).

## Boundary
Completes what #777 began (it corrected Status row + Sec 0, not the Sec 3 Phase 0 row or Sec 4 heading).
FD-38 fingerprint numbers remain un-inlined; [3] start requires a live read.
Rotation count (one vs two) NOT asserted — open carry-forward, credential-remediation session.

## Hygiene
Doc-only; [skip-automerge]; squash-merge; explicit-path stage of the runbook only;
no closing keywords adjacent to any #N; locus 1 additive-supersede.
```

---

## Scope boundary

This change set does not: start [3]; perform abort re-verify; touch prod box `54.163.229.144`; mutate the runbook body, PM2 state, secrets, or SGs; resolve the rotation count. It is the draft input to a gated confirm-and-apply PR the operator runs.
