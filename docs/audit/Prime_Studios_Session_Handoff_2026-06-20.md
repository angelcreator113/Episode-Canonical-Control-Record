# Prime Studios Session Handoff — 2026-06-20

**Session type:** Doc-only preservation + FD-39 investigation. NO box mutation
(every box command read-only). NO [3] progress. Box FROZEN throughout.

**⚠️ Wake-up first — do not trust the SHAs below.** Run the trio:
`git fetch origin` / `git log --oneline -1 origin/main` / `gh pr list --state open`.
Establish: (1) did **#828** merge? (2) is **#752** still open? (3) has **[3]** happened?

---

## What this session VERIFIED (corrects stale memory)

- **A2-cfg interpreter-pin is FULLY CLOSED.** Prior memory ("mid-Step B, nano open,
  Step C pending") was stale on every count. Both gate records are on main:
  - `100a2dc8` (#826) — A2-cfg interpreter-pin **Step C verification PASS**
  - `b49e7704` (#827) — A2-cfg interpreter-pin **Step A/B gate record** (HEAD at session start)
  - Authoring order (Step C committed 06:48 before A/B at 08:10) is sequence, not contradiction.
- **Live `ecosystem.config.js` on box:** `interpreter: '/usr/bin/node'` on all four app
  entries — the pin landed. Running processes (episode-api 19D, prod-hotfix 18D) predate
  the edit and still resolve the old interpreter; expected "config corrected, processes
  pending [3] restart-to-align," NOT drift.

## NEW findings recorded this session

- **FD-39 quantified (live).** Box git checkout is **197 commits behind origin/main**.
  Working tree divergent: `CharacterState.js` **byte-identical** to main ("IDENTICAL");
  `sequelize.js` **DIVERGENT** — box carries the OLD version (staging block +
  `DATABASE_URL` pathway); origin/main is a newer rewrite that removes `DATABASE_URL`
  and binds production to discrete `DB_*` vars. This is the EXISTING FD-39 finding now
  measured, not new damage.
- **FD-39 is REGISTERED — not a gap.** Minted in **Fix Plan v1.11** (register tail FD-39).
  v1.12 mints FD-40 (canon credential rotation gate record). v1.13 is a thin
  P-4/P-5=PASS accounting revision (no register body). **Current Fix Plan = v1.13**
  (verified by LastWriteTime — lexicographic sort hazard is real: v1.10–v1.13 sort
  ABOVE v1.2–v1.9).
- **2b env-completeness gate rationale (the consequential one).** The new `sequelize.js`
  will NOT survive on `DATABASE_URL`. A [3] tree-reparent without confirming the discrete
  `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/DB_PORT` keys are present + canon-auth-proven risks
  **prod DB-connection loss on restart.** Captured as hard ABORT gate 2b in the [3] runbook (#828).

## Shared-state action this session

- **PR #828 OPEN (NOT merged).** Branch `wip/preserve-drafts-2026-06-20`, commit `4fae6768`.
  Docs-only, `[skip-automerge]`, no closing keywords. Contents: FD-39 bridge keystone-framing
  correction (4 lines) + [3] runbook 2b env-completeness ABORT gate (9 lines) + four preserved
  at-risk untracked drafts (FD40 reconciliation, FDNEXT secret-leakage finding, P4P5 evidence
  pack, 2026-06-18 handoff).
- **`phase1_probe.sh` / `phase1_total.sh`** preserved to `Documents\PrimeStudios-Backups\`,
  left UNTRACKED. Read-only canon probes (identity-guarded, read-only-txn-locked, FD-31 §7
  abort-fingerprint shape). No hard-coded secrets, but embed live prod targeting + read
  `DB_PASSWORD` from `.env` at runtime — NOT committed (they are the FDNEXT finding's subject).

## FD-39 disposition (the inherited sentence)

> FD-39 is registered in v1.11; today's live quantification (197 behind; `sequelize.js`
> old `DATABASE_URL` version; `CharacterState` byte-identical) is preserved in #828 and
> gated in the [3] runbook 2b gate. Formal register-body promotion (v1.14) is **deferred**
> to the next FD-39/[3] working session — **not owed now**, nothing at risk if it waits.

## Deferred threads (each wants its own focused session)

- **#828 merge** — own gate, whenever chosen.
- **v1.14 register promotion** of the 197-commit quantification — fresh session, v1.11
  register open. Register-lineage action; do not tail-end it.
- **[3] priming** — needs a GENUINELY fresh cold session. This session is warm (read box,
  divergence, register lineage) and disqualified.
- **`.env.bak-*` plaintext hygiene** — start by reading remote branch
  `chore/redact-plaintext-credentials` (already in flight); don't duplicate.
- **#752** parked (AK-3 PM2 names), post-[3].
- **Locus 7** fork SG (`sg-0164d0b20fbebacbb`, still `0.0.0.0/0:5432`) — post-[3] sweep.

## Side note (flagged, not chased)

`stash@{0}` ("WIP on main: 4481ea0c", #755 era) is the most likely home of the v15-lost
`src/pages/` + `LandingPage.css` files, if recoverable. Not investigated this session.
