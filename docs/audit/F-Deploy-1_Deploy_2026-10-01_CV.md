| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CV, 2026-10-01, backend and frontend. Five migrations ran before the restart, there was no dependency change, and there was one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. D13, D14, D15, event spending, S1, the P11 title overlay and the committed invitation fonts go live. CFO 89/100 with 4 warnings, unchanged from CU. Production is two commits behind `origin/main`; one of them fixes an S1 failure that is now live (§8).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CU.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `51634975018753c202fe292a51730e301e5983da` (#2419),
read 2026-10-01. Deploy CV moved production to `d919ff8f` (#2417), two
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
migrations ran as is left out.

**The letter.** This deploy is lettered **CV**. It follows CU
(`F-Deploy-1_Deploy_2026-09-30_CU.md`, filed in #2413).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
02:20–02:32 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `c3bc92f5`, fetched 13 commits to `d919ff8f` and **stopped at step 3**
   on five pending migrations. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty, so no `npm ci` was run.
   - `git merge --ff-only` to `d919ff8f`: 116 files.
   - `src/assets/fonts/invitation/` lists six TTFs and two OFL texts.
   - `check-pending-migrations` against the canon instance: **5 pending of
     239**, exit 1.
3. **Migrate.** `db:migrate` as a separate database user (name left out).
   Its password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261001160000`, 0.105 s: 0 deliverables renamed, 0 drafted records.
   - `20261001170000`, 0.033 s: `deal_components` backfilled on 1 event.
   - `20261001180000`, 0.039 s: 1 extras row moved to event spending, 0
     left on completed episodes.
   - `20261001190000`, 0.016 s: `amount` nullable; `lala_home` written on 1
     show.
   - `20261001200000`, 0.017 s.
   - Re-check: **0 pending of 239**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 35.00 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 51, online.
   - Ready at 02:31:36.
   - `/health` at 2026-10-01T02:31:50Z: healthy, database connected,
     uptime 20.1 s.
   - No `FONT FILE MISSING` lines.
5. **CFO.** 02:31:44–02:31:48: **89/100**, 0 critical, **4 warnings**.

**App check (Evoni):** not checked yet.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor c3bc92f5 d919ff8f && echo "ancestor: yes"
ancestor: yes
$ git rev-parse c3bc92f5 d919ff8f
c3bc92f5d4107b73d7b6f6c930f5255055701082
d919ff8f429ee25885c8883fbdbc0e6c587abda7
```

**No gap.** CU ends at `c3bc92f5` (CU record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CU left it at 50 (CU
record §6), and CV's single restart brings it to 51. The script's stopped
run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count c3bc92f5..d919ff8f
13
$ git log --oneline c3bc92f5..d919ff8f
d919ff8f4 feat(episodes): the episode title as a real-typeface overlay (P11 amendment) [skip-automerge] (#2417)
c7c94d41e feat(scenes): every scene image is generated from one Scene Brief (S1) [skip-automerge] (#2416)
d93b6b5ff feat(deals): draft the whole Terms section from the ticked components (D13) [skip-automerge] (#2415)
7ff8ac8a4 docs(flow): record scene image rulings S1-S6 and the review's claims, checked [skip-automerge] (#2414)
2b8fe6747 docs(audit): deploy record CU [skip-automerge] (#2413)
957e1fed1 feat(money): event spending on the episode's Money tab, the event cost split [skip-automerge] (#2412)
69ec4ac21 feat(deals): tick what a deal includes; its label and invitation follow (D14 UI) [skip-automerge] (#2411)
acd73a542 feat(deals): a deal is its ticked components (D14 schema) [skip-automerge] (#2410)
c531d58c3 feat(deals): real influencer deliverable formats with platform and quantity (D15) [skip-automerge] (#2409)
9c1cde569 docs(deals): record D13–D15 and Evoni's answers; design deal components, drafted Terms and real formats [skip-automerge] (#2408)
e4e10dca6 docs(flow): record the event cost split (terms costs vs event spending) [skip-automerge] (#2407)
5d61cf083 docs(flow): record T9's second follow-up (Start Episode writes the lower count) [skip-automerge] (#2406)
e404cb821 feat(images): price gpt-image-1.5 input and output tokens [skip-automerge] (#2405)
$ git diff --shortstat c3bc92f5 d919ff8f
 116 files changed, 9241 insertions(+), 972 deletions(-)
$ git diff --name-only c3bc92f5 d919ff8f -- src/migrations/
src/migrations/20261001160000-add-deliverable-formats.js
src/migrations/20261001170000-add-world-events-deal-components.js
src/migrations/20261001180000-create-episode-spending-lines.js
src/migrations/20261001190000-d13-travel-price-required-and-lala-home.js
src/migrations/20261001200000-add-episode-title-overlay.js
$ git diff --name-only c3bc92f5 d919ff8f -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only c3bc92f5 d919ff8f -- frontend/ | wc -l
25
$ git diff --name-only c3bc92f5 d919ff8f -- src/ | wc -l
55
$ git ls-tree -r --name-only d919ff8f src/assets/fonts/invitation/
src/assets/fonts/invitation/.gitkeep
src/assets/fonts/invitation/CormorantGaramond-Bold.ttf
src/assets/fonts/invitation/CormorantGaramond-Italic.ttf
src/assets/fonts/invitation/CormorantGaramond-OFL.txt
src/assets/fonts/invitation/CormorantGaramond-Regular.ttf
src/assets/fonts/invitation/LibreBaskerville-Bold.ttf
src/assets/fonts/invitation/LibreBaskerville-Italic.ttf
src/assets/fonts/invitation/LibreBaskerville-OFL.txt
src/assets/fonts/invitation/LibreBaskerville-Regular.ttf
```

This agrees with Evoni's account:
- 13 commits;
- 116 files;
- exactly the five migrations the check listed;
- no package or lock file changed, so skipping `npm ci` was right;
- the font folder holds the six TTFs and two OFL texts she listed, plus
  `.gitkeep`.

25 frontend files changed, so the `vite build` was needed. 55 backend files
changed (five of them migrations); the restart was needed to load the
others.

## §3. The time

**ATTESTED.** The deploy ran about 02:20–02:32 UTC: ready at 02:31:36,
`/health` at 02:31:50, CFO done 02:31:48.

**MEASURED.** The range's last commit, #2417, is at 01:52:13 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI" c3bc92f5..d919ff8f | head -2
d919ff8f4 2026-09-30T21:52:13-04:00
c7c94d41e 2026-09-30T21:40:11-04:00
```

## §4. Migrations

**MEASURED.** The tree holds 239 migration files, five more than at CU:

```
$ git ls-tree -r --name-only d919ff8f src/migrations | grep -c '\.js$'
239
```

**ATTESTED (§0):** 5 pending of 239 before the run, 0 pending of 239 after
it. This agrees with the tree: CU recorded 0 pending of 234, and the range
adds exactly these five files.

**The script behaved as designed.** It stopped on the pending files, and the
migrations ran **before** the restart, as §7.1 requires on exit 1. The new
code started with its columns and table in place.

**The migrations' own counts.** Each count Evoni gave is one a migration
logs. MEASURED, the log lines:

```
$ for f in $(git diff --name-only c3bc92f5 d919ff8f -- src/migrations/); do git show d919ff8f:$f | grep -nE 'console\.log\(`\[migration' ; done
127:          console.log(`[migration 20261001160000] event_deliverables ${oldKey} → ${spec.type}: ${meta?.rowCount ?? 0} row(s)`);
132:      console.log(`[migration 20261001160000] drafted deliverable records rewritten on ${events} event(s)`);
80:      console.log(`[migration 20261001170000] deal_components backfilled on ${backfilled} event(s); drafted records carried on ${drafted}; unknown deal_type left NULL on ${unknown}`);
120:      console.log(`[migration 20261001180000] extras rows moved to event spending: ${moved}; left on completed episodes: ${completed}; rows of events with no episode stay until Start Episode`);
66:      console.log(`[migration 20261001190000] event_costs.amount nullable; lala_home written on ${written} show(s), kept on ${kept}`);
```

`20261001200000` logs no count.

## §5. What went live — MEASURED

- **#2405 (`e404cb82`):** gpt-image-1.5's input and output token prices.
- **#2409 (`c531d58c`): ruling D15.** Real influencer deliverable formats,
  with a platform and a quantity, and rate card version 2.
- **#2410 (`acd73a54`) and #2411 (`69ec4ac2`): ruling D14.** A deal is the
  components ticked for it. Its label and the invitation's wording follow
  them.
- **#2412 (`957e1fed`): the event cost split.** Event spending is on the
  episode's Money tab.
- **#2415 (`d93b6b5f`): ruling D13.**
  - The whole Terms section is drafted from the ticked components.
  - Lala's home is a show setting.
  - Travel and accommodation are drafted only outside her home city, with
    no amount ("Price required").
- **#2416 (`c7c94d41`): ruling S1.** Every scene image is generated from
  one Scene Brief.
- **#2417 (`d919ff8f`): the P11 amendment.**
  - The episode title is a real-typeface overlay.
  - The invitation fonts are committed to the repository, and their
    runtime download is removed.
  - A missing font file is logged as an error.
- **#2406, #2407, #2408, #2413 and #2414:** rulings records, a design note
  and the CU deploy record. They have no runtime effect.

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 51, online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- The account does not mention `episode-worker`.
- No `FONT FILE MISSING` lines.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CU.

**MEASURED**, then **INFERRED.** None of the font checks runs at startup.
- The phone screen, to-do list and social checklist renderers log `FONT
  FILE MISSING` from `loadFonts()` on their first render.
- The invitation and title compositing log `FONT FILES MISSING` from
  `checkFonts()` on their first use.

So the absence of those lines right after the restart shows little. The
evidence that the fonts are in place is Evoni's listing of the folder
(§0, ATTESTED), which matches the tree (§2). A first invitation, title
overlay or phone render would confirm it in the log.

```
$ grep -n "FONT FILE MISSING" src/services/phoneScreenRenderer.js
26:      else console.error(`[PhoneScreen] FONT FILE MISSING: ${p}; a fallback font is used. Redeploy src/assets/fonts/invitation.`);
$ grep -n "^function loadFonts\|^async function checkFonts" src/services/phoneScreenRenderer.js src/services/invitationCompositingService.js
src/services/phoneScreenRenderer.js:19:function loadFonts() {
src/services/invitationCompositingService.js:117:async function checkFonts() {
```

## §7. Schema changes

**MEASURED** (from the migration files); **ATTESTED** (that they ran, §0).
- New columns use `IF NOT EXISTS`.
- The new table is created only when absent.
- `event_costs.amount` loses its NOT NULL.
- Each step is skipped when its table is absent.

```
$ for f in $(git diff --name-only c3bc92f5 d919ff8f -- src/migrations/); do echo "== $f"; git show d919ff8f:$f | grep -nE "ADD COLUMN IF NOT EXISTS [a-z_]+ |DROP NOT NULL|createTable\('" ; done
== src/migrations/20261001160000-add-deliverable-formats.js
118:        await q('ALTER TABLE event_deliverables ADD COLUMN IF NOT EXISTS platform VARCHAR(20)');
119:        await q('ALTER TABLE event_deliverables ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1');
== src/migrations/20261001170000-add-world-events-deal-components.js
49:      await q('ALTER TABLE world_events ADD COLUMN IF NOT EXISTS deal_components JSONB');
== src/migrations/20261001180000-create-episode-spending-lines.js
59:        await queryInterface.createTable('episode_spending_lines', {
== src/migrations/20261001190000-d13-travel-price-required-and-lala-home.js
51:        await sequelize.query('ALTER TABLE event_costs ALTER COLUMN amount DROP NOT NULL', { transaction });
== src/migrations/20261001200000-add-episode-title-overlay.js
31:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_asset_id UUID');
32:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_title TEXT');
33:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_overlay_style JSONB');
```

Two of them also write data, as their headers say:
- `20261001160000` seeds rate card version 2, only when it has no rows.
- `20261001190000` writes `lala_home` to shows that have none.

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CV is `d919ff8f` (#2417).
`origin/main` at filing is two commits ahead of it, both merged after the
deploy started:
- #2418: P15, the Production → Overlays tab;
- #2419: the S1 follow-up fix, the Scene Brief's database handle.

Neither carries a migration.

```
$ git log --oneline d919ff8f..origin/main
516349750 fix(scenes): the Scene Brief reads through the models' own connection [skip-automerge] (#2419)
b48a71371 feat(episodes): Production → Overlays, every on-screen piece of the episode (P15) [skip-automerge] (#2418)
$ git diff --name-only d919ff8f..origin/main -- src/migrations | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**What runs live until #2419 ships.** This is INFERRED from the code at
`d919ff8f`; nothing in production was read.
- Some callers pass only `{ SceneSet, SceneAngle }` to the scene
  generation service:
  - the scene generation worker, for every job type including cascade
    regenerate;
  - the refinement queue;
  - the angle regenerate route.
- That service then calls `prepareSceneBrief(models.sequelize, …)` with an
  undefined connection. For a scene set with a World Location, that fails
  before any image call.
- The direct base and angle generate routes pass the full models and are
  not affected.
- #2419 is in `origin/main` and, per Evoni, ships next by script.

**INFERRED:** the next deploy, CW, can run through `scripts/deploy-prod.sh`
to the end, since the two commits carry no migration.

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

- **Continuity:** the tree agrees with Evoni's account, with no gap after
  CU:
  - 13 commits and 116 files;
  - the five migrations;
  - no package change;
  - the fonts in place.

  Production is at `d919ff8f`, two commits behind `origin/main`, neither
  with a migration.
- **Deploy:** the script stopped on the pending migrations as designed.
  Finished by hand per §7.1:
  - 5 pending of 239;
  - migrated, then 0 pending of 239;
  - build;
  - one restart (count 51);
  - `/health` healthy and connected;
  - no font-missing lines.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CU.
- **Open until #2419 ships (INFERRED, §8):** worker-run, queued and
  angle-regenerate scene generations fail for scene sets with a World
  Location.
- **App check:** not checked yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
