# F-Deploy-1 - Cold-Entry Memory-Contamination Finding (2026-06-25)

**Type:** Warm-session evidence / process finding. Mints no FD number. Additive - supersedes nothing.
Primes nothing, schedules nothing, mutates nothing. Box stays FROZEN; FD-31 and FD-42 remain OPEN.
This note confers no cold-entry standing and does not advance any gate.

## Purpose

Record a blocker isolated on 2026-06-25: the cold-entry mechanism the [3] procedure assumes
("open a cold session") is not currently achievable with the available memory tooling. The
project-scoped user-memory layer was cleared of [3]-derived conclusions this session, yet fresh
conversations still receive those conclusions in context. The contamination source is therefore
below or beyond the layer the memory-edit tool can reach. This is a nameable precondition for
[3], not a discipline failure - logged here so the next attempt starts from it rather than
rediscovering it.

## What this session was

A warm orientation/triage session. It read the allow-list, the Master Runbook Sec 5, the
First-Step Spec, Fix Plan v1.15, and credential findings - and is, by the binary cold/warm rule,
disqualified from priming [3]. No [3] priming occurred. No box mutation, no credential write, no
live abort re-verify (the chat network cannot reach canon RDS regardless; that read originates
from the workstation).

## The finding (by elimination)

1. The project-scoped user-memory edit layer was cleared of [3]-derived conclusions:
   - Two conclusion-heavy entries replaced with principle-only versions (verify-live discipline
     retained; FD-numbering mechanism and the three-security-class rule retained).
   - One dispensable single-keystone audit-bug entry removed to free a slot.
   - An exclusion directive added: keep [3]-derived conclusions (P4P5/parity results, FD register
     tail, Gate 2.5 status, abort-precondition status, row-count/fingerprint baselines, RDS
     identity values, SG IDs/CIDR states, reconciliation/runbook conclusions) OUT of memory; they
     live in files on main and must be re-derived live by cold sessions.

2. After the edits, fresh windows were probed cold (asked, before any read, what they knew about
   the FD register / Gate 2.5 / P4P5). They STILL surfaced those conclusions as injected context.
   This held across in-project, Incognito, and outside-project windows tried during the day.

3. Therefore: clearing the user-edit memory layer is NECESSARY BUT NOT SUFFICIENT. The conclusions
   arrive from a source the memory-edit tool does not expose - candidates: an account/global
   memory layer, a generated-summary layer not in the user-edit list, or Incognito not severing
   injection in this configuration. Not distinguishable from inside a chat session.

   Caveat held open: memory propagation runs on a background refresh, so an early "still warm"
   probe can reflect a pre-edit snapshot rather than a true failure. A longer-gap re-probe is
   still owed before treating propagation as ruled out (see Next steps).

## Consequence for [3]

The [3] procedure (allow-list + Master Runbook + First-Step Spec) assumes a cold session can be
instantiated on demand. As of this finding that assumption is unverified-to-false under current
tooling: every entry door observed today came up warm. Until a window can be opened that does NOT
receive [3]-derived conclusions in context, [3] cannot be primed - independent of credential
readiness or doc-fold status.

## Carry-in status (for the next session)

- Credential: operator asserts a recoverable, current canon credential is held off-box (value NOT
  recorded here, never pasted to chat). The earlier "no recoverable credential" blocker is, per
  operator, resolved. The remaining blocker is the cold-entry mechanism, not the credential.
- Doc-fold: the First-Step Spec Sec 1 known-benign baseline (canon public-endpoint resolution is
  normal; SSM/.env auth-fail is expected; corrected probe method) is NOT folded into Master
  Runbook Sec 5. With the credential in hand this is nice-to-have, not blocking. Deferred.
- Live FD-31 Sec 7 abort re-verify and DB_HOST confirm: run from workstation, not any chat. Owed
  at the cold window's own start, inheriting nothing.

## Next steps (neither primes [3])

1. Longer-gap propagation re-probe: after a meaningful break from the project (hours, not minutes),
   open ONE fresh window and probe it cold. A clean "holds nothing specific" = propagation was
   lagging and a cold path exists. Still warm after a real gap = propagation is not the cause.
2. Support question (the real lever, not answerable from inside a chat): project-scoped memory
   user-edits are cleared, but new conversations - including Incognito - still receive specific
   derived conclusions in context; where is that injection coming from, and how does one start a
   conversation that does not receive it?

## Discipline note

The aggressive fixed-deadline PM framing carried in the operating prompt is set aside for [3]
work: it does not match a deployed, frozen-prod forensic audit and would inject velocity pressure,
the named hazard. Abort / stop-and-verify is a valid success condition.

---
*Warm-session finding, 2026-06-25. Doc-only, additive, mints no FD, primes nothing, advances no
gate. Freeze stands; FD-31 and FD-42 remain OPEN.*