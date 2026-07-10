# F-Deploy-1 Fix Plan v1.31

**§4.3 rewrite drafted 2026-07-10 per the v1.30 §5 spec: `deploy-dev.yml` rewritten to SSM RunCommand transport (FD-57), tag-targeted, OIDC-authenticated, carrying zero application secrets. Three spec deltas recorded — (1) NO host secret exists on the path (tag targeting; exceeds §5 pt 1, verified live: the tag resolves to exactly one instance and the shared box carries a different tag), (2) runner auth via GitHub OIDC, not the static AWS keys (F-Deploy-G1-AD retirement on this path), (3) DB env carried via pm2 process env resolved at deploy time from the secret, app-boot reading deferred into P4. Four review findings caught pre-ship and applied in-draft — RF-1 (unscoped restart would materialize the ecosystem-defined prod-configured app on the dev box; scoped `--only`, config-hygiene rationale), RF-2 (EXIT trap armed before DB-env resolution re-creates the R3 clobber mechanism in miniature; trap re-homed after the eval), RF-3 (health check polled a not-yet-restarted app; explicit scoped restart added before it, trap demoted to failure insurance), RF-4 (the trap, left armed past the explicit restart, fires a second unverified restart at EXIT after the health check has passed — a wedge there hides behind a green run; trap disarmed immediately after the explicit restart). Prerequisite register P1–P5 transcribed. Merge order: this record first, then the workflow PR — CauseClosed precedent. Mints no FD. The rewrite file itself remains uncommitted at this revision's ship.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.30 (FD-57, FD-58, prereq-4 review record; merged #915, edc51c1f) |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.31 |
| **Gate effect** | Advances no gate. Authorizes no prod-box action. Fires zero writes. Records the §4.3 rewrite draft, its spec deltas, and its pre-ship review findings; transcribes the first-dispatch prerequisite register; fixes merge order. The workflow PR is a separate, subsequent, Rule 7-gated action. Re-enablement remains untaken, unproposed, and unaffected — the Actions-level `disabled_manually` state survives any merge of the rewrite file. |

**Basis (live reads 2026-07-10, same working session as v1.30's ship; zero writes fired):**

- Rewrite draft read in full at review (both reviewers, end to end) against the v1.30 §5 five-point spec and against the pre-rewrite file's R1–R6 record.
- `aws ec2 describe-tags` on i-016395bb5f7a51a0b: carries tag `Name=episode-dev-backend`.
- `aws ec2 describe-instances --filters "Name=tag:Name,Values=episode-dev-backend"`: resolves to exactly ONE instance — i-016395bb5f7a51a0b, running, 98.93.190.74. Reverse check: the shared box (`.144`) carries `Name=episode-backend` — the deploy tag CANNOT resolve to it. (RDS-identity discipline applied to EC2: names/tags confirmed live, not assumed.)
- `ecosystem.config.js` at HEAD (grep + section read): defines `episode-api-prod-hotfix` — port 3000, `NODE_ENV=production`, production `ALLOWED_ORIGINS` — kept permanently per Track B DB-1. This definition ships inside every deploy artifact (the artifact copies `ecosystem.config.js`).
- `.sequelizerc` at HEAD: read (migration path resolution for the on-box script).
- Prior-session basis carried live, not inherited: `gh workflow list --all` (Deploy to Development = `disabled_manually`), secrets inventory, IAM role policy, SSM registration — all read earlier this same session (v1.30 basis).

## §1 Purpose

Records the §4.3 rewrite draft — the artifact the v1.30 §5 spec called for — before the file itself is PR'd, per the CauseClosed forward-pointer precedent (record first, so the workflow edit's provenance comment has a committed target). Transcribes the three places the draft deviates from spec and why each is a strengthening; the four defects caught at draft review and applied before anything shipped; and the prerequisite register that must be satisfied before first dispatch. Performs no first-instance reasoning beyond transcription and live verification.

## §2 Rewrite draft — design record

