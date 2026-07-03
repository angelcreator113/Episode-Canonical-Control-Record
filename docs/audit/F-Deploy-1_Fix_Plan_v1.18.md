# F-Deploy-1 Fix Plan v1.18

## Sec 1 Purpose

Mints FD-45 (dump.pm2 plaintext-credential-at-rest surface, per FD-44's
noted-surfaces flag: "candidate for its own FD at next revision if not cleared" --
not cleared). Adopts the FD-42 Leg (a) warm reconciliation note (2026-07-02, #886)
into FD-44's carried reconciliation: leg (a) worked warm to SUBSTANTIATED, NOT
PROVEN; leg (b) untouched, remains open and cold. Drafted as transcription of
committed documents read live this session (v1.17; sitting record 3672fafe; Leg A
note #886); performs no first-instance reasoning beyond register bookkeeping;
executes no query; no box, SSM, or canon contact. No gate moves; freeze posture
unchanged (as amended by v1.17: id-3 held running); [3] not primed;
FD-31/FD-42/FD-43/FD-44 remain OPEN.

## Sec 2 Reference documents

| Doc | Role |
|---|---|
| `F-Deploy-1_Fix_Plan_v1.17.md` | Immediate predecessor; mints FD-44. Retained verbatim; v1.18 narrows FD-44's carried reconciliation additively and acts on its noted-surfaces flag. |
| `F-Deploy-1_id3_Standup_Sitting_Record_2026-07-02.md` (3672fafe) | Evidentiary basis for FD-45 (Sec 4 dump.pm2 inventory; Sec 7.5 disposition owed). |
| `F-Deploy-1_FD42_LegA_Warm_Reconciliation_Note_2026-07-02.md` (#886) | Leg (a) timeline and verdict adopted into FD-44's carried reconciliation. |

## Sec 3a Register entry -- FD-45

FD-45 -- ~/.pm2/dump.pm2 plaintext-credential-at-rest surface; triage owed,
deletion barred pending evidentiary read.

ESTABLISHED (sitting record 3672fafe, Sec 4):
  - EXISTS, 34,266 bytes, mtime 2026-06-24 03:14 UTC. jq absent on box, so
    contents NOT digested; not mutated in the sitting.
  - Surface class: pm2 dump files serialize process env -- DB_PASSWORD, API
    keys -- in plaintext at rest.

RECORDED, NOT ESTABLISHED (inference of this revision, not sourced):
  - The sitting record carries two separate observations: the dump inventory
    (Sec 4) and the id-4 window sharpening (Sec 7.2 -- which concerns id-3's
    creation time, not the dump). Joining them is this revision's reasoning:
    the dump's 06-24 03:14 mtime PREDATES the tightened id-4 boundary (06-27
    12:34:50) and id-3's creation (06-27 12:50:58Z) by ~3 days, so it may
    preserve pre-construction-window topology and credential state useful to
    the id-4 reconstruction. Whether it does, and whether it contains the
    working credential value, is UNKNOWN.

DISPOSITION (register-level, binding):
  - Deletion BARRED until an evidentiary read occurs. Triage order: digest
    contents (method pinned in-session) -> extract topology/credential
    evidence for the id-4 reconstruction -> then cleanup. All steps
    cold/box-gated; nothing warm-executable.

Evidence: sitting record 3672fafe (Sec 4, Sec 7.5); Fix Plan v1.17 (noted surfaces).
Status: OPEN -- closes when the evidentiary read + cleanup complete post-[3].

## Sec 3b FD-44 carried-reconciliation update (adopts Leg A; mints nothing)

Leg (a) -- when/how .env came to hold a working value: worked warm to
SUBSTANTIATED, NOT PROVEN (#886). Timeline as committed: 06-15 canon rotate +
SSM v2 write (97aac3b0, len 38) -> 06-20 canon rotate, no SSM rewrite -> FD-42
observes .env == SSM v2 fails canon auth -> 06-27 12:50:58Z id-3 launches with
an authenticating value (b6694fc0, len 40, value-only), pre-06-30 per #879
xcheck. Value change strongly implied (hash + length mismatch) but the hash
method for 97aac3b0 is unstated in the record -- method-equivalence unproven.
Warm ceiling reached. Settlement paths (cold, per the note): (1) Scoping-v2
Stale-row method check; (2) Candidate-B canon-auth proof-test, assigned to [3].

Leg (b) -- whether .env == SSM v2 still holds: NOT worked; requires live
SSM/box read; remains open and cold.

Register effect: FD-44's carried reconciliation narrows from "owed, unworked"
to "leg (a) at warm ceiling, settlement cold-assigned; leg (b) open." FD-44
remains OPEN; nothing in it is rewritten.

## Sec 4 Register decision -- mint FD-45; narrow FD-44 additively; retract nothing

1. FD-45 independent content/lifecycle? Yes -- a distinct at-rest exposure
   surface with its own triage lifecycle (digest -> extract -> cleanup),
   explicitly teed by v1.17's next-revision flag and not cleared. Peer register
   entry, not a sub-detail of FD-44.
2. Retracts anything? No. FD-44 stands verbatim in v1.17; its carried
   reconciliation is narrowed additively. FD-42/FD-43 untouched.

Register topology: FD-42 (v1.15, OPEN) -> FD-43 (v1.16, OPEN) -> FD-44 (v1.17,
OPEN, reconciliation narrowed by v1.18) -> FD-45 (v1.18, OPEN). No prior
register entry is rewritten.

## Sec 5 Closing

*Fix Plan revision v1.18. Mints FD-45 -- dump.pm2 plaintext-credential-at-rest
surface, deletion barred pending cold evidentiary read (id-4 reconstruction
relevance recorded, not established); adopts the FD-42 Leg (a) warm
reconciliation (#886) into FD-44's carried reconciliation at SUBSTANTIATED, NOT
PROVEN with cold settlement paths assigned; leg (b) remains open. Advances no
gate; authorizes no prod-box action; does not prime [3]; picks no branch;
rotates nothing. Freeze posture unchanged as amended by v1.17. FD-31 remains
OPEN. v1.17 (and the chain beneath it) canonical for anything v1.18 does not
supersede. [skip-automerge]*