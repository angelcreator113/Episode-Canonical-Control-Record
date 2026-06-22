# F-Deploy-1 — [3] entry known-benign baseline

Status: Warm-session reference. Built from recorded evidence (#838, SESSION2,
HashID 2026-06-22). READ-GATED: a cold [3]-entry session reads this ONLY when
baseline-aware entry is explicitly authorized by prior adjudication for that
run. Default cold-entry posture is baseline-BLIND.

Purpose: so an authorized baseline-aware session does not re-abort on signals
already known benign. Each entry marks a signal benign-WHEN-SEEN and names the
owed question it does NOT close.

## Signal 1 — TCP resolution to 100.50.2.212
Benign-when-seen: this is canon's confirmed public endpoint (06-21 #838
§4/§7/§8), distinct from the fork's 34.237.165.225. Seeing it is not a new
finding.
Does NOT close: the formal 100.50.2.212 ↔ 10.0.20.224 (DB-layer identity)
closure, which remains OWED. Public-endpoint confirmation is not DB-layer
identity confirmation.

## Signal 2 — SSM credential auth failure
Benign-when-seen: the value at `/episode-metadata/canon/db_password` is the
documented-stale credential (97aac3b0…, len 38), per SESSION2 §2 and 06-21 §4.
An auth failure from it is expected, not new.
Does NOT close: Candidate-B canon-auth status, which remains UNRESOLVED. A
known-stale credential failing tells us nothing about whether Candidate-B
authenticates.

## Signal 3 — connection-string parse misfire
Benign-when-seen: matches the SESSION2 §3 pitfall-#2 method defect. It is a
tooling/method defect, not a canon-state signal.
Does NOT close: any canon-identity question. The probe still owes a clean
execution that returns inet_server_addr / current_database.

## Standing non-closures (carried from adjudication 2026-06-22)
Candidate-B canon-auth UNRESOLVED · live canon DB-layer identity UNCONFIRMED ·
100.50.2.212 ↔ 10.0.20.224 OWED · split-brain DB_HOST re-confirm OWED ·
FD-31 Sec 7 NOT green. This document closes none of them.
