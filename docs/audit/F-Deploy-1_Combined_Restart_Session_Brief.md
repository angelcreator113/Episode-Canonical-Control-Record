# F-Deploy-1 — Combined Restart ([3]) Session Brief

**Authored 2026-06-03. Scoping artifact for the [3] combined prod-restart window. Additive on Handoff v15, Fix Plan v1.9 (FD-38), and Fix Plan v1.10 (decision (a) ratified). Authorities for exact step commands: the Combined Restart Master Runbook (FD-38-aligned via #759) and FD-31 Pre-Flight v1.4 — this brief does not replace them.**

| | |
|---|---|
| **Purpose** | Open the [3] execution session against a written scope, not a chat thread. |
| **Status** | PRE-SESSION SCOPE. Authorizes nothing. |
| **Box state** | FROZEN + DEGRADED. "Do not reboot" stands. No action authorized by this document. |
| **Gate state** | FD-31 OPEN (schema-fork + degraded-state legs). Phase B G2 §4.2 BLOCKED on FD-31. |
| **Restart vehicle** | A2 — direct pm2/ecosystem; `Deploy to Production` stays disabled through [3] (ratified, Fix Plan v1.10). |
| **Register** | FD-1 through FD-38. |

## Sec 0 — What this brief does and does not do

Does: state what the [3] session contains, the order it must run in, the abort conditions, the rollback anchor, and what is explicitly out of scope.

Does NOT: authorize, schedule, or prime any prod-box action; rotate credentials; restart pm2; reboot; or move FD-31 or §4.2. [3] remains its own deliberate, separately-authorized session. Path A discipline: a scope is not an authorization.

## Sec 1 — What [3] is

One gated prod-restart window, run as its own session, via vehicle A2 (direct pm2/ecosystem; production-deploy workflow stays disabled). It bundles three mutations plus a post-cutover security sweep, behind one read-only abort gate, with snapshot restore as rollback.

On clean close, [3] closes the two open FD-31 legs (schema-fork + degraded-state). That close is what unblocks Phase B G2 §4.2. [3] is therefore the gate-opener for §4.2 — not the other way around.

## Sec 2 — The integrity comparator is FD-38, not v14's number string (read this before scoping the gate)

Handoff v14 Sec 4 names the abort fingerprint as an eight-number string `72/10/64/53/40/444/605/764`. **That is stale. FD-38 (Fix Plan v1.9) governs.** Two corrections:

1. **Seven-table fingerprint, unfiltered `count(*)`** — the integrity comparator:

   | Table | Unfiltered count(*) |
   |---|---|
   | shows | 10 |
   | episodes | 72 |
   | assets | 64 |
   | world_events | 53 |
   | wardrobe | 40 |
   | social_profiles | 444 |
   | franchise_knowledge | 605 |

   Plus `current_database()` (= `episode_metadata`) and `inet_server_addr()` (= `10.0.20.224`) asserted in the same read. Run via direct read-only psql.

2. **`ai_usage_logs` is excluded from the hard gate.** It is an append-only volatile counter (the likely source of v14's eighth number, `764`). Including it would almost certainly trigger a **false abort**, because it moves on its own. Informational only.

3. **`/health` is liveness-only.** It filters `WHERE deleted_at IS NULL` (`app.js:313-316`) and will report ~1 show / 18 episodes — intentional, SAL is the sole live show; the other rows are soft-deleted scratch/test data. `/health` confirms the box is up (200 + database:connected); it is NOT the counts comparator. v14's "re-verify /health = matching counts" is superseded on the counts axis.

(Consistency note: franchise_knowledge is 605 total / 597 live — the 8-row gap is the soft-deleted backlog in Sec 6. Soft-deletes do not move the unfiltered count, so they do not perturb the fingerprint.)

## Sec 3 — Mandatory order

### Step 0 — Read-only abort gate, FIRST, before anything mutable

Fresh and live this session. Do NOT trust #749 or any prior run. Confirm four things current:

1. FD-38 seven-table fingerprint matches via psql.
2. Identity asserts resolve to canon (`current_database()` = `episode_metadata`, `inet_server_addr()` = `10.0.20.224`).
3. Snapshot `episode-control-dev-prefreeze-insurance-20260530` exists.
4. Verified dump on disk.

Any mismatch = ABORT, touch nothing. The counts-match check is itself an abort condition, not a formality.

### Steps 1–3 — Mutations, only if Step 0 is green

1. **FD-31 credential rotation** — canon `-dev` DB password (exposed in-session and in the hotfix env) and AWS static keys. Least-margin step; wants the freshest attention in the window, not its tail. (This is why A2 routes around the workflow: write-only secrets cannot be safely pre-written, so the workflow buys nothing and re-arms FD-36.)
2. **Track B restart-to-align (#746 ecosystem)** — resolves the degraded-state leg: port 3002→3000, the route-loading bug, and the `pm2 save`/dump. The running process is up via an additive hotfix on 3000, but the saved pm2 dump still perpetuates the wrong-port topology that caused the multi-day 502 — a reboot today still comes up wrong. [3] must fix the **saved** state, not only the running state.
3. **Template Studio route fix.**

### Step 4 — Post-restart verification

Re-run the FD-38 integrity gate (psql counts + identity). Confirm `/health` = 200 on the canon host. Wrong host or mismatched counts = ABORT + restore from snapshot.

### Step 5 — Security sweep

- Close 0.0.0.0/0 on the RDS security groups (AF/AE).
- Encrypt the insurance snapshot (AD-adjacent). **Note: it is currently unencrypted and it is the rollback anchor** — handle before it is ever needed under pressure.
- Move off AWS static keys to the instance profile (AD).

## Sec 4 — What does NOT block [3]

- **#752 (AK-3/AK-4 workflow corrections) — open, and that is fine.** A2 deliberately routes [3] around the production-deploy workflow, so an open #752 does not gate the cutover. This is the entire reason decision (a) landed on A2.
- **AK-1/AK-2** resolve *at* cutover (write-only secrets).
- **AK-5** (orphaned `scripts/deploy/` cleanup) is parallel-safe.

## Sec 5 — Pre-conditions before opening the window

1. A genuinely uninterrupted block — no second developer mid-deploy, no "between calls."
2. Rollback path read and understood as one move (snapshot restore), not a discovery exercise under pressure.

Both follow the read-only-entry-ritual pattern: confirm the safety net is real and current before any irreversible step.

## Sec 6 — Explicitly out of [3] scope (do not pull in)

Non-gating SAL launch-housekeeping items from the FD-38 backlog. They do not touch the restart and must not expand the window:

- SAL show row placeholder description ("ffff…") — fix before user-facing launch.
- Stale denormalized `shows.episode_count=0` — reconcile before user-facing launch.
- 8 soft-deleted `franchise_knowledge` rows — review before Director Brain / `franchise_brain` consolidation.

## Sec 7 — Two items to verify against the runbook before executing

This brief is scope, not exact procedure. Confirm against the Combined Restart Master Runbook / Pre-Flight v1.4:

1. The exact credential-rotation command sequence, and whether snapshot encryption is a prerequisite of the sweep or a follow-on.
2. Whether the runbook already carries the FD-38 comparator (seven-table, `ai_usage_logs` excluded, /health demoted) or still shows v14's eight-number list. #759 should have aligned it — confirm it actually did before trusting the runbook's gate section.

## Sec 8 — Risk shape (one paragraph)

The read-only abort gate plus the verified snapshot make the data axis recoverable; a mismatch at Step 0 or Step 4 aborts to a known restore point. The credential rotation (Step 1) is the step with the least margin and no clean mid-step rollback, so it gets the freshest attention in the window. Everything else (route fix, Track B align, SG changes) is reversible. The dominant failure mode is not data loss — it is opening the window without a current Step 0, or letting scope (Sec 6) stretch the window past the uninterrupted block in Sec 5.

---
*F-Deploy-1 Combined Restart ([3]) Session Brief. Authored 2026-06-03. Scoping only — authorizes no prod-box action. FD-31 OPEN; §4.2 BLOCKED; box FROZEN. Integrity comparator: FD-38 seven-table unfiltered fingerprint + identity asserts; /health liveness-only.*
