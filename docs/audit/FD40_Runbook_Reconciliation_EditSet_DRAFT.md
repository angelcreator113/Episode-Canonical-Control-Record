> **[APPLIED + SUPERSEDED - 2026-06-18, FD-40 / v1.12 / PR #821 / 9d6961f2]**
> All seven REPLACE TARGETS in this edit-set were applied to the live [3] Master
> Runbook (Loci 1-3 verified on main this session: top-of-file BLOCKER resolved-banner,
> Sec 3 phase-map Phase 0 row = "GREEN / CLOSED," Sec 4 closed-phase-record heading).
> Register authority for the FD-40 mint is now Fix Plan v1.12 (PR #821, 9d6961f2),
> not PR #799 - #799 recorded the gate file; v1.12 minted the register. This edit-set
> is spent; retained as at-filing record. Verify against live runbook text, not this
> draft, at any future confirm time.
# FD-40 Reconciliation — [3] Master Runbook Edit-Set (DRAFT for confirm-and-apply)

**Target:** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
**Date drafted:** 2026-06-15
**Mode:** Draft only. No runbook-body edit, no box touch, no shared-state mutation. This is the artifact a later confirm-and-apply PR draws from.
**Premise (verified, not inherited):** Gate 2.5 CLOSED on independent live-state verification — FD-40 gate record + PR #801 banner (RDS applied/no-pending, SSM v2 SecureString, SSM↔`.env` SHA-256 identical, CloudTrail RDS-then-SSM, canon probe `episode_metadata|143|10.0.20.224`).
**Convention:** Inline `[CORRECTED 2026-06-15 — FD-40]` blocks, modeled on the runbook's existing `[CORRECTED 2026-06-11]` style. Body preserved beneath each correction as at-filing record.

> **Standing rule carried from FD-40 note v2:** verify each block against live runbook text at confirm-and-apply time. This edit-set is itself a claim to check, not a fact to inherit.

---

## Two items that need an operator call before the PR

1. **Locus 1 filing shape** — **DECISION: Variant A** (resolved-banner-over-original; additive-supersede).
2. **Rotation count (§3) stays OPEN** — not resolved by this edit-set. Drafted into locus 5 as explicitly-open. No action needed unless you want to resolve it separately by reading the #799 gate record + #801 note against the 06-12 rotation doc. **[RESOLVED 2026-06-16 - Stop Gate #1.]** Count now resolved against live AWS artifacts: two canon rotation episodes (06-12 emergency, three masterUserPassword calls, value cardinality indeterminate; 06-15 gate-close paired to SSM v2). SSM-lag (first record 06-14) recorded as historical control-gap, not a Gate 2.5 reopen. Runbook line 319 carries the durable RESOLVED block; this note keeps the plan consistent with it. The "stays OPEN / resolve it separately" text above is the at-filing state, now superseded by this resolution.

---

## REPLACE TARGETS (7)

### Locus 1 — Top-of-file BLOCKER (header blockquote) — HIGHEST PRIORITY (read first)

**Current live text:**
> **BLOCKER (2026-06-14):** Canon credential confirmed exposed; treated as compromised. [3] cannot open until rotation completes and the put-parameter gate closes against the rotated credential. See `...Exposure_Finding_2026-06-14_DRAFT.md`. If that finding is later promoted off `_DRAFT`, update this pointer in the same PR.

**Variant A — resolved-banner-over-original (additive-supersede; original stays visible):**
> **[RESOLVED 2026-06-15 — FD-40.] This BLOCKER no longer gates [3].** The canon-credential exposure was remediated by rotation; gate 2.5 is CLOSED durable on main via PR #799, confirmed on independent live-state re-verification (PR #801). SSM Parameter Store (`/episode-metadata/canon/db_password`, v2 SecureString) is the credential backup-of-record. Evidence lives in the FD-40 gate record + #801 verification note — do not inline it here. Original BLOCKER text preserved below as at-filing record.
> _(original, 2026-06-14:)_ **BLOCKER (2026-06-14):** Canon credential confirmed exposed… [original text retained verbatim]

**Variant B — removal-with-pointer (cleaner for a cold reader; provenance lives in FD-40 record):**
> **STATUS (2026-06-15 — FD-40):** Credential exposure remediated; gate 2.5 CLOSED durable on main (PR #799, verified PR #801). **Not a blocker on [3].** Full exposure history + closure evidence: FD-40 gate record + #801 verification note. _(Original 2026-06-14 BLOCKER text removed from the file head; retained in the FD-40 record.)_

**Operator decision:** Variant A is locked for this pass (resolved-banner-over-original; additive-supersede).

---

### Locus 2 — Sec 3 phase-map, Phase 0 row

**Current cell:** `RE-OPENED 2026-06-12 — gate 2.5 RED (credential gap); rotation → .env update required before [3] proceeds. See Sec 0 and Sec 7 step 2.`

**Replacement cell:**
> **[CORRECTED 2026-06-15 — FD-40] Gate 2.5 GREEN / CLOSED.** Credential reconciled and rotated; closed durable via PR #799 (verified #801). See Sec 0 `[CORRECTED]` blocks + FD-40 record. (#777 corrected Sec 0 + Status row but not this phase-map row — this completes it.)

---

### Locus 3 — Sec 4 section heading + #750 line

**Current heading:** `Sec 4 — PHASE 0: Box-side credential reconcile (gate 2.5) — the next executable step`
**Current line:** `Run the existing F-Deploy-1_BoxSide_Credential_Reconcile_Runbook.md (#750) verbatim.`

**Inserted block under the heading; strike "— the next executable step":**
> **[CORRECTED 2026-06-15 — FD-40] Sec 4 is a CLOSED-phase record, not the next step.** Phase 0 was executed via #750/#751 (2026-06-02); gate 2.5 re-marked GREEN, re-verified 06-11, re-confirmed/superseded by FD-40 (PR #799/#801, 06-15). The #750 reference below is historical authority for *what was done*, not a forward instruction.

---

### Locus 4 — Sec 3 phase-map, Phase 2 row

**Current cell:** `Cutover (Phase 2B): cred rotation + restart-to-align + route fix + security sweep`

**Replacement cell:**
> Cutover (Phase 2B): restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep. **[CORRECTED 2026-06-15]** Credential rotation executed/closed in FD-40 (no longer cutover payload). Route fix landed — PR #773 (F-CW-1) merged.

---

### Locus 5 — Sec 7 Step 2  (delicate: preserve semantics, re-anchor authority, count OPEN)

**Current text:** `[FD-31] Rotation — ALREADY EXECUTED 2026-06-12, do NOT repeat… re-rotating would strand the box .env and the pm2 memory on different credentials.`

**Appended correction block (preserve the step body above it):**
> **[CORRECTED 2026-06-15 — FD-40] Authority re-anchored; no-repeat + strand warning PRESERVED; rotation count carried OPEN.** The no-repeat direction and the strand warning both stand — mechanically correct: box `.env` is in the live credential chain (PM2 resurrect reads `.env`; the AG gate greps `DB_PASSWORD` from `.env`), so re-rotating at cutover would leave `.env` on the prior value and the restart would fail canon auth. Superseded is only the *authority reference*: the operative rotation for gate 2.5 is the FD-40 rotation, SSM v2 as backup-of-record — not the "06-12 / value-held-in-`.env`" framing.
> **OPEN — not asserted here:** whether the canon credential was rotated once or twice. A 06-12 emergency rotation is on record (`Canon_RDS_Password_Rotation_2026-06-12.md`); the FD-40 record shows a 06-15 RDS `ModifyDBInstance` + SSM v2 write. Both events are real on record; the count is unresolved. The reconciliation does not depend on it — no-repeat-at-cutover holds either way.

---

### Locus 6 — Sec 7 Step 3

**Current text:** `[FD-31] Confirm the box .env holds the post-06-12 DB_PASSWORD… already written. DB_HOST is already canon. No edit is needed unless verification fails.`

**Replacement:**
> **[CORRECTED 2026-06-15 — FD-40] Two checks, against SSM v2 — not a self-authorizing `.env` read.** (a) Verify box `.env` holds the post-FD-40 rotation value, confirmed *against SSM v2 as the authority* (FD-40 verified them SHA-256 identical at 06-15 close — re-verify live at session time, do not inherit). (b) Confirm canon DB auth succeeds via live read-only probe. Keep `DB_HOST`-is-canon confirmation (Phase 0 established). Verification step, not a write. `.env` must match SSM v2 and is verified against it — not bypassed, not self-authorizing. ("post-06-12" → "post-FD-40 rotation".)

---

### Locus 7 — Sec 7 Step 8 (AF is a class finding; member states differ)

> **Forward note (2026-06-16):** This Locus apply anchor quotes the older fork-plus-canon text (Version 1: AF on fork-side SG sg-0164... plus canon-side SG sg-002...). The live runbook body at commit a97a1747 does NOT contain Version 1 - it carries the 2026-06-15 single-SG parenthetical (Version 2: AF = the canon RDS SG sg-002...; sg-0164... is the empty fork SG, NOT canon and not the AF target), which is the FD-40 Sec 4 relabel later retracted as wrong via #809. Confirm-and-apply MUST anchor on the live body Version 2 text, not the Version 1 quoted below. The Replacement block (Version 3, class-finding) is correct as written and matches #808; only this Current-text anchor is stale.

**Current text:** `…close 0.0.0.0/0 on the RDS SGs (F-Deploy-G1-AF on fork-side SG sg-0164d0b20fbebacbb, plus canon-side SG sg-002578912805d1930; confirm dev/staging SGs too)…`

**Replacement:**
> **[CORRECTED 2026-06-16 — AF lineage restored to source.]** Per the AF birth record (`8043a591` / #722), **F-Deploy-G1-AF is a class finding: all three RDS SGs admitted 5432 from `0.0.0.0/0` at filing, prod included.** It is not a single SG. Member states now differ and must be tracked separately:
>
> **Canon SG `sg-002578912805d1930`** (guards canon RDS at `10.0.20.224`; note the *instance is named `episode-control-dev` but holds live canon* — naming inversion): `0.0.0.0/0` **removed during 06-14 containment**, narrowed to four explicit CIDRs (FD-40 Sec 3). Residual hardening only; not an open `0.0.0.0/0`. **Was-it-used is INDETERMINATE** — no VPC flow logs on canon VPC `vpc-0754967be21268e7e` (FD-40 Sec 6), so containment closed the hole but did not establish whether anything traversed it while open. Carry as investigation item, not closed.
> **Fork SG `sg-0164d0b20fbebacbb`** (empty `episode-control-prod`): **still open `0.0.0.0/0` on :5432** (FD-40 Sec 8; G1_Audit F-Deploy-G1-AF entry). Separate post-[3] sweep close item.
> **Staging SG:** **unverified** — confirm at fold-in (G1_Audit F-Deploy-G1-AF entry, "confirm the dev/staging SGs").
> Standing escalation trigger: `0.0.0.0/0` or `3.94.166.174/32` reappearing on **canon** ingress :5432 (both removed 06-14; see FD-40 containment evidence).
> Preserve box-SG line **(AE = `episode-backend-sg`, ports 22/3000/3002/80/443 open `0.0.0.0/0`, G1_Audit F-Deploy-G1-AE)** and AD instance-profile / snapshot-encryption items as written.

---

## PRESERVE / GUARD (1)

### Locus 8 — Sec 7 Steps 6/7 — `episode-api-prod-hotfix` identity

**No edit.** Prod ingress identity is known: `episode-api-prod-hotfix` on port 3000. Guard rule for the PR: do NOT reintroduce open-finding / "unidentified hotfix" language. The Step 6 references are operational re-confirm prompts, correct as written.

---

## PR-body notes to carry (from FD-40 note §2)

- **#777 scope, recorded:** corrected Status row + Sec 0 `[CORRECTED]` blocks; did NOT touch the Sec 3 Phase 0 row (locus 2) or Sec 4 heading (locus 3). This PR completes what #777 began — cite #777 to make the boundary explicit.
- **#773 / F-CW-1 merged** — route-fix is post-merge verification wording, not pending payload (locus 4).
- **#752 parked, readiness-relevant** — track in checklist context; active only when [3] priming begins. Not folded into runbook steps here.
- **#750 / #751 merged (06-02)** — historical authority for what was done, not a forward instruction (locus 3).
- **FD-38 fingerprint numbers stay un-inlined** — point to authoritative source; require a live read at cold-session open.

## Scope boundary (this edit-set)

Does NOT: start or prime [3]; perform abort re-verify; touch the prod box; mutate the runbook body (that happens in the confirm-and-apply PR, not here); change PM2 / secrets / SGs; resolve the 06-12-vs-06-15 rotation count.
