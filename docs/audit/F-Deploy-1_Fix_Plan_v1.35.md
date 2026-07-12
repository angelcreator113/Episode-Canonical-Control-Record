# F-Deploy-1 Fix Plan v1.35

**P1 — THE CANON db_password ROTATION — CLOSES AS EXECUTED AT v1.34 STEP 8, CONFIRMED BY INDEPENDENT FIRE 2026-07-12.** Scoping reads (v1.21 P1 stanza; Audit_Handoff_Delta_2026-07-04_id3_Window; two-instance RDS topology read live) established the disclosed credential's identity: the working canon postgres master == .144 .env DB_PASSWORD (pre-flip) == SSM /episode-metadata/canon/db_password v5 — one value, base64-disclosed 07-04. The v1.34 step 8 master rotation replaced that value. **Confirm-by-fire exhibit chain: SSM v5 pulled masked -> len=39 (FD-44-corrected length) -> sha256_12=b6694fc0b2c2 (exact documented lineage) -> fired at canon as postgres -> password authentication failed.** Identity, provenance, and death proven independently of v1.34's own record. **SSM parameter RETIRED by maintainer ruling (b): deleted, ParameterNotFound proven; the master credential's sole home is the maintainer's password manager — single-point-of-failure accepted deliberately, recovery-cost re-priced by v1.34 (master rotation now disrupts nothing app-facing). REGISTER TAIL AT CLOSE: EMPTY.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.34 (merged #920, 8e4649b5 — via --admin; see S3) |
| **Author date** | 2026-07-12 |
| **Gate effect** | Closes P1 (executed + confirmed). Records SSM retirement (the one write this revision fired, its own confirm cycle). Corrects v1.33 S3.2. No box contact; freeze unchanged. |

## S1 P1 closure

Scoping, identity chain, and exhibits as headlined. The convenience-smell caution ("the work is already done" is the conclusion a lazy read wants) was resolved by requiring the independent fire rather than inheriting v1.34's V2 — the fire also validated SSM v5's contents byte-for-byte against the documented lineage before killing it.

## S2 Correction — v1.33 S3.2 "separate database"

v1.33 S3.2 excluded the canon rotation from the FD-45 window as "a separate database and a separate obligation." Live topology (two instances: canon episode-control-dev, fork episode-control-prod) and the 07-04 delta prove the canon credential and the window's step 8 target were the **same instance's master**. "Separate" was true only of the *obligation's provenance* (07-04 transcript burn vs FD-45's dump.pm2 surface), not the database. The scope exclusion was nonetheless correct in effect — it kept the window's confirm cycle honest — but the phrasing planted a phantom fourth credential. Corrected here; no earlier text retracted.

## S3 Recorded mechanisms

- #920 merged via gh pr merge --admin: branch protection requires review unsatisfiable by a sole maintainer; four checks green at merge; deliberate, confirmed in-channel. House pattern going forward, recorded once.
- SSM retirement executed this revision under its own draft->confirm (ruling (b), in-channel).

## S4 Carried obligations (v1.34 S4, renumbered survivors)

W1 revoke-or-ratify; 10.0.0.0/16 SG deferral; shared prod-key deferral; dump.pm2 disposition (contents now doubly-dead); worker stopped-state investigation; migration DDL/ownership grants before next dev migration; prod cluster-mode decision; NEW_CHAT_ONBOARDING correction. **None is a register-tail FD; all are named work items.**

## S5 Register hygiene

Tail at open: FD-45 (canon leg). Closed: FD-45 in full (dev leg v1.34; canon leg here). Minted: none. **Tail at close: EMPTY — first zero-tail state since FD-45's mint at v1.18.** FD numbers minted only by Fix Plan revisions — conforms. Ships [skip-automerge].

---

*End of F-Deploy-1 Fix Plan v1.35.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-12.*