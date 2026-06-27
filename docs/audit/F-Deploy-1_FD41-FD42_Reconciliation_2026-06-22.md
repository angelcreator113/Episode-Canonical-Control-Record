# F-Deploy-1 — FD-41 ↔ FD-42 Reconciliation (2026-06-22)

**Type:** Reconciliation note. Mints no FD number (FD numbers are minted by Fix Plan revisions;
this note is the input to v1.15, which does the minting). Additive — supersedes nothing on its own.
Authorizes nothing, schedules nothing, mutates nothing. The box stays FROZEN; FD-31 remains OPEN;
`[3]` is not primed.

**Purpose:** Reconcile the FD-41 finding (Fix Plan v1.14) against the FD-42 provisional note and its
three CloudTrail provenance addenda (2026-06-22), so that Fix Plan v1.15 can mint FD-42 as a
transcription of settled reconciliation rather than first-instance reasoning. The reconciliation
posture is **mechanism superseded, observations retained**.

**Sources reconciled (all on main):**
- `F-Deploy-1_Fix_Plan_v1.14.md` — registers FD-41 (stored canon credential stale against canon;
  original mechanism: 06-14/15 change "never applied to the canon `postgres` role").
- `F-Deploy-1_FD42_Phase1_OffBox_Credential_Precondition_DRAFT_2026-06-22.md` — FD-42 provisional
  note + provenance addenda #1–#3.

---

## §1 The reconciliation in one line

FD-42 **supersedes FD-41's credential-staleness mechanism** and withdraws FD-41's CloudTrail-empty
claim; **FD-41's unaffected observation legs are retained and carried forward**; the cold-`[3]`-locked
credential-validity questions remain **OPEN behind the same FD-31 §7 gate**, unchanged by either
document.

## §2 Mechanism superseded (FD-42 over FD-41) — three points

1. **CloudTrail "empty in-window" (FD-41) → withdrawn.** FD-41 asserted "CloudTrail ModifyDBInstance
   empty; SSM has no v3; only RDS event in window is a 2026-06-08 engine upgrade." FD-42 addenda #2/#3
   located two `ModifyDBInstance` master-password events on the canon instance
   (`episode-control-dev`) in the same window. FD-41's negative-evidence claim was a scoping/window
   miss and is withdrawn.

2. **"Never applied / canon holds the pre-06-15 value" (FD-41) → superseded.** FD-41's mechanism
   required the 06-15 change to have never reached canon. FD-42 addendum #3 records a
   2026-06-15 09:50:22Z `ModifyDBInstance` master-password request on canon with
   `applyImmediately: true`. A change *was* requested against canon on 06-15, so "never applied" no
   longer holds as stated. The mechanism becomes **stale-by-later-rotation** (evidence-dependency
   caveat in §5): SSM v2 (written 06-15 09:53) captured the 06-15-era value, and a later
   2026-06-20 23:16:50Z canon master-password modify moved canon again, stranding SSM. The event
   chain is gap-free as to recorded events: 06-15 09:50 canon modify → 06-15 09:53 SSM v2 write →
   06-20 23:16 canon modify (no SSM write after 06-15).

3. **FD-42's "CONFIRMED / resolved" → qualified down.** FD-42 addendum #2 calls hypothesis (ii)
   "CONFIRMED" and the stale-SSM mechanism "resolved." That overstates what CloudTrail proves:
   the events establish modify requests **issued and queued** (`applyImmediately: true`,
   `pendingModifiedValues.masterUserPassword: present`), and FD-42's own interpretation admits it
   "does not separately prove completion state from CloudTrail alone." Register-safe statement for
   v1.15: **leading mechanism, strongly evidenced by the event chain; completion inferred, not
   directly proven from CloudTrail alone.** "CONFIRMED/resolved" is NOT carried into register
   language without separate completion proof.

## §3 Observations retained from FD-41 (unaffected by the supersede)

These FD-41 legs are not touched by FD-42 and are carried forward valid:

- `.env` `DB_PASSWORD` and SSM v2 are **byte-identical** (shared SHA-256 `97aac3b0…41fae`, len 38);
  the original investigation's "`.env` SHA ≠ SSM v2 SHA" claim was already refuted in v1.14.
- The **stored value fails canon auth now** from both box and workstation (`password authentication
  failed for user "postgres"`; server reached, an auth verdict, not a network mute).
- The **only currently-working credential exists in the running app's in-memory pool** (process
  uptime ~20d). This is the fragility finding: any pool refresh or restart and the app cannot
  reconnect on the stored value.
- FD-41's **OPEN status** stands; it is closed only by the `[3]` reconciliation (apply a canon-valid
  value + restart-to-align).

## §4 Carried-open — cold-`[3]`-locked, unchanged by this reconciliation

Both documents respect the same boundary; the reconciliation does not move it:

- **Post-06-20 canon password value** — not established (the 06-20 modify's resulting secret is not
  in any warm-readable source).
- **Which credential group is canon-valid** — cold-`[3]`-locked; warm-testable = false (Rotation
  Scoping v2; D1 holds).
- **Candidate-B canon-auth status** — UNRESOLVED, load-bearing.
- All of the above remain gated behind **FD-31 §7 green**. The freeze stands.

## §5 Evidence basis and caveat (load-bearing)

This reconciliation's §2 supersede conclusion rests on **FD-42 addenda #1–#3 as evidence of record**
— prose-level summaries of warm, read-only CloudTrail and SSM `get-parameter-history` reads. The
conclusion is sound **given those addenda are accurate**. It is **revisitable** if any addendum is
later found mis-scoped or misread — for example, if the 06-15 / 06-20 `ModifyDBInstance` events were
on a different instance than recorded, or the event bodies were misread. Per project discipline (live
terminal output is the only first-class evidence standard; prose carries no independent evidentiary
weight), this note does not launder the addenda's prose into independently-verified fact.

A fresh warm CloudTrail re-read (the diagnostic FD-42 itself recommends, "to open with fresh
intent/gate, not momentum") is an **optional hardening step**, not a prerequisite for this note or for
v1.15. If run, it would upgrade §2 from "conditioned on addenda accuracy" toward independently
re-verified.

## §6 What this note does NOT do

- Does NOT mint FD-42 — that is Fix Plan v1.15's action.
- Does NOT move any gate, close FD-31, or prime `[3]`.
- Does NOT establish the post-06-20 canon password value or any credential group's canon-validity
  (cold-`[3]`-locked; D1 holds).
- Does NOT authorize any box, canon, or rotation action.
- Does NOT rewrite FD-41 or v1.14; FD-41 stands verbatim, its mechanism corrected by supersede, its
  observation legs retained.