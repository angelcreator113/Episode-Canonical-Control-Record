# F-Deploy-1 — id-3 Standup Scoping: Gate-2.5 Readiness Restoration (DRAFT, 2026-07-01)

**Type:** Scoping/planning note. Additive on `F-Deploy-1_PMState_AllStopped_CauseInvestigation_2026-06-30.md`
(warm cause-investigation) and `F-Deploy-1_AllStopped_CauseClosed_WorkflowCascade_2026-07-01.md`
(cause closed), and downstream of `F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` (gate 2.5)
and the FD-42 credential-state finding. Doc-only, no box mutation, no `pm2` action, no `.env`
edit. **Mints no FD.** Supersedes nothing. Box stays FROZEN; FD-31 and FD-42 remain OPEN.

This note specifies *what a sanctioned id-3 standup is* so that when the sitting happens it is
**ratification of a written plan with exposure-safe capture discipline pre-scripted**, not
improvisation at the PM2 daemon. Writing the standup discipline once also serves as the positive
definition the id-4 off-record standup gap lacks (Sec 9).

---

## Sec 1 — Objective

**Primary:** restore **gate 2.5 readability** — a running id 3 (`episode-api-prod-hotfix`,
prod/3000) whose pool is authenticated against canon, re-establishing the `pm2 env 3` (3a)
read with the semantic guarantee that a *running* process provides (06-30 Sec 5: a stopped
process's env cannot be trusted as the working credential; only a running, authenticating pool
proves it). Gate 2.5's 3a==3b confirm (#750) is un-makeable until this holds.

**Secondary (the recovery payoff, Sec 5):** on pool-auth success, **mint the trustworthy
off-box reference digest of the working canon credential** — the first such reference to exist
since FD-42 opened. This is what un-runs §7's credential row for the [3] session *independently*
of id-3 staying up. Without it the standup re-greens 2.5 but leaves [3] dependent on id-3
remaining online with no reference; with it, the standup **closes the FD-42 off-box gap** rather
than merely routing around it. This is the line between "id-3 is running again" and "the
credential recovery succeeded."

---

## Sec 2 — Ownership & scope (D resolved: option 1)

**FD-31 / gate-2.5-owned. Minimal. Read-purposed. Track-B-coordinated-and-informed.**

id 3 is `episode-api-prod-hotfix` (PROD/3000), and 06-30 Sec 5 flags an id-3 start as "adjacent
to the single irreversible cutover action." That places it near Track B's domain (Track B owns
the prod restart / port flip / topology formalization per FD-31 Sec 6.3 steps 5-6 handoff and
`Track_B_PM2_Topology_Formalization_Plan.md`). The ownership seam is resolved by **purpose-scope
discipline**, not by absorption:

- This sitting exists to restore gate-2.5 readability and mint the reference digest — **full
  stop.** Its failure domain is credentials, not topology.
- Folding it into Track B's combined window would **couple an unrelated failure domain to the
  [3] critical path**: a port/topology problem mid-window would leave gate 2.5 blocked for
  reasons that have nothing to do with credentials. Small single-purpose gated sittings is the
  pattern that has been working.
- The seam is closed by **naming it**, not dissolving it — which is the id-4 lesson applied.

**Track B coordination line (pre-drafted):**
> Track B is named and informed **before** this sitting. The port flip (3002→3000), `pm2 save`/
> `dump.pm2` topology correction, and any parallel/dev-process work are **explicitly out of
> scope** here and remain Track B's to run in its own window. This sitting starts **id 3 only**,
> for credential readability, and does **not** formalize topology, does **not** run `pm2 save`,
> and does **not** touch ids 0/1/4.

---

## Sec 3 — The pre-standup read (diagnostic; exposure-safe; bounded)

A read-only digest comparison, run **before** the mutation, to bound hypotheses about what id-3's
stored launch env holds. It is a planning input, **not** a gate and **not** confirmatory.

