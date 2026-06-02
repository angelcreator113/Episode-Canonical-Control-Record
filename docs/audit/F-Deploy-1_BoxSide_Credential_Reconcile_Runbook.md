# F-Deploy-1 [3] Phase 2 -- Box-Side Credential Reconcile RUNBOOK (DRAFT v0.1)

> **PREP / RUNBOOK DOCUMENT. AUTHORIZES NO ACTION BY ITSELF.**
> This is a reviewed script for the box-side credential reconcile, to be executed in
> its own session under Rule 7. Reading/drafting it changes nothing. Every step is
> marked read-only (safe) or mutating (gated). The restart that [3] eventually needs is
> NOT in this runbook -- this runbook only makes the box's `.env` hold a working canon
> credential, so that a LATER restart (in the combined [3] window) is safe.

| | |
|---|---|
| **Parent** | FD-31 Pre-Flight v1.4 gate 2.5; [3] combined-restart window (v13 Sec 4); the 2026-06-02 re-verify finding (`F-Deploy-1_PreFlight_Reverify_2026-06-02.md`). |
| **Goal** | Establish what password canon (`episode-control-dev`) accepts, confirm what the box's `/home/ubuntu/episode-metadata/.env` holds, and ensure the box's `.env` holds a working canon credential. Re-mark gate 2.5 green (or keep it red with a precise reason). |
| **Explicitly NOT in scope** | The prod restart / restart-to-align (Track B, [3] Phase 3). The FD-31 password ROTATION (optional hygiene -- can be folded into the combined window). The AK audit. Any `pm2` mutation. |
| **Box** | `episode-backend`, `54.163.229.144`, SSH key `C:\Users\12483\episode-prod-key.pem`, user `ubuntu`. |
| **Status** | DRAFT v0.1 -- reviewed plan, not yet executed. |

---

## Sec 0 -- The situation (from the 2026-06-02 finding)

- Canon = `episode-control-dev` (RDS). It accepts a specific 40-char password ("the
  working password" -- held by Evoni; was confirmed working 2026-06-02 via read-only
  count query).
- The **workstation** `.env` holds a DIFFERENT 40-char password that canon REJECTS.
- The **box's** `/home/ubuntu/episode-metadata/.env` was NOT inspected -- UNKNOWN whether
  it matches the workstation's (stale) value, the working value, or a third thing.
- The **running** prod process authenticated at boot and holds a working credential in
  memory (prod is `200`, DB-connected) -- but that in-memory credential is only re-read
  from `.env` on the next restart. So the box's `.env`-on-disk is what governs a restart.

**The whole question:** does the box's `.env` hold a credential canon accepts? If yes,
gate 2.5 is green and a restart is auth-safe. If no, the box's `.env` must be corrected
to the working password BEFORE any restart, or the restart crashes prod on canon auth.

## Sec 1 -- SSH discipline (READ THIS BEFORE CONNECTING -- Pre-Flight Sec 3.3)

The box is the one-keystroke-from-disaster host. The single most dangerous action (a
`pm2` mutation that re-poisons the topology or drops prod) is always one line away.
Rules for this entire session:

- **Single, complete commands only.** Prefer one-shot `ssh ubuntu@host "command"` form
  over opening an interactive shell and typing inside it. If an interactive shell IS
  opened, do nothing but the planned read, then `exit` immediately.
- **NO `pm2 restart`, `reload`, `delete`, `stop`, `save`, `start`, `kill`** -- none, for
  any reason, this session. If a restart seems needed, that means this is no longer the
  reconcile session -- STOP and re-scope.
- **NO edits to anything except, deliberately and gated, the box's `.env`** (Sec 4, and
  only if Sec 3 shows it's stale).
- **The PowerShell terminal has been finicky** (quoting, hidden-password prompts). Use
  single-line commands; avoid multi-line paste blocks with `>>`; avoid interactive
  password prompts (use file/stdin-based handling as the 2026-06-02 session learned).
- **Rule 7:** the only mutating step here is writing the box's `.env` (Sec 4) -- draft,
  confirm, then execute. Everything else (Sec 2, Sec 3) is read-only and needs no gate.

## Sec 2 -- Step 1: confirm live state (read-only, workstation)

```
git checkout main; git fetch origin main --quiet; git log --oneline -3
```
Expect HEAD `e5471152` (#749) or later. If main moved, read what landed before acting.

```
curl.exe -s -o NUL -w "%{http_code}" https://primepisodes.com/health
```
Expect `200`. If not, prod state changed -- that becomes the priority, STOP the reconcile.

## Sec 3 -- Step 2: read the box's credential state (READ-ONLY SSH -- two one-shot commands)

Both are single `ssh "..."` invocations -- they run one command and return; no interactive
shell is left open. Neither mutates anything.

**3a -- what the RUNNING prod process authenticates with** (its in-memory working cred):
```
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@54.163.229.144 "pm2 env 3 | grep -i db_password"
```
This is the credential prod is currently, successfully using against canon. It is the
"known-good" reference. (`pm2 env 3` was used read-only on 2026-06-01 and 06-02 safely --
it only prints env, does not mutate. Confirm id 3 is still the prod hotfix first if
unsure: `ssh ... "pm2 list"` -- read-only.)

**3b -- what the box's `.env`-ON-DISK holds** (what a restart would read):
```
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@54.163.229.144 "grep '^DB_PASSWORD=' /home/ubuntu/episode-metadata/.env"
```

**Compare 3a vs 3b:**
- **If 3a == 3b** -> the box's `.env` holds the working credential. **Gate 2.5 is GREEN.**
  A restart is auth-safe. No write needed. Skip Sec 4; go to Sec 5.
- **If 3a != 3b** -> the box's `.env` is STALE (holds a password that differs from the
  working in-memory one). A restart would read the stale value and fail canon auth.
  The box's `.env` must be corrected (Sec 4).

