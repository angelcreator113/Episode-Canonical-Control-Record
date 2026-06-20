# F-Deploy-1 — FD-40 Reconciliation: Fork-and-Block Framing

**STATUS: DRAFT ONLY. THIS DOCUMENT MINTS NOTHING.**
It does not mint FD-40. It does not change the Fix Plan register. It does not
adjudicate whether credential-rotation work occurred. It frames the decision a
future *gated* Fix Plan revision must make, and names the specific read that
unblocks that decision.

Authored read-only, 2026-06-18 (warm session — P-4/P-5 verification session,
disqualified from priming [3]). Verify-and-land is for a later session under gate.

---

## 1. Verified read-only facts (this session)

1. Authoritative Fix Plan register tail = **FD-39** (`F-Deploy-1_Fix_Plan_v1.11.md`,
   which itself records "v1.10 register through FD-38"; v1.11 mints FD-39).
2. **No Fix Plan revision mints FD-40.** Strict grep (`FD-40`) and permissive grep
   (`FD.?40`) across all `*Fix_Plan*` files returned empty.
3. FD-40 exists only as an **orphan cluster of 5 standalone artifacts** keyed to the
   unminted number:
   - `F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md`  (credential-adjacent)
   - `F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md`
   - `F-Deploy-1_[3]_Master_Runbook_FD40_Reconciliation_Readiness_Note_2026-06-15_DRAFT.md`
   - `FD40_Runbook_Reconciliation_EditSet_DRAFT.md`
   - `Prime_Studios_Session_Handoff_v20_2026-06-15_FD40.md`  (a SESSION HANDOFF —
     the likely vector by which memory inherited "register through FD-40" as fact)

**Consequence:** Gate 2.5 (credential rotation) register status is **UNCONFIRMED**,
not closed. Its "closed" status rested on the credential-rotation standalone's
self-applied banner, which — per the FD mechanism — is **not register authority**.

**Non-assertion:** This says nothing about whether the rotation *work* happened.
Memory records rotation episodes (#807/#810/#811). The work may be done. What is
unconfirmed is the **register status**, not the work.

---

## 2. The fork — a decision that CANNOT be made read-only

Two distinct things are both reaching for the number FD-40:

- **(X) the credential-rotation gate** — the subject the orphan standalone originally
  claimed FD-40 for; and
- **(Y) the register-integrity defect** — the finding that (X) was never properly minted.

The next mintable number is FD-40 (tail = FD-39). It must NOT be assigned blindly.
A premature mint of FD-40 to (Y) the defect would be a **referent collision**: FD-40
would come to mean "the report about the problem" rather than "the credential gate,"
forcing (X) into FD-41 or permanent orphanhood — a worse tangle than the present one.

**PATH 1 — the rotation work is real and mintable:**
  - Mint **FD-40 = credential-rotation gate** (subject X).
  - The integrity tripwire (Y) does NOT get its own FD number. Per the FD mechanism
    (a verification thread that corroborates an existing finding files as an evidence
    note + forward-pointer, not a new FD number), it files as the note that surfaced
    the mint gap.
  - The 5 orphan artifacts are reconciled to point at the now-validly-minted FD-40.

**PATH 2 — the orphan cluster should be withdrawn/renumbered:**
  - The credential-rotation standalone is withdrawn or renumbered (not retroactively
    blessed as FD-40).
  - FD-40 is then free to mint for whatever the next genuine finding is, OR the defect
    (Y) takes FD-40 explicitly and on purpose.
  - Exact disposition depends on what the read in Sec 3 reveals.

---

## 3. The blocker — the specific gated read that decides the fork

The choice between Path 1 and Path 2 depends on whether the underlying
credential-rotation work is real and mintable. That can only be judged by reading:

> **`F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md`**

This file is **credential-adjacent — EDITOR-READ ONLY, never `cat` to console.**
It must be read by a human, in the editor pane, not summarized by the IDE agent
(trust conclusion this session: agent fine for pointing at files, NOT trusted to
disposition or summarize their content for decisions).

Until that read happens, **FD-40's referent is undecided and no revision should mint it.**

---

## 4. Clearing condition (for [3] precondition accounting)

Before Gate 2.5 may be counted green as a [3] precondition, ONE reconciled path
must land via a gated Fix Plan revision:

1. A Fix Plan revision mints the gate finding with valid FD numbering and an aligned
   register entry (Path 1), OR
2. The FD40 standalone artifacts are renumbered or withdrawn so standalone naming and
   Fix Plan register agree (Path 2).

Until then, Gate 2.5 is tracked as **UNCONFIRMED by register authority**, and the
tripwire stands. Stop Gate #1 (no-repeat-at-cutover) remains MANDATORY regardless.

---

## 5. What this draft is NOT

- NOT a Fix Plan revision (mints nothing, advances no gate).
- NOT a disposition of the 5 orphan artifacts (that is separate gated cleanup).
- NOT a judgment on whether rotation work occurred.
- NOT landable from this warm session — it is framing + blocker identification only.