The draft replaces the shared-box SSH deploy end to end. Held from spec: SSM RunCommand transport with zero new inbound (FD-57); the SG untouched by deploys; zero application secrets carried (no `DEV_DB_*` injection, no `write_env_key`, no `.env` writes — the CauseClosed Sec 4 clobber mechanism and the R5 AD-pattern are structurally absent, as v1.30 §5 pt 3 promised); shared-box logic stripped; no `push:` trigger exists anywhere in the file (the Sec 6 binary check passes as empty output — stronger than the commented-out form it replaces); `workflow_dispatch` retained as the gated lever; rewrite-before-re-enablement ordering held.

**Spec deltas, all three strengthenings, recorded here as the authority for the file's header claims:**

1. **No host secret (exceeds §5 pt 1).** The spec said retarget to `EPISODE_DEV_BACKEND_HOST`. The RunCommand design targets by instance tag; NO host secret is referenced by the path at all. `DEV_EC2_HOST` is still retired (deleted at the workflow PR's gate, per v1.30 §5 pt 1 — the landmine argument stands); `EPISODE_DEV_BACKEND_HOST` becomes unreferenced and is retained (harmless, and other future consumers may want it). Verified live this session: the tag resolves uniquely to the new box and the shared box carries a different tag value.
2. **OIDC runner auth (spec was silent).** The runner assumes `episode-gha-deploy-dev` via GitHub OIDC federation instead of using the repo's static `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. Building the new path on static keys would import the F-Deploy-G1-AD antipattern into the artifact meant to help retire it. AD retirement is path-scoped: the static keys remain in the repo inventory for other consumers; their global retirement is separate, unscheduled work.
3. **DB-env-via-pm2 model (refines §5 pt 3).** The spec's "app reads the secret at boot" is realized in stages: at this draft, `scripts/print-db-env.js` (P4, unwritten) resolves `DB_*` from `episode-metadata/dev/database` via the instance role at deploy time; the values enter the shell, migrations consume them, and the scoped `--update-env` restart carries them into pm2 process env. True app-boot secret reading (no DB env in pm2 storage at all) remains open inside P4's code PR. The staged model is the acknowledged design, not an oversight — pinned here so no future review reads pm2-stored DB env as a regression.

## §3 Review findings applied pre-ship (RF-1 – RF-4)

Caught at draft review 2026-07-10, applied in-draft before any commit. Recorded as findings-in-kind; no FD minted — none ever existed on main.

**RF-1 — unscoped restart materializes a prod-configured process.** The draft's first restart call omitted `--only`. The shipped `ecosystem.config.js` defines `episode-api-prod-hotfix` (port 3000, `NODE_ENV=production`, prod `ALLOWED_ORIGINS`), so an unscoped `startOrRestart` on the dev box would START a production-configured app there — the draft's own header rationale ("this box hosts no prod process") conflated topology with config: the box hosts none *until the unscoped call creates one*. Fix: `--only episode-api,episode-worker`, with the rationale corrected to CONFIG HYGIENE — the scoping is owed anywhere this ecosystem file lands, independent of box topology. **Standing hazard noted, not resolved here:** any future unscoped pm2 invocation against the shipped ecosystem file, on any box, re-arms this. The structural fix (splitting dev/prod ecosystem definitions) is future work, unscheduled; this note is its provenance.

**RF-2 — trap armed before DB-env resolution re-creates R3 in miniature.** The draft installed the EXIT trap before `eval "$(node scripts/print-db-env.js)"`. An early failure (artifact fetch, disk) would fire `--update-env` with empty `DB_*` — clobbering a previously-healthy process's env with blanks. Same mechanism-family as the CauseClosed Sec 4 finding this rewrite exists to kill. Fix: trap armed immediately after the eval; nothing before that point stops PM2, so no restart is owed on early exit paths.

**RF-3 — health check polled a not-yet-restarted app.** The draft carried the restart only in the EXIT trap, which fires AFTER the health check runs — the check would poll the old process at best, and on first deploy to this box (pm2 daemon up, zero apps, per the v1.28 basis) an app that has never started. The pre-rewrite file carries the same latent shape; noted, not litigated — that file is superseded by this rewrite, not patched. Fix: explicit scoped restart after migrations, before the health check; the trap demoted to failure insurance for exit paths that skip the explicit call.

**RF-4 — armed trap past the explicit restart fires a second, unverified restart.** RF-3's fix introduced its mirror image: with the explicit restart in place, the EXIT trap fires `restore_pm2` a second time at script end — after the health check and route verification have passed against the first restart. The workflow reports Success on the pre-second-restart state; if the second restart wedges, the site is down behind a green run — a verification-ordering defect whose signature is success, not failure. Fix: `trap - EXIT` immediately after the explicit restart. The insurance analysis closes clean: the trap's protected window is exactly eval→explicit-restart; every exit path after the disarm reports state without changing PM2 state, so no restart is ever owed there.

## §4 Prerequisite register — before first dispatch

Transcribed from the draft header; none exist at authoring; each is its own gated action. The workflow enforces P1 itself (preflight fails fast, names the prereq).

| # | Prerequisite | Owner action |
|---|---|---|
| P1 | Instance role gains SSM permissions; instance registers (verify `describe-instance-information` non-empty) | One gated IAM write (FD-57 enablement leg) + read verify |
| P2 | GitHub OIDC provider + `episode-gha-deploy-dev` role (trust scoped to this repo + environment `development`); S3 Put/Get on `deploys/*`, `ssm:SendCommand` scoped to instance+document, invocation reads | Gated IAM writes, own draft |
| P3 | `episode-metadata/dev/database` exists + instance-role read statement (FD-55(b), scope per FD-58) | Folds into the FD-45 remediation window |
| P4 | `scripts/print-db-env.js` — SDK read of the secret via instance role, emits export lines | Code PR, separate, own review |
| P5 | Nginx provisioning on episode-dev-backend confirmed (deploy fails loudly if absent — correct behavior) | Read/verify; provision if absent (gated dev-box action) |

Also travels with the workflow PR's gate, per v1.30 §5 pt 1: `DEV_EC2_HOST` secret deletion.

## §5 Merge order and gate posture

1. **This record merges first**, then the workflow PR — CauseClosed precedent (the workflow file's header cites Fix Plan v1.30/v1.31; the citations need committed targets).
2. The workflow PR is Rule 7: draft → explicit maintainer confirm → push; `[skip-automerge]` in title (and moot besides — Auto-merge is `disabled_manually`).
3. Merging the rewrite **re-enables nothing**: `disabled_manually` is workflow-ID runtime state and survives file changes, verified in principle by the FD-50 discipline (runtime state read live this session). Re-enablement remains its own future Rule 7 gate per v1.28 §5, conditioned on the prerequisite register above and the §4.2 memory synthetic.

## §6 Retained

- Fix Plan v1.30 in full: FD-57, FD-58, the R1–R6 review record, the §5 rewrite spec — spec now satisfied by the draft with the §2 deltas recorded as its refinements.
- Fix Plan v1.29 and v1.28 per v1.30's carriage.
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). Nothing in this revision or the rewrite draft touches episode-backend; the tag-resolution basis read affirmatively verified the deploy path cannot reach it.
- CauseClosed Sec 6 abort-precondition: strengthened in the draft (no `push:` exists at all); the binary check's expected-empty result is unchanged.
- FD-45 OPEN (tail); FD-56 OPEN; FD-55 decision (b) stands, scope per FD-58; register tail FD-58.

## §7 Register hygiene

- Register tail at v1.31 open: FD-58 (v1.30). Minted here: none. Tail at close: FD-58.
- FD numbers minted only by Fix Plan revisions — conforms (RF-1–RF-4 are review findings applied pre-ship to an uncommitted draft; nothing they describe ever existed on main; no mint owed).
- Closes no findings. Advances no gate.
- Zero writes fired this session segment: all basis reads read-only; the rewrite draft exists only as an uncommitted local artifact at this revision's ship.
- Doc-only revision.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #915 — historical; no close/fix/resolve adjacent forms; "applied pre-ship" and "record" are the operative forms).
- Ships with `[skip-automerge]` in the title, PR body via `--body-file`.

---

*End of F-Deploy-1 Fix Plan v1.31 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
*Predecessor: v1.30 (edc51c1f, #915).*
*Closed: none. Minted: none. Advances no gate; authorizes no prod-box action; the workflow PR follows separately, Rule 7. [skip-automerge]*
