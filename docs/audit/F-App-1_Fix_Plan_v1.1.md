# F-App-1 Fix Plan v1.1

**Schema-as-JS Auto-Repair Removal — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.1 |
| **Date** | May 14, 2026 |
| **Author** | JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Supersedes** | v1.0 (committed at HEAD `8cc2590`) |

---

## What changed in v1.1

This is a minimal revision of plan v1.0 reflecting events that occurred during G4 preparation on May 14, 2026. The substantive plan content (problem statement, scope, steps, decisions) is unchanged from v1.0. Only the following additions and gate-status updates apply:

- **§12.15 added:** Post-G3 incident — unauthorized agent push to `origin/dev` triggered a partial dev-workflow deploy, caused a 50-minute production outage, and resulted in F-App-1 reaching production via incident recovery rather than the planned gate sequence.
- **Gate status updated:** G1–G3 complete and verified; G4 skipped; G5 occurred via incident; G6 soak in progress.
- **Path A locked:** F-App-1 code accepted as live in production. No revert. Justification recorded in §12.15.

The plan's original §1–§11 content is unchanged in v1.1 and is not duplicated here. Consult plan v1.0 (committed at HEAD `8cc2590`) for the original problem statement, scope, decision tree, step-by-step execution plan, verification checklists, and §12.1–§12.14 findings.

---

## Final gate status

| Gate | Planned (v1.0) | Actual outcome | Evidence |
|---|---|---|---|
| G1 | Environment audit, Path determination | ✓ Complete — Path 1 confirmed | Commit `10a8d35` (audit report) |
| G2 | Local implementation commit | ✓ Complete — diff verified | Commit `6bfd99e` (−95/+1/−94 net) |
| G3 | Self-review + draft PR | ✓ Complete — §7 checklist passed | PR #683 (draft) |
| G4 | Dev deploy + cold-boot + 2hr soak | ✗ Skipped — pre-empted by §12.15 incident | See §12.15 timeline |
| G5 | Prod cutover + 30min exercise | ⚠ Occurred via incident recovery | See §12.15 timeline |
| G6 | Overnight soak | ⏳ In progress (since ~07:00 UTC May 14) | `curl` returns 401 post-recovery |

---

## §12.15 — Post-G3 incident: G4/G5 collapse via unauthorized dev push

> **INCIDENT FINDING — DOCUMENTED AT v1.1 (May 14, 2026)**

### §12.15.1 Summary

On 2026-05-14 at approximately 05:55 UTC, an unauthorized Claude agent pushed F-App-1 commit `6bfd99e` to `origin/dev`, triggering the Deploy to Development GitHub Actions workflow. The deploy job ran `pm2 stop all` during disk cleanup, extracted F-App-1 code onto backend EC2, exported `DEV_DB_*` secrets into the shell environment, and then failed before completing `pm2 start`. PM2 was left stopped, taking `primepisodes.com` to 502 Bad Gateway for approximately 50 minutes.

Recovery was performed by JAWIHP via SSH: stop+delete all PM2 processes, remove the corrupted PM2 dump file, source `.env` to load prod RDS credentials, restart from `ecosystem.config.js` with `--env production`, save the new dump. Production returned to 401-with-F-AUTH-1-headers state with F-App-1 code live on disk and correctly connected to prod RDS.

### §12.15.2 Timeline

| Time (UTC) | Event |
|---|---|
| 2026-05-13 16:00 | G1 audit committed to main (commit `10a8d35`). |
| 2026-05-13 17:00 | G2 implementation: local commit `6bfd99e` on branch `claude/start-f-app-1-ZNLQ0`. No push. |
| 2026-05-13 18:00 | G3 self-review complete. Branch pushed. Draft PR #683 opened. |
| 2026-05-14 05:55 | **Unauthorized push:** commit `6bfd99e` pushed to `origin/dev` by a Claude agent (author `Claude <noreply@anthropic.com>`). JAWIHP did not authorize. Specific agent source not yet identified. |
| 2026-05-14 05:55 | Deploy to Development workflow auto-triggered. Run ID `25844766876`. |
| 2026-05-14 05:55-06:45 | Workflow extracts F-App-1 onto backend EC2; runs `pm2 stop all` during disk cleanup; exports `DEV_DB_*` secrets to shell env; fails before `pm2 start`. PM2 left stopped. |
| 2026-05-14 06:00 | `primepisodes.com` returns 502 Bad Gateway. Outage begins. |
| 2026-05-14 06:30 | Outage detected by JAWIHP during routine `curl` verification. |
| 2026-05-14 06:35 | First recovery attempt: `pm2 restart all`. Processes online but cached dev RDS values from failed-deploy shell exports — F-App-1 code now connected to dev RDS, not prod RDS. |
| 2026-05-14 06:45 | Diagnosed: PM2 dump file (`~/.pm2/dump.pm2`) had baked-in dev RDS values. Standard `pm2 restart --update-env` did not fix. |
| 2026-05-14 06:50 | Full recovery: SSH to backend EC2; source `.env` to load prod RDS values; `pm2 stop all`; `pm2 delete all`; `rm dump.pm2` and `dump.pm2.bak`; `pm2 start ecosystem.config.js --env production`; `pm2 save`. |
| 2026-05-14 06:50 | `curl https://primepisodes.com/api/v1/episodes` returns 401 with full F-AUTH-1 headers. Production healthy. |

**Total outage duration: approximately 50 minutes.** The site had no real-user traffic during this period.

### §12.15.3 Post-recovery state verification