> Optional cross-check against canon directly (read-only, workstation psql -- the
> 2026-06-02 method): the value from 3a should authenticate against canon; the
> workstation `.env` value (and 3b if it differs) should not. This triangulates which
> string is truly the working one. Use the file-based `PGPASSWORD` approach from the
> 06-02 session (write the candidate to a temp file, `PGPASSWORD=(Get-Content file).Trim()`,
> run `SELECT 1`, delete file) -- DO NOT type passwords at the interactive prompt.

## Sec 4 -- Step 3 (ONLY IF 3a != 3b): correct the box's `.env` (GATED MUTATION)

This writes the working credential into the box's `.env` so a restart authenticates.
It does NOT restart anything -- editing `.env` is safe; the running process keeps its
(correct, in-memory) credential until a deliberate restart later.

> **RULE 7 GATE. Draft, confirm target + value, then execute.** The target is the box's
> `.env`; the value is the WORKING password (the 3a value, confirmed against canon in
> Sec 3). Confirm twice that you are writing to `/home/ubuntu/episode-metadata/.env` and
> NOT triggering any pm2 action.

Approach (assemble at session time -- left un-runnable here by design, per the standing
rule about not copying mutation commands out of a doc):
1. Back up the box's current `.env` first (read-only copy): `cp .env .env.bak-YYYYMMDD`
   on the box, so the prior state is recoverable.
2. Replace the `DB_PASSWORD=` line in the box's `.env` with the working value. Use a
   method that handles special chars safely (the password may contain `!!` etc. --
   the incident doc notes this). Prefer writing via a here-doc/temp-file mechanism over
   inline `sed` with the raw password, to avoid shell interpretation. Do NOT echo the
   password into shell history.
3. Verify the line is correct (read-only `grep '^DB_PASSWORD=' .env`) and that no other
   line changed (`diff .env .env.bak-YYYYMMDD` -- should show only DB_PASSWORD).
4. **Do NOT restart.** The corrected `.env` takes effect at the next deliberate restart
   (the [3] combined window). Leaving it corrected-but-not-restarted is the safe state:
   running prod is fine (in-memory cred), and the next restart will now succeed.

## Sec 5 -- Step 4: record the outcome + update gate 2.5

- If 3a == 3b (or after Sec 4 correction): the box's `.env` holds a working canon
  credential. **Re-mark FD-31 Pre-Flight gate 2.5 GREEN** in a short doc/PR, citing this
  reconcile. Note whether a correction was made (Sec 4) or the box `.env` was already good.
- Also record the CAUSE if discoverable (the 06-02 finding Sec 3.4 left it open: was the
  canon password rotated post-06-01 and `.env` not updated, or was `.env` edited wrong?).
  The 3a/3b/workstation triangulation may reveal which. Fold into the finding.
- **Credential rotation (optional, deferred):** this runbook does NOT rotate the canon
  password -- it only makes `.env` match the current working one. The FD-31 Sec 6.5
  rotate-at-cutover item still stands and is best done IN the combined [3] window (rotate
  canon pw + write new value to `.env` + the single restart that picks it up, all together).

## Sec 6 -- After this runbook: where [3] stands

Once gate 2.5 is green again, [3]'s remaining entry gate (v13 Sec 4 / #749 Sec 5) is:
1. Live abort-check re-verify (catalog: ai_usage_logs now 765, content 72/10/64/53/40/444/605, total 143).
2. Credential gate 2.5 -- GREEN (this runbook).
3. AK five-point audit -- still required (separate work).
4. Then the combined window: FD-31 rotation + Track B restart-to-align + route fix +
   security sweep, ONE restart, post-restart `/health` = canon host + matching counts or ABORT+restore.

## Sec 7 -- What this runbook does NOT do
- Does NOT restart, reload, or `pm2`-mutate anything.
- Does NOT execute [3] or the restart-to-align.
- Does NOT rotate the canon password (deferred to the combined window).
- Does NOT run the AK audit.
- Does NOT edit anything but the box's `.env` (and only if Sec 3 shows it's stale, gated).

---
*Box-side credential reconcile runbook for [3] Phase 2. Reads the running process's
working credential (3a) and the box's on-disk `.env` (3b), compares them, and -- only if
they differ -- corrects the box's `.env` to the working canon password (gated, no restart).
Closes the gate 2.5 question the 2026-06-02 re-verify left open. Read-only except one
gated `.env` edit; no restart, no pm2 mutation, no [3] execution. SSH discipline (Pre-Flight
Sec 3.3) applies throughout: single read-only commands, no pm2 actions, the dangerous action
is always one keystroke away.*
