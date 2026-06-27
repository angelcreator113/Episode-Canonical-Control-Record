# F-Deploy-1 — [3] Credential-Discovery Opening Step (NAVIGATION ONLY)

> **PURPOSE.** This is the first LIVE step the [3] execution session takes after its own
> wake-up trio and scoped reads. It establishes which workstation→canon read-only credential
> authenticates, *by discovering it live* — not by inheriting any prior session's probe result.
>
> **This file carries NO credential values, NO prior probe results, NO "expected" auth outcome.**
> It is branch logic. A session that has read none of the 06-21 / 06-24 credential history can
> run this and reach the same place. If you already "know the answer," you are not cold — and
> knowing the answer is exactly what this step exists to avoid trusting.
>
> **It changes nothing on the box** (`54.163.229.144`, FROZEN). Every step here is read-only:
> SSM read, a psql auth check (no query beyond auth), and a conditionally-gated box read.

---

## Precondition (inherited from cold-entry, re-confirm live — do not pin)

Before this step, the execution session has ALREADY done, live:
- wake-up trio (`git fetch` / `git log -1 origin/main` / `gh pr list`) — its own live HEAD
- scoped Master Runbook Sec 5 read (the checks + A5 fold)
- scoped FD-31 Sec 7 read (the abort conditions)
- instance identity confirmed live: `aws rds describe-db-instances --region us-east-1
  --query "DBInstances[].DBInstanceIdentifier" --output json` returns exactly TWO distinct
  instances (canon + empty fork). If not two-and-distinct → STOP (PreFlight Sec 7: instance
  uncertainty is the whole incident class).
- canon endpoint live-confirmed by identity, NOT by name-string trust.

Client path: VERIFY LIVE before proceeding — run `Get-Command psql` yourself. Do not trust
this document's claim that psql is on PATH; that was true on one workstation at draft time and
is not an inherited fact.
- If it returns a native path → use `$env:PGPASSWORD` (not `export`) and `Remove-Item
  Env:\PGPASSWORD` after (not `unset`). PowerShell has no `export`/`unset`.
- If it returns nothing → the probe runs in Git Bash or WSL. There, use `export PGPASSWORD=…`
  and `unset PGPASSWORD`, and host every probe command in that shell consistently (do not mix
  PowerShell and bash credential syntax in one run).

---

## What this step decides

Which of the candidate read-only credentials authenticates workstation→canon RIGHT NOW.
There are (at least) two candidate password sources reachable WITHOUT SSH:

- **Path A — SSM parameter** (`/episode-metadata/canon/db_password`): reachable without SSH.
- **Path B — box `.env` value** (the credential the box itself holds): reachable without SSH
  only if the operator retains the value; otherwise requires a Phase-0 SSH box read.

> Do NOT assume which is current. Whether SSM is stale and whether the box value authenticates
> are LIVE questions answered below — not facts to carry in. A prior session's result on either
> is NOT evidence about live state.

---

## Step 1 — SSM-first (read-only, no SSH)

Read the SSM parameter and test it against canon. This is run FIRST not because it is
expected to pass or fail, but because it is the no-SSH path and its live result is the
fork in the road.

PowerShell:

    $p = aws ssm get-parameter --name /episode-metadata/canon/db_password --with-decryption --region us-east-1 --query "Parameter.Value" --output text
    $env:PGPASSWORD = $p
    psql "host=<CANON_ENDPOINT> port=5432 dbname=episode_metadata user=postgres sslmode=require options=-c default_transaction_read_only=on" -c "SELECT 1 AS auth_ok;"
    $code = $LASTEXITCODE
    Remove-Item Env:\PGPASSWORD
    $p = $null
    "psql_exit=$code"

Substitute `<CANON_ENDPOINT>` from the live `describe-db-instances` confirm — do not type it
from memory.

**Branch on `psql_exit`:**

