| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BI, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session. A new event started from a Feed creator arrives drafted, and each drafted field reads Auto-drafted until it is changed.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BG.md` (the BG record, the newest filed). This
document follows that one rather than editing it. Basis:
`28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1` (#2129), the tree Deploy BI moved
production to. `origin/main` at filing is `28d14ff9` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, a local build of a
  commit, and register documents already merged under `docs/audit/`.
- **INFERRED** is marked where used (§1, §6) and is not upgraded.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, account number or ARN.

**The letter.** This deploy is lettered **BI**, not BH. BG (#2112) is the
newest filed record and ends at `acdb6c7d`; this deploy begins at `0386bb97`.
The deploy between them, which took production from `acdb6c7d` to
`0386bb97`, has no record. BH is left for it (§1).

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-28 UTC):**

- Fast-forward `0386bb97cda965ec33ee4cbbcc2a5bf64f406adf` →
  `28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1`, 7 commits: PRs #2117, #2119,
  #2121, #2123, #2125, #2127, #2129.
- `git status` before the pull: untracked files only (old `.bak` files,
  "Production", "sed"); nothing tracked modified.
- No migration or dependency changes in the range. The pending-migration
  check, run with `NODE_ENV=production`, read the canon instance, database
  `episode_metadata` as `episode_app_dev`: 0 pending of 220, exit 0.
- Backup: `frontend/dist` copied to `~/dist-backup-<timestamp>` before the
  build. The vite build succeeded, with two warnings: stale browserslist data,
  and a CSS minifier "Unexpected @keyframes" warning.
- `ANTHROPIC_API_KEY` present in `.env` (count 1; the value was not read).
  `.env` unchanged.
- One plain `pm2 restart` of `episode-api-prod-hotfix`; the restart count is
  now 10. `/health` reported healthy, database connected. The startup log was
  clean.
- **App check:** an event created from a Feed creator showed the drafted
  labels, and editing a field showed Edited.

Her account gives no backup timestamp, no build entry file name and no
`/health` timestamp; none is recorded here. The database hostname is not
recorded.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `0386bb97` to `28d14ff9` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git merge-base --is-ancestor 0386bb97cda965ec33ee4cbbcc2a5bf64f406adf 28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1 && echo ancestor
ancestor
```

**MEASURED: a gap before this deploy.** Deploy BG ends at `acdb6c7d` (BG
record §1, §8). Between `acdb6c7d` and this deploy's start, `0386bb97`, the
repository holds:

```
$ git log --oneline acdb6c7d..0386bb97cda965ec33ee4cbbcc2a5bf64f406adf
0386bb97c feat(db): a migration that adds registry_characters.world as production has it [skip-automerge] (#2114)
f8c8509a6 fix(stories): write-back updates only its own registry's character [skip-automerge] (#2113)
b00b8fc83 docs(audit): F-Reg-2 Fix Plan v1.1, world column homed [skip-automerge] (#2115)
7db3a9ac9 docs(audit): file deploy record BG [skip-automerge] (#2112)
dcd60857a docs(events): record event-generation rulings, amend rule 14 [skip-automerge] (#2103)

$ git diff --name-only acdb6c7d 0386bb97cda965ec33ee4cbbcc2a5bf64f406adf -- src/migrations
src/migrations/20260927210000-add-registry-characters-world.js

$ grep -rln "0386bb97\|f8c8509a" docs/audit
(no output)

$ git log origin/main --format='%h %s' -- 'docs/audit/F-Deploy-1_Deploy_*' | head -1
7db3a9ac9 docs(audit): file deploy record BG [skip-automerge] (#2112)
```

**INFERRED.** Production was already at `0386bb97` when this deploy began
(§0); BG recorded 0 pending of 219 and a restart count of 8 (BG record §4,
§6); this deploy's check reads 0 pending of 220 and a count of 10. So a deploy
between BG and BI moved production to `0386bb97`, ran migration
`20260927210000-add-registry-characters-world.js`, and restarted once (8 → 9).
No document records it. **Its record, lettered BH, is owed**, on Evoni's
account; this document does not stand in for it.

## §2. The range — MEASURED

