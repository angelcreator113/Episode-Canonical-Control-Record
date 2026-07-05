# F-Deploy-1 Fix Plan v1.19 — DRAFT NOTES (for Evoni's ratification)

> These are DRAFT register-advance notes from the 2026-07-04 id-3/[3] combined window,
> for adoption into a formal v1.19 revision. Per FD-numbering discipline, FD numbers are
> minted/advanced ONLY by a Fix Plan revision Evoni ratifies — this notes file mints and
> closes nothing on its own. It records what the live window established so the revision
> can be written against it. Verify against main and the companion 07-04(b) handoff delta.

## Predecessor

v1.18 (mints FD-45; narrows FD-44 Leg A to warm ceiling). This window WORKED the cold
settlement paths v1.18 assigned to [3]. Retain v1.18 verbatim; v1.19 advances additively.

## Findings for register adoption

### 1. FD-44 Leg A → PROVEN (was: SUBSTANTIATED, NOT PROVEN)

v1.18 left Leg A at warm ceiling with two cold settlement paths (Scoping-v2 stale-row check;
Candidate-B canon-auth proof-test). This window ran the live probes:

- Candidate B: canon AUTH FAIL. The 06-12 value is NOT canon's live password.
- Candidates A and Stale: canon AUTH FAIL.
- Live `.env` value (`b6694fc0`): canon AUTH **SUCCESS**, identity green (episode_metadata /
  10.0.20.224), off-process.

Leg A resolves: the working canon credential is the on-disk `.env` value, proven by direct
off-process authentication (not merely a running pool). **Leg A: PROVEN.** The FD-42
"in-memory only" premise (already flagged for revision by the 07-02 sitting record finding 1)
is now falsified live. No credential value changed; no canon write; rotation COUNT unchanged.

### 2. FD-45 evidentiary read → COMPLETE; deletion-bar LIFTS; cleanup owed

v1.18 barred dump.pm2 deletion pending a cold evidentiary read. Read done this window (masked,
jq-free). dump.pm2 preserved off-box (fd45-evidence-20260704). Findings: pre-window 3-process
topology captured; working `b6694fc0` at rest by 06-24 (sharpens Leg A timeline and the id-4
window); 12-secret plaintext inventory enumerated. FD-45 disposition advances: evidentiary read
COMPLETE → cleanup NOW PERMITTED. Cleanup must account for `pm2 save` regenerating the surface.
FD-45 remains OPEN until cleanup executes (deferred with the restart).

### 3. FD-44 len correction

dump.pm2 reports `b6694fc0` at len 39; v1.18 carried len 40. Full-hash equivalence is definitive
(same value); len-40 was computed pre-amendment (quote/newline included). Additive correction:
canonical length under the amended value-only method is 39.

### 4. Off-box credential surface (FD-42/43) re-anchored

SSM `/episode-metadata/canon/db_password` re-anchored to the proven value, v5 canonical,
roundtrip-verified. `.env` == SSM v5 == canon live password. The FD-42/43 off-box gap
("no known-good off-box canon credential") is CLOSED by re-anchor, no canon write. (v3 was a
corrupted transit artifact; v4/v5 a guarded double-write; v5 verified.) FD-42/FD-43 disposition
narrows toward closable — but hold OPEN pending the restart-to-align that adopts the aligned
surface into a cycled process.

### 5. New P1 — db_password transcript disclosure

The base64 encoding of the working value was disclosed in the 07-04 session transcript. Base64 is
trivially reversible → treat the value as disclosed. Register as a P1 rotation obligation for a
future gated window (rotate canon + re-anchor .env/SSM; this WOULD increment the rotation COUNT).
Not tonight; canon unreachable from the disclosure context.

## Gate / freeze posture

Advances NO gate to closed. FD-31 §7 re-verify GREEN on all pre-restart conditions, but the
restart-to-align (the gate-closing act) was DEFERRED on topology grounds (id-0 cluster-vs-config;
unaccounted id-4). Freeze posture UNCHANGED: box FROZEN, id-3 held running, deploy-dev push trigger
disabled, re-enablement still gated. FD-31/42/43/44/45 remain OPEN.

## Restart-to-align — deferred scope (next cold window)

The window that closes FD-31 must, in order: (a) identify id-4 (episode-metadata-parallel) before
any pm2 save; (b) reconcile id-0 cluster-mode vs config single-fork (P0 uiOverlayRoutes module-state
risk under cluster); (c) start intended topology BY NAME from live config; (d) FD-38 integrity gate;
(e) pm2 save; (f) re-digest resurrect state + FD-45 cleanup. Track B coordination is inherent (sole
operator). id-3 is NOT restarted for credential reasons — it already runs the correct value.

*Draft notes for v1.19. Mints/closes nothing until Evoni ratifies a formal revision. [skip-automerge]*