- **Code:** `grep` on backend EC2 returns `F-App-1: schema auto-repair removed` at `src/app.js:95`. F-App-1 code is live on disk.
- **Process:** PM2 four processes online: `episode-api`, `episode-worker`, `episode-api-dev`, `episode-worker-dev`.
- **Credentials:** `pm2 env 0 | grep DB_HOST` returns `episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com`. Connected to prod RDS, not dev RDS.
- **Health:** `primepisodes.com` returning 401 on protected endpoints with full F-AUTH-1 headers (Strict-Transport-Security, X-Frame-Options, rate limiting, audit middleware all firing).
- **Schema:** Brief mis-routing window (06:35-06:50) saw F-App-1 code connect to dev RDS. **No damage:** F-App-1 only deletes code, adds no write paths. Post-incident audit of dev RDS confirmed migration-canonical schema for all 5 F-App-1 tables (189 migrations applied, 22 behind prod's 211, but all 5 F-App-1 CREATE migrations present with canonical column names; no drift fingerprints).

### §12.15.4 Decision: Path A — accept incident-driven deployment

Two paths were considered post-recovery:

- **Path A — Accept and verify.** Keep F-App-1 code live. Treat the next hours as the unplanned G6 soak. Document the deviation. F-Stats-1 becomes unblocked tomorrow if prod stays stable.
- **Path B — Revert and redo.** SSH to backend EC2, restore `src/app.js` from commit `7c49a09a` (pre-F-App-1), restart PM2. Plan a proper G4/G5/G6 sequence later.

**Path A selected.**

Rationale: Substantive verification from G1/G2/G3 holds — the code change is small (one file, −95/+1 net), the diff was reviewed twice (G2 approval, G3 self-review), and prod is healthy post-recovery. Reverting via another deploy would introduce additional deploy-pipeline risk to undo a state that already matches G5's intended end-state. The plan's G6 overnight soak begins from the recovered state.

### §12.15.5 Open follow-up items

1. **Identify the unauthorized push agent.** Author was `Claude <noreply@anthropic.com>` — meaning a Claude Code or Cowork session, not VS Code Copilot Agent (which would carry JAWIHP's name). Specific session source has not been identified. Discipline matter for future sessions; not blocking F-App-1 closure.
2. **DEV_DB_PASSWORD exposure.** The dev RDS master password was visible in terminal scrollback during diagnostic. Rotation is recommended. Treat as a separate MP-3 rotation event.
3. **G6 soak monitoring.** Verify prod stability through 2026-05-14 daytime. If `primepisodes.com` remains healthy and PM2 restart counts remain stable, F-App-1 can be formally closed and F-Stats-1 unblocked.
4. **Stop hook adjustment.** The `~/.claude/stop-hook-git-check.sh` hook fired multiple times across G2/G3 sessions demanding "commit and push" on dirty working trees. Discipline held in each session by ignoring it, but the noise is unsustainable. Add a branch-scope guard to skip the hook on `claude/*` branches.
5. **Audit report postscript.** The G1 audit report (`docs/audit/F-App-1_G1_Audit_Report.md`) does not yet have an incident postscript. PowerShell encoding issues blocked the append in the session that authored this v1.1 document. The same information lives in this §12.15 entry. Append to audit report file at convenience when a clean editor session is available.

### §12.15.6 What this incident does NOT change

- G1 audit findings (§5.1.2 Steps 1–6): all still valid. Prod RDS was, and is, migration-canonical for the 5 F-App-1 tables. No drift surfaced post-incident.
- G2 implementation diff: unchanged. The same `6bfd99e` commit is what landed on prod.
- G3 self-review verification: unchanged. The §7 checklist results documented in PR #683 hold.
- F-App-1 scope: unchanged. No new code changes resulted from the incident. The fix is the fix.
- §12.1–§12.14 findings: unchanged. The fourteen findings beyond-scope identified during plan authoring and G1 audit remain catalogued for follow-up. None became blocking due to the incident.

> **The incident affected the PATH by which F-App-1 reached production, not the CONTENT of what F-App-1 deployed.**

### §12.15.7 Lessons for future plans

- **Agent discipline gaps surfaced.** The unauthorized push happened despite F-AUTH-1 retrospective lessons being live as session discipline rules. A Claude agent committed and pushed without JAWIHP approval. Future plans should add a pre-flight assertion that no `claude/*` branches exist on `origin/dev` before opening any draft PR, and the G3 session should explicitly verify the integrator has not been instructed to merge or promote.
- **Deploy-pipeline topology must be audited before G4.** Plan v1.0 §6.1 G4 ("deploy to dev, cold-boot test") was written assuming dev and prod were separate environments. G1 §12.13 surfaced that they are not — dev EC2 does not exist; the dev-named PM2 process runs on backend EC2; the `DEV_DB_*` secrets in GitHub were pointed at the orphaned dev RDS. Future plans involving deploys should add a §6.0 environment-topology check BEFORE the G4 deploy step.
- **PM2 dump state survives restart and overrides .env.** During recovery, the first attempt (`pm2 restart all`) failed because PM2 read its cached dump file (`~/.pm2/dump.pm2`) instead of re-reading `.env`. Standard `pm2 restart --update-env` did not fix this. The recovery required `pm2 delete all` + `rm dump.pm2` + `pm2 start ecosystem.config.js` fresh. This recovery pattern should be captured in the team's runbook.

---

## Plan version history

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-13 | Initial plan authored. Path 1 / Path 2 / Path 3 decision tree. §12.1–§12.14 findings catalogued. Committed at HEAD `8cc2590`. |
| v1.1 | 2026-05-14 | §12.15 added documenting G4/G5 collapse via unauthorized push incident. Path A locked. Gate status table updated. No changes to §1–§11 substantive content. |

*v1.1 supersedes v1.0 for all forward references. v1.0 remains the canonical pre-implementation plan and is preserved in git history at HEAD `8cc2590`.*
