| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CT, 2026-09-30, backend (frontend rebuilt from unchanged sources), one migration run before the restart, no dependency change, one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. Image cost tracking (#2388) and the invitation as the episode's overlay (P10, #2391) go live. CFO 87/100 with a fifth warning, not named in the log (§6).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CS.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `5757f30b9d131eda052c4b2b0f45b5c77724a94b` (#2393),
read 2026-09-30. Deploy CT moved production to `0bff6977` (#2391), four
commits before it (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database user or ARN. The database user the
migration ran as is left out.

**The letter.** This deploy is lettered **CT**. It follows CS
(`F-Deploy-1_Deploy_2026-09-30_CS.md`, filed in #2390, still open at
filing).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
19:45–19:51 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `f9810a6d`, fetched 3 commits (#2388, #2389, #2391) to `0bff6977` and
   **stopped at step 3** on the pending migration
   `20261001100000-add-image-cost-columns-to-ai-usage-logs`. Nothing had
   changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name). The package diff was
     empty.
   - `git merge --ff-only` to `0bff6977`: 25 files.
   - `check-pending-migrations` against the canon instance: **1 pending of
     230**, exit 1.
3. **Migrate.** `npx sequelize-cli db:migrate` as a separate database user
   (name left out). Its password was entered at a hidden prompt and unset
   afterwards.
   - Migrated in 0.030 s, exit 0.
   - Re-check: **0 pending of 230**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 37.41 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 49, online.
   - Ready at 19:50:29.
   - `/health` at 2026-09-30T19:50:43Z: healthy, database connected,
     uptime 20.2 s.
5. **CFO.** 19:50:37–19:50:42: **87/100** (was 89), 0 critical, **5
   warnings** (was 4).

**App check (Evoni):** not checked yet.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor f9810a6d4fddec59b7369061ca9bfe20242de127 0bff6977a3be33c2733d80f4c22ceb1b7baede4f && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CS ends at `f9810a6d` (CS record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CS left it at 48 (CS
record §6), and CT's single restart brings it to 49. The script's stopped
run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count f9810a6d..0bff6977
3
$ git log --oneline f9810a6d..0bff6977
0bff6977a feat(overlays): the approved invitation is the episode's invitation overlay (P10) [skip-automerge] (#2391)
1993b94dc docs(flow): record episode visuals rulings P10–P13 in §8(w) [skip-automerge] (#2389)
3e263a1fd feat(ai-cost): log and budget-gate every image generation [skip-automerge] (#2388)
$ git diff --shortstat f9810a6d 0bff6977
 25 files changed, 1830 insertions(+), 140 deletions(-)
$ git diff --name-only f9810a6d 0bff6977 -- src/migrations/
src/migrations/20261001100000-add-image-cost-columns-to-ai-usage-logs.js
$ git diff --name-only f9810a6d 0bff6977 -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only f9810a6d 0bff6977 -- frontend/ | wc -l
0
$ git diff --name-only f9810a6d 0bff6977 -- src/ | wc -l
19
```

This agrees with Evoni's account:
- 3 commits, the three PRs named;
- 25 files;
- exactly the one migration the check listed;
- no package or lock file.

**No frontend file changed**, so the `vite build` rebuilt the same sources.
19 backend files changed (one of them the migration); the restart was needed
to load the others.

## §3. The time

**ATTESTED.** The deploy ran about 19:45–19:51 UTC: ready at 19:50:29,
`/health` at 19:50:43, CFO done 19:50:42.

**MEASURED.** The range's last commit, #2391, is at 19:45:25 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" f9810a6d..0bff6977
0bff6977a 2026-09-30T15:45:25-04:00 feat(overlays): the approved invitation is the episode's invitation overlay (P10) [skip-automerge] (#2391)
1993b94dc 2026-09-30T15:36:19-04:00 docs(flow): record episode visuals rulings P10–P13 in §8(w) [skip-automerge] (#2389)
3e263a1fd 2026-09-30T15:02:58-04:00 feat(ai-cost): log and budget-gate every image generation [skip-automerge] (#2388)
```

## §4. Migrations

**MEASURED.** The tree holds 230 migration files, one more than at CS:

```
$ git ls-tree -r --name-only 0bff6977 src/migrations | grep -c '\.js$'
230
```

**ATTESTED (§0):** 1 pending of 230 before the run, 0 pending of 230 after
it. This agrees with the tree: CS recorded 0 pending of 229, and the range
adds exactly this file.

**The script behaved as designed.** It stopped on the pending file, and the
migration ran **before** the restart, as §7.1 requires on exit 1. The
image-cost code of #2388 therefore started with the new `ai_usage_logs`
columns in place.

## §5. What went live — MEASURED

- **#2388 (`3e263a1f`), Task #2387: image cost tracking.**
  - Every image generation call is budget-gated before it runs and logged
    to `ai_usage_logs`: fal Flux and Kontext, OpenAI dall-e-3 and
    gpt-image-1, and the Replicate clients. The in-memory counter is gone.
  - Rates are in `imageCostService.RATE_TABLE`, from Evoni's prices of
    2026-09-30. Unpriced models log `cost_usd` NULL.
  - A call over budget is refused with 429 `AI_BUDGET_EXCEEDED`.
- **#2391 (`0bff6977`), Task #2386: ruling P10.** An event's approved
  invitation is tagged as its episode's invitation overlay, placed on
  beat 5 "Reveal", and listed in that episode's overlays. The Phone Hub
  stays show-wide.
- **#2389 (`1993b94d`):** rulings P10–P13 recorded in §8(w). A document with
  no runtime effect.

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 49, online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- The account does not mention `episode-worker`.

**The fifth CFO warning is not named in the log — MEASURED.**
`cfoAgent.scheduledRun` prints the warning count only. It prints the text
of critical findings and of budget findings (a warning whose message
contains "budget"), nothing else:

```
$ git show e5311b25:src/services/cfoAgent.js | grep -n "console.log(\`\[CFO\]\|console.log('\[CFO\]" | head -6
678:    console.log('[CFO] ⏰ Scheduled audit starting...');
686:    console.log(`[CFO] ✅ Audit complete — Score: ${report.overall_score}/100 | ${criticals} critical | ${warnings} warnings | ${report.duration_ms}ms`);
689:      console.log('[CFO] 🚨 Critical issues found:');
698:      if (f.level === 'critical') console.log(`[CFO] 💸 BUDGET ALERT: ${f.msg}`);
699:      else if (f.level === 'warning') console.log(`[CFO] ⚠️ Budget warning: ${f.msg}`);
710:  console.log(`[CFO] 🕐 Scheduler started — auditing every ${schedulerIntervalMs / (60 * 60 * 1000)}h`);
```

Evoni's account shows no "Budget warning" line. **INFERRED:** the new
warning is therefore not one of the two budget checks.

`cfoAgent` can raise these other warnings:
- `cost_watchdog`: today's spend more than 2× the 7-day average; Opus calls
  in 30 days.
- `dependency_audit`: major updates; moderate vulnerabilities.
- `resource_monitor`: database over 5 GB; more than 20 connections; log
  tables over 500 MB.
- `lights_off`: more than 15 empty tables.
- `health_patrol`: P95 AI latency over 30 s; RSS over 1500 MB; more than 10
  failed queue jobs.

**INFERRED:** it is unlikely to come from cost tracking.
- No image call can have been logged between the restart (ready 19:50:29)
  and the audit (19:50:37).
- The migration adds nullable columns only.
- The overall score fell by 2. With the weights (`cost_watchdog` 30,
  `resource_monitor` 20, `health_patrol` 25, `dependency_audit` 15,
  `lights_off` 10), a 2-point drop fits best a `resource_monitor` −10
  warning or a `health_patrol` −10 warning.
- The warning can be named from the audit history, `GET /api/v1/cfo/history`
  (ADMIN), whose last report lists `all_findings` with `agent`. This record
  does not call it.

**INFERRED (a warning cost tracking may cause later):** `health_patrol`'s
P95 latency check reads `duration_ms` from every non-error `ai_usage_logs`
row of the last 7 days. Image generations are now logged there, and they
often take tens of seconds. So "P95 AI call latency is N s" may appear once
image calls accumulate. It would reflect slow image models, not slow text
calls.

## §7. Schema changes

**MEASURED** (from the migration file), **ATTESTED** (that it ran, §0).

`20261001100000-add-image-cost-columns-to-ai-usage-logs` adds three
nullable columns to `ai_usage_logs`, with `ADD COLUMN IF NOT EXISTS`, and is
skipped if the table is absent:
- `provider` varchar(50)
- `billing_unit` varchar(20)
- `billed_units` numeric(12,4)

```
$ git show 0bff6977:src/migrations/20261001100000-add-image-cost-columns-to-ai-usage-logs.js | grep -n "ADD COLUMN"
21: * ADD COLUMN IF NOT EXISTS, and skipped when the table is absent, so a re-run
36:    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS provider character varying(50)');
37:    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS billing_unit character varying(20)');
38:    await q('ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS billed_units numeric(12,4)');
```

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CT is `0bff6977` (#2391).
`origin/main` at filing is four commits ahead of it, all merged after the
deploy: #2392 (P11, title approval and title card, with migration
`20261001120000`), #2390 (the CS record), #2394 (a frontend test fix) and
#2393 (P12/P13, the teaser, with migration `20261001130000`).

```
$ git log --oneline 0bff6977..origin/main
5757f30b9 feat(episodes): viewer teaser, description as internal synopsis (P12, P13) [skip-automerge] (#2393)
2246af138 test(episodes): wait for the wardrobe empty state instead of asserting at once [skip-automerge] (#2394)
d4755e399 docs(audit): deploy record CS [skip-automerge] (#2390)
e5311b251 feat(episodes): approve the title and design its title card (P11) [skip-automerge] (#2392)
$ git log -1 --format='%H %ad %s' --date=short origin/main
5757f30b9d131eda052c4b2b0f45b5c77724a94b 2026-09-30 feat(episodes): viewer teaser, description as internal synopsis (P12, P13) [skip-automerge] (#2393)
$ git diff --name-only 0bff6977..origin/main -- src/migrations
src/migrations/20261001120000-add-episode-title-approval-and-card.js
src/migrations/20261001130000-add-episodes-teaser.js
$ git rev-parse --is-shallow-repository
false
```

**INFERRED:** because #2392 and #2393 carry migrations, the deploy that
takes them is a manual one per §7.1, as CT was.

## §9. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with Evoni's account (3 commits, 25 files,
  the one migration, no package change), with no gap after CS. Production
  is at `0bff6977`, four commits behind `origin/main` (#2392 and #2393
  each carry a migration).
- **Deploy:** the script stopped on the pending migration as designed.
  Finished by hand per §7.1:
  - 1 pending of 230;
  - migrated, then 0 pending of 230;
  - build;
  - one restart (count 49);
  - `/health` healthy and connected.
- **CFO:** 87/100, 0 critical, 5 warnings. The fifth is not named in the
  log; it is unlikely to come from cost tracking (INFERRED, §6).
- **App check:** not checked yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
