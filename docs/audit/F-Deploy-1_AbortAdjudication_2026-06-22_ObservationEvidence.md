# F-Deploy-1 — Abort Adjudication Observation Evidence (2026-06-22)

**Type:** Evidence companion to the 2026-06-22 abort adjudication. Mints no FD number (FD numbers are
minted by Fix Plan revisions, not by standalone notes). Additive — supersedes nothing. Authorizes
nothing, schedules nothing, mutates nothing. The box stays FROZEN; FD-31 and FD-41 remain OPEN.

**Relationship to the adjudication:** The lean tracked adjudication
(`F-Deploy-1_[3]_AbortAdjudication_2026-06-22.md`, #845) holds the *verdicts* (observation → known-
benign-baseline mapping). This note holds the *derivation* behind those verdicts — the observation-by-
observation working that maps the 2026-06-22 abort note's three at-filing observations to their
adjudicated dispositions. It exists so the reasoning chain is not lost when scratch drafts are retired:
if a later reader asks "how was `100.50.2.212` established as benign?", the answer lives here, not as a
bare verdict elsewhere.

**Session character:** WARM — this note cites and reasons over reconciliation docs, FD-41 findings, and
prior evidence captures, which a cold session is walled from. It does **NOT** prime a `[3]` entry and
confers no cold-entry standing. The next `[3]` session opens empty, runs its own wake-up trio, and
re-derives every live fact independently. Nothing here substitutes for live re-verification.

**Provenance chain (all on main at adjudication time):**
- `F-Deploy-1_[3]_AbortNote_2026-06-22.md` (#844) — the abort being adjudicated; stands verbatim.
- `F-Deploy-1_2026-06-21_canon-auth-investigation_evidence.md` (#838) — 06-21 read-only captures.
- `F-Deploy-1_FD41_Credential_Adjudication_2026-06-21_SESSION2.md` (#842) — three-candidate auth adjudication.
- `F-Deploy-1_FD41_InMemory_HashID_2026-06-22.md` — in-memory == Candidate B; §3 gate-completeness caveat; §4 B proof-test qualifier.
- `F-Deploy-1_[3]_Step0_Topology_Identity_Reconcile_2026-06-15_DRAFT.md` — §6 keeps `inet_server_addr` reconcile open.

---

## §1 Observation 1 — endpoint resolved to `100.50.2.212`, not `10.0.20.224` — NOT a finding

Abort note obs. 1–2: `episode-control-dev` returned endpoint
`episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`; a psql attempt to it resolved TCP
to `100.50.2.212`.

`100.50.2.212` is canon's confirmed public-endpoint resolution, not a misdirected target:

- 06-21 evidence §4 records the identical resolution (`…(100.50.2.212), port 5432`) from both the
  workstation and the box, each reaching the server to a clean auth verdict.
- 06-21 §7 establishes the contrast that rules out wrong-target: the fork (`episode-control-prod`)
  resolves to a different address (`34.237.165.225`) and was network-unreachable on `:5432` from the box.
- 06-21 §8 adjudicates this explicitly: same resolution from two independent vantage points
  "kills H3-as-misdirection."

The cold session flagged `100.50.2.212` as anomalous only because, walled from the 06-21 evidence by
hygiene rule, it had no way to know that address is canon's normal public face. It then compared that
public-endpoint resolution against an internal `inet_server_addr` self-report value (`10.0.20.224`) —
two different measurements taken from two different network positions. That is a category mismatch,
not a topology conflict.

**Precision — what is NOT closed here:** this note does *not* claim a completed network trace proving
`100.50.2.212` and `10.0.20.224` are one instance. Step0 §6 and HashID §6 both record `10.0.20.224`
as suggestive, not formally closed (single FD-40 post-rotation probe). What is established is narrower
and sufficient to dissolve the observation as a finding: `100.50.2.212` is canon's endpoint, not a
wrong/fork target. Formal `100.50.2.212` ↔ `10.0.20.224` closure remains owed and `[3]`-gated.

## §2 Observation 2 — SSM credential failed `postgres` auth — NOT a finding (documented-stale value)

Abort note obs. 2: a credential pulled live from SSM `/episode-metadata/canon/db_password` (us-east-1)
returned `FATAL: password authentication failed for user "postgres"`.

That SSM value is the stored/stale credential (`97aac3b0…1fae`, len 38), and its clean auth failure
against canon was already verbatim-evidenced twice before the 2026-06-22 session:

- SESSION2 §2: SSM v2 / `.env` (`97aac3b0…1fae`) → `FATAL: password authentication failed` — recorded
  as clean (no encryption/pg_hba line, no ignored-arg warning).
- 06-21 §4: the same value (`.env` == SSM v2, byte-identical hash per 06-21 §5) → identical `FATAL`
  from both workstation and box, against this same `100.50.2.212`.

The cold session re-pulled this value and re-hit the documented failure. This is expected behavior, not
a new condition. It is also the wrong credential to have been probing for an identity test: per HashID
§1/§4 the only working credential is the in-memory value, which hash-matches Candidate B
(`9f7856a2…438b`) — not the SSM/stale value. An identity probe built on the stale value cannot confirm
canon identity even on success, because that value does not authenticate to canon.

## §3 Observation 3 — "connection-string parse misfire," probe did not execute — method defect, not a finding

Abort note obs. 3: `inet_server_addr()` never returned because the probe query did not execute after a
connection-string parse misfire.

This matches the SESSION2 §3 pitfall-#2 class: a connection-string-as-positional form in which `psql`
ignored `-c` ("extra command-line argument … ignored") and the identity select never ran. The
connection reached auth, but the probe was malformed and produced no identity verdict.

SESSION2 §3 already established the corrected method that avoids this class: `PGSSLMODE=require` as an
env var (not in a conn string); flag-based `-h/-p/-d/-U`; read-and-assign collapsed to a single line
(the PowerShell multi-line-paste hazard is the other pitfall in the same section). The cold session,
reading only Sec 5, did not have this corrected method in hand.

This is a mechanical defect in probe construction, not a fact about canon. It is the second of the two
stacked non-findings behind the abort.

## §4 What the abort got right

The abort is a clean, correct stop, recorded here as a valid success:

- Box stayed FROZEN throughout — no query executed to a verdict, no canon write, no on-box contact.
- Canon DB-layer identity (`inet_server_addr`) was genuinely not confirmed in the session; the abort
  did not manufacture an identity confirmation it did not have.
- Stopping on an unconfirmed canon identity is exactly what the §7 abort discipline exists to do. The
  gate fired as designed.

The criticism in the adjudication is not of the cold session, which followed hygiene correctly. It is a
structural observation about the cold-entry read — addressed by the companion cold-entry first-step spec.

## §5 What this note did NOT do

- Did NOT run any probe, warm or otherwise — no live canon auth attempt.
- Did NOT touch the box (no command, read-only or otherwise, against prod infra).
- Did NOT confirm canon DB-layer identity (no credential authenticated).
- Did NOT move FD-31 §7 to green, close FD-41, or choose a remediation option.
- Did NOT prime or confer standing for a `[3]` entry.
- Did NOT supersede or rewrite #844 or #845; both stand verbatim.