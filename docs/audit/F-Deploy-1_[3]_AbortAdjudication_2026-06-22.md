# F-Deploy-1 — [3] entry abort, ADJUDICATION, 2026-06-22

Status: Warm-session adjudication of the [3]-entry abort recorded in
`F-Deploy-1_[3]_AbortNote_2026-06-22.md` (PR #844, commit 9c3e5a88). This note
interprets; it resolves no [3]-gated question. Box remained FROZEN; this
adjudication executed no query and made no on-box contact.

## Source
Evidence base: AbortNote #844 (cold, facts-only). Baseline references: 06-21
evidence #838, SESSION2 evidence note, HashID 2026-06-22. This session is WARM
and was permitted to read those; the cold filing session was not.

## Finding
The abort fired CORRECTLY. Canon identity (`inet_server_addr` = 10.0.20.224,
`current_database` = episode_metadata) was genuinely unconfirmed at Phase 1, so
Sec 5 abort-on-unconfirmed-identity behaved exactly as designed. The abort
surfaced ZERO new findings.

## Observation → known-benign baseline mappings
1. TCP resolution to 100.50.2.212 (AbortNote obs. 1–2): matches canon's
   confirmed public endpoint per 06-21 #838 §4/§7/§8, distinct from the fork's
   34.237.165.225. Benign-when-seen. This does NOT close the owed formal
   100.50.2.212 ↔ 10.0.20.224 closure.
2. SSM auth failure (AbortNote obs. 2): the credential pulled live from
   `/episode-metadata/canon/db_password` is the documented-stale value
   (97aac3b0…, len 38), behaving as SESSION2 §2 and 06-21 §4 already recorded.
   Benign-when-seen as a known-stale credential. This does NOT resolve
   Candidate-B canon-auth status.
3. Probe parse misfire (AbortNote obs. 3): matches the SESSION2 §3 pitfall-#2
   connection-string method defect. A method defect, not a canon-state signal.

## Root cause
The cold session was blind to the known-benign baseline (correctly — cold is
baseline-blind by design). All three signals are benign-when-seen against
recorded evidence, but a baseline-blind session cannot know that, so it aborted.
Root cause = the cold/warm wall, operating as intended. NOT a new defect.

## Explicitly preserved as UNRESOLVED (no closure asserted here)
1. Candidate-B canon-auth status — UNRESOLVED.
2. Live canon DB-layer identity (10.0.20.224 / episode_metadata) — UNCONFIRMED;
   never returned in any session.
3. Formal 100.50.2.212 ↔ 10.0.20.224 closure — OWED.
4. Split-brain DB_HOST live re-confirm — OWED at [3] start.
5. FD-31 Sec 7 — NOT green.

Benign-when-seen ≠ resolved. None of the five above is closed by this note.
