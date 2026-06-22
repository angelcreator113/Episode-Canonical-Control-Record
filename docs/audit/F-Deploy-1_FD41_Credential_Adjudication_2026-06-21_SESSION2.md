# F-Deploy-1 — FD-41 Credential Adjudication (2026-06-21, Session 2) — EVIDENCE NOTE

**Type:** Evidence note + forward-pointer. Mints no FD number (FD numbers are minted by Fix
Plan revisions, not by standalone notes). Enriches the existing **FD-41** (F-Deploy-1 Fix
Plan v1.14 §3, on main via #837). Authorizes nothing, schedules nothing, mutates nothing.
The box stays FROZEN; FD-31 and FD-41 remain OPEN.

**Forward-pointer:** the next Fix Plan revision should fold this note's adjudication result
and the remediation re-framing (§6 below) into FD-41's body. Until then, this note is the
evidence-of-record for the 2026-06-21 Session 2 candidate adjudication.

**Subsequent to #838.** This note follows the earlier same-day FD-41 evidence note
(`F-Deploy-1_2026-06-21_canon-auth-investigation_evidence.md`, #838) and records a separate
session with an additional, distinct evidence set: the three-value candidate adjudication
against canon (§2) and the `/proc` in-memory presence result (§4). No scope or filename
collision with #838.

**Session character:** Cold session, opened to execute the FD-41 apply-to-canon remediation
per Rotation Session Scoping v2 (`#841`). Cold-entry sequence completed (wake-up trio →
scoped read of Scoping v2 + Runbook Sec 5 → live abort re-verify). The apply was **NOT
executed.** The read-only candidate adjudication that Scoping v2 §4 deferred as
cold-verifiable-only was run first (per session direction, inverting the doc's §2
rotate-first ordering), and its result re-frames the remediation away from rotation.

---

## §1 What this session establishes

**The stored canonical credential and both on-disk recovery candidates all fail canon auth.
The only working credential exists in the running process, where `DB_PASSWORD` is confirmed
present in the process environ (extraction is therefore possible but was NOT performed).**

This confirms FD-41 (stored credential is genuinely stale, not a probe artifact) AND
establishes the harder fact behind it: **the recovery ladder's on-disk rungs are empty.**
There is no captured known-good credential to fall back to.

## §2 The adjudication — three values, all verbatim-evidenced

Live HEAD at session start: `origin/main` = `29ad264a` (PR #841, Scoping v2 at HEAD).
FD-41 register authority confirmed live: Fix Plan v1.14 minting commit `7839e96b` (#837),
evidence note `d89cf50d` (#838), step-4 auth abort note `3e9c9c92` (#839).

**Candidate identification (masked hash verify, value never printed):** all seven captured
`.env*` files in
`C:\Users\12483\Documents\PrimeStudios-Backups\capture-20260621-prereconcile\untracked\`
hash-verified against Scoping v2 §4. All match; no `NO_DB_PASSWORD_LINE`, no same-group
divergence, no length mismatch.

| Group | Files | Value hash (masked) | len |
|---|---|---|---|
| Candidate A (05-11) | `.env.backup-pe39-20260511`, `.env.bak-manual-20260511-1536`, `.env.bak-` | `70469a66…1dc5` | 40 |
| Candidate B (06-12) | `.env.bak-20260612-144450`, `.env.pre_reconcile_20260612_3` | `9f7856a2…438b` | 40 |
| Stale (== SSM v2 / `.env`) | `.env.pre_reconcile_20260612_4`, `.env.pre-dbport-20260620-154546` | `97aac3b0…1fae` | 38 |

> **Masking-width note:** Scoping v2 §4 prints the stale tail as `…41fae` (5 chars); the
> session's `Substring(len-4)` mask prints `…1fae` (4 chars). Same hash — §4 showed one
> extra tail char. Not drift. Resolved from raw output, not assumed.

**Canon auth probes (workstation → canon, read-only, SSL-required, well-formed):**

Method that produces a *valid* verdict (established by debugging three malformed attempts —
see §3): `PGSSLMODE=require`, `PGOPTIONS=-c default_transaction_read_only=on`, value pulled
non-printing from SSM or the candidate file into `PGPASSWORD`, `psql -w` (no-prompt),
identity-only select (`current_database()`, `inet_server_addr()`), env cleared after.

| Value | Source | Canon auth result (verbatim) |
|---|---|---|
| SSM v2 / `.env` (`97aac3b0…1fae`) | stored "canonical" | `FATAL: password authentication failed for user "postgres"` — clean (no encryption/pg_hba line, no ignored-arg warning) |
| Candidate B (`9f7856a2…438b`) | 06-12 capture | `FATAL: password authentication failed for user "postgres"` — clean |
| Candidate A (`70469a66…1dc5`) | 05-11 capture | `FATAL: password authentication failed for user "postgres"` — clean |

**All three fail.** No on-disk credential authenticates to canon.

## §3 Method caveats (so the verdicts are trustworthy, not lucky)

Three malformed probe attempts preceded the valid ones; recorded so the result is not
mistaken for fragile:

1. **Plaintext probe** (no `sslmode`) → RDS rejected at the host-auth/encryption layer
   (`no pg_hba.conf entry … no encryption`). NOT a credential verdict — discarded.
2. **Connection-string-as-positional** (`sslmode=require` in a conn string passed
   positionally) → `psql` ignored `-c` ("extra command-line argument … ignored"); the
   identity select never ran. Connection reached auth and failed clean, but the run was
   malformed — re-run.
3. **Skipped-assignment** (the `PGPASSWORD=` line dropped in a multi-line paste) →
   `fe_sendauth: no password supplied`; the value was never sent. NOT a B-fail — re-run
   with read-and-assign collapsed to one line.

The valid verdicts in §2 are the well-formed runs: SSL satisfied, `-c` executed, value
demonstrably sent (no `no password supplied`). The PowerShell multi-line paste hazard and
the libpq positional-argument trap are the two mechanical pitfalls; both are now controlled
by (a) `PGSSLMODE` env var instead of conn-string, (b) flag-based `-h/-p/-d/-U`, (c)
collapsing read-and-assign to a single statement.

**DB-layer canon identity remains UNconfirmed.** No credential authenticated, so
`current_database()`/`inet_server_addr()` never returned. AWS-layer identity is confirmed
(`episode-control-dev`, master `postgres`, SG `sg-002578912805d1930`, the four no-auth abort
gates green at session start — see §5). DB-layer identity (`episode_metadata` /
`10.0.20.224`) is confirmable only once *some* credential works — i.e. only via the
in-memory value (§4) or a post-remediation probe.

## §4 In-memory credential — present, extractable, NOT extracted

The working credential is the value the prod app loaded ~06-01 and holds in its connection
pool. Read-only checks on the confirmed prod box (`i-02ae7608c531db485`, verified via EC2
instance-metadata — NOT name/prompt trust):

- `pm2 pid episode-api-prod-hotfix` → `1384830` (pm2 pid prints only the numeric pid; not
  an env/secret dump; outside the `pm2 env`/`jlist`/`prettylist` prohibition).
- `grep -c -z 'DB_PASSWORD=' /proc/1384830/environ` → `1` (presence count of the *key*;
  no value printed).

So `DB_PASSWORD` IS in the live process environ → a masked-hash extraction is **possible.**
It was **deliberately not performed this session.** Rationale: the extraction must read a
value, hash it, and print only the hash, from a NUL-delimited `/proc/environ` blob, on a
frozen prod box, in a pipe with zero value-leak tolerance on any edge case. Three workstation
probe misfires this session (§3) demonstrate the ambient mechanical-error rate; the same
error class on a `/proc/environ` value-handling pipe prints the live credential to the
transcript. That asymmetry warrants a dedicated, fresh session with a carefully-designed
pipe — not a tail-of-session improvisation.

## §5 No-auth abort gates (green at session start, verbatim)

| Gate | Result |
|---|---|
| Layer-1 identity | `episode-control-dev` / master `postgres` / port 5432 / `available` / SG `sg-002578912805d1930` — matches Scoping v2 §2.1 (AWS-layer only) |
| Snapshot | `episode-control-dev-prefreeze-insurance-20260530` = `available` (note: `Encrypted: false` — owed hardening, Runbook Sec 7 step 8) |
| Verified dump | `episode-control-dev-verified-20260530.dump` present, **2828246 bytes** (confirmed via bare `.Length`, not inferred from truncated display) |
| Canon SG ingress `:5432` | three CIDRs: `10.0.0.0/16`, `108.216.160.136/32` (workstation egress), `54.163.229.144/32` (prod box). **No `0.0.0.0/0`, no `3.94.166.174/32`** — neither escalation trigger present |

> **CIDR-count note:** ingress shows **3** CIDRs; Runbook Sec 7 step 8 recorded canon
> narrowed to **4** explicit CIDRs on 06-14. Fewer-than-recorded = a tightening, not a
> loosening → not an abort. Flag for reconciliation in the next Fix Plan touch: confirm
> which CIDR was removed and that the removal was intended.

## §6 Remediation re-framing (analysis — input to the next Fix Plan revision, not a decision)

> This section is Claude's analysis of what the §2/§4 evidence implies for remediation. It
> decides nothing and authorizes nothing; the remediation choice belongs to a dedicated,
> fully-informed session and the Fix Plan revision that follows it. The option table below
> is laid out as tradeoffs, not a recommendation.

Scoping v2's chosen remediation — apply-to-canon (`modify-db-instance --master-user-password`
to the stored value, then restart-to-align) — is **no longer the only candidate path**, for
two reasons this session's evidence surfaces:

1. **The apply electively destroys the only working credential.** Canon is currently
   *healthy*; the running app survives on its in-memory credential. `modify-db-instance`
   changes canon's live password the moment it completes — invalidating that in-memory value
   on the app's next reconnect. On this reading, the plan trades a *latent* problem (can't
   restart safely) for an *active* one (deliberately invalidate the working credential, then
   attempt an unproven restart to recover), with no outage forcing it. The principle
   underlying this risk assessment — and the basis for the align-without-rotate lean below —
   is that a healthy-but-unverified state is preferable to a state that is "fixed" on paper
   but carries a live failure path. A reviewer who weights the latent restart-unsafety more
   heavily, or the apply path's risks less, may rank the options differently; that
   re-weighting is exactly what the next session should adjudicate.

2. **A safer alternative now exists: align-without-rotate.** Because `DB_PASSWORD` is present
   in the process environ (§4), the in-memory working value is *extractable* (masked). If
   extracted and written to `.env`/SSM, the restart becomes a true **no-op alignment** — the
   app reloads the same value it already holds — rather than a forced cutover onto a value
   canon doesn't yet accept. This avoids both the elective credential-destruction and the
   "restart onto an unproven new credential" risk.

**Three remediation options for the next (dedicated, fully-informed) session:**

| Option | Mechanism | Risk profile |
|---|---|---|
| **Align-without-rotate** (newly viable) | masked-extract in-memory value → write to `.env`+SSM → restart is a no-op | restart still unproven (FD-36/37), but it aligns to the *already-working* value; no canon master change; no elective credential destruction |
| **Apply-to-canon** (Scoping v2's plan) | `modify-db-instance` to stored value → restart-to-align | elective canon master rotation + invalidates in-memory value + unproven restart onto a not-yet-live value; rotation COUNT increment |
| **Defer** | write this finding, take no remediation now | canon stays healthy; latent restart-unsafety persists; lowest immediate risk |

The align-without-rotate option's viability hinges on the masked extraction (§4), which is
the clean next executable step — in its own session.

## §7 What this session did NOT do

- Did NOT execute the apply-to-canon rotation (`modify-db-instance` undrafted, untouched).
- Did NOT perform the masked in-memory extraction (possible, deferred with reason — §4).
- Did NOT restart, reboot, or edit `.env` on the box.
- Did NOT confirm DB-layer canon identity (no working credential authenticated — §3).
- Touched the prod box with exactly THREE read-only commands (`pm2 pid`, instance-metadata,
  `grep -c -z` presence) — none mutating, none printing a secret. Box returns to
  untouched-frozen.

## §8 Open qualifiers carried forward

- Rotation COUNT (held OPEN at FD-41) is **unchanged** — no rotation occurred this session.
- In-memory credential state: now known **present in process environ** (was "self-reported
  only"); value itself still uncaptured.
- Canon SG CIDR count (3 vs recorded 4) — reconcile next Fix Plan touch (§5).
- DB-layer canon identity — confirmable only post-remediation or via the in-memory value.
