# F-Deploy-1 [3] -- Credential Branch Execution Runbook

**Type:** Cold-safe execution procedure. Navigation/scaffolding only. Mints no FD.
Authorizes nothing, schedules nothing, mutates nothing on its own. Contains NO probe
outcome, NO branch selection, NO credential value beyond the masked-hash identifiers already
on main. The cold [3] session fills in the live result and follows the matching branch. Box
stays FROZEN; FD-31 OPEN; [3] not primed by this document.

**Purpose:** The credential re-anchor at [3] resolves on a single cold-locked canon-auth
probe with four mutually-exclusive outcomes (ReAnchor Scoping 2026-06-22, Sec 4). Three
outcomes require NO canon password write; one does. All four end in the [3] restart-to-align.
This runbook turns that four-way branch into a followable procedure so the cold session
executes a decided sequence rather than improvising a canon write live. It decides nothing --
the probe outcome (not this doc) selects the branch.

**Authorities (all on main; this doc synthesizes, supersedes nothing):**
- `F-Deploy-1_Rotation_Session_Scoping_v2.md` Sec 4 -- probe order, candidate set, prohibited extraction methods.
- `F-Deploy-1_ReAnchor_Scoping_2026-06-22.md` Sec 3-4 -- value-provenance gate, four cold-locked branches.
- `F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` Sec 6.3 (+ supersede banner) -- the rotate + restart-to-align coupling for the canon-write branch.
- FD-43 (Fix Plan v1.16) -- the off-box-credential precondition this procedure exists to resolve (supersedes FD-42/v1.15, the prior precondition framing).

---

## Precondition (before the probe)

This runbook is entered ONLY inside a validly-primed cold [3] window, AFTER FD-31 Sec 7
abort re-verify is green. The probe below is the cold-locked action; it is not taken in any
warm session. If FD-31 Sec 7 has not passed live this session, STOP -- you are not at the
branch point yet.

## Step P -- The canon-auth probe (selects the branch)

Run the probe per v2 Sec 4: a live, masked, non-printing canon auth attempt against the
on-hand candidates in order, terminating at the first success.

- Probe order (newest-plausible-first): **Candidate B (06-12 era, `9f7856a2...438b`) ->
  Candidate A (05-11 era, `70469a66...1dc5`) -> Stale (stored SSM v2/.env value, `97aac3b0...`)**.
- Stale is probed LAST: the v1.15 "completion-inferred, not proven" qualifier means the stored
  value could still authenticate if the 06-20 modify did not complete -- so it is third, not first.
- Each attempt: psql connect, masked, NO value to transcript. Success = authenticates AND
  returns canon identity by data (`current_database()` = episode_metadata, `inet_server_addr()`
  = 10.0.20.224, never by name string).
- The outcomes are mutually exclusive -- canon accepts exactly one password. Record WHICH
  branch the probe selected; do not record the value.

After the probe returns, go to the matching branch below.

## Branch 1 -- Stale authenticates

Implication: the stored SSM v2/.env value IS canon's current password (the 06-20 modify did
not materially change it, or queued != completed). v2's apply premise is restored.

Action:
1. The apply step is a no-op or a re-assert of the stored value -- no NEW credential value is
   written. Provenance gate stays CLOSED (stored value is correct).
2. The restart-to-align still proceeds. It is the [3] window's restart and happens regardless
   of branch; only the credential apply is a no-op here, not the restart.
3. Verify canon identity post-restart by the FD-31 Sec 6.3 / FD-38 integrity gate (unfiltered
   count + IP/VPC identity, NOT /health). Any deviation -> ABORT, restore from snapshot (Sec 6.4).

## Branch 2 -- Candidate B authenticates

Implication: canon's live password is the 06-12-era value (`9f7856a2...438b`), not the stored value.

Action:
1. Apply target is B. No canon password WRITE -- B already authenticates; re-anchor the off-box
   source (SSM new version + .env) TO B so the in-policy surfaces match canon.
2. B is on-disk: no box read of the running secret needed. B handling stays masked/non-printing
   throughout (no echo, no cat, no render).
3. Write B to .env AND SSM (new version) within the window. Then restart-to-align per Sec 6.3.
4. Verify post-restart by canon identity (IP/VPC) + integrity gate. Deviation -> ABORT (Sec 6.4).

## Branch 3 -- Candidate A authenticates

Implication: canon's live password is the 05-11-era value (`70469a66...1dc5`).

