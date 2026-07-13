# F-Deploy-1 Fix Plan v1.37

**CANON MASTER-CREDENTIAL CUSTODY FAILURE AND RECOVERY 2026-07-12/13: the
maintainer-held master credential for episode-control-dev failed authentication
at post-close verification — master access was unknown-to-maintainer, a direct
consequence of a v1.34 close-set defect minted here as FD-60 (closed at mint:
defect documented, consequence remediated this window). Recovery rotation
executed under fingerprint discipline (SHA256 pre-verified `bbae36716f81`,
39-char candidate, paper custody): fired via modify-db-instance
--apply-immediately, authoritative fire artifact = RDS event "Reset master
credentials" 2026-07-13T00:33:27.143Z. Close set complete with attribution-clean
exhibits: positive probe from paper (postgres | episode_metadata | 10.0.20.224),
negative probe on the prior paper value (FATAL, exit=2), negative probe on the
07-12 burned `c7QW…` candidate (FATAL, exit=2 — the probe v1.34 omitted, now on
the record). Zero blast: both .144 apps healthy with uptime unbroken across the
rotation (FD-59 dissolution held). Custody ruling: single paper copy +
adjacent fingerprint is the method of record; v1.35's "password manager"
language RETIRED as inaccurate. FD-61 MINTED OPEN (P2): StorageEncrypted=false
on canon RDS, remediation = snapshot-restore cutover at its own gated window.
Mints FD-60 (closed), FD-61 (open). Register tail: EMPTY at open, FD-61 at
close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.36 (G2 reconciliation; merged #922, 0e22b55d) |
| **Author date** | 2026-07-13 |
| **Gate effect** | Records the custody failure, the recovery rotation, and its close set. Mints FD-60 (closed at mint) and FD-61 (open, parked). Retires v1.35's custody-medium language. Corroborates security posture incidentally (PubliclyAccessible, StorageEncrypted, engine 17.9). Advances no G2 gate; the one write fired this window (modify-db-instance) ran under its own in-channel confirm cycle. |

**Basis (live reads 2026-07-12/13, this session):**
- `git log --oneline origin/main` → 8d0f2032 (#924 frontend) over 84159a8e
  (#923, P4 code PR) over 0e22b55d (v1.36, #922). Fix Plan predecessor is
  v1.36; the two intervening merges are non-audit. `gh pr list` → none.
- **FD ceiling derived by cross-revision scan (v1.34–v1.36) → FD-59 highest.
  Standing method note: a newest-revision-only scan understates — it returned
  FD-58, because FD-59 (minted v1.34, born closed) is never restated in
  v1.35/v1.36. Counter authority is the minting revision, not the newest
  (FD-53 species applied to the counter itself).**
- `aws rds describe-events` (3h window, at discovery) → EMPTY — falsifying a
  premature "rotation fired" claim (§2). Post-fire (30m window) → "Reset
  master credentials" 2026-07-13T00:33:27.143Z.
- `aws rds modify-db-instance` return blob →
  `PendingModifiedValues: {"MasterUserPassword": "****"}`; status transit
  observed `resetting-master-credentials` → (rds wait) → `available`,
  Pending `{}`.
- psql probes (workstation, sslmode=require, pgpass bypassed PGPASSFILE=NUL,
  server address 100.50.2.212 public path): exhibits itemized §4.
- SHA256 fingerprint of the candidate verified `bbae36716f81` in-channel
  pre-fire; capture length echo 39 chars, value never displayed.
- .144 reads (07-12 pre-fire): pm2 both apps online ↺0; `pm2 env 12`,
  `pm2 env 13`, and `.env` all DB_USER=episode_app_dev. (07-13 post-fire):
  /health :3002 + :3000 both healthy, database connected, uptime ≈33.1h —
  continuous across the rotation.

## §1 Custody failure (discovery)

At post-close verification of the FD-45 window (a verification pass, two
sessions after v1.34/v1.35 merged), the maintainer-held master credential for
canon RDS (episode-control-dev) failed authentication: interactive psql as
`postgres`, pgpass bypassed, paper-held value entered twice → FATAL: password
authentication failed. RDS `available`, PendingModifiedValues empty — not a
settling rotation. Master access was unknown-to-maintainer at discovery.

App blast: zero. All app-facing surfaces authenticate as `episode_app_dev`
(FD-56 dissolution per FD-59), verified live at discovery via pm2 env 12/13
(running-process env) and .env on disk — the next restart was also safe.

Two candidate branches at discovery — paper mis-transcription vs.
redo-never-fired leaving live master on the burned `c7QW…` value — were
deliberately not distinguished pre-recovery; the recovery rotation kills both,
and the §4 negative probes retire both by exhibit.

## §2 FD-60 (minted, closed at mint): v1.34 close-set defect

v1.34 §S1 records two burn events; the session-4/5 record holds three plus a
false-close. Absent from merged v1.34: the 07-12 Read-Host-label burn
(`c7QW…`) and the master-landed-on-burned-value event. v1.34's step-8 close
set negative-probed only the pgpass value — not `c7QW` — violating the rule
minted in that same session: negative-probe every value with known disclosure,
not merely the superseded one. The §1 custody failure is the direct
consequence.

Also recorded under FD-60, same species, three instances this window:
1. A "rotation fired" claim was made in-channel before any fire occurred; the
   empty describe-events read falsified it before it could contaminate the
   register. A claim is not a close; the artifact is the close (FD-51
   lineage).
2. The FD-counter near-miss (Basis): newest-revision-only ceiling scan would
   have minted a colliding FD-59.
3. Attribution defect on the first `c7QW` probe attempt (§4): masked prompts
   cannot self-attribute. A FATAL exhibit is worthless if the input that
   produced it cannot be established; exhibits produced under conflicting
   session records are superseded by a fresh attributable run, not
   reconciled.

FD-60 status: CLOSED at this revision — defect documented, consequence
remediated by §3–§4, rules already canon (reinforced, not newly minted).

## §3 Recovery rotation (artifact chain)

1. Candidate generated blind at a prior sitting (39-char, charset excluding
   quote/backslash), SHA256 fingerprint `bbae36716f81` computed
   pre-disclosure, transcribed to paper with fingerprint adjacent —
   **maintainer attestation** (generation predates this session's transcript).
2. At recovery execution, `$pw` was NULL in the reachable session
   (GetBytes ArgumentNullException — in-channel). Re-established from paper
   via masked Read-Host run verbatim (label-only quoted string, per the 07-12
   burn guard): capture echo 39 chars, value never displayed. Fingerprint
   re-verified in-channel pre-fire: `bbae36716f81` exact. **The paper copy
   survived a full round-trip validation under fire — evidence for §5.**
3. Fired: `aws rds modify-db-instance --db-instance-identifier
   episode-control-dev --master-user-password $pw --apply-immediately`. The
   command line carried the literal string `$pw`, not the value. Return blob
   in-channel: Pending MasterUserPassword populated.
4. Status transit observed live: `resetting-master-credentials` →
   `available` + Pending `{}` (rds wait, then read).
5. RDS instance event "Reset master credentials" 2026-07-13T00:33:27.143Z —
   the authoritative fire artifact, the exhibit class whose absence falsified
   the premature claim in §2.

## §4 Close set (three probes + zero-blast + teardown)

- **POSITIVE (paper):** psql as `postgres`, value typed from paper at masked
  prompt → connected TLSv1.3, server 17.9;
  `SELECT current_user, current_database(), inet_server_addr()` =
  `postgres | episode_metadata | 10.0.20.224` — RDS identity confirmed per
  standing discipline; transcription validated against fingerprint by the
  connection itself.
- **NEGATIVE 1 (prior paper value):** FATAL password authentication failed,
  exit=2.
- **NEGATIVE 2 (`c7QW…`, the 07-12 burn):** FATAL password authentication
  failed, exit=2 — attribution-clean run 2026-07-13. Earlier probe attempts
  in this window are unattributable (masked input; conflicting session
  records — one attempt authenticated, established as an input-slip where the
  new value was typed in place of `c7QW`: a redundant positive, no burn, F-f
  species) and are superseded by this exhibit. Both disclosed values now
  certified dead by their own copies.
- **ZERO-BLAST:** /health on :3002 (dev) and :3000 (prod-hotfix) both
  healthy post-rotation, database connected, uptime ≈33.1h at read —
  continuous across the 00:33Z fire. FD-59's dissolution claim held under
  live test.
- **TEARDOWN (executed at close of window, in-channel):** disclosure surfaces
  this window were `$pw`/`$sec` in one session's memory and the paper copy —
  the command line and Last-Command metadata carried only the literal `$pw`.
  `Remove-Variable pw, sec` executed and verified null; PGPASSFILE override
  removed; Clear-History run as optional hygiene. Paper copy retained per §5.

## §5 Custody ruling

Master-credential custody method of record: **single paper copy, SHA256
fingerprint (first 12 hex) written adjacent, fingerprint recorded in the
register** (`bbae36716f81` for the credential installed this window). v1.35's
"maintainer's password manager" language is RETIRED as inaccurate — no
manager exists; the discrepancy between v1.35 and the session-4 record
resolves in favor of the session record (paper). The single-point-of-failure
acceptance recorded at v1.35 stands unchanged; only the medium is corrected.
Any future rotation validates transcription by positive-probe-from-paper
before close, and its close set negative-probes every value with known
disclosure (FD-60).

## §6 Security-posture corroboration + FD-61 (minted, open)

Captured incidentally this window, canon RDS (episode-control-dev):
- `PubliclyAccessible: true` — corroborated twice (modify return blob; failed
  probes reached the instance from the workstation via public path
  100.50.2.212 while in-session `inet_server_addr()` reads 10.0.20.224).
  Feeds the standing SG-exposure deferral (v1.34 §S4.3, 10.0.0.0/16 ingress);
  no new FD, register updated by reference.
- `StorageEncrypted: false` — **FD-61 MINTED, OPEN, P2.** Remediation
  requires snapshot-restore (new encrypted instance + endpoint cutover) — a
  deliberate gated window, not in the current live frontier. Parked behind
  Phase B G2 work.
- Engine baseline: PostgreSQL 17.9 confirmed (modify blob + psql server
  banner). Recorded as current baseline.

## §7 Register hygiene

Tail at open: EMPTY (since v1.35). Minted: FD-60 (closed at mint), FD-61
(OPEN). Closed: FD-60. **Tail at close: FD-61 only.** FD-45 remains CLOSED IN
FULL (dev leg v1.34, canon leg v1.35) — this revision reopens nothing; the
custody failure was a defect in v1.34's exhibits, not in the rotation's
effect, and the recovery re-established known-custody without disturbing any
closed finding. FD numbers minted only by Fix Plan revisions — conforms;
ceiling verified by cross-revision scan (Basis). Live frontier unchanged:
Phase B G2 per v1.36 §5 two-track framing. Carried obligations per v1.35 §S4
unchanged. One write fired this window (modify-db-instance, own confirm
cycle); all other actions read-only or local. FD-21 check on commit message
(no closing keyword adjacent to #N). Ships [skip-automerge] in title, body
via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.37.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-13. Predecessor: v1.36 (0e22b55d, #922).*
*Minted: FD-60 (closed), FD-61 (open). Tail: FD-61.*
