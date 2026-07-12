# F-Deploy-1 Fix Plan v1.34

**THE FD-45 REMEDIATION WINDOW EXECUTED AND CLOSED 2026-07-11/12 (one continuous ratified session). FD-56 CLOSES BY DISSOLUTION — FD-59 minted below as the dissolution record: master rotated as the window's final step and nothing app-facing noticed, because by then nothing app-facing authenticated as master. FD-58 CLOSES — the scoped secret-read policy was written and verified end-to-end from the dev box. FD-45's dev leg is DONE; its canon leg (canon db_password rotation) remains OPEN, explicitly out of this window's scope per v1.33 §3.2, owed its own gate. Register tail at close: FD-45 (canon leg only).**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.33 (merged #919, e637b7e4) |
| **Author date** | 2026-07-12 |
| **Status** | v1.34 — as-executed record |
| **Gate effect** | Records execution; mints FD-59; closes FD-56 (dissolution) and FD-58 (executed); moves FD-45 dev leg to done. Records the freeze amendment's ratification and its expansion (deliberate prod blip, maintainer-ruled option (a)). Authorizes nothing further; the freeze posture for prod actions outside ratified gates resumes in full at window close. |

**Basis (live reads 2026-07-12):** `git log --oneline -1 origin/main` -> e637b7e4 (v1.33, #919); `gh pr list` -> none. Execution exhibits captured in-channel 2026-07-11/12 and itemized below; where an exhibit is a negative proof, the failing output is the exhibit.

## S1 Pre-window gate (v1.33 S4.1) — executed, EXTENDED by maintainer ruling

- Role created prior sitting (07-10 mid-flight, reconciled by live read): episode_app_dev — rolsuper=f, rolcreatedb=f, rolcanlogin=t; CONNECT/USAGE/CREATE verified.
- **Two credential burn events, both remediated at zero cost (no consumers existed):** (1) last-command metadata echo of the CREATE ROLE line — a side channel that defeats typing discipline by reporting the raw command; (2) a Set-Clipboard line bearing the fresh value typed into psql, landing it in transcript. Rotation of record: \password episode_app_dev as postgres, hidden prompt, verified by fresh login from the dev box. **Guard canon minted from these:** (a) prefer \password <role> over ALTER ROLE ... PASSWORD for interactive rotations — it makes the burn class structurally impossible; (b) after any credential-bearing command, run a trailing no-op so last-command metadata is harmless; (c) prompt-check before every paste — shell commands only at shell prompts, SQL only at psql prompts.
- W1 (SG ingress TCP 5432 from 98.93.190.74/32 into sg-002578912805d1930): **found live by read, not fired** — provenance inferred (prior sitting), not known. Revoke-or-ratify obligation carried OPEN with no birth certificate; CloudTrail holds the authoritative timestamp if wanted. **Adjacent observation, deferred by name:** the same SG carries a VPC-wide 10.0.0.0/16 ingress on 5432 — AF-class candidate, parked for the SG review, not acted on here.
- W2: postgresql-client 14.23 installed on dev box (standing confirm).
- Dev-box verification (probe form): identity episode_app_dev | 98.93.190.74; DDL probe CREATE/ALTER/DROP clean; **crux quantified:** 143/143 public tables postgres-owned, SequelizeMeta permission-denied.
- **Maintainer ruling (2026-07-11, on the record): gate remains OPEN, extended** — probe-accept-with-recorded-gap REJECTED; table-level grants moved PRE-window as their own additive gate; boot-migration check added; re-verify required. Rationale: the gate's purpose is a credential proven against actual consumers; green-by-redefinition is the FD-52-species failure.
- GRANT leg (as postgres, identity-checked postgres | episode_metadata | 10.0.20.224): SELECT/INSERT/UPDATE/DELETE on all tables, USAGE/SELECT on all sequences, plus ALTER DEFAULT PRIVILEGES for both classes — the future-objects guard. Four statements, four expected responses. **Lesson recorded:** the first attempt ran in the app-user's own session and denied cleanly; identity checks must include current_user, not just database/host.
- Boot-migration check: no migrate-on-boot anywhere — npm start and all three pm2 apps launch src/server.js / workers/start.js directly. Runtime CRUD sufficient for the flip; migration DDL/ownership deferred off the critical path (owed at a future gate; ownership transfer on RDS is NOT trivially non-breaking — master is not superuser).
- Re-verify from dev box as episode_app_dev: SequelizeMeta count 219 (previously denied); rollback-wrapped UPDATE on episodes clean. **GATE GREEN.**

## S2 Window execution (steps 0-8, amended live where recorded)

**Confirm of record:** maintainer's composite confirm accepted the draft's four explicit elements — freeze amendment ratified for the .144 .env writes and restarts; downtime accepted per **option (a)** ruling (full flip, prod blip included); executor = maintainer's keyboard, single channel; go. The (a) ruling resolved the shared-.env landmine the draft surfaced: all three pm2 apps build from one sharedEnv; a dev-only flip would have planted a delayed prod outage at master rotation.

- **Step 0 (window-open reads):** three trees found, not two — episode-metadata-deploy inspected, no .env, EXCLUDED. Worker found STOPPED (4 restarts) — amended shape: worker stays stopped, inherits app-user creds at whatever future gate starts it; its stale baked env died harmlessly at rotation. Collision gate HELD: both running apps in-memory postgres @ episode-control-dev, matching both .envs. Premise confirmed: prod-hotfix runs against the dev RDS as master.
- **Step 2:** both trees' .env -> episode_app_dev + login-proven password (value proven by fresh psql login before the edit; in-editor paste only).
- **Step 3:** **finding of record — pm2 restart --update-env is INSUFFICIENT for ecosystem-managed apps whose env bakes from dotenv.** The canary restart produced a mixed identity (stored DB_USER=postgres + fresh app-user password -> auth-fail loop as postgres). Smoking-gun exhibit: post-restart pm2 env still showed DB_USER: postgres. **Flip mechanism of record: pm2 delete + pm2 start ecosystem.config.js --only <app>.** Dev then green (GenWorker querying, CFO 5/100 -> 86/100, surviving critical = pre-existing dependency vulns). Prod flipped by the proven mechanism: episode_app_dev | production | 3000, clean boot, CFO 88/100. **Deviation recorded, not fixed: prod relaunched in cluster mode (was fork); instances:1 so functionally equivalent; mode-revert is a future config decision.** pm2 save deliberately NOT run — dump.pm2 is FD-45's minted surface.
- **Step 4:** episode-metadata/dev/database created (ARN ...-NQKsdP, version 5975d268) — **born clean with app-user credentials**, the decisive row of v1.33 S2's table executed. Temp seed files shredded, verified absent. (Notepad .txt-extension hazard recorded; JSON validity later proven by parse.)
- **Step 5:** DEV_DB_PASSWORD overwritten via gh secret set, masked stdin — v1.29 S4.1 residual ambiguity retired.
- **Step 6 — deviation, maintainer ruling (b):** dev-box /home/ubuntu/.env found to be a single orphaned DB_PASSWORD= line, no consumer on the box. Rewrite-per-plan would have created a fresh unmanaged at-rest copy; **PURGED instead** (truncated, 0 bytes proven). v1.29-era assumption corrected by live read.
- **Step 7 (FD-58 executes):** dev-database-secret-read put on episode-dev-backend-role — scoped to the single secret ARN, GetSecretValue+DescribeSecret only, additive-second-policy per v1.32 P1 precedent. **Verification lesson:** first verify ran locally under admin credentials — proves nothing about the role; the exhibit of record is the dev-box read under the instance profile (awscli installed for it): keys valid, username: episode_app_dev. Policy temp file shredded.
- **Step 8:** master rotated via modify-db-instance --master-user-password (SecureString bridge, value never on a bare command line), available, pending empty. **Positive proof:** new value authenticates. **Negative proof (V2, method of record):** pgpass.conf — the old value's last surviving copy — re-enabled and allowed to fire itself: password authentication failed, with psql attesting the value's source. The burned value's death certificate, signed by its own copy. pgpass.conf then purged (maintainer ruling), absence verified. **Dissolution exhibit:** both apps online and serving traffic hours post-rotation, zero auth errors.

## S3 FD-59 — minted: FD-56 closed by dissolution

Per v1.29 S3's assignment to the execution revision. FD-56 named the master-credential coupling: every dev rotation required a frozen-box write. As of step 8: no app-facing consumer authenticates as master; the dev credential's home is a Secrets Manager secret born clean; future dev rotations touch episode_app_dev only and never open .144. The coupling did not survive contact with the rotation — that is the closure. **FD-59 status: CLOSED at mint (dissolution record).**

## S4 Dispositions and carried obligations

1. FD-45 **canon leg** (canon db_password rotation, carried since v1.21): OPEN, own gate owed — the only tail item.
2. W1 SG rule: revoke-or-ratify OPEN, provenance-unknown noted.
3. 10.0.0.0/16 SG ingress: named deferral, SG review.
4. Shared episode-prod-key: deferred per v1.33 S5.2, unchanged.
5. dump.pm2 (.144): contents now dead credentials post-rotation; full disposition at the FD-45 tail / F-Ward gate.
6. Worker stopped-state (4 restarts): investigation owed before any start.
7. Migration DDL / table ownership for episode_app_dev: owed before next migration runs against dev; RDS ownership-transfer hazard noted.
8. Prod cluster-mode deviation: config decision at a future gate.
9. NEW_CHAT_ONBOARDING correction: still owed (standing).

## S5 Retained

v1.29-v1.33 in full as amended by execution above. G2 Implementation v1.3 as G2 contract with standing corrections. Freeze posture: **resumed in full** — the window's amendment expired with the window. deploy-dev.yml re-enablement: untaken, unproposed, unaffected.

## S6 Register hygiene

Tail at open: FD-58. Closed here: FD-56 (dissolution, FD-59), FD-58 (executed step 7). Minted: FD-59 (born closed). **Tail at close: FD-45 (canon leg).** FD numbers minted only by Fix Plan revisions — conforms. FD-21 check on commit message. Ships [skip-automerge].

---

*End of F-Deploy-1 Fix Plan v1.34.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-12.*