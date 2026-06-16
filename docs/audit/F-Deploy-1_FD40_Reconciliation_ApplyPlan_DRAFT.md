# F-Deploy-1 — FD-40 Reconciliation Apply Plan (Path A, DRAFT — confirm-and-apply pending)

**Date drafted:** 2026-06-15
**Mode:** Path A — drafting only. No box touch, no shared-state mutation, **no runbook-body edit in producing this plan.** This document is itself a Rule 7 *draft* artifact for a later confirm-and-apply PR.
**Target artifact to be edited (future PR):** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (the file printed from `origin/main`; titled *[3] Combined-Restart Window: MASTER RUNBOOK*).
**Authority of record for the reconciliation:** `docs/audit/F-Deploy-1_[3]_Master_Runbook_FD40_Reconciliation_Readiness_Note_2026-06-15_DRAFT.md` @ `957ca12e` (the FD-40 note, v2-extended). The note is the *spec*; this plan converts it to executable edits.

> **Convergence note (2026-06-15):** `docs/audit/F-Deploy-1_FD40_Reconciliation_ChangeSet_DRAFT.md` is the single source of truth for the edit pass. This apply-plan is retained as supporting rationale and must stay consistent with that change set.

---

## 0) Provenance & honesty caveats (read first)

- **Both sources were surfaced live**, not from memory: the FD-40 note via `git show 957ca12e:<note>`, the runbook body via `git show origin/main:<runbook>`. This plan's *current text* (old_str) is transcribed from the surfaced runbook body; its *proposed text* (new_str) is drafted from the note's reconciled-replacement column.
- **Runbook body received was truncated at the tail.** The captured content ends mid-sentence inside **Sec 11** ("**Session A (next, low stakes):** … Output:"). All 8 loci sit at or above Sec 10, so the plan is complete *for the loci* — but the absolute tail (rest of Sec 11) was not seen. The note declares exactly 8 loci, none past Sec 10, so this is recorded as **non-blocking**, not waved away. Confirm at apply time that no additional stale language hides in the unseen tail.
- **Line numbers are not asserted as absolute.** Markdown tables / long lines reflow; a pasted copy can drift from the on-disk bytes. Each locus is therefore anchored by a **unique verbatim search string** (the real `str_replace` key) **plus a `grep`/`Select-String` command** that locks the exact on-disk line number from *your* `runbook_body.md` at apply time. Anchor on the string; treat the line number as derived.
- **Dash/encoding hazard.** The runbook mixes em-dashes (`—`) and ASCII hyphens (`-`); some step headers use a plain hyphen ("`Rotation - ALREADY EXECUTED`"). Use `[System.IO.File]::ReadAllText` with `UTF8Encoding($false)` for the edit and match dash bytes exactly; the `Select-String` patterns below use only ASCII-safe substrings to avoid false misses.

---

## 1) Apply-readiness summary