- `psql_exit=0` → SSM credential authenticates canon LIVE. Path A is viable. Proceed to
  **Step 3** (the actual count re-verify) using this credential. Record: "SSM authenticated
  cold at <live HEAD>, <timestamp>." Do NOT compare against any remembered SSM SHA — the live
  auth result is the fact; a remembered SHA is not.
- `psql_exit=2` (or auth failure) → SSM credential does NOT authenticate canon LIVE. This is a
  valid data point: it tells you SSM is not the path *right now*. It does NOT tell you the box
  `.env` value works — that is a separate question. Go to **Step 2**.
- any other exit (network, SSL, host) → not an auth verdict. STOP, classify (likely SG, SSL,
  or endpoint typo), do not proceed to Step 2 on a non-auth failure.

---

## Step 2 — box `.env` value (only if Step 1 did not authenticate)

Two sub-paths. Decide which BEFORE acting:

**2a — operator retains the value (no SSH):**
If the operator holds the working canon `DB_PASSWORD`, set it directly and re-run the same
auth check:

    $env:PGPASSWORD = '<operator-provided value>'
    psql "host=<CANON_ENDPOINT> port=5432 dbname=episode_metadata user=postgres sslmode=require options=-c default_transaction_read_only=on" -c "SELECT 1 AS auth_ok;"
    $code = $LASTEXITCODE
    Remove-Item Env:\PGPASSWORD
    "psql_exit=$code"

- `0` → this credential authenticates canon LIVE. Proceed to Step 3 with it.
- non-0 → neither SSM nor the held value authenticates. STOP. Per FD-31 Sec 7, "no durable
  credential ready" is a hard stop — do NOT improvise. Classify before proceeding.

**2b — operator does NOT retain the value → SSH box read (Phase-0 box action, GATED):**
Reading `.env` on the box is a box-side action. It is read-only, but it is box contact, so it
is NOT the same as a workstation credential probe and must be gated explicitly:
- Draft → operator confirms → operator executes → paste result. (Rule 7.)
- Command targets the box, not canon RDS — confirm the instance before running (the implicit-
  reach incident class). SSH user is `ubuntu`, NOT `episode-backend`; key at the recorded path.
- Read ONLY the credential line needed; do not mutate `.env`, do not restart anything, do not
  run a probe that writes a `/tmp` artifact. (A found `/tmp/pm2jlist.json` from #813 is expected,
  not new — but do not ADD to it.)
- Once the value is in hand, return to 2a's auth check from the workstation.

---

## Step 3 — the count re-verify (only after a credential authenticates)

This is the FD-31 Sec 7 / Runbook Sec 5 live re-verify proper. It runs ONLY once Step 1 or
Step 2 has produced a live-authenticating credential. Read-only, workstation→canon, same
connection string (`sslmode=require`, `options=-c default_transaction_read_only=on`).

Compare live counts row-by-row against the Runbook Sec 5 table (episodes, shows, assets,
world_events, wardrobe, social_profiles, franchise_knowledge; table total; `ai_usage_logs`
is the one moving number that does NOT abort by itself). ANY content-count or total mismatch
→ STOP (PreFlight Sec 7). Snapshot + verified-dump existence are part of the same gate.

> Draft the exact count query at Step-3 time against the live-confirmed schema, gated.
> This file does not pre-bake it — the cold session builds it when it gets there, so the
> expected numbers are read fresh from Sec 5, not carried in this pointer.

Clear `$env:PGPASSWORD` after. Record the run (HEAD, timestamp, per-table actual-vs-expected).

---

## What this step does NOT do
- Does not restart, reboot, or write anything to the box or canon.
- Does not decide the credential in advance — it discovers it live and branches.
- Does not carry prior-session probe results, SHAs, or auth outcomes as fact.
- Does not proceed to cutover (Runbook Sec 7 Phase 2) — that is the irreversible window,
  separate gate, after this re-verify passes.

## Provenance
Drafted as a navigation artifact at origin/main HEAD 13002465 (live-confirmed this session).
Carries pointers and branch logic only. Reading it does not warm a session.