```
$ git rev-list --count 0386bb97cda965ec33ee4cbbcc2a5bf64f406adf..28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1
7

$ git log --oneline 0386bb97cda965ec33ee4cbbcc2a5bf64f406adf..28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1
28d14ff9d feat(events): Auto-drafted and Edited field states per rule 14 [skip-automerge] (#2129)
7f10520b4 feat(events): draft category, format and start time at creation per §8(u) R3 [skip-automerge] (#2127)
a56e10392 feat(events): draft dress code, keywords and styling brief at creation per §8(u) R7 [skip-automerge] (#2125)
f076b019d feat(events): draft concept, activity and description at creation per §8(u)/(v) [skip-automerge] (#2123)
40447e64a fix(events): frame suggest-names by organizer niche and event per §8(u) R9 [skip-automerge] (#2121)
c946b8538 docs(context): refresh §4.6, §6.5, §10 for event generation [skip-automerge] (#2119)
3df6e7d75 feat(events): add 15 formats and fitness category per §8(u) [skip-automerge] (#2117)

$ git diff --name-only 0386bb97 28d14ff9
PROJECT_CONTEXT.md
docs/EVENT_EPISODE_FLOW.md
frontend/src/constants/eventTaxonomy.json
frontend/src/pages/EventPackagePage.basics.test.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/utils/eventBasics.js
frontend/src/utils/eventBasics.test.js
frontend/src/utils/eventReadinessSections.js
frontend/src/utils/eventReadinessSections.test.js
frontend/src/utils/eventTaxonomy.test.js
src/models/WorldEvent.js
src/routes/worldEvents.js
src/services/eventConceptDraftService.js
src/services/financialTransactionService.js
src/services/wardrobeIntelligenceService.js
src/utils/suggestNamesFraming.js
tests/unit/routes/worldEvents-from-profile-concept-draft.test.js
tests/unit/routes/worldEvents-taxonomy.test.js
tests/unit/services/eventConceptDraftService.test.js
tests/unit/utils/suggestNamesFraming.test.js

$ git diff --name-only 0386bb97 28d14ff9 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
```

