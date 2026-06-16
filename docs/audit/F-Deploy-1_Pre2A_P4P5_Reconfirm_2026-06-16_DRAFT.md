# F-Deploy-1 - Pre-2A P-4/P-5 Reconfirm (DRAFT)

**Date:** 2026-06-16  
**Session type:** Off-box P-4/P-5 combined rerun (container-local only)  
**Status:** DRAFT - for operator Rule 7 gate review. Not canon until filed.  
**Scope:** Reconfirm P-4 and close previously open P-5 against current HEAD, with no persisted artifact.

---

## 0. One-line

Combined rerun on pinned commit `6b0c097a` reconfirmed P-4 PASS and completed P-5 PASS in the same filesystem context (`npm ci` then capped start-verify), with parity four-tuple matched and no FAIL signatures (`MODULE_NOT_FOUND` or early native-ABI load crash).

---

## 1. Why this rerun existed

- Prior run confirmed P-4 only and tore down before start-verify; P-5 remained open.
- This rerun intentionally executed `npm ci` and `node app.js` in one mounted worktree context so P-5 tested the tree actually populated by P-4.
- Rebuild-at-priming policy remained intact: no artifact persistence.

## 2. Pin and precheck

- Build commit pinned to current HEAD: `6b0c097aeac198ab46083d14a4fe9d4f1bce74e0`.
- Delta from `5db6493a` to HEAD confirmed docs-only (`#805`), with no `package.json` or `package-lock.json` changes.

## 3. Environment and parity evidence

Parity image built from inline Dockerfile in Ubuntu 22.04 glibc lane, NodeSource `setup_20.x`, independent of `Dockerfile.p4` as execution authority.

Container-internal parity probe output:

- `uname -m`: `x86_64`
- `ldd --version | head -1`: `ldd (Ubuntu GLIBC 2.35-0ubuntu3.13) 2.35`
- `node --version`: `v20.20.2`
- `npm --version`: `10.8.2`

Result: four-tuple matched expected lane exactly.

## 4. P-4 result (reconfirm)

Command shape: `npm ci` in mounted worktree inside parity container.

Observed:

- Install completed successfully.
- `added 946 packages, and audited 947 packages`.
- No native-ABI load crash.
- Deprecation and vulnerability warnings present (non-gating for this viability check).

Verdict: **P-4 PASS (reconfirmed).**

## 5. P-5 result (close)

Command shape: start-verify under a 30s cap in the same mounted context (`timeout 30 node app.js`).

Pre-committed classification rule:

- FAIL: `MODULE_NOT_FOUND` or early native-ABI load crash before app logic.
- PASS: runtime reachability through app init / route-model registration / DB-connect attempt, with expected off-box DB/JWT env gaps.

Observed:

- App booted and logged startup/version markers.
- Model load and association phases completed.
- Route registration proceeded broadly across the stack.
- Runtime reached route registration within the cap window.
- No `MODULE_NOT_FOUND` and no early native-ABI crash.
- Expected env-gap failures occurred (`DB_*` unset; `JWT_SECRET` unset in isolated container).

Verdict: **P-5 PASS (start viability confirmed).**

## 6. Anomalies logged (non-gating in this session)

- Template Studio route load emitted: `The "url" argument must be of type string. Received undefined`.
	- This is not a FAIL-signature for this gate and did not prevent runtime reachability.
	- Logged here for follow-up visibility; not investigated in this off-box viability session.
- CORS allow-list output included `3.94.166.174` as a configured origin string.
	- This is application config output, not SG ingress state.
	- Logged for awareness only; no security-group conclusion drawn from this signal.

## 7. Boundary and policy checks

- No production SSH.
- No production box mutation.
- No credential extraction or rotation.
- No shared-state mutation in repo history from this execution sequence.
- Image removed and temp worktree removed at close.
- No persisted build artifact (rebuild-at-priming preserved).

## 8. Chain position after this session

1. Phase 0 (gate 2.5): CLOSED (FD-40 / PR #799).
2. Phase 1 live abort re-verify: GREEN (recorded in the 2026-06-16 handoff, filed via #805; rerun required at actual [3] window).
3. P-4: PASS (reconfirmed this session).
4. P-5: PASS (closed this session).
5. Next gated thread: verify formal satisfaction of the put-parameter chain step (explicitly flagged as "verify, do not assume" in 2026-06-16 handoff), then later [3] window prerequisites.

[3] remains NOT primed by this note.

## 9. Session-close state

- Box changes: none
- Process changes: none (off-box container only)
- Credential changes: none
- Artifact persistence: none

