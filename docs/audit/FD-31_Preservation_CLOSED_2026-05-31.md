# FD-31 — Prod-Only Schema Preservation: PARKED (handoff note)

> Freeze-safe prep note. Nothing here touched the frozen prod box
> `episode-backend` (`54.163.229.144`). No Fix Plan gate moved. Sec 4.2 remains
> BLOCKED on FD-31. The cutover sitting stays gated behind closing the item below.

| | |
|---|---|
| **Parent** | FD-31 reconciliation pre-flight (`F-Deploy-1_FD31_Reconciliation_PreFlight_Plan.md` v1.3) |
| **Status** | Preservation of the 37 prod-only definitions — **OPEN, narrowly parked (updated 2026-05-31, 2nd cycle)** |
| **Blocker now** | SSL solved + placement solved. **Sole remaining blocker: correct `-prod` master credential not in hand.** Box untouched throughout. |

---

## The correction this surfaced (matters more than the block)

The pre-flight plan (Sec 4.3) records the 37 prod-only definitions as preserved
"in the verified dump (Sec 3) AND a parked migration file," and calls preservation
a **firm** requirement. The verified dump cannot hold them.

- The verified dump (`episode-control-dev-verified-20260530.dump`, gate 2.1b) was
  produced from a restore of the `episode-control-dev` snapshot. It is **canon
  `-dev`: 143 tables.** The 37 are prod-only *by definition* — a `-dev` dump
  mathematically cannot contain them.
- Right now the 37 definitions exist durably in **exactly one place: the
  `episode-control-prod` RDS itself** (empty-but-schema). If the parked migration
  file does not actually carry all 37 (named in Sec 4.3 but contents unconfirmed),
  the "firm" requirement is nominally met, not actually met.

**Action required before cutover:** capture the 37 faithfully off-instance via a
`--schema-only` dump of the empty `-prod` RDS. This is freeze-safe (it reads an RDS
instance, not the frozen EC2 box; `-prod` is empty so nothing is fragile) — same
logic Sec 5.1 already used to read `-prod` for the diff.

---

## Progress across two cycles (2026-05-31)

Host always resolved correctly by identifier (no typed-host risk):
`episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com`. Box never touched.

**Cycle 1 — two walls:**
```
FATAL: password authentication failed for user "postgres"
FATAL: no pg_hba.conf entry for host "<workstation IP>", ... no encryption
```
(a) credential rejected, and (b) `-prod` refused a **plaintext** connection.

**Cycle 2 — both narrowed to one:**
- Added `PGSSLMODE=require` → the `pg_hba`/`no encryption` wall **disappeared**.
  **SSL is solved**; `-prod` is now reachable over an encrypted connection.
- Placement issues (special chars / quoting) resolved by loading the password via
  `Read-Host -AsSecureString`; `$env:PGPASSWORD.Length` = 23 confirmed a real,
  non-placeholder string lands cleanly. **Placement is solved.**
- Result is now **only** `FATAL: password authentication failed` — i.e. the
  23-char string in hand is **not** the `-prod` master. (Almost certainly the
  `-dev` credential; the split-brain means the prod box authenticates to `-dev`,
  so a `-dev` password is what's readily available — it won't work against `-prod`.)

**No file written** (dump never authenticated). `episode-control-verify-throwaway`
confirmed already gone (`DBInstanceNotFound`).

### `-prod` credential provenance (CloudTrail, this cycle)
- Instance `episode-control-prod` created 2026-01-01 07:22:16.
- Master password **explicitly reset 2026-05-10** via `ModifyDBInstance`: `root` at
  18:45:06 then `evoni-admin` at 19:19:33 (-04:00). The live value is the
  **19:19:33** one (later of the two).
- `requestParameters.masterUserPassword = HIDDEN_DUE_TO_SECURITY_REASONS` — AWS
  proves a reset happened but **will not surrender the value**. No lookup recovers
  it; it must come from your own records or be reset again.

---

## Next cycle — one short step (SSL + placement already solved)

Get a working `-prod` credential, then run the dump. Two legitimate paths; pick
whichever is faster:

1. **Recover the 2026-05-10 value** (preferred, non-mutating): password manager
   entry ~May 10, an `.env`/script edit that day, or terminal history
   (`Get-Content (Get-PSReadlineOption).HistorySavePath | Select-String "master-user-password"`
   — note: if found there it was typed in cleartext, an exposure to clean up).
2. **Reset `-prod` master deliberately** (safe here): `-prod` is **empty** and no
   live app depends on its auth (the prod box authenticates to `-dev`). A planned
   reset to a known literal harms nothing — same logic the throwaway used. This is
   no longer the "don't reset a live instance reflexively" case; that caution was
   about panic-unblocking at cycle's end, not a considered step.
   `aws rds modify-db-instance --db-instance-identifier episode-control-prod --master-user-password <KNOWN-LITERAL> --apply-immediately --region us-east-1`,
   poll `PendingModifiedValues` until clear, then dump.

Then the capture (SSL + placement form that worked this cycle):

```powershell
$sec = Read-Host "Enter -prod master password" -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new("", $sec).Password
$env:PGSSLMODE  = "require"
pg_dump -h episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com -p 5432 -U postgres -d episode_metadata --schema-only --no-owner --no-privileges -f prod-only-schema-preservation-20260531.sql
```

Verify the 37 are inside it:

```powershell
(Select-String -Pattern "CREATE TABLE" prod-only-schema-preservation-20260531.sql).Count
Select-String -Pattern "CREATE TABLE.*(ai_edit_plans|raw_footage|scene_layer_configuration|markers|lala_cash_grab_quests)" prod-only-schema-preservation-20260531.sql
```

Count near 171, all five lines present → preservation closed. Store off-repo in
`Documents\PrimeStudios-Backups\` next to the verified dump. **Do not `git add`.**

---

## Other documentation corrections noted this session (cosmetic; lint, not defects)

- **Sec 4.3** — overstates preservation: names the verified dump as a vehicle for
  the prod-only defs, which it cannot be (see above). Reword to: definitions live
  on `-prod` RDS; preservation = `--schema-only` dump of `-prod`, parked off-repo.
- **Sec 8** — stale: claims the prod-only set "still needs the `-dev` diff," but
  Sec 5.2 / gate 2.3 record the diff done 2026-05-31 with the 37 authoritative.
- **Lines ~313–316** — a garbled copy-paste duplicate of the clean Sec 5.2
  entanglement paragraph above it. Delete.

---

## Cycle status (handoff)

- Verified `-dev` dump — DONE (gate 2.1b). ✅
- `-prod` reachability (SSL) — SOLVED this cycle (`PGSSLMODE=require`). ✅
- Password placement (PowerShell) — SOLVED (`Read-Host -AsSecureString`). ✅
- `-prod` schema preservation — PARKED, narrowed to **one** blocker: correct
  `-prod` master credential not in hand (reset 2026-05-10; AWS won't surface it).
  Next: recover the May-10 value OR deliberately reset the empty instance, then
  re-run the dump. ⏸️
- `episode-control-verify-throwaway` — already gone, confirmed. ✅
- Frozen prod box — never touched. ✅
- Cutover sitting — stays gated behind closing the preservation item.

*Two cycles in, this is progress, not a stall: two walls (SSL + placement) fell,
the blocker is down to a single recoverable/resettable credential, and the box was
never touched. Backup-first, freeze-safe, deliberate.*
