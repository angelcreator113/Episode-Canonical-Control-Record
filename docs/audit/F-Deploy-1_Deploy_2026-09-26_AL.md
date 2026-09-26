| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AL, 2026-09-26, backend only, no migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-26_AK.md` (the AK record, #1957). This document
follows that one rather than editing it. Basis:
`35394cb4d2653b57717fd67f41082f00819a38f0` (#1957), the tree Deploy AL moved
production to. `origin/main` at filing is
`70b42b9f4a93d016536feccd9d487286bf8dfbb2` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce, and register documents
  already merged under `docs/audit/`.

Nothing here is INFERRED, and nothing is RULED. This document closes no
keystone, discharges no owed item, mints no FD, XK or PE number, and does not
rule on the standing of F-AUTH-1 G3 clause 3 (§5.2) or on #1946 (§5.3).

The deploy is lettered AL, continuing after Deploy AK of the AK record.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-26), verbatim in substance:**

- Tree `7c7f8d48` → `35394cb4`. Backend only; no `vite build`, no rsync; the
  served entry stays `index-BrWEe0ti.js` from AK.
- Restart at 08:34:27 UTC, per the app's own startup line in the pm2 log;
  SSH login at 08:32:56.
- No backup (the bundle backup runs only when the frontend rebuilds).
- `node -c` passed on both changed files. No migrations.
- pm2 restart 50 → 51; `/health` 200.
- Post-deploy error log checked: nothing after the 08:34:27 startup line.
  One "Not allowed by CORS" 500 appears above it and predates this deploy;
  recorded, not attributed to AL.
- Clause 3 exercised live for the first time: a `decision_log` row with
  source `'styling_game'`, `created_at` 2026-09-26 08:36:18.311+00, carrying
  the signed-in user's id. The id is Evoni's own Cognito user id, confirmed
  by her against the row; value not recorded.
- Also observed live: Outfit Synergy 87 (+54 base, +6 aesthetic, +15 tier
  harmony, +6 event alignment, +6 coverage), the line "They're not ready for
  me", and the coins header reading 560.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `7c7f8d48` to `35394cb4`.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 7c7f8d48 35394cb4 origin/main HEAD
7c7f8d4849e22f99e4d6f43b3f5840bbd83c85f8
35394cb4d2653b57717fd67f41082f00819a38f0
70b42b9f4a93d016536feccd9d487286bf8dfbb2
70b42b9f4a93d016536feccd9d487286bf8dfbb2
$ git merge-base --is-ancestor 7c7f8d48 35394cb4; echo "exit=$?"
exit=0
```

(`HEAD` is this filing session's branch point before this record's commit.)
Deploy AK ends at `7c7f8d48` (AK record §1, §8); Deploy AL begins there.

## §2. The range — MEASURED

```
$ git log --oneline 7c7f8d48..35394cb4
35394cb4 docs(audit): file the deploy record for Deploy AK [skip-automerge] (#1957)
25eccd58 fix(decision-log): the styling game's browse pool records who generated it [skip-automerge] (#1956)

$ git diff --name-only 7c7f8d48..35394cb4 -- src/ frontend/src/ src/migrations/
src/routes/wardrobe.js
src/utils/decisionLogger.js

$ git diff --name-status 7c7f8d48 35394cb4
A	docs/audit/F-AUTH-1_G3Clause3_Retarget_Correction_2026-09-26.md
A	docs/audit/F-Deploy-1_Deploy_2026-09-26_AK.md
M	src/routes/wardrobe.js
M	src/utils/decisionLogger.js
M	tests/integration/f-auth-1-g3-clause3.test.js
A	tests/unit/routes/wardrobe-browsePool-decisionLog.test.js
M	tests/unit/utils/decisionLogger.userId.test.js

$ git ls-tree -r --name-only 35394cb4 src/migrations | wc -l
218
```

Exactly two commits: #1956 carries the code (two backend files) and #1957
files the AK record. Nothing under `frontend/src/` and nothing under
`src/migrations/` changes; 218 migration files, as at AK.

**Beside her account.** "Backend only", "no migrations" and "both changed
files" agree with the measurement: the range changes exactly two backend
files and no frontend file.

## §3. The time

