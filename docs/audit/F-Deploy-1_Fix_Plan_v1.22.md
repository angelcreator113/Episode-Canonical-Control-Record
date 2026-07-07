# F-Deploy-1 Fix Plan -- v1.22 (2026-07-07)

Formal revision. Supersedes nothing in the v1.21 FD register; all
v1.21 content stands. This revision records PHASE POSITION only.
Basis: the 2026-07-06 ruling session (live reads of v1.21, v1.20,
v1.19, v1.14, v1.1, and F-Stats-1 Fix Plan v1.2 s9), re-verified
2026-07-07 against origin/main at f6e1485b, including a live
re-read of v1.1's Phase A gate ladder. That ruling session landed
no artifact on main; this revision closes that gap so cold
sessions inherit the ruling from the register, not from chat or
memory. Performs no first-instance reasoning beyond transcription;
executes no query; no box or canon contact.

## Phase position (authoritative as of this revision)

1. PHASE A IS OPEN. Per v1.0 s5.1-s5.3 as carried unchanged by
   v1.1: Gate A-G1 (pre-flight) closed at v1.1 (FD-13). Phase A G2
   (implementation of sub-form A auto-merge hardening, PRs
   A-1/A-2/A-3, plus sub-form C branch protection / FD-5 required
   checks) was the next executable gate as of v1.1 and REMAINS
   unexecuted. Phase A G3 (sub-form D local-tooling diagnostic,
   candidate inventory per FD-14) and Phase A G4 (1-week soak per
   FD-10) follow G2. Work stopped at approximately v1.14 when the
   credential thread began and has not resumed.

2. The FD-31 / FD-38 / FD-42 / FD-43 / FD-44 / FD-45 arc (v1.14
   through v1.21) is the credential and restart-to-align
   workstream. It is deploy-box runtime work adjacent to Phase B.
   It is NOT Phase A progress and its closures do not advance any
   Phase A gate. A reader of v1.21 alone could mistake a closed FD
   register for progress toward keystone close; this revision
   forecloses that reading.

3. DECISION #9, as written in F-Stats-1 Fix Plan v1.2 s9, gates
   F-Stats-1 Phase B on F-DEPLOY-1 KEYSTONE CLOSE (Phase C
   complete), not on Phase A close. Sole exception: F-Stats-1
   Phase B G2 serves as the canonical test DURING F-Deploy-1
   Phase B/C soak only. Earlier wording attributing the gate to
   "Phase A close" (carried in session memory and some handoff
   text) is stale and superseded by the s9 text itself.

## Close path restated

Keystone close = Phase A resume (G2 implementation -> G3
diagnostic -> G4 soak, per v1.0 s5.1-s5.3) -> Phase B (deploy-dev
architectural correction, alpha-vs-beta decision per FD-8 at
Phase B G1) -> Phase C (soak and verification). FD-45 tail and
the v1.21 carried items are credential-thread residue, tracked in
v1.21; they are owed but are not the keystone spine.

*Closed: none. Minted: none. Advances no gate; authorizes no
prod-box action. [skip-automerge]*
