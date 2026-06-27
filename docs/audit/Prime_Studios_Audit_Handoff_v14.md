# Prime Studios Audit Handoff v14

**Authored 2026-06-02 (a working session after v13, same day as #748–#750 merged). Additive on v13; v13/v12/v11/v10 remain canonical for anything v14 does not supersede.**

## Sec 0 — Front matter

**What changed v13 → v14 (2026-06-02):**
- **The registry reconcile is FOLDED — on PR #755, not yet on main.** The long-owed reconcile (open since v11 Sec 3.10, carried v12 Sec 8.1, v13 Sec 8.1) is done as content: a new consolidated **§8 Findings Registry** in `docs/audit/F-Deploy-1_G1_Audit.md`, folding **AB through AK**. Commit `29249084` on branch `audit/registry-reconcile-ab-ak`, opened as **PR #755** against main. **It is NOT canon until #755 merges.** Confirm merge status at v15 start. Details Sec 3 + Sec 8.
- **Decisions settled in the reconcile (now recorded canon):** severities AD/AE = **P1**, AF/AG/AI = **P0**, AJ/AK = **P1**; **AH = VOID** (letter-slip, retained-not-reused); **no new G1 letter for shared-database coupling** (covered by G1-G + AG + AK-2 — the v13/hazard-doc Sec 5 open question is closed); AK-3/AK-4 corrections recorded as **open PR #752, not landed**.
- **Decision (a) — [3] restart vehicle — RECOMMENDED A2, not yet formally ratified.** Strong recommendation: direct pm2/ecosystem; `Deploy to Production` stays disabled through [3]; AK five-point path (b) becomes post-[3] cleanup. Reasoning Sec 4. **Ratify explicitly at [3] scoping.**
- **No prod-box action. No [3] progress.** Doc-only session. [3] remains its own deliberate session, not primed.

**Main HEAD at this writing:** `285a913a` (#750), with the reconcile on PR #755 (`29249084`). If #755 merged, main has advanced — `git log --oneline -5` for current.

**Supersedes v13 on:** Sec 8.1 (reconcile now folded, was "still owed"). Adds the decision-(a) recommendation framing. v13/v12/v10 canonical elsewhere.

## Sec 1 — How to use this document

Carry-forward from v13 Sec 1 with amendments.

- **Wake-up sequence:** Confirm live state FIRST — `git log --oneline -5` and `gh pr list --state open`. Two things to establish: (1) did **PR #755** (reconcile) merge? (2) what is the disposition of **#751–#754** (box-cred reconcile, AK-3/AK-4 #752, gate-status #753, gate-2.5 green doc #754)? Their merge status changes [3]'s framing.
- **The next BIG step is [3]** — the combined prod-restart window. But two cheap, reversible loops should close first (Sec 4): land the open PRs, and formally ratify decision (a). [3] is its own session.
- **Prod state:** UP via the 06-01 additive hotfix, reboot-durable, MONITORED (AJ live). Config-of-record corrected (Track B Minimal-B, #746); running processes still on hotfix names pending the [3] restart-to-align. Unchanged from v13.
- **Authorities (current-state):** FD-31 Pre-Flight v1.4, the 06-02 PreFlight re-verify (#749), `F-Deploy-G1-AK_ProdDeploy_Workflow_Hazard.md` (#747) + its five-point gate-status addendum, the split-brain hazard doc, the 05-30 incident doc. This handoff is orientation.

## Sec 2 — Keystone status (additive on v13 Sec 2 for F-Deploy-1)

- **F-AUTH-1 / F-App-1 / F-Stats-1 / F-Reg-2 / F-Ward-1 / F-Ward-3 / F-Franchise-1 / F-Sec-3** — all unchanged from v13. Still queued behind F-Deploy-1 full close.
- **F-Deploy-1** — Phase A CLOSED; Phase B G1 CLOSED; Phase B G2 still BLOCKED on FD-31. Within the workstream: the **G1 registry is now reconciled to AK** (on PR #755 — internal-bookkeeping debt cleared once merged). The combined-restart window ([3]) is still the gating prod action (Sec 4). Register FD-1 through FD-37; G1 letters A through AK (AH void). Prod RESTORED + MONITORED, on hotfix topology pending [3].

## Sec 3 — What moved this session (additive on v13 Sec 3)

### Sec 3.15 (NEW) — Registry reconcile folded (PR #755)

The reconcile owed since v11 was executed against `F-Deploy-1_G1_Audit.md` (which had no consolidated registry — A–AA lived inline in §3, classified in §4). A new **§8 Findings Registry (consolidated)** was appended: a status table for AB–AK plus full folded entries, in the audit's inline finding style. Source material: the AB–AK reconcile draft + the AK five-point gate-status addendum (both authored prior). Live-verified against `origin/main` (`285a913a`): #720/#721/#722/#746/#747 merged and citable; **#751–#754 confirmed OPEN** (so AK-3/AK-4, in #752, are drafted-not-landed and recorded as such). Commit `29249084`, PR #755.

**Known incompleteness (carry to v15):** the append added §8 at the bottom but the audit doc's **front-matter table was NOT updated** — it still reads "21 (A through U) / day 1 / 2026-05-15" while §8 says 37 letters. A small internal inconsistency. Fix as a second commit on the #755 branch before merge, or a tiny follow-up after. The four edits: date `2026-05-15…` → `2026-06-02`; status `IN PROGRESS — day 1…` → `CONTENT-COMPLETE (A–AA); registry reconciled to AK (§8)`; findings `21 (A through U)` → `37 letters (A–AK); AH VOID; 36 substantive`; deferred-items `F-Deploy-G1-T` → append `— resolved via AK finding (#747)`.

## Sec 4 — The next big step: [3], with two cheap loops first (additive on v13 Sec 4)

[3] (the combined prod-restart window) is unchanged from v13 as the gating prod action and the true next big step. Before opening it, close two low-stakes, reversible loops:

**Loop 1 — land the open PRs / establish merge state.** Merge #755 (reconcile) and apply the front-matter fix (Sec 3.15). Disposition #751–#754. Knowing what is on main changes [3]'s framing (e.g. whether AK-3/AK-4 are landed).

**Loop 2 — ratify decision (a): the [3] restart vehicle.** RECOMMENDED **A2 — direct pm2/ecosystem; `Deploy to Production` stays disabled through [3]; AK path (b) is post-[3] cleanup.** Reasoning: AK-1/AK-2 (the workflow's `.env`/secret hazards) can be resolved ONLY at cutover (write-only secrets, no safe blind pre-write), so routing [3] through the workflow buys nothing and re-arms FD-36; the #746 ecosystem is already corrected and live-verified, making direct `--env production` the known-good path. Lock this explicitly before [3], not during it.

**Then [3] — its own deliberate session.** v13 Sec 4 + PreFlight Sec 5 require a **FRESH live FD-31 Sec 7 abort re-verify at [3]'s own session start** — do NOT trust #749 (or any prior session): canon row counts vs catalog (72/10/64/53/40/444/605/764), snapshot `episode-control-dev-prefreeze-insurance-20260530` available, verified dump on disk. Mismatch = ABORT. Only if green: ONE gated restart — FD-31 cred rotation + Track B restart-to-align (#746 ecosystem) + Template Studio route fix + post-cutover security sweep (close 0.0.0.0/0 on RDS SGs per AF/AE, encrypt insurance snapshot, move off static keys to instance profile per AD). Re-verify `/health` = canon host + matching counts after; wrong host/counts = ABORT + restore from snapshot.

After [3]: F-Deploy-1 toward full close (G2 §4.2 memory gate still owed — ≤820 MiB on dev EC2, 7-day burn-in), then the downstream keystone sequence resumes.

## Sec 8 — Findings registry (UPDATE v13 Sec 8 + 8.1)

- **Registry reconcile: FOLDED (PR #755), pending merge.** AB–AK are entered in the new consolidated §8 of `F-Deploy-1_G1_Audit.md`. AH recorded VOID. AK confirmed as the letter (P1). The v11→v13 "still owed" debt is cleared as content — closes once #755 merges. This supersedes v13 Sec 8.1's "still owed."
- **Shared-DB-coupling question (v13 Sec 8.1 / hazard Sec 5): CLOSED — no new letter.** Covered across G1-G (compute analog), AG (state), AK-2 (workflow form); fix path is the [3] schema-fork reconciliation (AG's). Minting a letter would re-describe existing findings (cf. AH).
- **AK five-point gate:** unchanged from v13 — NOT satisfied (path (b) partial: AK-3/AK-4 in open #752; AK-1/AK-2 → cutover; AK-5 open/parallel-safe). Live containment is **path (a): `Deploy to Production` disabled**.
- Everything else carries forward unchanged.

## Sec 9 — Trust-the-prior-session checklist (UPDATE v13 Sec 9)

For the v15 author:
- [ ] `git log --oneline -5` + `gh pr list --state open`. **Did PR #755 merge?** If yes, the registry reconcile is canon on main and Sec 8/8.1's "pending merge" is stale. If no, #755 is still open.
- [ ] Disposition #751–#754 (box-cred, AK-3/AK-4 #752, gate-status #753, gate-2.5 #754). If #752 merged, flip AK-3/AK-4 in §8 from "open PR" to "on main."
- [ ] Was the audit-doc front-matter fix applied (Sec 3.15)? If not, it's still owed.
- [ ] Was **decision (a)** formally ratified (Sec 4 Loop 2)? Recorded as RECOMMENDED A2, not yet locked.
- [ ] Confirm whether **[3]** has happened — if it has, prod topology + credentials changed and Sec 2/4 framing is stale.
- [ ] G2 §4.2 memory gate status; S4.2-B/S4.2-C disposition (G2-register).
- [ ] Confirm Episode 1 status (still "Honey Table deprecated, replacement TBD").

## Sec 10 — Outstanding housekeeping (UPDATE v13 Sec 10)

- **PR #755** — merge it; apply the front-matter fix (Sec 3.15). Top of housekeeping.
- **#751–#754** — disposition / confirm merge state.
- **Decision (a) ratification** — Loop 2, before [3].
- **[3] combined-restart window** — the next big prod step; fresh FD-31 abort re-verify at its own session start.
- **AK five-point** — path (a) in force; AK-1/AK-2 at cutover; **AK-5 orphaned-`scripts/deploy/` cleanup is parallel-safe, not [3]-blocked.**
- **G2 §4.2 memory gate** — ≤820 MiB, 7-day burn-in on dev EC2; possibly parallel-able with prod [3] work — confirm sequencing.
- **S4.2-B / S4.2-C** — G2-register, still owed.
- **AJ synthetic canary** + **target-health alarm** (post-[3] / post-Track-B-TG-fix) — deferred follow-ons.
- Carry-forward from v13 Sec 10: `-prod` teardown post-cutover; F-Stats-1 Phase B behind F-Deploy-1 close; parked working-tree items (the `world_events` backfill migration `20260807000000` — reconciliation-gated, do NOT run/commit until cutover; `dev_tables.txt`/`prod_tables.txt`/`countcheck.sql` scratch; parked `src/pages` + `LandingPage.css`); Frontend IA Audit dispositions.

## Sec 11 — Director Brain / Sec 12 — Episode 1 / Sec 13 — C2C (status-quo, unchanged)

All unchanged from v13/v12. Director Brain still deferred (F-Franchise-1 resolution, behind F-Deploy-1 close; `migrations/20260725000000` the migration template). Episode 1 still "Honey Table deprecated, replacement TBD." C2C still deferred until SAL has a following. Status-quo-explicit so silence isn't misread as change.

---
*Prime Studios Audit Handoff v14. Authored 2026-06-02. Additive on v13. Headline: the long-owed G1 registry reconcile is FOLDED (AB–AK into a new consolidated §8 of `F-Deploy-1_G1_Audit.md`) on PR #755 — canon once merged; severities and the shared-DB-coupling "no new letter" decision settled; AK-3/AK-4 recorded as open-PR-#752 not landed. Decision (a) [3]-restart-vehicle RECOMMENDED A2 (direct pm2; workflow stays disabled), ratify at [3] scoping. Two cheap loops (land the PRs, lock decision a) precede the next big step, [3] — the combined prod-restart window, its own deliberate session with a fresh FD-31 abort re-verify required at start, untrusted from #749. Doc-only session, zero box mutations, [3] not primed. v13/v12/v10 canonical for anything v14 does not supersede.*