**ATTESTED:** SSH login 08:32:56 UTC; restart 08:34:27 UTC (the app's
startup line); the clause-3 row at 08:36:18.311 UTC.

**MEASURED:** both commits were committed before the login (committer times,
UTC-4):

```
$ git log --first-parent --format="%h %cI %s" 7c7f8d48..35394cb4
35394cb4 2026-09-26T04:27:09-04:00 docs(audit): file the deploy record for Deploy AK [skip-automerge] (#1957)
25eccd58 2026-09-26T04:23:27-04:00 fix(decision-log): the styling game's browse pool records who generated it
```

#1956 at 08:23:27 UTC and #1957 at 08:27:09 UTC, then login 08:32:56,
restart 08:34:27 and the row 08:36:18: the order is consistent.

## §4. Pre-deploy checks

**ATTESTED.** `node -c` passed on both changed files. Her account reports no
`check-pending-migrations` run for AL.

**MEASURED.** Both files parse at `35394cb4`:

```
$ git show 35394cb4:src/routes/wardrobe.js > wardrobe.js && node -c wardrobe.js; echo "exit=$?"
exit=0
$ git show 35394cb4:src/utils/decisionLogger.js > decisionLogger.js && node -c decisionLogger.js; echo "exit=$?"
exit=0
```

The range changes no migration file (§2), so the 218 files are the same 218
the AJ record §4.1 attests a clean check over.

## §5. What went live

### §5.1 The change, MEASURED

#1956 (`25eccd58`): `POST /api/v1/wardrobe/browse-pool` (`requireAuth`,
`src/routes/wardrobe.js:1093` at `35394cb4`) now writes a
`browse_pool_generated` row to `decision_log` through
`recordBrowsePoolGenerated` (`:1071-1087`), which calls
`DecisionLogger.logBrowsePoolGenerated` with `user_id: req.user.id` (`:1077`)
and `source: 'styling_game'` (`:1082`). A failed write is logged, not
swallowed (`:1085`). `logBrowsePoolGenerated` takes an optional `source`,
defaulting to `'evaluate_page'` (`src/utils/decisionLogger.js:235`).

### §5.2 G3 clause 3: exercised in production

**ATTESTED.** The first `decision_log` row from the live route: source
`'styling_game'`, `created_at` 2026-09-26 08:36:18.311+00, carrying the
signed-in user's id, which Evoni confirmed against the row as her own
Cognito user id. The value is not recorded here.