### 3.1 — Exposure discipline (mandatory — this is `pm2 jlist`-class)

`pm2 env 3` / `dump.pm2` print the process environment, **credentials included**, into the
session transcript. This is the exact mechanism of the 06-30 self-inflicted exposure, scoped to
one process. "Read-only against the box" is **not** "safe for the transcript." Every read below
obeys:

- **Straight to the hash, one pass, no intermediate.** Extract the credential line and pipe it
  **directly** into `sha256sum`. No `grep`-then-print, no temp variable that could echo. The value
  never lands in a frame, not even for a keystroke. Only the **digest** crosses into the record.
- **Canonicalization pinned to the reference.** A raw SHA256 is whitespace/newline/quote/prefix
  sensitive. The exact canonicalization (line format, trailing newline, `KEY=` prefix in or out,
  quotes stripped or not) MUST match whatever the comparison reference used, or a spurious
  mismatch reads as a real one. Pin it on both sides in the script before the sitting.
- **Empty-match guard — fail loud.** If the line is not found, `sha256sum` of empty input still
  emits a valid-looking digest (`e3b0c442...`). The script MUST detect no-match and **error**,
  never hash nothing and emit a hash that masquerades as a result. (This silent-failure class is
  exactly what bites in transcripts.)

### 3.2 — The read and its two surfaces

- **Surface 1 — daemon-held launch env:** `pm2 env 3`, digested per 3.1. Whether a *stopped*
  process still returns its launch env depends on the daemon holding the definition (it does —
  that is the whole stop-not-death signature, 06-30 Sec 1). If it returns empty/stale, pivot to:
- **Surface 2 — `~/.pm2/dump.pm2`:** if any `pm2 save` ran, launch-time env is on disk here
  regardless of process state. Same one-pass digest discipline. **`dump.pm2` is also an
  exposure/cleanup surface the standup must inventory** (a plaintext credential at rest on the box).

### 3.3 — The ceiling (state this hard — do not let a reader over-run it)

FD-42's premise is that the working canon value exists **nowhere off-box**. #879 confirms it from
the record side: the 2026-06-30 rotation digested each rotated credential — **Batch A's seven
provider keys plus Batch B's `JWT_SECRET` / `LALAVERSE_EMAIL_PASSWORD`, nine total** — and the
canon `DB_PASSWORD` was **explicitly excluded** as the gated [3] keystone (rotation-order record:
"Excluded — do NOT rotate here"; "`DB_PASSWORD` untouched (gated)"). So **no off-box digest of the
working canon credential exists anywhere.** The only comparable is the FD-42-**stale** `.env`/SSM-v2 value.
Therefore this read can only answer *"does id-3's launch env == the stale off-box value?"*:

| Result | Reading | Verdict |
|---|---|---|
| **match** | id-3 launched with the stale value; the live pool may have rotated past it post-launch (the exact semantic-guarantee hole), or FD-42's premise is soft | ambiguous, leans bad |
| **mismatch** | id-3 launched with something newer than off-box — **possibly** the working value, but there is no digest of the true value to confirm it against | inconclusive-positive |

**The read is diagnostic, not confirmatory. It cannot positively identify the working credential
— only rule the stale value in or out.** Nobody reads a mismatch as "we found the good cred."
Confirmation requires a running pool (Sec 5), full stop.

---

## Sec 4 — The mutation (single Rule-7 gated action)

**`pm2 start 3` — and nothing else.** This is the one box-touching line; it is a hard Rule-7
boundary even though developer-initiated (per the standing prod-restart rule).

- **NOT `--update-env`.** This is load-bearing, not hygiene. Plain `pm2 start 3` **reuses the
  daemon's stored launch env** — i.e. the potentially-working in-memory value comes back up with
  the pool. `--update-env` would re-read the on-disk `.env` and **inject the FD-42-stale value,
  destroying the very thing the standup exists to recover.** `--update-env` is prohibited in this
  window.