Action: identical to Branch 2, substituting Candidate A for B. Same provenance posture (A is
on-disk; masked handling; re-anchor SSM/.env to A; restart-to-align; verify by identity).

## Branch 4 -- None authenticate (the canon-write branch)

Implication: canon's current password (likely post-06-20) is captured nowhere on disk; it
exists only in the running app's in-memory pool. This is the worst-case branch and the ONLY
one that writes a new canon password. The value-provenance gate (ReAnchor Sec 3) is fully live.

Two sub-paths -- choose per session policy, both gated:

> **Preference within Branch 4 (Finding 3, FD-43 #865).** 4a and 4b are NOT neutral
> choices. 4a is PREFERRED: it propagates the EXISTING working credential (the in-memory
> value) to the off-box surfaces without touching canon -- the same re-anchor mechanism
> branches 2 and 3 use (write an already-authenticated value to SSM/.env), differing only
> in that the value is sourced from masked in-memory extraction rather than a disk file.
> The thread through branches 2, 3, and 4a is identical: re-anchor an authenticated value,
> whatever its source; canon's password is unchanged. The mechanism is `ssm put-parameter`
> (+ .env write), NOT `modify-db-instance`. 4b (rotate fresh) is the FALLBACK only when
> extraction is prohibited or fails -- and it is the ONLY sub-path that changes the
> authenticated value, constitutes a canon write, and increments the credential rotation
> COUNT (FD-42 qualifier). Try 4a first; fall to 4b only if 4a is unavailable.

**4a -- Masked in-memory extraction (if policy permits reading the running secret):**
1. Extraction is masked, hashed, non-printing ONLY. `pm2 env`, `pm2 jlist`, `pm2 prettylist`
   are PROHIBITED -- they print the secret to console/transcript (v2 Sec 4).
2. A box read creates a transient plaintext third copy -- a mutation of the exposure surface.
   It demands ONE uninterrupted sequence (read -> use -> verify, no staged plaintext left
   sitting), no-echo on both sides (ReAnchor Sec 3 box-read cost).
3. Correctness gate is the canon re-probe (identity by IP/VPC), NOT a hash compare -- a hash
   compare only proves faithful transfer, not that the value authenticates canon.
4. Re-anchor SSM/.env to the recovered value; restart-to-align; verify by identity.

**4b -- Rotate fresh (if extraction is not permitted or fails):**
1. Generate a new password locally (never recorded in any doc/chat/commit).
2. Write to canon: `aws rds modify-db-instance --region us-east-1 --db-instance-identifier
   episode-control-dev --master-user-password <NEW> --apply-immediately`. Rule 7 hard gate;
   confirm target identifier TWICE (episode-control-dev, NOT -prod). Poll PendingModifiedValues
   empty before proceeding.
3. Per the FD-31 Sec 6.3 supersede banner: this is the credential-destructive path. The <NEW>
   value MUST be in .env (and SSM, new version) BEFORE the process cycles, or the only working
   credential is lost with no off-box recovery. Order: rotate canon -> confirm PendingModifiedValues
   empty -> write <NEW> to .env + SSM -> THEN restart-to-align.
4. Verify post-restart by canon identity (IP/VPC) + integrity gate. Any deviation -> ABORT,
   restore from snapshot (Sec 6.4).

## Post-branch (all branches)

- All four branches end in the [3] restart-to-align. Only the credential apply differs: no-op
  (Branch 1), off-box re-anchor (Branches 2, 3), canon write (Branch 4b) or masked recovery
  (Branch 4a).
- The credential rotation COUNT qualifier (FD-42) increments only on a canon WRITE (Branch 4b);
  Branches 2 and 3 re-anchor off-box only; Branch 1 writes nothing. Record which occurred for
  the [3] reconciliation close.
- Fork (`episode-control-prod`) is OUT OF SCOPE here (v2 Sec 5); its teardown is separate
  post-cutover housekeeping. Do not cross-wire DB_PASSWORD and FORK_DB_PASSWORD.
- This runbook closes nothing on its own. The [3] reconciliation close (Fix Plan revision +
  FD register advance) is a separate gated artifact authored after the window completes.

## What this runbook does NOT do

- Does NOT state which branch is true (cold-locked; the probe decides).
- Does NOT contain any credential value (masked-hash identifiers only, already on main).
- Does NOT prime, schedule, or authorize [3]; does NOT move or close any FD or gate.
- Does NOT decide rotate-vs-recover -- it scaffolds whichever the live probe selects.