**Beside it, from the register.**
`docs/audit/F-AUTH-1_G3Clause3_Retarget_Correction_2026-09-26.md` §5 (filed
in this range, #1956) marks clause 3's evidence on this route "NOT YET
EXERCISED" and names the production check: open the closet once while
signed in, read the newest `decision_log` row, and compare its `user_id`
with the `id` that `GET /api/v1/auth/me` returns for the same session. It
states that a row with `source = 'styling_game'`, a `created_at` from the
closet load and `user_id` equal to `/auth/me`'s `id` is the production
evidence.

Her account gives the source and `created_at` that §5 names, and a `user_id`
she confirmed as her own. It does not say the comparison was made against
`/auth/me` specifically. This record states only what she attested. Whether
§5 is now satisfied, and so whether clause 3's evidence stands, is for the
F-AUTH-1 register to record; this document does not rule it and does not
edit the amendment.

### §5.3 The Outfit Synergy breakdown

**ATTESTED.** Outfit Synergy 87: +54 base, +6 aesthetic, +15 tier harmony,
+6 event alignment, +6 coverage.

**MEASURED, at `35394cb4`**, in `getOutfitScore` (`src/routes/wardrobe.js`):

```
$ git show 35394cb4:src/routes/wardrobe.js | sed -n '1948,1954p'
    const sigDelta = (type) => (result.signals || [])
      .filter(s => s.type === type)
      .reduce((sum, s) => sum + (s.delta || 0), 0);
    const aesthetic = Math.max(0, Math.round((sigDelta('color_harmony') || 0) + 6));
    const event_alignment = Math.max(0, Math.round((sigDelta('occasion_precision') || 0) + 6));
    const coverage = Math.min(10, Math.round(((result.slots || []).filter(s => s.items?.length).length) * 2));
    const base = Math.max(0, total - aesthetic - tier_harmony - event_alignment - coverage);
```

Lines 1951–1952 add a constant 6 to the `color_harmony` and
`occasion_precision` signal sums, so a reading of exactly 6 means those
signals netted to zero (none present, or deltas cancelling). Line 1954
derives `base` by subtraction from the total, so +54 is what remains of 87
after the other four terms. The attested +6 aesthetic and +6 event alignment
are consistent with #1946. This record rules nothing on #1946.

### §5.4 Post-deploy checks

**ATTESTED.** pm2 restart 50 → 51; `/health` 200; the error log shows
nothing after the 08:34:27 startup line. The one "Not allowed by CORS" 500
above that line predates this deploy and is not attributed to AL. Also
observed: the line "They're not ready for me" and the coins header reading
560. Recorded as given.

## §6. Frontend and restarts

**ATTESTED.** Backend only: no `vite build`, no rsync, no backup; the served
entry stays `index-BrWEe0ti.js`. pm2 restart 50 → 51.

**Beside it, from the register.** `index-BrWEe0ti.js` is the entry the AK
record §2.1 attests, and AK's restart was 49 → 50 (AK record §0, §6). AL's
50 → 51 continues that count. The range changes no frontend file (§2), so no
rebuild was needed.

## §7. Schema changes

**ATTESTED.** No migrations.

**MEASURED.** No file under `src/migrations/` changes; 218 files (§2).
`decision_log` is an existing table; #1956 adds no column.

## §8. Basis statement

**MEASURED.** After Deploy AL, production's tree is this record's basis,
`35394cb4`. Merged after AL, at filing, after `git fetch origin main`:

```
$ git log --oneline --first-parent 35394cb4..origin/main
70b42b9f docs(phone): read the two phone renderers [skip-automerge] (#1971)
f240f3af docs(audit): F-Deploy-1 Fix Plan v1.54, retire three box directories [skip-automerge] (#1970)
baa69a2d fix(phone): Preview Phone shows the episode's screens, overrides included [skip-automerge] (#1966)
f8d1fb7a fix(phone): one saved skin for Lala's Phone [skip-automerge] (#1965)
15cf3b1e docs(doctrine): record the 2026-09-26 rules [skip-automerge] (#1963)
8c4b19b5 docs(context): refresh basis, §0, §6.5, §10 [skip-automerge] (#1961)
```

The next deploy, AM, moved production on to `baa69a2d`. Its record is owed
under #1968 and is not filed at this basis; this record does not describe it.

## §9. What this document does not do

This document:

- does not record the clause-3 user id or any part of it;
- does not rule on whether F-AUTH-1 G3 clause 3's evidence now stands, and
  does not edit `F-AUTH-1_G3Clause3_Retarget_Correction_2026-09-26.md` or the
  retarget note it corrects (§5.2);
- does not rule on #1946 or change the scoring (§5.3), or on #1958's
  proposed retirement of the world browse-pool route;
- does not attribute the pre-AL CORS 500 to this deploy, and does not rule on
  it;
- does not describe Deploy AM, whose record is owed under #1968;
- does not edit the AK record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow dispatch,
  or credential change of its own, and makes no host, AWS, database or
  Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself;
- records no secret and no database host.

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

Unchanged from the AK record §10. Nothing minted here.

## §Standing

- §1–§4, §6 and §7 each carry ATTESTED and MEASURED clauses, marked
  separately and never merged into one standing.
- Every attested count agrees with the measurement: two commits, two backend
  files (both `node -c` clean), no frontend file, no migration file (218)
  (§2, §4, §7).
- The time agrees: both merges (08:23:27, 08:27:09 UTC) precede the login
  (08:32:56), the restart (08:34:27) and the row (08:36:18) (§3).
- **Clause 3 (§5.2):** exercised live for the first time, ATTESTED; the user
  id is her own, confirmed by her against the row, value not recorded. The
  amendment's §5 check names a comparison with `/auth/me`; her account does
  not say which reference she used. Not ruled.
- **The breakdown (§5.3):** +6 and +6 are the constants at lines 1951–1952
  with no signal contribution, and +54 is the remainder at line 1954;
  consistent with #1946, nothing ruled.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #1960.*