| Loci | State | Why |
|---|---|---|
| **1, 2, 3, 4, 5, 6, 8** | **APPLY-READY** | Primary-source checks are now in hand: PR #799 MERGED (FD-40 gate-close record), PR #801 MERGED (independent verification), PR #773 MERGED (route-fix landed), plus v20 handoff text for AF-label correction context. |
| **5, 6** | **CONSTRAINED (count-neutral wording only)** | Edits re-anchor authority to FD-40/SSM v2 and preserve `.env`-in-chain behavior, but do **not** assert one-vs-two rotation count. Count remains carry-forward (Stop Gate #1). |
| **7** | **APPLY-READY (adjudicated by superseding record)** | AF attribution resolved by newer primary records (PR #799 and session handoff v20): AF = canon RDS SG `sg-002578912805d1930`. Fork SG `sg-0164d0b20fbebacbb` remains in the sweep as a real open exposure (not AF-labeled) pending close/decommission disposition. |

**Net: 7 replace loci + 1 preserve guard are now actionable in one reconciliation pass, with count-neutral language retained for loci 5/6 and filing-shape decision still required for locus 1.**

---

## 2) Line-anchored replacement table (7 replace + 1 preserve)

Priority is top-down: locus 1 is read first by a cold operator and is the highest-stakes stale hard-stop.

### Locus 1 — Top-of-file BLOCKER (2026-06-14) · **APPLY-READY (filing-shape decision still required)**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'BLOCKER \(2026-06-14\)'`
- **Current text (old_str):**
  > **BLOCKER (2026-06-14):** Canon credential confirmed exposed; treated as compromised. [3] cannot open until rotation completes and the put-parameter gate closes against the rotated credential. See `docs/audit/F-Deploy-1_Canon_Credential_Exposure_Finding_2026-06-14_DRAFT.md`. If that finding is later promoted off `_DRAFT`, update this pointer in the same PR.
- **Proposed (new_str) — DRAFT, resolved-banner-over-original shape (one of two; see gate):** prepend an additive RESOLVED banner; leave the original BLOCKER beneath as at-filing record:
  > **[RESOLVED 2026-06-15 — supersedes the BLOCKER below.]** The canon-credential exposure recorded here has been remediated: the credential was rotated and gate 2.5 closed durable on `main` via PR #799 (FD-40), with AWS SSM Parameter Store as backup-of-record. **This BLOCKER no longer gates [3].** Rotation-count framing (one vs. two rotations) is **not** asserted here — see FD-40 reconciliation note §3. Original text retained below as the at-filing record.
- **Authority:** FD-40 / PR #799 (gate 2.5 GREEN, 06-15); SSM Parameter Store backup-of-record. Verified against PR #799 body and #801 verification note.
- **Class:** hard edit.
- **Gates:** filing-shape decision only (resolved-banner-over-original vs. removal-with-pointer) — deferred to PR time with operator per note §2 item 6, because a top-of-file hard-stop is read first under restart pressure.

### Locus 2 — Sec 3 phase-map, Phase 0 row · **APPLY-READY**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'gate 2\.5 RED \(credential gap\); rotation'`
- **Current text (old_str)** — the Session-column cell:
  > **RE-OPENED 2026-06-12 — gate 2.5 RED (credential gap); rotation → `.env` update required before [3] proceeds. See Sec 0 and Sec 7 step 2.**
- **Proposed (new_str):**
  > **GREEN / CLOSED — gate 2.5 re-marked green; credential reconciled and rotated, closed durable via PR #799 (FD-40). See Sec 0 correction blocks and the FD-40 record for evidence. Phase 0 is CLOSED.**
- **Authority:** PR #799 (FD-40); Sec 0 [CORRECTED]/[RESOLVED] blocks. Staleness/location is **self-evidenced** (the cell still reads RED while Sec 0 records the 06-12 recovery; **#777 corrected Sec 0 + Status row but not this row** — confirmed: this row is still live in HEAD).
- **Class:** hard edit.

### Locus 3 — Sec 4 section heading · **APPLY-READY** (body-self-evidenced)

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'the next executable step'` (the unique hit is the Sec 4 H2; cross-check it is the `## Sec 4 — PHASE 0:` heading, not Sec 0 prose).
- **Current text (old_str), two adjacent edits:**
  1. Heading: `## Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — the next executable step`
  2. Lead line: `**Run the existing` `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` `(#750) verbatim.**`
- **Proposed (new_str):**
  1. `## Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — CLOSED-phase record`
  2. > Phase 0 was **executed** via #750/#751 (2026-06-02) and gate 2.5 re-marked GREEN (re-verified 2026-06-11). `F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md` (#750) below is retained as the **historical authority for what was done**, not a forward instruction.
- **Authority:** the runbook's **own** Sec 0 `[CORRECTED 2026-06-11]` block (#750/#751 merged 2026-06-02, Phase 0 CLOSED, re-verified 06-11). No external dependency required.
- **Class:** hard edit, **apply-ready.** *(Note: the note's draft also adds "re-confirmed/superseded by FD-40"; that clause is OMITTED from the ready form to keep locus 3 fully body-evidenced. Add it only if folding under Evidence Gate #3.)*

### Locus 4 — Sec 3 phase-map, Phase 2 row · **APPLY-READY**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'cred rotation \+ restart-to-align \+ route fix'`
- **Current text (old_str)** — the "What" cell:
  > Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep
- **Proposed (new_str):**
  > Cutover (Phase 2B): restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep
- **Authority:** FD-40 (credential rotation executed/closed, no longer cutover payload); PR #773 / F-CW-1 merged (route fix landed).
- **Class:** hard edit. Evidence checked: PR #773 is MERGED (2026-06-11T03:01:05Z).

### Locus 5 — Sec 7 Step 2 · **APPLY-READY (count-neutral wording only)**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'ALREADY EXECUTED 2026-06-12, do NOT repeat'`
- **Current text (old_str):**
  > 2. **[FD-31] Rotation - ALREADY EXECUTED 2026-06-12, do NOT repeat.** The canon `-dev` rotation that FD-31 §6.3 step 2 deferred to cutover was performed early as gap-recovery (see Sec 0 and `F-Deploy-1_Canon_RDS_Password_Rotation_2026-06-12.md`). The box `.env` already holds the new value. **Do NOT rotate again at cutover** - re-rotating would strand the box `.env` and the pm2 memory on different credentials. This step is now a no-op; proceed to step 3 confirmation.
- **Proposed (new_str) — preserve no-repeat AND strand warning; re-anchor authority only; COUNT-NEUTRAL:**
  > 2. **[FD-31] Rotation — ALREADY EXECUTED, do NOT repeat.** The canon `-dev` rotation that FD-31 §6.3 step 2 deferred to cutover has already been performed; authority of record is the **FD-40 rotation close (PR #799)** with **SSM Parameter Store v2** as backup-of-record. The box `.env` holds the post-rotation value. **Do NOT rotate again at cutover** — re-rotating would strand the box `.env` and the pm2 memory on different credentials (`.env` is in the live credential chain: PM2 resurrect reads it). This step is a no-op; proceed to step 3 confirmation.
- **Authority:** FD-40 / PR #799; SSM v2. Strand warning preserved (mechanically correct — `.env` is in the chain).
- **Class:** hard edit (authority re-anchor). **Constraint:** drafted *without* asserting one-vs-two rotations; do not reintroduce a count.

### Locus 6 — Sec 7 Step 3 · **APPLY-READY (count-neutral wording retained)**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'holds the post-06-12 ` + "`DB_PASSWORD`" + `'` *(or simply: `Select-String -LiteralPath .\runbook_body.md -Pattern 'post-06-12'`)*
- **Current text (old_str):**
  > 3. **[FD-31] Confirm the box `.env` holds the post-06-12 `DB_PASSWORD`** (§6.3 step 3): already written. `DB_HOST` is already canon (Phase 0 confirmed). No edit is needed unless verification fails.
- **Proposed (new_str) — two checks, `.env`-against-SSM-v2, not self-authorizing:**
  > 3. **[FD-31] Verify the box `.env` `DB_PASSWORD` against SSM v2, then confirm canon auth** (§6.3 step 3): (a) confirm the box `.env` holds the post-rotation value, verified **against SSM Parameter Store v2 as source-of-truth** — do not assume `.env` is already correct or self-authorizing; (b) confirm canon DB auth succeeds via a read-only live probe. `DB_HOST` = canon is already confirmed (Phase 0). This is a verification step, **not a write.** **Load-bearing:** `.env` must match SSM v2 and is verified against it — `.env` is in the credential chain, not bypassed.
- **Authority:** FD-40 / PR #799; SSM v2 as authority for the correct value (AG gate greps `DB_PASSWORD` from `.env`; PM2 resurrect reads `.env` — `.env` is **not** bypassed).
- **Class:** hard edit.

### Locus 7 — Sec 7 Step 8 (AF attribution) · **APPLY-READY (adjudicated by superseding primary text)**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'F-Deploy-G1-AF on fork-side SG'`
- **Current text (old_str):**
  > 8. **Post-cutover security sweep** (FD-31 §6.3 step 8): close `0.0.0.0/0` on the RDS SGs (F-Deploy-G1-AF on fork-side SG `sg-0164d0b20fbebacbb`, plus canon-side SG `sg-002578912805d1930`; confirm dev/staging SGs too) and on the prod box SG sg-05c3a6ed6eee7b3a6 (F-Deploy-G1-AE); encrypt the insurance snapshot (currently unencrypted); migrate the box off static `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD).
- **Proposed (new_str):**
  > 8. **Post-cutover security sweep** (FD-31 §6.3 step 8): close `0.0.0.0/0` on the RDS SGs — **F-Deploy-G1-AF = canon RDS SG `sg-002578912805d1930`** (the AF target; corrected label); **also close `0.0.0.0/0` on fork RDS SG `sg-0164d0b20fbebacbb`** (real exposure verified open in `G1_Audit.md`, but not AF-labeled), and confirm dev/staging SGs too — and on the prod box SG `sg-05c3a6ed6eee7b3a6` (F-Deploy-G1-AE); encrypt the insurance snapshot (currently unencrypted); migrate the box off static `AWS_ACCESS_KEY_ID`/`SECRET` in `.env` to an instance profile (F-Deploy-G1-AD). Add the v20 standing escalation trigger for canon SG `tcp/5432` (`0.0.0.0/0` or `3.94.166.174/32` reappearance).
- **Authority adjudication:** PR #799 body explicitly records: "AF-label correction on record: canon SG is `sg-002578912805d1930`, not `sg-0164d0b20fbebacbb`." Session handoff v20 repeats the same correction in Open/carry-forward. The mount `PrimeStudios_Architecture_v20.docx` remains non-authoritative noise for this issue.
- **Disposition:** apply corrected scope from the change set: canon SG carries AF label, and fork SG remains explicitly in sweep scope until closed or decommissioned.
- **Class:** hard edit. Byte-exact values to lock: AE = `sg-05c3a6ed6eee7b3a6`, fork RDS = `sg-0164d0b20fbebacbb`, canon RDS = `sg-002578912805d1930`.

### Locus 8 — Sec 7 Step 6/7 (`episode-api-prod-hotfix` identity) · **PRESERVE — APPLY-READY (no-op guard)**

- **Locate:** `Select-String -LiteralPath .\runbook_body.md -Pattern 'episode-api-prod-hotfix'`
- **Current text (verified):** Step 6 reads `…DB-1 keeps the `episode-api-prod-hotfix` name; DB-2 one shared worker`. References are operational re-confirm prompts; closed-identity framing is present; **no "unidentified hotfix" open-finding language remains** (confirmed from the body).
- **Guard rule:** preserve closed-identity framing — prod ingress identity is `episode-api-prod-hotfix` on port 3000. **Do NOT reintroduce open-finding language** during the reconciliation pass.
- **Class:** preserve / no edit. Verified from the body; nothing to apply.

---

## 3) Hard edits vs. carry-forward

**Hard edits (to be applied in the confirm-and-apply PR):** loci 1, 2, 3, 4, 5, 6, 7.
- *Apply-ready now:* **1, 2, 3, 4, 5, 6, 7**.
- *Constraint during apply:* loci **5/6 remain count-neutral** (do not assert one-vs-two rotations).

**Carry-forward (explicitly NOT resolved by this plan):**
- **06-12-vs-06-15 rotation count** (Stop Gate #1). Loci 5/6 are drafted count-neutral; the count itself is owned by the separate **credential-remediation session** that precedes [3]. Resolution requires the FD-40 record (PR #799 gate record + #801 verification note).
- **Locus 1 filing-shape** (resolved-banner-over-original vs. removal-with-pointer) — decided with operator at PR time (note §2 item 6).
- **Unseen runbook tail** (rest of Sec 11) — confirm no stale language there at apply time.

---

## 4) Stop-gate / evidence-gate list (must be GREEN before the corresponding loci apply)

1. **Stop Gate #1 — rotation count (06-12 vs 06-15).** UNRESOLVED by design. Loci 5/6 are intentionally count-neutral; do not assert one-vs-two rotations in runbook edits.
2. **Stop Gate #2 — AF attribution.** RESOLVED by superseding primary text: PR #799 + session handoff v20 both state AF = canon SG `sg-002578912805d1930` and not fork SG `sg-0164d0b20fbebacbb`.
3. **Evidence Gate #3 — FD-40 closure facts.** GREEN. PR #799 MERGED and PR #801 MERGED; both record FD-40 close chain (gate 2.5 close, SSM v2 backup-of-record framing).
4. **Evidence Gate #4 — #773 / F-CW-1 merged.** GREEN. PR #773 MERGED 2026-06-11T03:01:05Z.

---

## 5) PR body draft (for the future confirm-and-apply edit pass)

> **Mergeability note:** Evidence Gate #3, Evidence Gate #4, and Stop Gate #2 are now green per this plan's primary-source checks. The only remaining hard constraint is Stop Gate #1 handling: keep loci 5/6 count-neutral (do not assert one-vs-two rotations). FD-21 hygiene below applies.

**Commit message (note the required `[skip-automerge]`, no closing keywords adjacent to any `#N`):**

```
docs(audit): reconcile [3] master runbook to FD-40-era voice (loci per FD-40 note) [skip-automerge]
```

**PR body:**

```
## What

Reconciles mixed-era language in docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md
to one FD-40-era voice, per the readiness note
docs/audit/F-Deploy-1_[3]_Master_Runbook_FD40_Reconciliation_Readiness_Note_2026-06-15_DRAFT.md
(957ca12e). Doc-only. No box action, no shared-state mutation, [3] not primed.

## Loci edited (see the note for full rationale; values not inlined here)

- Locus 1 (top BLOCKER): resolve via additive-supersede banner over original text (operator filing-shape decision).
- Locus 2 (Sec 3 Phase 0 row): re-mark as GREEN/CLOSED per FD-40 closure.
- Locus 3 (Sec 4 heading): "next executable step" -> CLOSED-phase record (body-self-evidenced via Sec 0 [CORRECTED 2026-06-11]).
- Locus 4 (Sec 3 Phase 2 row): remove credential-rotation + route-fix from remaining cutover payload.
- Locus 5 (Sec 7 Step 2): preserve no-repeat + strand warning; re-anchor authority to FD-40/SSM v2, count-neutral.
- Locus 6 (Sec 7 Step 3): two-check env-vs-SSM-v2 verification wording; count-neutral.
- Locus 7 (Sec 7 Step 8): AF attribution corrected to canon SG `sg-002578912805d1930`; fork SG kept in lockdown scope as non-AF but real open exposure.
- Locus 8 (Sec 7 Step 6/7): preserve closed identity framing for `episode-api-prod-hotfix` (guard, no edit).

## Boundary / provenance

- Completes what PR #777 began: #777 corrected the Status row + Sec 0 [CORRECTED] blocks but
  did NOT touch the Sec 3 Phase 0 row (locus 2) or the Sec 4 heading (locus 3).
- FD-38 fingerprint numbers remain un-inlined; [3] start points to the authoritative source and
  requires a live read at cold-session open.
- Authority of record for reconciled values is the FD-40 note, not this PR body.

## Hygiene

- Doc-only; [skip-automerge] set; squash-merge.
- Explicit-path stage: git add docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md (only).
- No GitHub closing keywords adjacent to any #N (FD-21).
- Locus 1, if included, uses additive-supersede (banner over original; original retained).
```

---

## 6) Confirm-and-apply procedure (un-executed — Evoni runs)

1. `git fetch origin` → `git log --oneline -1 origin/main` → `gh pr list --state open` (wake-up; live beats this plan).
2. Reconfirm gates in-session: Evidence #3 (PR #799 + #801), Evidence #4 (#773), and Stop #2 (AF attribution) should still read GREEN; Stop #1 remains count-neutral wording only.
3. For each locus: `Select-String` the anchor to lock the on-disk line; apply via `[System.IO.File]::ReadAllText`/`WriteAllText` (`UTF8Encoding($false)`), matching dash bytes exactly; one locus per edit; re-read after each (prior view is stale post-edit).
4. Locus 1: decide filing-shape with operator first; additive-supersede (banner over original).
5. `git diff --cached --stat` as the explicit staged-set gate (runbook file only) before commit.
6. Commit with `[skip-automerge]`, no closing keywords; push; verify `git log --oneline origin/main..HEAD` before treating as landed; `gh pr create --body-file`.

---

## 7) Scope boundary

This plan does not: start [3]; perform abort re-verify; touch prod box `54.163.229.144`; mutate PM2 state, secrets, or SGs; or resolve one-vs-two rotation count. AF attribution is adjudicated here from superseding primary records (PR #799 + session handoff v20), and the runbook-body edits remain for a later confirm-and-apply PR.