- **id 3 only.** Do NOT touch ids 0/1/4. No `pm2 save`, no `pm2 resurrect`, no port flip (Track B).
- **Two-outcome test, not an assumed success.** Starting id 3 is a *test*: the pool either
  authenticates against canon or it does not. The failure branch is real and is **non-destructive**
  (a pool that can't connect leaves canon data untouched). Both branches are handled in Sec 5.

Pre-mutation, re-confirm the Sec 6 preconditions live (deploy-dev binary check empty; no open
`claude/**` PRs; daemon signature unchanged).

---

## Sec 5 — Post-start verification & the success-digest mint

Immediately after `pm2 start 3`, run read-only:

1. **Process online** — `pm2 list` shows id 3 `online`, restart counter behaviour noted (a clean
   start should not crash-loop; a climbing restart count = failing boot → treat as failure branch).
2. **Pool-auth against canon** — confirm the process's DB pool actually authenticated against
   `episode-control-dev` (canon). This — not liveness — is what **genuinely re-greens gate 2.5**.
3. **Liveness caveat (FD-38):** `/health` is **liveness-only**; its soft-delete-filtered counts
   are NOT the integrity comparator. Any integrity read uses the runbook's FD-38 method (unfiltered
   `count(*)` + `db`/`server` identity asserts via read-only psql), not `/health`.

### 5.1 — SUCCESS branch → mint the reference digest (the deliverable)

The moment the pool authenticates against canon, the daemon's launch-env value is **proven
working** — the first confirmable trustworthy canon credential since FD-42 opened. Capture it
**then**, as the named deliverable of this sitting:

- Digest the **running** id-3 credential (the same `pm2 env 3` 3a read gate 2.5 uses, now proven),
  under the identical Sec 3.1 discipline: one-pass extract → `sha256sum`, no intermediate,
  canonicalization pinned for future comparisons, **value never printed**, empty-match guard.
- Record **only the digest** in the sitting's record. That digest becomes the **off-box reference
  FD-42 says does not exist** — the reference the [3] session compares against to un-run §7's
  credential row **independently of id-3 staying up**.
- **Corroboration (free, if available):** if the Sec 3 stopped-state digest == this proven-running
  digest, it shows the daemon held the working value intact across the stop. Note it; do not depend
  on it.

Without this step the standup re-greens 2.5 but leaves [3] dependent on id-3 remaining online with
no independent reference. With it, FD-42's off-box gap is **closed.**

### 5.2 — FAILURE branch (pool does not authenticate)

