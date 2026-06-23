# F-Deploy-1 — Cold-Entry First-Step Spec (2026-06-22)

**Type:** Cold-entry spec (Deliverable 2). Mints no FD number. Additive — supersedes nothing.
Authorizes nothing, schedules nothing, mutates nothing. The box stays FROZEN; FD-31 and FD-41
remain OPEN. This spec does not prime a `[3]` entry and confers no cold-entry standing.

**Purpose:** Fold a tightly-scoped *known-benign baseline* and a re-sequenced first-step order
into the cold-entry read, so a correctly-behaving cold session is not blind to two already-recorded
non-findings and does not abort on re-discovering them. Source of this content: the §6 structural
finding of the 2026-06-22 abort adjudication. This spec relocates that §6 spec content to its proper
home; the adjudication note itself stays lean.

**Wall discipline (read this first):** This spec is *additive, not a wall-weakening*. The cold/warm
wall stands: a cold session at `[3]` entry reads only runbook Sec 5, opens empty, runs its own
wake-up trio, and re-derives every live fact itself. Nothing below is a conclusion to be trusted in
place of live verification. The baseline states *what you will observe and how to probe it correctly*,
so the cold session still derives the live verdict — it is simply not blind to (a) what `100.50.2.212`
is and (b) how to form an identity probe that does not misfire. If any line below reads as "the answer
is X, trust it," treat that as a defect in this spec, not as license to skip live derivation.

---

## §1 Known-benign baseline (expect-and-verify, not trust-and-skip)

### (a) `100.50.2.212` is canon's normal public-endpoint resolution

A cold psql attempt to the canon endpoint
(`episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`) is expected to resolve TCP to
`100.50.2.212`. **This is canon's known public face, not a misdirected or fork target.** A cold
session that flags it as anomalous is re-discovering a known non-finding.

How to confirm live rather than assume:
- The fork (`episode-control-prod`) resolves to a *different* address and was network-unreachable on
  `:5432` from the box. If your cold resolution returns `100.50.2.212` and the fork contrast still
  holds, you are pointed at canon's endpoint, not the fork.
- Do **not** treat `100.50.2.212` (a public-endpoint resolution) as conflicting with `10.0.20.224`
  (an internal `inet_server_addr` self-report). These are two different measurements from two
  different network positions — a category difference, not a topology conflict.

**Still owed at `[3]`, not closed by this baseline:** formal `100.50.2.212` ↔ `10.0.20.224` closure
(a completed trace proving one instance) remains an open `[3]`-gated item. The baseline establishes
only the narrower, sufficient fact: `100.50.2.212` is canon's endpoint, not a wrong target.

### (b) The SSM-stored credential is documented-stale and is the wrong probe credential

A credential pulled live from SSM `/episode-metadata/canon/db_password` (us-east-1) is expected to
return `FATAL: password authentication failed for user "postgres"` against canon. **This is the
stored/stale value behaving as already evidenced — not a new condition.** It is also the *wrong
credential for an identity probe*: an identity test built on a value that does not authenticate to
canon cannot confirm identity even on success. Probe with the load-bearing candidate (see §2 step 3),
not the SSM value.

### (c) The probe must use the corrected method or it will misfire without producing a verdict

An `inet_server_addr()` probe formed as a connection-string-as-positional form causes `psql` to
ignore `-c` (emitting "extra command-line argument … ignored") so the identity select never runs —
the connection reaches auth but returns no identity verdict. This is a mechanical method defect, not
a canon-state signal. The corrected method (§2 step 2) avoids it.

## §2 Re-sequenced cold-session first actions

A cold session at `[3]` entry runs these in order before any identity conclusion:

1. **Re-confirm the split-brain `DB_HOST` gate live, first.** This is the owed-first gate.
   Box `.env` `DB_HOST` was previously observed pointed at canon, but that is prose — prose carries
   zero evidentiary weight. Re-confirm it live; do not inherit the prior observation.
2. **Use the corrected probe method.** Set `PGSSLMODE=require` as an *environment variable* (not
   inside a connection string); use flag-based `-h / -p / -d / -U`; collapse any read-and-assign to a
   *single line* (the PowerShell multi-line-paste hazard is a separate, co-located pitfall). This is
   the method that does not trip the §1(c) misfire class.
3. **Target the Candidate B proof-test, not the stale SSM value.** The in-memory working value
   hash-matches Candidate B; B's *fresh-connect* canon-auth status is the load-bearing UNRESOLVED
   qualifier that gates align-without-rotate viability. Resolve it with a well-formed,
   captured-to-file proof-test. Do not substitute the SSM/stale value (§1b).

## §3 What this spec does NOT do

- Does NOT weaken the cold/warm wall. Sec 5-only reading and live re-derivation stand.
- Does NOT prime or confer standing for a `[3]` entry.
- Does NOT confirm canon DB-layer identity, move FD-31 §7 to green, or close FD-41.
- Does NOT close the formal `100.50.2.212` ↔ `10.0.20.224` reconcile (still `[3]`-gated).
- Does NOT touch the box or run any probe. Written artifact only.

---

**Provenance (reference, not instruction):** This spec's content was extracted from §6 of the
2026-06-22 abort adjudication (`F-Deploy-1_[3]_AbortAdjudication_2026-06-22.md`). The observation-level
derivation behind the known-benign baseline above lives in
`F-Deploy-1_AbortAdjudication_2026-06-22_ObservationEvidence.md`. This footer is provenance only; it
confers no standing and is not part of the cold-entry procedure.