# F-Stats-1 Fix Plan v1.2

**CharacterState Sequelize Model Creation + Raw-SQL Consolidation — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.2 |
| **Date** | May 14, 2026 |
| **Author** | JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Supersedes** | v1.1 (committed at HEAD `dbd32f13`) |
| **Predecessor keystone** | F-App-1 (closed 2026-05-14, commit `67c3a8e` on main) |
| **Successor keystone** | F-Deploy-1 (PROMOTED — see Decision #8); then F-Sec-3 |
| **Audit canon reference** | Audit Handoff v8, Decision #54 |
| **Phase A G1 audit reference** | `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` (committed at `6fe0eab`) |
| **Phase A G2 commit** | `178c981` (lives on `claude/start-f-stats-1-g2` and `origin/dev`; PR #684 open as draft) |

---

## What changed in v1.2

This is a revision of plan v1.1 documenting the Phase A G2 incident on May 14, 2026 and the resulting prioritization shift. The substantive plan content (problem statement, scope, phase structure, gate sequence, model spec, risk profile, §12.1-§12.18 findings) is unchanged from v1.1. Updates in v1.2:

- **§9 Decisions Locked:** Decision #8 added — F-Deploy-1 promoted to next-after-F-Stats-1 priority following second deploy-pipeline production outage in 12 hours
- **§11 Plan Version History:** v1.2 row added
- **§12 Findings Beyond Scope:** §12.19 added documenting today's deploy-disruption incident
- **§12 Findings Distribution table:** updated with §12.19

The original v1.1 sections §1, §2, §3, §4, §5.4, §6, §7, §8, §10, Appendix, and §12.1-§12.18 content is unchanged in v1.2. Consult plan v1.1 (committed at HEAD `dbd32f13`) for those sections.

---

## §9 Decisions Locked (UPDATED — Decision #8 ADDED)

Decisions #1 through #7 are unchanged from v1.1. New decision added at v1.2:

### Decision #8 — F-Deploy-1 promoted to next-after-F-Stats-1 priority

Following the Phase A G2 deploy-pipeline incident on 2026-05-14 (§12.19 below), **F-Deploy-1 keystone is promoted to next-after-F-Stats-1 priority**, jumping ahead of F-Sec-3 and F-Tx-1 in the queue.

**Rationale:** Two production outages have occurred within 12 hours from the same architectural deploy issue:

- **F-App-1 §12.15** (2026-05-14 ~06:00 UTC): Workflow ran `pm2 stop all` during cleanup, failed before `pm2 start` → PM2 stopped → 502. Outage duration: 50 minutes.
- **F-Stats-1 §12.19** (2026-05-14 ~17:30 UTC): Workflow restarted PM2 without `--env production` flag → `episode-api` came up on port 3002 instead of 3000 → nginx mismatch → 502. Outage duration: ~10 minutes.

Both incidents share the same root cause: **the dev-deploy workflow runs on the prod backend EC2 and can disrupt prod PM2 state.** Different failure modes, same architectural defect.

**F-Deploy-1 mandate (high-level, formal plan to be authored after F-Stats-1 closes):**

- Investigate why "Auto-merge to Dev" workflow triggers on `claude/*` branch pushes (architectural question: should `claude/*` branches auto-merge to dev?)
- Make the "Deploy to Development" workflow safe to fail mid-flight without disrupting prod
- Ensure PM2 restarts always include `--env production` for the prod-serving process
- Either separate dev EC2 from prod EC2 (architectural), OR make the shared-EC2 deploy idempotent and prod-safe (procedural)

**Order of future keystones:**
1. ✅ F-App-1 — closed
2. ⏳ F-Stats-1 — Phase A G2 done; Phase B/C pending
3. 🔜 **F-Deploy-1 — PROMOTED** (was unscoped)
4. 🔜 F-Tx-1 (§12.13 transactional gap)
5. 🔜 F-Sec-3 (`character_key` drift sweep) — was originally next, now deprioritized
6. 🔜 F-Hist-1 OR expanded F-Sec-3 (§12.15 history-mutation disposition — TBD per Decision #7)

**Locked: 2026-05-14.** After F-Stats-1 keystone closes, F-Deploy-1 starts before any other work.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan authored. Phases A/B/B-2/C structure. 25 gates total. Path 1/2/3 decision tree. §12 findings catalog initialized empty. Committed at HEAD `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed by Phase A G1 audit (commit `6fe0eab`). §5.4 file list corrected with actual filenames. §12 findings populated (§12.1-§12.18). Decision #7 added for §12.13/§12.15 disposition. Committed at HEAD `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 added documenting Phase A G2 deploy-pipeline incident. Decision #8 added promoting F-Deploy-1 to next-after-F-Stats-1 priority. |

v1.2 supersedes v1.1 for all forward references. v1.1 and v1.0 remain in git history.

---

## §12 Findings Beyond Scope (UPDATED — §12.19 ADDED)

Findings §12.1 through §12.18 are unchanged from v1.1. New finding added at v1.2:

### §12.19 — Phase A G2 deploy-pipeline incident: PM2 wrong-port outage

**Severity: HIGH-PRIORITY architectural bug (F-Deploy-1 critical).**

On 2026-05-14 at approximately 17:30 UTC, F-Stats-1 Phase A G2 commit `178c981` was pushed to feature branch `claude/start-f-stats-1-g2`. The push triggered the "Auto-merge to Dev" GitHub Actions workflow, which:

1. ✅ Successfully ran Validate workflow (1m 55s) — tests, lint, route validation, cost audit all passed
2. ✅ Successfully merged the commit into `origin/dev` (the "merge-to-dev" job, 11s)
3. ✅ Successfully built the deployment artifact ("build" job within Deploy-to-Development, 57s)
4. ✅ Successfully ran post-build test ("test" job within Deploy-to-Development, 1m 56s)
5. ❌ **FAILED at the deploy job** (53s elapsed) — PM2 was restarted on the backend EC2 WITHOUT the `--env production` flag

**Effect:** `episode-api` process restarted on port 3002 (the dev default in `ecosystem.config.js`). Nginx prod config (`episode-prod`) proxies to port 3000. Port mismatch → 502 Bad Gateway on `primepisodes.com`.

**Recovery (manual, via SSH to backend EC2):**

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

The `--env production` flag forces PM2 to use the `env_production` block in `ecosystem.config.js`, which explicitly sets `PORT: 3000` matching nginx. Recovery returned `episode-api` to port 3000 and `primepisodes.com` to 401 with F-AUTH-1 headers.

**Total outage duration: approximately 10 minutes.** Recovery diagnosis was sharper than F-App-1 §12.15's 50-minute incident because the port-mismatch root cause was identified quickly via `pm2 info episode-api` + nginx config comparison.

**Post-recovery state verification:**

- ✅ `CharacterState.js` on prod EC2 at `/home/ubuntu/episode-metadata/src/models/CharacterState.js` (1515 bytes, May 14 17:32 UTC)
- ✅ `index.js` on prod EC2 has 4 `CharacterState` references (matching local 4 insertions)
- ✅ PM2 4 processes online with 47-minute uptime, 0 restarts since recovery
- ✅ `curl https://primepisodes.com/api/v1/episodes` returns 401 with F-AUTH-1 headers
- ✅ F-Stats-1 G2 code is genuinely live in production (Path A)

### Comparison with F-App-1 §12.15

Both incidents share the **same architectural root cause**: dev-deploy workflow runs on prod backend EC2 and disrupts prod PM2 state. But the failure modes are distinct:

| Aspect | F-App-1 §12.15 | F-Stats-1 §12.19 |
|---|---|---|
| Date | 2026-05-14 ~06:00 UTC | 2026-05-14 ~17:30 UTC |
| Trigger | Unauthorized agent push to `origin/dev` | Authorized push to `claude/start-f-stats-1-g2`; Auto-merge-to-Dev workflow ran |
| Failure mode | PM2 stopped, never restarted | PM2 restarted but on wrong port |
| Outage cause | No process listening | Process listening on wrong port |
| Outage duration | ~50 minutes | ~10 minutes |
| Recovery | Full PM2 stop + delete + dump rm + fresh start | `pm2 start ecosystem.config.js --env production` |
| Code disposition | F-App-1 commit `6bfd99e` accepted live (Path A) | F-Stats-1 commit `178c981` accepted live (Path A) |

### Why this is Decision #8 territory

After F-App-1, the deploy-pipeline issue was deferred for a future keystone. The first occurrence within 24 hours of F-App-1's closure (literally during the next keystone's first implementation gate) is **disqualifying for further deferral**. Decision #8 promotes F-Deploy-1 to next priority.

### What F-Stats-1 does about §12.19

**Nothing — preserves Path A.** The G2 code is live and prod is healthy. Decision #8 in §9 (above) handles the forward-looking priority shift. Plan v1.3 may follow as F-Deploy-1 work progresses, but plan v1.2 only documents the incident and locks the priority decision.

---

## §12 Findings Distribution (UPDATED)

| Severity class | Count | Findings |
|---|---|---|
| F-Stats-1 implementation guidance | 3 | §12.6, §12.14, §12.17 (plus §12.11 forward-looking) |
| F-Sec-3 / character_key drift work | 8 | §12.1, §12.3, §12.4, §12.5, §12.8, §12.10, §12.12, §12.18 |
| Architectural bugs beyond drift | 3 | §12.13 (transactional gap), §12.15 (history mutation), **§12.19 (deploy pipeline)** |
| Documentation / cleanup | 4 | §12.2, §12.7, §12.9, §12.10 |
| Verification needed | 1 | §12.16 (state_json vs state_after_json columns) |

Total findings: 19 (was 18 in v1.1).

---

## Forward Statement

Plan v1.2 supersedes v1.1. F-Stats-1 status:

- **Phase A G2:** Complete (commit `178c981` live on prod via Path A; PR #684 open as draft)
- **Phase A G6:** In progress (soak started ~17:32 UTC; verify tomorrow morning)
- **Phase B:** Begins after Phase A G6 soak passes (read-call consolidation, route files first)

After F-Stats-1 closes, **F-Deploy-1 starts** per Decision #8 — before F-Sec-3, F-Tx-1, or any other deferred work.

Plan v1.0 (commit `a278a69`), v1.1 (commit `dbd32f13`), and the Phase A G1 audit (commit `6fe0eab`) are preserved in git history. Plan v1.2 (this document) is the canonical plan-of-record going forward.
