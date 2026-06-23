# F-Deploy-1 — Off-Box Credential Re-Anchor Scoping (2026-06-22)

**Type:** Scoping note (on-paper only). Mints no FD number. Additive — supersedes nothing.
Authorizes nothing, schedules nothing, mutates nothing. Proposes no command and primes no `[3]`
entry. The box stays FROZEN; FD-31 remains OPEN; `[3]` is not primed.

**Purpose:** Scope the impact of the FD-42 / Fix Plan v1.15 rotation finding on the existing
apply-to-canon plan (Rotation Session Scoping v2). This note is a **delta against v2**: what in v2
still holds, what v1.15's stale-by-later-rotation mechanism now puts in question, one re-activated
constraint from the 2026-06-12 durability scoping, and the cold-`[3]`-locked branch points with the
evidence that unlocks each. It resolves nothing — every unlocking fact is cold-`[3]`-locked.

**Sources (all on main):**
- `F-Deploy-1_Rotation_Session_Scoping_v2.md` — the apply-to-canon plan this note deltas against.
- `F-Deploy-1_Fix_Plan_v1.15.md` (#852) — mints FD-42; stale-by-later-rotation mechanism.
- `F-Deploy-1_FD41-FD42_Reconciliation_2026-06-22.md` (#851) — the reconciliation v1.15 transcribes.
- `F-Deploy-1_Canon_Credential_Durability_Scoping_Outcome_2026-06-12.md` — value-provenance gate
  (mostly superseded; one constraint re-activated here, §3).

---

## §1 What still holds from v2 (unaffected by the rotation finding)

The rotation finding does not disturb these v2 elements; they carry forward:

- **Direction — apply-to-canon.** v2 chose to make canon's live password match a single canonical
  secret source rather than recover-and-re-canonize an old value. That rationale (one canonical
  source, minimize branching) is independent of *which* value is current and still holds.
- **Procedure shape.** Layer-1 infra identity (pre-apply, no DB credential) → apply to canon master
  → verify at DB level → restart-to-align. The shape is sound; only the apply *value* is in question
  (§2).
- **Abort gates (v2 §3).** Snapshot present, verified dump on disk, ingress clean (no `0.0.0.0/0`,
  no `3.94.166.174/32` on canon `:5432`), post-apply auth, post-restart `/health`. All carry; all
  re-confirmed live at `[3]` start, untrusted from prior.
- **Recovery-candidate identification (v2 §4).** Three on-disk groups exist by masked hash —
  Candidate A (`70469a66…`, 05-11 era), Candidate B (`9f7856a2…`, 06-12 era), Stale (`97aac3b0…` ==
  current `.env`/SSM v2). Their *existence* and the masked-hash identification hold.
- **Cold-lock on validity ("D1").** Which value canon accepts is not warm-testable; it requires a
  live auth attempt against canon, a cold-`[3]` action (v2 §4). This principle (the handoff's "D1")
  is unchanged and governs every branch in §4 below.

## §2 What the FD-42 / v1.15 rotation finding puts in question

v2 was written on FD-41's mechanism (06-15 change "never applied"; canon holds the pre-06-15 value).
v1.15 superseded that with stale-by-later-rotation (06-15 *and* 06-20 canon `ModifyDBInstance`
events; canon moved later than v2 assumed). Three v2 elements are now uncertain as a result:

- **v2's cause statement (§1) is superseded.** v2 says canon holds "the pre-06-15 value the app
  loaded ~06-01." Under v1.15, a 06-20 canon master-password modify exists — so canon's live
  password is more likely the **post-06-20 value**, not pre-06-15. (Per the v1.15 evidence
  qualification, the modify is *requested/queued*; completion is inferred, not proven — so "canon
  holds post-06-20" is the leading expectation, not certainty.)
- **v2's apply value (§2 step 2) is in question.** v2 applies "the stored 06-15 value (SSM v2/`.env`)"
  on the premise it is the intended-and-correct value. If canon's live password is post-06-20, the
  stored 06-15 value is neither canon's current password *nor* necessarily the right target to apply.
  The apply-the-stored-value step cannot be taken as settled.
- **v2's recovery candidate set (§4) may be incomplete.** Candidates A, B, and Stale are all
  pre-06-20 captures (05-11, 06-12, 06-20-pre / 06-12). If canon rotated 06-20 to a value captured
  nowhere on disk, **none** of the three is canon's current password — which is v2 §4's own
  worst-case ("captured nowhere; exists only in the running process"), now made more likely by the
  06-20 finding rather than merely possible.

## §3 Re-activated constraint — the value-provenance gate (from 2026-06-12 durability scoping)

The 2026-06-12 durability scoping is largely superseded (its cause model predates FD-41 and FD-42).
But one constraint it raised is **re-activated** by the rotation finding, because it depends on a
premise v1.15 removed:

v2's apply sources its value from SSM v2/`.env` without grappling with provenance, because under v2's
premise the stored value *is* the right one. Once that premise is in question (§2), the 06-12
**value-provenance gate** becomes live again: if re-anchoring needs a value that is *not* the stored
SSM/`.env` value (e.g., the post-06-20 canon password, or a recovery candidate), where does that
value come from — a held secure off-box copy, or a one-time controlled read from the box `.env`?

The 06-12 scoping established the **box-read branch cost**, which carries forward intact:

- A box read of the credential creates a **transient plaintext third copy** during the read — a
  mutation of the exposure surface, not mere setup.
- It demands **one uninterrupted sequence** (read → use → verify, no staged plaintext left sitting),
  **no-echo on both sides** (no `cat .env`; no render on box or operator terminal), and shifts the
  **correctness gate** onto the canon re-probe (identity by IP/VPC, `10.0.20.224` / canon VPC, never
  by name string) rather than a hash compare — because if the box `.env` is the source, a hash
  compare only proves faithful transfer, not correctness.

This note does not decide whether a box read is needed — that depends on the cold-locked branch
outcomes (§4). It records that the provenance gate is **no longer closed** by v2's "stored value is
correct" assumption, and that the box-read path carries the 06-12 cost if it is later required.

## §4 Cold-`[3]`-locked branch points and unlocking evidence

Every branch below resolves on the **same single cold-`[3]` action**: a live, masked, non-printing
canon auth probe against the on-hand candidates, in v2 §4's order (Candidate B → Candidate A),
plus the Stale value. The probe's *outcome* selects the branch; the probe itself is cold-locked
(behind FD-31 §7 green) and is not taken here.

| Probe outcome | What it implies | Re-anchor consequence |
|---|---|---|
| **Stale (`97aac3b0…`) authenticates** | The stored SSM v2/`.env` value IS canon's current password — either the 06-20 modify did not change it materially, or queued≠completed. v2's apply premise is effectively restored. | v2's plan proceeds largely as written; the apply may even be a no-op or a re-assert. Provenance gate (§3) stays closed — stored value is correct. |
| **Candidate B (`9f7856a2…`) authenticates** | Canon's live password is the 06-12-era value, not the stored value. | Apply target is B, not the stored value. Re-anchor SSM/`.env` to B as the canonical source. Provenance: B is on-disk (no box read of the *running* secret needed, but B handling still masked). |
| **Candidate A (`70469a66…`) authenticates** | Canon's live password is the 05-11-era value. | As B, but with A. Same provenance posture. |
| **None authenticate** | Canon's current password (likely post-06-20) is captured nowhere on disk; it exists only in the running app's in-memory pool (v2 §4.2 worst case, now more likely). | The provenance gate (§3) is fully live: re-anchoring requires either in-memory extraction (masked/hashed/non-printing only; prohibited extraction methods are defined in v2 §4.2) or applying a freshly-chosen value to canon and re-aligning. The box-read / extraction cost (§3) applies. |

Two notes on the table:

- The outcomes are **mutually exclusive — at most one authenticates** — canon accepts exactly one
  password. The probe order (B → A, then Stale) is v2's, newest-plausible-first; it terminates at the
  first success.
- The "completion inferred, not proven" qualifier (v1.15) is why even the **Stale-authenticates**
  row is live: if the 06-20 modify was requested but did not complete, canon may still hold the
  earlier value, and the stored value could still authenticate. The probe is what collapses the
  inference to fact.

## §5 What this note does NOT do

- Does NOT take, schedule, or authorize the cold-`[3]` auth probe or any apply.
- Does NOT choose a re-anchor value or direction — the branch outcomes (§4) drive that, and they are
  cold-locked.
- Does NOT decide whether a box read / in-memory extraction is required (§3) — branch-dependent.
- Does NOT move any gate, close FD-31, or prime `[3]`.
- Does NOT touch the box, canon, SSM, or `.env`. On-paper only.
- Does NOT supersede v2, v1.15, or the 06-12 scoping; it deltas against v2 and re-activates one
  06-12 constraint, leaving all three documents standing.
