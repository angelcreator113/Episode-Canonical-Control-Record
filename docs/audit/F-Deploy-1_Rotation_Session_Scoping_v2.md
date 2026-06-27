# F-Deploy-1 FD-41 Credential Reconciliation — Session Scoping (v2)

**Type:** Session scoping. Authorizes nothing, schedules nothing, primes nothing. No RDS or prod-box action is taken by this document. The box stays FROZEN; FD-31 and FD-41 remain OPEN.
**Supersedes:** the v1 scoping DRAFT (which framed standalone-vs-[3] as OPEN and the cause as unknown). v2 collapses that branching: cause is established, direction is chosen.
**Remediates:** FD-41 (F-Deploy-1 Fix Plan v1.14 §3, on main via #837) — stored canon credential stale against canon.
**Discipline:** runs in the gated [3] window with [3]'s own fresh live FD-31 §7 abort re-verify. Inherits nothing from the 2026-06-21 investigation.

---

## §1 What changed v1 → v2

v1 left two things open; the 2026-06-21 step-zero reads and the admin recall closed both:

- **Cause — settled (benign).** The stored canon credential (`.env` == SSM v2, byte-identical, shared hash `97aac3b0…41fae`) is the intended value of an admin-initiated credential change written 2026-06-14/15 (SSM v1→v2, `evoni-admin`) that was never applied to the canon `postgres` role. Canon's live password is the pre-06-15 value the running app loaded at start (~06-01) and holds in its in-memory pool. Not an intrusion (admin-recognized); not a cross-wire (`FORK_DB_PASSWORD` is a distinct value). Evidence: FD-41 evidence note (#838).
- **Direction — chosen (apply-to-canon).** Make canon's live password match the stored `.env`/SSM value, rather than recover and re-canonize the old in-memory value. Rationale: stored state is already aligned between `.env` and SSM; recovering the old value is higher ambiguity and weaker control; apply-to-canon keeps one canonical secret source and minimizes branching.

The v1 §2 standalone-vs-[3] question resolves to **fold into [3]**: the app cannot adopt any reconciled credential without the restart-to-align, and that restart is the [3] operation.

## §2 The reconciliation, in order

This is no longer "rotation because nothing authenticates." It is "apply the already-intended credential to canon, then let the app pick it up at the restart." Steps, all inside the gated [3] window:

1. **Layer-1 identity (pre-apply, infra, no DB credential).** Confirm the target is canon at the AWS layer: `describe-db-instances` shows `episode-control-dev`, single intended instance, master user `postgres`, SG `sg-002578912805d1930`. (Two instances exist — canon `episode-control-dev` and fork `episode-control-prod`; the apply targets canon only.)
2. **Apply the stored value to canon master.** `postgres` is the confirmed RDS master user, so:
   ```
   aws rds modify-db-instance --db-instance-identifier episode-control-dev \
     --master-user-password <STORED-VALUE-FROM-SSM-v2> --apply-immediately --region us-east-1
   ```
   Non-disruptive at the RDS layer (no instance reboot). The value comes from SSM v2 / `.env` (already aligned) — not retyped, not newly generated. After this, canon's live password == stored value.
3. **Verify the apply (DB-level, with the now-matching stored credential).** Once the modify completes, a fresh psql/pg connect with the stored credential should now SUCCEED and return `current_database()` = `episode_metadata`, `inet_server_addr()` = `10.0.20.224`. This is the first point canon identity is DB-confirmable (FD-41 left it unconfirmable). Failure here = ABORT + investigate before any restart.
4. **Restart-to-align (the [3] restart).** The running app is still on its old in-memory credential; restart so it reloads `.env` and connects on the now-matching value. Clean-restart is unproven (FD-36/FD-37) and the box is frozen — this is why the apply folds into [3] and is not a standalone act. Post-restart: `/health` = 200 + `database:connected` on the canon host, FD-38 fingerprint + identity asserts. Wrong host / mismatch = ABORT + restore from snapshot.

## §3 Abort gates — confirm live at the [3] session start, untrusted from any prior

| Gate | Condition to proceed |
|---|---|
| Snapshot present | `episode-control-dev-prefreeze-insurance-20260530` exists and is restorable |
| Verified dump on disk | `C:\Users\12483\Documents\PrimeStudios-Backups\` dump present (on-record: 2,828,246 bytes) |
| Ingress clean | Canon SG `:5432` ingress shows no `0.0.0.0/0`, no `3.94.166.174/32` — either reappearing is an escalation trigger |
| Post-apply auth (step 3) | Stored credential now authenticates to canon, identity resolves to `episode_metadata` / `10.0.20.224` |
| Post-restart (step 4) | `/health` 200 + `database:connected` on canon host; FD-38 fingerprint matches |

Any gate not green = do not proceed. Step-3 or step-4 mismatch = ABORT + restore from snapshot.

## §4 Recovery fallback — on-disk candidates exist; validity is cold-verifiable only

If step 2 or 3 goes wrong (the stored value is itself defective, not merely unapplied), there ARE on-disk fallbacks — but which one canon accepts cannot be determined warm. Verified 2026-06-21 by masked hash (value never read): the 06-21 capture's `untracked/` set on the box holds **three distinct values**, time-ordered by filename:

| Value | masked hash (sha256) | len | first/last | appears in |
|---|---|---|---|---|
| **Candidate A** | `70469a66…1dc5` | 40 | Q / R | `.env.bak-manual-20260511-1536`, `.env.backup-pe39-20260511`, `.env.bak-` (05-11 era) |
| **Candidate B** | `9f7856a2…438b` | 40 | F / 3 | `.env.bak-20260612-144450`, `.env.pre_reconcile_20260612_3` (06-12 era) |
| **Stale (current/broken)** | `97aac3b0…41fae` | 38 | F / 9 | `.env.pre-dbport-20260620-154546`, `.env.pre_reconcile_20260612_4` (06-20 + one 06-12) — identical to current `.env` and SSM v2 |

What this does and does NOT establish:
- Recovery candidates exist on disk (A and B). This is NOT the "working value lives only in memory" case.
- The running app loaded its credential ~06-01; the value canon currently accepts is whatever was live in `.env` at 06-01. None of the captured filenames is dated 06-01, so **A, B, or neither** could be the live canon password. The hashes alone cannot decide it.
- **Validity is not warm-testable.** Confirming which value canon accepts requires a live auth attempt against canon — a cold-[3] action, not a warm one. So this section identifies candidates; it does not certify a recovery value.

Cold-session recovery procedure (only if apply-to-canon needs a fallback):
1. Test the on-disk candidates against canon read-only (psql connect, masked, no value to transcript), newest-plausible-first: **Candidate B (06-12) → Candidate A (05-11)**. The first that authenticates and returns canon identity (`episode_metadata` / `10.0.20.224`) is the known-good working credential.
2. If neither authenticates, the working value is captured nowhere on disk and exists only in the running process. In that case in-memory extraction is a **masked, hashed, non-printing** operation — and `pm2 env` / `pm2 jlist` / `pm2 prettylist` remain PROHIBITED (they print the secret to console/transcript).
3. Recovery is a fallback to the apply-to-canon plan, not a substitute for it. The plan remains: apply the stored value to canon master (§2). A known-good recovery value is insurance if that apply proves defective.

All of the above is read-only candidate identification; no value was read or printed in establishing it (masked hashes only).

## §5 Scope and exclusions

- **Fork out of scope.** No cross-wire between `DB_PASSWORD` and `FORK_DB_PASSWORD`; the fork (`episode-control-prod`, `34.237.165.225`) was network-unreachable from the box this session (no fork auth conclusion claimed). `FORK_DB_PASSWORD` is treated as correctly scoped unless a separate fork-auth check disproves it. The fork's own teardown remains separate post-cutover housekeeping.
- **One canonical secret source.** After the apply, `.env` == SSM v2 == canon live password. No new SSM version is required by apply-to-canon (the stored value is unchanged); if any write occurs, it is metadata only.

## §6 Session discipline

- Runs inside the gated [3] window; [3]'s own fresh live FD-31 §7 abort re-verify at session start; inherits nothing.
- Draft → Confirm → Execute on every RDS / box / shared-state step. One command per line (PowerShell paste hazard). `--region us-east-1` explicit. `-LiteralPath` for any path containing `[3]`.
- The step-2 `modify-db-instance` is the one mutating call; it is the credential rotation event (increments the rotation COUNT qualifier held OPEN at FD-41). Everything before it (Layer-1) and the verifies (steps 3–4) are reads.
- On close: a Fix Plan revision moves FD-41 OPEN → closed-by-reconciliation, records the rotation COUNT increment, and captures the post-restart in-memory state (resolving the self-reported-only qualifier).

## §7 Status of the step-zero reads

The step-zero read-pack (`F-Deploy-1_Rotation_StepZero_Reads_DRAFT.md`) is SPENT — it answered §1's cause and direction questions on 2026-06-21 and does not need re-running to open [3]. Its findings are folded into FD-41 (#837) and the evidence note (#838). [3] runs its own fresh abort re-verify regardless; the step-zero reads are not a substitute for that.

## §8 What this scoping does NOT do

- Does not authorize the apply or schedule [3].
- Does not take any RDS or prod-box action.
- Does not generate a new credential (the stored value is applied as-is).
- Does not touch the fork.
