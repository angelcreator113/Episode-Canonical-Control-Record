# F-Deploy-1 — FD-41 In-Memory Credential Hash-Identification (2026-06-22) — EVIDENCE NOTE

**Type:** Evidence note + open-qualifier record. Mints no FD number (FD numbers are minted by
Fix Plan revisions, not by standalone notes). Enriches the existing **FD-41** (F-Deploy-1 Fix
Plan v1.14 §3, on main via #837) and follows the SESSION2 adjudication note (#842). Authorizes
nothing, schedules nothing, mutates nothing. The box stays FROZEN; FD-31 and FD-41 remain OPEN.

**Forward-pointer:** the next Fix Plan revision should fold this note's hash-identification and
the open qualifier (§4 below) into FD-41's body. Until then, this note is the evidence-of-record
for the 2026-06-22 in-memory hash identification and the Candidate B auth-status qualifier.

**Subsequent to #842.** This note follows the same-line-of-work SESSION2 evidence note
(`F-Deploy-1_FD41_Credential_Adjudication_2026-06-21_SESSION2.md`, #842). It adds one distinct
result SESSION2 did not produce — a masked hash of the in-memory `DB_PASSWORD` value — and records
the qualifier that result raises against SESSION2 §2/§6. It does not supersede or rewrite #842;
#842's body stands verbatim. This note is additive.

**Session character:** Session opened to design the masked in-memory credential extraction
(per SESSION2 §4/§6, which deferred it as the clean next executable step). Scope was extraction
*design*, not rotation and not apply-to-canon — both of which remain unauthorized. The design work
produced a masked hash of the in-memory value as its key result; that hash, compared to the
on-disk candidate hashes in Scoping v2 §4 / SESSION2 §2, surfaces a load-bearing qualifier. The
masked extraction pipe was exercised only to the extent of producing a hash; no value was printed.
Live HEAD at session start: `origin/main` = `96925c04` (#842, SESSION2 note at HEAD).

---

## §1 What this session establishes

**The in-memory `DB_PASSWORD` value the running prod app holds hash-matches Candidate B
(`9f7856a2…438b`, len 40) — the 06-12 on-disk value. SESSION2 never hashed the in-memory value;
it established only presence. This is new evidence.**

Because SESSION2 §2 records Candidate B as failing canon auth, the in-memory value's identity as
B makes B's canon-auth status **load-bearing** in a way it was not when SESSION2 treated B as one
inert recovery candidate among three. This is the qualifier recorded in §4. It is NOT a proof that
B authenticates to canon, and it is NOT, on its own, a refutation of SESSION2 §2 (see §4 for why
both can hold simultaneously).

## §2 The hash identification — masked, value never printed

Read-only, on the confirmed prod box (`ubuntu@ip-172-31-26-1`, prod box `54.163.229.144`),
masked-hash method (value read into a shell var, hashed, only the hash and byte-length printed,
var unset immediately):

- `pm2 pid episode-api-prod-hotfix` → `1384830` (numeric pid only; not an env/secret dump;
  outside the `pm2 env`/`jlist`/`prettylist` prohibition, which remains in force).
- In-memory fingerprint (NUL-delimited `/proc/$pid/environ`, single `DB_PASSWORD` line, value
  hashed not printed):
  ```
  inmem_sha=9f7856a2ddc43eb242dc8cdc64ff425683659acbc7297d8e88f50829ca35438b len=40
  ```

Comparison to the candidate table (Scoping v2 §4 / SESSION2 §2):

| Group | Value hash (masked) | len | in-memory match? |
|---|---|---|---|
| Candidate A (05-11) | `70469a66…1dc5` | 40 | no |
| **Candidate B (06-12)** | **`9f7856a2…438b`** | **40** | **YES — in-memory == B** |
| Stale (== SSM v2 / `.env`) | `97aac3b0…1fae` | 38 | no |

The in-memory value is **not** the stored/stale value (`97aac3b0…`), confirming the running app
is not on the broken stored credential. It is byte-identical-by-hash to the 06-12 capture.

`pm2 env` / `pm2 jlist` / `pm2 prettylist` remained PROHIBITED and were not used. (Note for the
record: bare `pm2 env` was attempted earlier with no `id` argument and errored harmlessly; it
printed nothing. The prohibition stands regardless.)

## §3 Live §7 abort re-verify — all four no-auth gates green (verbatim)

Re-run live this session, untrusted from SESSION2 §5:

| Gate | Result (live 2026-06-22) |
|---|---|
| Layer-1 identity | `episode-control-dev` / master `postgres` / port 5432 / `available` / SG `sg-002578912805d1930` — matches SESSION2 §5 (AWS-layer only) |
| Snapshot | `episode-control-dev-prefreeze-insurance-20260530` = `available` (`Encrypted: false` — owed hardening, Runbook Sec 7 step 8; not an abort) |
| Verified dump | `episode-control-dev-verified-20260530.dump` present, **2828246 bytes** (bare `.Length`) — exact match to SESSION2 §5 |
| Canon SG ingress `:5432` | three CIDRs: `10.0.0.0/16`, `108.216.160.136/32`, `54.163.229.144/32`. **No `0.0.0.0/0`, no `3.94.166.174/32`** — neither escalation trigger present. Matches SESSION2 §5 |

> **Gate-list completeness caveat (runbook §8 pulled and compared this session):** these four are
> the **AWS-/backup-layer no-auth gates** (SESSION2 §5 / Scoping v2 §3). The Runbook's consolidated
> abort set (§8) is structurally larger and includes gates NOT re-verified this session:
> - **Phase 0 — split-brain check:** box `.env` `DB_HOST` ≠ canon. *Directly relevant to this note's
>   subject:* this note fingerprints the in-memory `DB_PASSWORD`, but does not confirm the box `.env`
>   `DB_HOST` is pointed at canon vs. fork. If `DB_HOST` were unexpected, the fingerprinted credential
>   would be for an unverified host. Not checked this session — flagged as the first gate the [3]
>   session should close, ahead of the Candidate B proof-test.
> - **Phase 1 gates:** live content counts vs catalog; verified-dump content counts; schema/table
>   inventory. Not re-verified.
> - **Phase 2A gates:** parity mismatch, disk headroom, env-completeness
>   (`DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_PORT`), memory pressure, parallel-process
>   integrity. Not re-verified.
> - **Post-restart gates:** AG gate (identity, counts, fingerprint), `/health` 200 +
>   `database:connected`; Gate 2.5 state at restart time. Not applicable warm (no restart this
>   session) — listed for completeness.
>
> The four AWS-/backup-layer gates above are GREEN. The non-infrastructure gates (split-brain,
> content counts, env-completeness) were NOT re-verified and are owed at [3] session start. This is
> a known, named gap — not an assumption that four is the full set.

> **CIDR-count note (carried from SESSION2 §5):** ingress shows 3 CIDRs; Runbook Sec 7 step 8
> recorded canon narrowed to 4 on 06-14. Fewer-than-recorded = tightening, not loosening → not an
> abort. Still owed reconciliation in the next Fix Plan touch.

No gate tripped. Session did not stop on §7 grounds.

## §4 Open qualifier — Candidate B canon-auth status is unresolved and load-bearing

**The qualifier:**

> The in-memory `DB_PASSWORD` value hash-matches Candidate B (`9f7856a2…438b`). SESSION2 §2 records
> Candidate B as a clean canon auth failure. The in-memory value's identity as B therefore makes
> B's canon-auth status load-bearing for §6 align-without-rotate viability. **Candidate B's canon
> authentication status is UNRESOLVED.** It must be resolved inside [3] with a well-formed,
> captured-to-file Candidate B proof-test. This does NOT block entering [3]; it enters [3] as the
> first verification step.

**Why this is a tension, not a proven contradiction (precision — do not over-read):**

Both of the following can be true at once, so the in-memory hash match does NOT by itself refute
SESSION2 §2:

1. The running app holds a connection pool established at app start (~06-01 per SESSION2 §4). A
   value held in that pool keeps the app's *existing* connections alive regardless of whether the
   same value would succeed on a *fresh* connect today.
2. If canon's master password was changed after the pool was established (which is the FD-41
   premise — a stored credential change written but its application history unclear), then the
   in-memory value can be both (a) what the live app runs on and (b) rejected by canon on a fresh
   auth attempt.

So "in-memory == B" and "B fails canon auth (SESSION2 §2)" are not logically exclusive. What the
hash match changes is the *weight* on B: it is no longer one dead recovery candidate but the
identity of the value the app is actually running on. That is why its canon-auth status must be
re-tested cleanly — not because we know SESSION2 was wrong.

**Why SESSION2 §2's verdict is itself weak evidence (independent of the tension):**

SESSION2's canon auth verdicts (§2 table: all three candidates fail) were transient workstation
probe output with `PGPASSWORD` cleared after. Searched this session: SESSION2 committed exactly one
file (`#842`, the note itself); no probe log, no redirected auth output exists on main or in the
local capture dir (`*probe*` / `*auth*` searches empty). **SESSION2's §2 verdicts are therefore
uncaptured-prose summaries with no surviving terminal-output backing** — weak by the project's own
evidence standard (live terminal output only; prose carries zero evidentiary weight). This is an
independent reason the B verdict must be re-derived with captured proof in [3], regardless of the
hash-match tension.

## §5 Disposition — deferred to [3], not resolved warm

The contradiction-test (a live, well-formed Candidate B canon auth probe) was **deliberately NOT
run this session.** Rationale, in order:

1. **§4 boundary.** Scoping v2 §4 scopes live canon auth to the gated [3] window
   ("not warm-testable… a cold-[3] action"). A read-only probe is non-mutating, but the doc's
   boundary is real and this session is not [3]. Strict reading governs.
2. **Session scope.** This session's scope was extraction *design*; it produced its key result (the
   hash ID). Running live canon probes is the next session's work.
3. **Defect non-reproduction.** SESSION2's weakness was uncaptured probe output. A warm probe run
   now risks reproducing that defect. Deferring to [3] yields one well-formed, captured proof inside
   the window built to contain canon actions — strictly safer than scattering warm probes.
4. **Right context.** Resolving the qualifier inside [3] is not deferring the problem; it is
   resolving it in the place built to act on the result coherently.

## §6 Implication for the §6 remediation options (analysis — input to next Fix Plan, not a decision)

This note does not re-decide remediation. It records one effect on SESSION2 §6's option table:

- **Align-without-rotate** (SESSION2 §6 option 1) is premised on the in-memory value being "the
  already-working value," such that extracting it and restarting is a no-op alignment. The hash ID
  + the open qualifier mean that premise is **unverified**: if Candidate B (== in-memory) fails
  canon auth on a fresh connect, then writing the extracted value to `.env`/SSM and restarting
  would align the app onto a value canon rejects — i.e. a break, not a no-op. Align-without-rotate's
  viability is therefore **gated on the [3] Candidate B proof-test**, not established.
- **Apply-to-canon** and **Defer** (SESSION2 §6 options 2, 3) are unaffected by this note.

The option choice remains the next dedicated, fully-informed session's work and the Fix Plan
revision that follows it. This note moves no option from candidate to chosen.

## §7 What this session did NOT do

- Did NOT execute the masked in-memory extraction-to-`.env`/SSM (only a hash was produced; no value
  written anywhere).
- Did NOT run a live canon auth probe (deferred to [3] — §5).
- Did NOT execute apply-to-canon (`modify-db-instance` undrafted, untouched).
- Did NOT restart, reboot, or edit `.env` on the box.
- Did NOT confirm DB-layer canon identity (no credential authenticated this session).
- Did NOT use `pm2 env` / `pm2 jlist` / `pm2 prettylist`.
- Touched the prod box with read-only commands only (`pm2 pid`, masked `/proc/environ` hash) — none
  mutating, none printing a secret. Box returns to untouched-frozen.

## §8 Open qualifiers carried forward

- **Candidate B canon-auth status — UNRESOLVED, load-bearing (§4).** Resolve first in [3] with a
  well-formed captured proof-test. Gates align-without-rotate viability.
- In-memory credential: now hash-identified as Candidate B (`9f7856a2…438b`); was "present in
  process environ, value uncaptured" at SESSION2.
- Rotation COUNT (held OPEN at FD-41): **unchanged** — no rotation this session.
- Canon SG CIDR count (3 vs recorded 4): reconcile next Fix Plan touch (carried from SESSION2 §5).
- Runbook §8 abort gates beyond the four AWS-/backup-layer ones: NOT re-verified this session
  (split-brain box `.env` `DB_HOST`, content counts, env-completeness). The **split-brain check is
  owed first at [3] start**, ahead of the Candidate B proof-test — it bears directly on whether the
  fingerprinted in-memory credential is even for the canon host (§3 caveat).
- DB-layer canon identity: confirmable only post-remediation or via a working credential in [3].
