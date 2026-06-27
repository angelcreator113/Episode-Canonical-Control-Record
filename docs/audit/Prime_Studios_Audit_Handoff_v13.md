# Prime Studios Audit Handoff v13

**Authored 2026-06-01 (later same day as v12). Additive on v12; v12/v11/v10 remain canonical for anything v13 does not supersede.**

## Sec 0 -- Front matter

**What changed v12 -> v13 (all 2026-06-01, a second working session after v12 was authored):**
- **F-Deploy-G1-AJ monitoring is now LIVE** (was plan-only at v12). The recommended ELB 5xx alarm + dedicated SNS topic were created and verified. Prod has availability alerting for the first time -- the gap that hid the multi-day 502 is closed. Details Sec 3.13.
- **Track B Minimal-B is EXECUTED** (config layer). `ecosystem.config.js` on main now describes the verified-working topology (PR #746). F-Deploy-G1-H is killed at the source: a deploy without `--env production` can no longer land prod on the dev port. NO prod-box action -- config-of-record only; the running processes and dump are unchanged. The restart-to-align remains deferred to the combined window. Details Sec 3.14.
- **New finding F-Deploy-G1-AK (P1, provisional letter)** -- the `Deploy to Production` workflow, if manually run today, would re-arm FD-36 and disrupt the live topology. Five-part cluster. Filed as its own doc (PR #747). This is the headline of the session: **it materially expanded [3]'s scope.** Details Sec 8 + the finding doc.
- **[3] the combined-restart window is now BIGGER.** v12 framed it as FD-31 cred rotation + Track B restart-to-align + route fix. v13 adds: it must ALSO satisfy the AK five-point audit gate before firing (or disable `Deploy to Production` for the window). Sec 4.

**Day's PR run (v13 session):** #746 (Track B Minimal-B ecosystem fix), #747 (F-Deploy-G1-AK finding). Plus the AJ monitoring AWS writes (no PR -- direct CloudWatch/SNS, see Sec 3.13).

**Main HEAD at this writing:** `6e4f6986` (#747). Goes stale on next merge -- `git log --oneline -1 main` for current.

**Supersedes v12 on:** Sec 2 (F-Deploy-1 sub-status -- AJ live, Track B config-executed), Sec 4 (next-action framing -- [3] scope expanded by AK). Adds Sec 3.13/3.14, a new finding (Sec 8), and updates the trust-the-prior-session checklist (Sec 9). v12/v11/v10 canonical elsewhere.

**Status-quo-explicit convention carried forward:** Director Brain, Episode 1, C2C unchanged -- see v12 Sec 11/12/13; nothing added this session.

## Sec 1 -- How to use this document

Carry-forward from v12 Sec 1 with amendments. The world moved again on 2026-06-01 (second session).

- **Wake-up sequence:** The true next EXECUTABLE prod action remains the **combined restart window** ([3]) -- BUT it is now gated on the AK five-point audit (Sec 4) in addition to the FD-31/Track B work v12 named. Before [3] touches anything, re-verify the FD-31 Sec 7 abort checks LIVE (this is the plan's own requirement, not optional) AND clear or neutralize AK.
- **Prod state:** UP via the 06-01 additive hotfix, reboot-durable, NOW MONITORED (AJ live, Sec 3.13). Config-of-record corrected (Track B Minimal-B, #746) but running processes still on the hotfix names -- the file and the running state agree in role/port, differ in process name (`episode-api-prod-hotfix`@3000 = prod; `episode-api`@3002 = dev). The restart-to-align that makes names match is deferred to [3].
- **Authorities (current-state):** the FD-31 Pre-Flight v1.4, Track B v0.2, the 2026-06-01 incident doc, AND the new `F-Deploy-G1-AK_ProdDeploy_Workflow_Hazard.md`. This handoff is orientation.

## Sec 2 -- Keystone status (SUPERSEDES v12 Sec 2 for F-Deploy-1)

- **F-AUTH-1 / F-App-1 / F-Stats-1 / F-Reg-2 / F-Ward-1 / F-Ward-3 / F-Franchise-1 / F-Sec-3** -- all unchanged from v12. Still queued behind F-Deploy-1 full close.
- **F-Deploy-1** -- ADVANCED further this session. Phase A CLOSED; Phase B G1 CLOSED; Phase B G2 still BLOCKED on FD-31. Within the FD-31/topology workstream: **AJ monitoring LIVE** (Sec 3.13), **Track B Minimal-B config-executed** (#746, Sec 3.14), **new finding AK filed** (#747, Sec 8). The combined-restart window ([3]) is the gating prod action and its scope grew (Sec 4). Register FD-1 through FD-37 (no new FD this session -- AK is a G1-registry finding, not an FD decision). Prod RESTORED + MONITORED, on hotfix topology pending [3].

## Sec 3 -- What moved this session (additive on v12 Sec 3, which carried v11's 3.1-3.12)

### Sec 3.13 (NEW) -- AJ monitoring went live

The v12 AJ plan (#743) was implemented. Created: SNS topic `episode-metadata-availability-alerts`
(ARN `arn:aws:sns:us-east-1:637423256673:episode-metadata-availability-alerts`), email
subscription to `evonifoster@yahoo.com` (CONFIRMED), and CloudWatch alarm
`prod-availability-elb-5xx` on `HTTPCode_ELB_5XX_Count` for the prod ALB
(`app/primepisodes-alb/75ba68945d7aa0bf`), threshold >= 5 in a 5-min window, alarm+OK
actions both to the new topic. Verified: subscription Confirmed (real ARN, not pending),
alarm state OK, dimension = the real LB. The 06-01 failure mode (ELB 502, nothing healthy
on 3000) would now alert within ~5 min.

**Known limitation (recorded, deferred):** `HTTPCode_ELB_5XX_Count` only fires when there
IS traffic generating 5xx; a true zero-traffic dead window would not trip it. The synthetic
canary (AJ Sec 4 follow-on) closes that gap and remains deferred -- NOT scope creep, a named
follow-on. The target-health alarm (AJ option 1) remains blocked until Track B corrects the
TG port 3002->3000 (it would watch the wrong port today).

### Sec 3.14 (NEW) -- Track B Minimal-B executed at the config layer

`ecosystem.config.js` (#746) was corrected to the verified-working topology: the prod app's
DEFAULT `env` block now binds 3000/production (was 3002 -- the F-Deploy-G1-H defect that, via
FD-35's save, caused the 06-01 outage). 4 apps folded to 3: `episode-api-prod-hotfix` (prod,
3000, name kept per DB-1), `episode-worker` (one shared, DB-2), `episode-api` (dev, 3002).
The prod block was verified against the LIVE running hotfix env (`pm2 env 3`) before commit --
PORT/NODE_ENV/APP_NAME/ALLOWED_ORIGINS all matched; API_VERSION + HOST added back per the
original config intent (verified-safe, take effect only at next restart). DB-3 confirmed:
`sharedEnv` loads `.env` via explicit `__dirname` path, so `--env production` comes up
DB-connected. **No running process, dump, or nginx touched.** The deferred restart-to-align
is [3]'s.

## Sec 4 -- The next prod action: [3] combined-restart window (SUPERSEDES v12 Sec 4 scope)

v12 scoped [3] as: FD-31 credential rotation + Track B restart-to-align + route-bug fix, one
gated restart. **v13 adds a mandatory precondition: the AK five-point audit gate.**

[3] MUST NOT begin until BOTH:
1. **FD-31 Sec 7 abort checks re-verified LIVE at session start** -- canon row counts vs catalog
   (72/10/64/53/40/444/605/764), snapshot `episode-control-dev-prefreeze-insurance-20260530`
   available, verified dump on disk. Mismatch = abort. (Plan requirement; do not trust from any
   prior session -- including this one.)
2. **AK gate cleared** -- EITHER disable `Deploy to Production` for the window, OR audit-and-correct
   all five AK sub-points (see Sec 8 + finding doc): PROD_DB_HOST = canon; PRODUCTION_DATABASE_URL =
   same canon DB; `.env` DB_HOST write removed/guarded; `deploy-production.sh` PM2 names reconciled
   to #746; nginx-delete failure path neutralized. If [3] USES the workflow as its restart vehicle,
   the full audit is mandatory.

Then, in ONE restart: FD-31 cred rotation (rotate exposed canon `-dev` password, write to `.env`)
+ Track B restart-to-align (running processes onto the #746 ecosystem definitions) + Template Studio
route-bug fix + the post-cutover security sweep (close 0.0.0.0/0 on RDS SGs, encrypt insurance
snapshot, move off static AWS keys to instance profile). Re-verify `/health` shows canon host +
matching counts after; wrong host/counts = ABORT + restore from snapshot.

After [3]: F-Deploy-1 can move toward full close (G2 Sec 4.2 memory gate still owed -- <=820 MiB on
the dev EC2, 7-day burn-in), then the downstream keystone sequence resumes (F-AUTH-1 -> ... ->
Director Brain -> F-Sec-3). Unchanged from v12/v11.

## Sec 8 -- Findings registry (CARRY-FORWARD v12 Sec 8, + ONE new finding)

- **F-Deploy-G1-AK (NEW, P1, provisional letter)** -- the `Deploy to Production` workflow drifted
  from live reality while sitting un-run; a manual invocation now performs unsafe writes/restarts.
  Five sub-findings: **AK-1** `.env` DB_HOST overwrite from stale `PROD_DB_HOST` re-arms FD-36;
  **AK-2** migrations run against `PRODUCTION_DATABASE_URL` while runtime points at `PROD_DB_HOST`
  (two different secrets = encoded split-brain); **AK-3** PM2 stop/delete/start uses names that
  drifted from roles and from #746 (would disrupt dev, miss prod, poison the dump); **AK-4** nginx
  redeploy reintroduces the risk class Track B excluded (with a prod-vhost-delete failure path);
  **AK-5 (sub)** five deploy scripts, one wired, four orphaned. Full doc:
  `docs/audit/F-Deploy-G1-AK_ProdDeploy_Workflow_Hazard.md` (#747). Disposition: hard blocker on
  [3] with a satisfiable five-point gate. Cited to `deploy-production.yml` +
  `.github/scripts/deploy-production.sh`.
- Everything else carries forward unchanged.

### Sec 8.1 (UPDATE) -- Registry reconcile: STILL OWED, now owes AK too

v12 Sec 8.1 carried the v11 reconcile task: fold AB-AG, AI, AJ into `F-Deploy-1_G1_Audit.md`'s
registry (which tails at AA), record AH as void. **v13 adds AK to that list.** The reconcile set
is now: AB-AC (FD-29/30), AD-AF (G2 v1.2 contract), AG (split-brain), AI (per register), AH (VOID),
AJ (no monitoring -- now LIVE per Sec 3.13 but the FINDING still needs folding), **AK (prod-deploy
hazard, provisional -- confirm letter at reconcile)**. Still deferred deliberately; still owed; a
good low-stakes parallel-safe task.

## Sec 9 -- Trust-the-prior-session checklist (UPDATE v12 Sec 9)

For the v14 author:
- [ ] Read v12 + this v13 for deltas; v11/v10 beneath for anything unsuperseded.
- [ ] Confirm whether [3] (combined restart window) has happened -- if it has, prod topology +
      credentials changed and Sec 2/4 framing is stale.
- [ ] Confirm the AK gate disposition before [3] -- workflow disabled, or five points audited?
- [ ] Confirm AJ's synthetic-canary follow-on (still deferred?) and whether the target-health alarm
      was added post-Track-B.
- [ ] Do the registry reconcile (Sec 8.1) -- still owed from v11, now owes AK.
- [ ] Confirm Episode 1 status (still "Honey Table deprecated, replacement TBD").

## Sec 10 -- Outstanding housekeeping (UPDATE v12 Sec 10)

- **[3] combined-restart window** -- the true next prod action; scope now includes the AK gate (Sec 4).
- **AK five-point audit** -- prerequisite to [3] (or disable the workflow for the window).
- **Registry reconcile** (Sec 8.1) -- owes AB-AG, AI, AJ, AK; AH void. Parallel-safe, low-stakes.
- **AJ synthetic canary** -- deferred follow-on (zero-traffic dead-window coverage).
- **Target-health alarm** -- blocked until Track B corrects TG port (post-[3]).
- Carry-forward from v12 Sec 10: `-prod` teardown post-cutover; F-Stats-1 Phase B behind F-Deploy-1
  close; parked working-tree items (the `world_events` backfill migration -- still reconciliation-gated,
  do NOT run/commit until cutover; `dev_tables.txt`/`prod_tables.txt` scratch; parked `src/pages` +
  `LandingPage.css`); Frontend IA Audit dispositions.

---
*Prime Studios Audit Handoff v13. Authored 2026-06-01, second session after v12. Additive on v12.
Headline: AJ monitoring went LIVE (prod finally has eyes), Track B Minimal-B executed at the config
layer (#746 -- F-Deploy-G1-H killed at source, no box action), and a new five-part finding
F-Deploy-G1-AK (#747) surfaced -- the prod-deploy workflow can re-arm FD-36 and disrupt the live
topology, materially expanding [3]'s scope. [3] (the combined-restart window) is now gated on BOTH
the live FD-31 abort-check re-verify AND the AK five-point audit. Three landings this session, zero
prod-box mutations, all additive/reversible. Registry reconcile still owed (now + AK). v12/v11/v10
canonical for anything v13 does not supersede.*
