# Prime Studios Audit Handoff v15

**Authored 2026-06-03 (a doc-only PR + working-tree session after v14). Additive on v14; v14/v13/v12/v10 remain canonical for anything v15 does not supersede.**

## Sec 0 — Front matter

**What changed v14 → v15 (2026-06-03):**
- **Both pre-[3] loops are CLOSED.** v14 Sec 4 set up two cheap loops before [3]; both are now done. Loop 1 (land PRs / establish merge state): **#755 MERGED** (2026-06-03T19:00:05Z, merge commit `4481ea0c`) — the G1 registry reconcile **and** the front-matter fix are both canon on main. Loop 2 (ratify decision (a)): **LOCKED = A2** via Fix Plan v1.10 (#758). The next big step is now unambiguously **[3]**, its own deliberate gated session.
- **#755 supersedes v14's open debts.** v14 Sec 0/2/3.15/8 all carried "#755 pending merge" and "front-matter NOT updated / still owed." Both resolved. The on-main `docs/audit/F-Deploy-1_G1_Audit.md` header now reads: date `2026-06-02 (registry reconciled to AK)`; status `CONTENT-COMPLETE (A-AA, 2026-05-16); registry reconciled to AK (Sec 8)`; findings `37 letters (A-AK); AH VOID; 36 substantive`; deferred `F-Deploy-G1-T (resolved via AK finding #747)`. Whoever merged #755 folded the four front-matter edits in at the same time — they are NOT still owed.
- **Register extends to FD-38.** Landed between v14 and this session: **FD-38** (#757) — soft-delete-aware integrity gate + baseline certification; **PreFlight 6.3/Sec7 folded to FD-38** (#759), with a noted PreFlight 6.3 ↔ FD-38 staleness flag; **AK five-point gate status recorded** (#753) — AK-3/AK-4 corrected in open #752, AK-1/AK-2 deferred to cutover, AK-5 open/parallel-safe. Register now **FD-1 through FD-38**.
- **This session was doc-only + working-tree cleanup. No prod-box action. No [3] progress.** [3] remains its own deliberate session, not primed.

**Main HEAD at this writing:** includes #755 (`4481ea0c`, registry + front-matter) and #760 (session brief, merged this session, fast-forward to `9e82cb5c`). Exact tip/ordering not re-confirmed at close — run `git log --oneline -5` for current.

**Supersedes v14 on:** Sec 0/2/3.15/8 (#755 now merged, front-matter applied — was "pending"); Sec 4 Loop 2 (decision (a) now LOCKED A2 — was "RECOMMENDED, not ratified"). v14/v13/v12/v10 canonical elsewhere.

## Sec 1 — How to use this document

Carry-forward from v14 Sec 1 with amendments.

- **Wake-up sequence:** Confirm live state FIRST — `git log --oneline -5` and `gh pr list --state open`. Establish: (1) did **#761** (this handoff) and **#762** (runbook draft) merge? (2) is **#752** (AK-3/AK-4) still open? (3) has **[3]** happened — if so, prod topology + credentials changed and Sec 2/4 framing is stale.
- **The next BIG step is [3]** — the combined prod-restart window. Both v14 pre-loops are closed; there is no longer a cheap loop standing between you and [3]. [3] is its own session (Sec 4).
- **Prod state:** UP via the 06-01 additive hotfix, reboot-durable, MONITORED (AJ live). Config-of-record corrected (Track B Minimal-B, #746); running processes still on hotfix names pending the [3] restart-to-align. Freeze reaffirmed (#757/#758). Unchanged from v14.
- **Authorities (current-state):** FD-31 Pre-Flight v1.4 + the 06-02 PreFlight re-verify (#749), Fix Plan v1.10 (#758, decision (a) ratified), FD-38 integrity-gate docs (#757/#759), `F-Deploy-G1-AK_ProdDeploy_Workflow_Hazard.md` (#747) + five-point gate-status addendum, the `F-Deploy-1_Combined_Restart_Session_Brief.md` now on main (#760), the split-brain hazard doc, the 05-30 incident doc. This handoff is orientation.

## Sec 2 — Keystone status (additive on v14 Sec 2 for F-Deploy-1)

- **F-AUTH-1 / F-App-1 / F-Stats-1 / F-Reg-2 / F-Ward-1 / F-Ward-3 / F-Franchise-1 / F-Sec-3** — all unchanged from v14. Still queued behind F-Deploy-1 full close.
- **F-Deploy-1** — Phase A CLOSED; Phase B G1 CLOSED; Phase B G2 still BLOCKED on FD-31. The **G1 registry is now canon on main** (reconciled to AK, front-matter consistent — #755 merged; the v11→v14 bookkeeping debt is fully cleared, not just folded). Decision (a) restart vehicle **LOCKED = A2**. The combined-restart window ([3]) is the gating prod action (Sec 4). Register **FD-1 through FD-38**; G1 letters A through AK (AH void, 36 substantive). Prod RESTORED + MONITORED, on hotfix topology pending [3].

## Sec 3 — What moved this session (additive on v14 Sec 3)

### Sec 3.16 (NEW) — Doc-only PR session + working-tree cleanup

- **#760 MERGED** — `F-Deploy-1_Combined_Restart_Session_Brief.md` (112 lines) now on main.
- **#761 opened** — this handoff (`docs/audit/Prime_Studios_Audit_Handoff_v15.md`).
- **#762 opened** — `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (334 lines), the [3] runbook draft.
- **Working tree cleaned.** Removed the garbled venv-activation junk file at repo root (`Remove-Item`, targeted). Then a `git clean -i` was run and committed clean-all (`1`), which also removed: the regenerable scratch (`countcheck.sql`, `dev_tables.txt`, `prod_tables.txt`, `pr-body.md`) — no loss; `docs/audit/Sec8_DROP_IN_append_to_audit_doc.md` — **no loss** (a staging copy of §8 text already canonical on main via #755); and **the parked untracked root paths `src/pages/` and `src/styles/LandingPage.css`** — these were untracked and never committed, so **git cannot restore them.** v14 Sec 10 listed them as keep-items; if they are still wanted, they must be reconstructed (check VS Code Local History / Timeline on those exact root paths before that window is closed). **This note is about root `src/...` only, not tracked frontend paths under `frontend/src/...`.** Working tree now down to `parked/` only.

### Sec 3.17 (NEW) — Working-tree hygiene lesson (methodological)
Once a targeted delete (`Remove-Item -LiteralPath`) has removed the intended file, **stop** — do not reach for a sweep tool. Never run `git clean -f` or take `git clean -i` option `1` (clean-all) while wanted items are untracked: the sweep does not distinguish junk from parked work. If a sweep is unavoidable, read its target list against what you actually mean to remove, and use `4: ask each`, not `1`. (Earned this session — the activation file was already gone before `git clean` ran; the sweep was unnecessary and cost the two parked `src/` items.)

## Sec 4 — The next big step: [3] (additive on v14 Sec 4)

Both v14 pre-[3] loops are now CLOSED (Sec 0). [3] (the combined prod-restart window) is unchanged as the gating prod action, now with nothing cheap standing in front of it. Restart vehicle **LOCKED = A2** (direct pm2/ecosystem; `Deploy to Production` stays disabled through [3]; AK path (b) is post-[3] cleanup).

**[3] is its own deliberate session.** A **FRESH live FD-31 Sec 7 abort re-verify at [3]'s own session start** is required — do NOT trust this session or #749 or any prior. The comparator is the **FD-38 seven-table unfiltered `count(*)` fingerprint + identity asserts** — read it from Fix Plan v1.9 / Combined Restart Session Brief Sec 2 / the Master Runbook Step 0; do NOT inline the numbers here. v14's eight-number string `72/10/64/53/40/444/605/764` is SUPERSEDED: `ai_usage_logs` is a volatile append-only counter, EXCLUDED from the hard gate (inlining it courts a false abort), and `/health` is liveness-only (`deleted_at IS NULL`, reports ~1 show/18 episodes), NOT the counts comparator. Confirm: fingerprint matches, identity asserts resolve to canon (`current_database()` = `episode_metadata`, `inet_server_addr()` = `10.0.20.224`), snapshot `episode-control-dev-prefreeze-insurance-20260530` present, verified dump on disk. Any mismatch = ABORT. Only if green: ONE gated restart — FD-31 cred rotation + Track B restart-to-align (#746 ecosystem) + Template Studio route fix + post-cutover security sweep (close 0.0.0.0/0 on RDS SGs per AF/AE, encrypt insurance snapshot, move off static keys to instance profile per AD) + FD-38 post-restart integrity gate. Post-restart: re-run the FD-38 fingerprint + identity asserts; confirm `/health` = 200 + `database:connected` on the canon host (liveness only — NOT the counts check). Mismatched fingerprint or wrong host = ABORT + restore from snapshot.

After [3]: F-Deploy-1 toward full close (G2 §4.2 memory gate still owed — ≤820 MiB on dev EC2, 7-day burn-in), then the downstream keystone sequence resumes.

## Sec 8 — Findings registry (UPDATE v14 Sec 8)

- **Registry reconcile: CANON ON MAIN (#755 merged, `4481ea0c`).** Supersedes v14's "FOLDED, pending merge." AB–AK live in the consolidated §8 of `F-Deploy-1_G1_Audit.md`; front-matter consistent (37 letters, AH VOID, 36 substantive). Debt fully cleared.
- **FD-38 registered** (#757) — soft-delete-aware integrity gate + baseline certification; PreFlight 6.3/Sec7 folded to it (#759).
- **AK five-point gate:** still NOT satisfied. AK-3/AK-4 corrected in **open #752** (drafted, not landed); AK-1/AK-2 → cutover; AK-5 open/parallel-safe. Live containment remains **path (a): `Deploy to Production` disabled**.
- **Shared-DB-coupling question:** CLOSED, no new letter (carry-forward from v14 — covered by G1-G + AG + AK-2).
- Everything else carries forward unchanged.

## Sec 9 — Trust-the-prior-session checklist (for the v16 author)

- [ ] `git log --oneline -5` + `gh pr list --state open`. Did **#761** (v15 handoff) and **#762** (runbook draft) merge? Is **#752** (AK-3/AK-4) still open? If #752 merged, flip AK-3/AK-4 in §8 from "open PR" to "on main."
- [ ] Confirm whether **[3]** has happened — if it has, prod topology + credentials changed and Sec 2/4 framing is stale; fresh FD-31 abort re-verify was required at its start.
- [ ] **Parked root `src/pages/` + `src/styles/LandingPage.css`** — were these reconstructed (Sec 3.16)? If still needed and not yet rebuilt, still owed.
- [ ] G2 §4.2 memory gate status (≤820 MiB, 7-day burn-in, dev EC2); S4.2-B/S4.2-C disposition (G2-register).
- [ ] Confirm Episode 1 status (still "Honey Table deprecated, replacement TBD").

## Sec 10 — Outstanding housekeeping (UPDATE v14 Sec 10)

*Cleared this session (drop from list): #755 merge; front-matter fix; decision (a) ratification.*

- **#761 / #762** — review and merge (this handoff + runbook draft).
- **#752 (AK-3/AK-4)** — still open; disposition / land.
- **[3] combined-restart window** — the next big prod step; fresh FD-31 abort re-verify at its own session start; vehicle locked A2.
- **AK five-point** — path (a) in force; AK-1/AK-2 at cutover; AK-5 orphaned-`scripts/deploy/` cleanup parallel-safe, not [3]-blocked.
- **G2 §4.2 memory gate** — ≤820 MiB, 7-day burn-in on dev EC2; possibly parallel-able with prod [3] work — confirm sequencing.
- **S4.2-B / S4.2-C** — G2-register, still owed.
- **AJ synthetic canary** + **target-health alarm** (post-[3] / post-Track-B-TG-fix) — deferred follow-ons.
- **Parked root `src/pages/` + `src/styles/LandingPage.css`** — removed this session (Sec 3.16); reconstruct only if those exact root-path artifacts are still required.
- Carry-forward from v14 Sec 10: `-prod` teardown post-cutover; F-Stats-1 Phase B behind F-Deploy-1 close; the `world_events` backfill migration `20260807000000` (reconciliation-gated, do NOT run/commit until cutover — was not in this session's working tree, confirm location); `parked/`; Frontend IA Audit dispositions. *(The `dev_tables.txt`/`prod_tables.txt`/`countcheck.sql` scratch that v14 carried here was deleted this session — regenerable, drop from carry-forward.)*

## Sec 11 — Director Brain / Sec 12 — Episode 1 / Sec 13 — C2C (status-quo, unchanged)

All unchanged from v14/v13/v12. Director Brain still deferred (F-Franchise-1 resolution, behind F-Deploy-1 close; `migrations/20260725000000` the migration template). Episode 1 still "Honey Table deprecated, replacement TBD." C2C still deferred until SAL has a following. Status-quo-explicit so silence isn't misread as change.

---
*Prime Studios Audit Handoff v15. Authored 2026-06-03. Additive on v14. Headline: both v14 pre-[3] loops are CLOSED — #755 merged (`4481ea0c`, G1 registry reconciled to AK + front-matter fix both canon on main), and decision (a) restart vehicle LOCKED = A2 (#758, Fix Plan v1.10). Register extends to FD-38 (soft-delete-aware integrity gate, #757; PreFlight 6.3 folded #759) — and FD-38, not v14's eight-number string, is the abort comparator: seven-table unfiltered fingerprint + identity asserts, `ai_usage_logs` excluded as volatile, `/health` liveness-only. Doc-only PR session: #760 merged (session brief), #761 (this handoff) + #762 (runbook draft) opened; working tree cleaned — note the parked root paths `src/pages` + `src/styles/LandingPage.css` were inadvertently removed by a git-clean overrun and are not git-recoverable (Sec 3.16/3.17). [3] is now the immediate next big step, its own deliberate session with a fresh FD-31/FD-38 abort re-verify required at start, untrusted from any prior run. No box mutations, [3] not primed. v14/v13/v12/v10 canonical for anything v15 does not supersede.*