Non-destructive by construction (canon untouched). This means id-3's stored launch env is NOT a
working canon credential — a real finding, not a fixable-forward error. Do **not** `--update-env`
to "try the .env value" (it's the stale one). Roll back per Sec 6 and record the outcome; the
credential-recovery path then escalates separately (out of scope for this sitting).

---

## Sec 6 — Preconditions, abort/rollback, and the freeze-posture amendment

### 6.1 — Preconditions (all must hold at sitting start; git/box-verifiable)

- **Deploy-dev SSH path structurally disabled** — `git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"` returns **empty** (AllStopped Sec 6; landed #881). Protects the box from a cascade mid-sitting.
- **No open `claude/**` PRs** — no pending auto-merge → no deploy-dev cascade queued.
- **Daemon-signature unchanged (A)** — re-read `pm2 list`; confirm it still matches the 06-30
  signature: all four entries **present-but-stopped**, **id-3 at 0 restarts**. If id-3's restart
  counter moved, something started/cycled it off-record → the launch-env read premise is dead →
  **STOP, that is its own finding**, not a proceed.
- **Exposure surfaces inventoried** — `pm2 env`/`jlist` and `~/.pm2/dump.pm2` accounted for
  (Sec 3.2); digest-capture method **scripted and canonicalization-pinned before** the sitting,
  not improvised at the daemon.

### 6.2 — Abort / rollback

- **Anomaly / failure branch → `pm2 stop 3`** restores the known-frozen state (all four stopped).
  Abort criteria: pool fails to authenticate; restart counter climbs (failing boot); any identity
  or fingerprint deviation on a read; any uncertainty about target instance.
- **Rollback is NOT automatic on success.** `pm2 stop 3` is the *anomaly* path. Stopping a
  *successful* id-3 just re-enters the blocked state by hand (gate 2.5's 3a needs a running id 3
  for [3] anyway). So a successful start is a **decision point**, not an auto-revert — see 6.3.

### 6.3 — Freeze-posture amendment (pre-drafted, per E)

On success the real decision is not stop-vs-hold; it is **authorizing an amendment to the freeze
posture.** The default leans strongly toward **hold id-3 running** as the gate-2.5 reference
process. The sitting arrives at this with the amendment pre-drafted rather than improvising:

> **Proposed freeze amendment:** "Box FROZEN, **except id 3 (`episode-api-prod-hotfix`) held
> running as the gate-2.5 reference process.** ids 0/1/4 remain stopped; no topology
> formalization; no `pm2 save`; no port flip. id-3 is up for credential-readability only, pending
> the [3] window and Track B's combined restart." Authorization is Evoni's, recorded in the
> sitting.

Holding id-3 running is itself a freeze-posture change and requires that explicit authorization —
it does not happen by default just because the start succeeded.

---

## Sec 7 — Sequencing & boundaries

- **Critical path:** this standup → gate 2.5 re-greened + reference digest minted → §7 credential
  row of the FD-31/[3] re-derivation becomes runnable. It is the unblock for [3], nothing more.
- **Relative to rotation surfaces:** the minted reference digest is what a later rotation/[3]
  window compares against; this sitting does **not** rotate anything and does **not** write `.env`.
- **Relative to Track B:** Track B's prod restart / port flip / topology / `pm2 save` run in Track
  B's own combined window (Sec 2). This sitting is coordinated-with but **not** part of it.
- **What this note / sitting does NOT decide:** no [3] entry; no cutover step; no credential
  rotation; no promotion of any FD or gate; no id-4 disposition (Sec 9); no topology
  formalization; no `.env` edit.

---

## Sec 8 — id-4 forward-pointer (thread stays OPEN)

The recorded-standup discipline defined in this note — pre/post `pm2 list` snapshots, a single
named Rule-7 mutation, exposure-safe capture, who commands it, draft→confirm→execute — **is the
positive definition the id-4 `episode-api-parallel` off-record standup lacks** (06-30 Sec 4;
07-01 Sec 5.2, time-tightened to before 06-27 12:34:50). Writing it once here serves both: the
id-3 sitting is the worked example of what an on-record standup looks like. The id-4 gap is
**not resolved** by this note — it remains OPEN as a freeze-discipline reconciliation (either the
06-27 construction window executed off-record, or id-4 arrived by another path needing
explanation). Forward-pointer only; disposition is its own future triage.

---

## Sec 9 — What this note did / did not do

- **DID:** scope the id-3 standup (objective, ownership per D-option-1, exposure-safe pre-standup
  read with a stated diagnostic ceiling, the single Rule-7 mutation, two-outcome verification with
  the success-digest mint as deliverable, abort/rollback, a pre-drafted freeze-posture amendment,
  sequencing, and the id-4 forward-pointer).
- **DID NOT:** start, restart, `pm2`-mutate, read the box, edit any `.env`, run any digest,
  perform gate 2.5, enter [3], mint an FD, or authorize the standup. Box untouched; freeze stands;
  FD-31 and FD-42 remain OPEN.

---

*Scoping/planning note, 2026-07-01. Additive on the AllStopped investigation + closure and the
FD-31 gate-2.5 / FD-42 credential-state records. Doc-only, no mutation, no gate advanced. Scopes a
future gated, exposure-disciplined, single-purpose id-3 standup whose success closes the FD-42
off-box reference gap. The standup remains gated and is its own deliberate Rule-7 sitting.
[skip-automerge]*