Seven commits: six code (#2117, #2121, #2123, #2125, #2127, #2129) and one
docs-only (#2119, `PROJECT_CONTEXT.md`). Twenty-one files: six under `src/`,
nine under `frontend/src`, four backend tests, and two docs. Eight of the
twenty-one are tests. No migration file, no package manifest or lockfile.

## §3. The time

**ATTESTED.** 2026-09-28 UTC. Her account gives no login or deploy time.

**MEASURED.** The newest commit in the range is #2129, 01:29:04 UTC on
2026-09-28, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 0386bb97..28d14ff9 | head -1
28d14ff9d 2026-09-27T21:29:04-04:00 feat(events): Auto-drafted and Edited field states per rule 14 [skip-automerge] (#2129)
```

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check with `NODE_ENV=production`, against the
canon instance, database `episode_metadata` as `episode_app_dev`: 0 pending of
220, exit 0. `git status`: untracked files only.

**MEASURED.** The migration tree holds 220 files at the end of the range, and
the range adds none (§2):

```
$ git ls-tree -r --name-only 28d14ff9 src/migrations | wc -l
220
```

## §5. What went live

### §5.1 The change, MEASURED

The event-generation workstream (`docs/EVENT_EPISODE_FLOW.md` §8(u), §8(v);
`docs/DESIGN_DOCTRINE.md` rule 14 as amended by #2103, a docs-only commit in
the gap range before this one, §1):

- #2117 (`3df6e7d7`): 23 formats and 11 categories (`fitness` added) in
  `WorldEvent`'s `isIn` lists and the frontend mirror; start-time and
  dress-code defaults for the 15 new formats; `fitness` → `fitness` and
  `lifestyle` → `community_local`; `format`-first checks in
  `financialTransactionService` (photo booth) and
  `wardrobeIntelligenceService` (colour psychology), with the `event_type`
  lists kept as fallback.
- #2119 (`c946b853`): `PROJECT_CONTEXT.md` only.
- #2121 (`40447e64`): the suggest-names prompt is framed by the organizer's
  niche, the event's format and the first sentence of its description,
  no longer "a fashion/lifestyle content-creator show".
- #2123 (`f076b019`): `POST /world/:showId/events/from-profile` makes one
  Haiku 4.5 call (`claude-haiku-4-5-20251001`) that drafts a concept, an
  activity and the public description (R8). It never blocks creation: with
  no `ANTHROPIC_API_KEY`, over its own per-user limit, on `aiCostTracker`'s
  budget refusal or on any error, the event saves with the template fields
  and no draft.
- #2125 (`a56e1039`): the same call drafts `dress_code`,
  `dress_code_keywords` and `automation.styling_brief` (R7).
- #2127 (`7f10520b`): the same call drafts `category`, `format` and
  `event_time` (R3). One attempt, 10 s timeout, no retries.
- #2129 (`28d14ff9`): the Event Package shows each drafted field as
  "Auto-drafted · AI draft" (the default date as "Auto-drafted · schedule")
  until it is changed, then "Edited"; both count toward Event Ready (R2).

### §5.2 The live check, beside the code

**ATTESTED (§0).** A new event from a Feed creator showed the drafted labels;
editing a field showed Edited. `/health` healthy, database connected; the
startup log clean.

**MEASURED.** Each matches the range: the drafted labels and Edited are
#2129 over #2123–#2127. The key's presence is what lets the draft run: with
no `ANTHROPIC_API_KEY` the draft is skipped, and that skip logs nothing
(`src/services/eventConceptDraftService.js`). A draft that succeeds with
every field valid also logs nothing; a failed call, the draft's own rate
limit, an unusable reply, or a dropped field (invalid styling, category,
format or time) each logs a warning or error. The drafted labels she saw are
what shows the draft ran; a clean log alone would not.

**Not attested:** which fields the checked event had drafted, which field was
edited, and whether any draft fell back to the template.

### §5.3 The build and the backup

**ATTESTED.** `frontend/dist` was copied to `~/dist-backup-<timestamp>`
before the build; the build succeeded with the two warnings in §0.

**MEASURED: neither warning is new with this deploy.** A local build of each
end of the range, in a throwaway worktree, prints both:

```
$ (at 0386bb97) npx vite build
Browserslist: browsers data (caniuse-lite) is 8 months old. Please run:
▲ [WARNING] Unexpected "@keyframes" [css-syntax-error]
      164 │ @keyframes spin {
0386bb97 build exit: 0

$ (at 28d14ff9) npx vite build
Browserslist: browsers data (caniuse-lite) is 8 months old. Please run:
▲ [WARNING] Unexpected "@keyframes" [css-syntax-error]
      164 │ @keyframes spin {
28d14ff9 build exit: 0
```

For production's request path, this record cites
`F-Deploy-1_Fix_Plan_v1.56.md`.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the
restart count is now 10. `.env` unchanged; `ANTHROPIC_API_KEY` present
(count 1, value not read).

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BG took the count from 7 to 8 (BG record §6).
- **INFERRED:** the unrecorded deploy between BG and BI (§1) took it from
  8 to 9. Owed: the BH record.
- BI took it to 10.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 220.

**MEASURED.** No file under `src/migrations/` changes in the range (§2, §4).
#2127 moved the `category` and `format` value lists into constants in
`src/models/WorldEvent.js` with no value or order change; model-level
validation only, no schema change.

## §8. Basis statement

**MEASURED.** After Deploy BI, production's tree is this record's basis,
`28d14ff9`. At filing, after `git fetch origin`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
28d14ff9d4218b9e11b77eba0ffb6cdaa661d9d1 2026-09-27 feat(events): Auto-drafted and Edited field states per rule 14 [skip-automerge] (#2129)
```

Nothing is merged after it.

## §9. What this document does not do

This document:

- records no token, email, password, database host, account number or ARN,
  and does not record the `ANTHROPIC_API_KEY` value (which was not read);
- does not edit the BG record or any other filed document, and does not stand
  in for the owed BH record (§1);
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, restart, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read or a
  local build this filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately; §1
  and §6 carry one INFERRED clause each.
- The tree agrees with her account: seven commits, no migration, no package
  change (§2).
- **The live check (§5.2):** drafted labels on a new Feed-creator event, and
  Edited after a change; `/health` healthy and connected; startup log clean.
- The two build warnings predate this range (§5.3).
- **Owed:** the record of the deploy between BG and BI (`acdb6c7d` →
  `0386bb97`, migration `20260927210000-add-registry-characters-world.js`,
  restart 8 → 9), lettered BH, on Evoni's account.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
