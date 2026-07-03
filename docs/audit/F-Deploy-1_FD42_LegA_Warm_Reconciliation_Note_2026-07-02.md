# F-Deploy-1 - FD-42 leg (a) warm reconciliation note - 2026-07-02

Not a fix-plan revision. Mints no FD. FD-42 reconciliation register status UNCHANGED (OPEN, "NOT established"). Sharpens scope only.

Source grounding: v1.15, v1.17, and the FD-41 InMemory HashID note all read via git show origin/main this session, on screen. A cold session re-derives all of this live per standard discipline.

## Leg (a) - when/how .env came to hold a working value

Worked this session; committed records only, no box/SSM contact.

- Timeline: 06-15 canon rotate + SSM v2 written (97aac3b0, len 38) -> 06-20 23:16:50Z canon rotate again, no SSM rewrite (stale) -> 06-20/06-22 FD-42 observes .env == SSM v2 == 97aac3b0 fails canon auth -> 06-27 12:50:58Z id-3 launches with an authenticating value (b6694fc0, len 40, value-only), pre-06-30 per #879 xcheck.

- Verdict: SUBSTANTIATED, NOT PROVEN. A working value entered .env in the 06-22 to 06-27 window; mechanism unestablished. Value change strongly implied (97aac3b0 len 38 != b6694fc0 len 40) but the hash method for 97aac3b0 is not stated in the record, so method-equivalence is not proven.

- Warm ceiling reached. FD-41 note grounds the in-memory value as Candidate B (9f7856a2...438b, len 40, value-only) but does NOT carry method to the Stale hash. Same-table-same-method is inference, not adopted.

- Settles only via: (1) Scoping-v2 Stale-row method (header reads sha256 only, not stated), or (2) Candidate-B canon-auth proof-test, assigned to [3]. Cold work.

## Leg (b) - whether .env == SSM v2 still holds

NOT worked. Requires live SSM/box read; gated for cold session.

## Entry state

HEAD 3c3654a6, no open PRs. Re-run wake-up trio and re-derive v1.15 live at cold start; do not inherit this timeline.