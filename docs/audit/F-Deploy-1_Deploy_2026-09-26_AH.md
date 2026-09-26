| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AH, 2026-09-26, backend and frontend, no migration, performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-25_AG.md` (the AG record, #1934). This
document follows that one rather than editing it. Basis: `95418e94347b86dc8ece58602bb81ec5828ef129`
(#1936), the tree Deploy AH moved production to. `origin/main` at filing
is `2b2584fbd61b9214fd9c32918724933096c9b2e6` (#1940), the tree of
Deploy AI, which has its own record,
`F-Deploy-1_Deploy_2026-09-26_AI.md`, filed in the same commit as this
one (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Three standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host, database or running app states. It cannot be reproduced from a
  clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.
- **NOT ATTESTED** marks a post-deploy check that Evoni's account does
  not report (§5.1). Nothing is inferred in its place.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploy is lettered AH, continuing after Deploy AG of the AG record.
It runs no migration (§4.1, §7). Its app test completes AG's steps 3
and 4 (§5.1).

## §0. Evoni's account, verbatim

**ATTESTED (Evoni, 2026-09-26, issue #1944):**

> Deploy AH done. Restart 46 → 47, health `200`. Production at `95418e94`.
> Deploy AH — 2026-09-26 ~00:15 UTC, backend and frontend: 5a60f327 → 95418e94, three commits (#1934, #1935, #1936), 3 files under src/, node -c passed on all three. No migrations in the range. Backup /var/www/html.bak-20260926-pre1936; build 33.80s; entry index-B-sNqrLl.js; HTTP 200. Restart 46 → 47; health 200.

Her app-test results, given afterwards in two parts, are recorded
verbatim in §5.1. The sections below split the account into its claims
and set each beside what the repository measures.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `5a60f327` to `95418e94`. Evoni's
account gives no `git status` read for this deploy.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 5a60f3278 95418e943 2b2584fbd origin/main HEAD
5a60f3278b3d176a0a7bebc73f907b0945258e08
95418e94347b86dc8ece58602bb81ec5828ef129
2b2584fbd61b9214fd9c32918724933096c9b2e6
2b2584fbd61b9214fd9c32918724933096c9b2e6
2b2584fbd61b9214fd9c32918724933096c9b2e6
$ git merge-base --is-ancestor 5a60f3278 95418e943; echo "exit=$?"
exit=0
```

Deploy AG ends at `5a60f3278` (AG record §1, §8); Deploy AH begins
there.

## §2. Deploy AH — 2026-09-26 ~00:15 UTC, backend and frontend

**ATTESTED.**
- Three commits (#1934, #1935, #1936), 3 files under `src/`.
- `node -c` passed on all three.
- No migrations in the range.
- A frontend build (§2.1).
- `pm2 restart`: restart count 46 → 47. `/health` returned 200.

**MEASURED**, `git log --oneline --first-parent 5a60f3278..95418e943`:

```
95418e943 fix(wardrobe): the approval handlers include EpisodeWardrobe's registered alias [skip-automerge] (#1936)
82bb47f60 docs(audit): file the deploy record for Deploy AG [skip-automerge] (#1934)
732246135 fix(wardrobe): the episode styling game shows the real garment images [skip-automerge] (#1935)
```

```
$ git rev-list --count --first-parent 5a60f3278..95418e943
3
$ git rev-list --count 5a60f3278..95418e943
3
```

Three commits, the same three PR numbers, matching Evoni's count.
`git diff --stat 5a60f3278 95418e943 -- src/`:

```
 src/controllers/wardrobeApprovalController.js | 44 +++++++++++++++++----------
 src/controllers/wardrobeLibraryController.js  |  9 ++++--
 src/models/EpisodeWardrobe.js                 | 21 +++----------
 3 files changed, 38 insertions(+), 36 deletions(-)
```

Three files, matching Evoni's count. `git diff --stat` scoped to
`frontend/`, `src/migrations/`, the package files and `docs/`:

```
$ git diff --stat 5a60f3278 95418e943 -- frontend/
 .../src/components/EpisodeWardrobeGameplay.jsx     |  62 ++++++++-
 .../components/EpisodeWardrobeGameplay.test.jsx    | 144 +++++++++++++++++++++
 frontend/src/utils/wardrobeImage.js                |  69 ++++++++++
 frontend/src/utils/wardrobeImage.test.js           |  53 ++++++++
 4 files changed, 323 insertions(+), 5 deletions(-)
$ git diff --name-status 5a60f3278 95418e943 -- src/migrations/
$ git diff --stat 5a60f3278 95418e943 -- package.json package-lock.json frontend/package.json frontend/package-lock.json
$ git diff --stat 5a60f3278 95418e943 -- docs/
 docs/audit/F-Deploy-1_Deploy_2026-09-25_AG.md | 590 ++++++++++++++++++++++++++
 1 file changed, 590 insertions(+)
$ git ls-tree -r --name-only 5a60f3278 src/migrations | wc -l
217
$ git ls-tree -r --name-only 95418e943 src/migrations | wc -l
217
```

Four `frontend/` files, two of them tests
(`EpisodeWardrobeGameplay.test.jsx`, `wardrobeImage.test.js`); two are
source the build bundles (`EpisodeWardrobeGameplay.jsx`,
`utils/wardrobeImage.js`). Evoni's account gives no `frontend/` file
count; it attests a build (§2.1). No migration file changes: 217 at
both ends, matching "No migrations in the range". No package change.
One `docs/` file, the AG record itself (#1934).

- **`node -c`.** The filing session checked out the three files at
  `95418e943` into its own worktree (`git checkout 95418e943 -- <the
  three>`; `git diff --stat 95418e943 -- <the three>` then printed
  nothing), ran `node -c` on each, and restored them from `HEAD`:

  ```
  $ n=0; for f in src/controllers/wardrobeApprovalController.js src/controllers/wardrobeLibraryController.js src/models/EpisodeWardrobe.js; do node -c "$f" && n=$((n+1)) && echo "ok $f"; done; echo "all $n ok"
  ok src/controllers/wardrobeApprovalController.js
  ok src/controllers/wardrobeLibraryController.js
  ok src/models/EpisodeWardrobe.js
  all 3 ok
  ```

  That is a repository read; the host's own `node -c` run is ATTESTED.
- **Outside `src/`, `frontend/` and `docs/`**, the range changes one
  file under `scripts/` (`schema-agreement.baseline`, #1936) and one
  under `tests/` (`tests/unit/routes/episodeWardrobeAlias.test.js`,
  #1936). `git diff --stat 5a60f3278 95418e943`: 10 files, 1190
  insertions, 44 deletions. None of these is served.

**Classification**, from each commit's own `git show --stat`:

| Commit | PR | Class | Served files it changes |
|---|---|---|---|
| `732246135` | #1935 | frontend | `EpisodeWardrobeGameplay.jsx`, `utils/wardrobeImage.js` (plus 2 test files) |
| `82bb47f60` | #1934 | docs | `docs/audit/F-Deploy-1_Deploy_2026-09-25_AG.md` (not served) |
| `95418e943` | #1936 | backend | `src/controllers/wardrobeApprovalController.js`, `src/controllers/wardrobeLibraryController.js`, `src/models/EpisodeWardrobe.js` |

#1935 and #1934 touch no `src/` file, so the net 3 is #1936's 3. No
commit touches `src/migrations/`.

**Counts, side by side.**

| Claim | ATTESTED | MEASURED |
|---|---|---|
| Commits | 3 (#1934, #1935, #1936) | 3 first-parent, 3 total; the same three PR numbers |
| Files under `src/` | 3 | 3 |
| Frontend | a build (§2.1); no file count given | 4 files under `frontend/`, 2 of them tests |
| Migrations | none in the range | 0 files changed under `src/migrations/`; 217 → 217 |
| Packages | not stated | no output for the root or `frontend/` package files |

No count differs.

### §2.1 Frontend

**ATTESTED (Evoni).**
- Backup of the served bundle: `/var/www/html.bak-20260926-pre1936`.
- Frontend build: 33.80s.
- Entry bundle: `index-B-sNqrLl.js`.
- HTTP 200 after the deploy.

**Beside it, from the register.** AG built no frontend (AG record
§2.1), so the bundle AH replaced is AF's, whose ending entry name the AF
record §2.1 attests as `index-fBcuWgnP.js`. Evoni's AH account names
only the new entry, not the old one; both names stay ATTESTED.

**What the repository cannot confirm.** Bundle hashes are produced by a
build on the host and are not committed (`frontend/dist/` is not in the
tree), so no read of this repository confirms the entry name, the build
time, the backup path or the HTTP status. All four stay ATTESTED.

### §2.2 Housekeeping: the pending host restart

**ATTESTED (AF record §2.2; carried as pending by the AG record §2.2).**
After AF the box wanted a system restart.

Evoni's AH account (§0) does not report that restart as done. It is
recorded here as **still pending**, with no ruling. The filing session
measures nothing here.

## §3. The time

**ATTESTED:** 2026-09-26 ~00:15 UTC.

**MEASURED:** the end commit `95418e943` (#1936) was committed
2026-09-26 00:00:18 UTC:

```
$ git log -1 --format=%cI 95418e943
2026-09-25T20:00:18-04:00
$ TZ=UTC git log --first-parent --format='%h %cd %s' --date=iso-local 5a60f3278..2b2584fbd
2b2584fbd 2026-09-26 00:52:17 +0000 fix(wardrobe): the styling game offers, shows and locks only what Lala can wear [skip-automerge] (#1940)
ccccafff5 2026-09-26 00:20:42 +0000 fix(coins,wardrobe): coins never go below zero; episode_wardrobe keeps one index of each [skip-automerge] (#1938)
95418e943 2026-09-26 00:00:18 +0000 fix(wardrobe): the approval handlers include EpisodeWardrobe's registered alias [skip-automerge] (#1936)
82bb47f60 2026-09-25 23:57:12 +0000 docs(audit): file the deploy record for Deploy AG [skip-automerge] (#1934)
732246135 2026-09-25 23:53:57 +0000 fix(wardrobe): the episode styling game shows the real garment images [skip-automerge] (#1935)
```

| Deploy | ATTESTED time | MEASURED: committer date of the attested end commit |
|---|---|---|
| AH | 2026-09-26 ~00:15 | `95418e943` 2026-09-26 00:00:18 |

The attested ~00:15 is after that merge, and before the next merge
(`ccccafff5`, 00:20:42), which is Deploy AI's (AI record §2).

**Beside it, from GitHub (read, not written).** Issue #1937, whose body
cites "Seen on Deploy AH (ATTESTED, Evoni, 2026-09-26)", was created
2026-09-26 00:14:31 UTC. So the deploy was live by about 00:14; that is
within the "~" of the attested ~00:15, and is noted, not a
disagreement.

## §4. Pre-deploy checks

### §4.1 `scripts/check-pending-migrations.js`

**ATTESTED.** "No migrations in the range." Evoni's AH account reports
no `check-pending-migrations` run.

**Beside it, from the register.** The AG record §4.1 attests 3 pending
of 217 after AG's hand-run migration, "the same three".

**MEASURED.** The tree has 217 migration files at `5a60f3278` and 217
at `95418e943` (§2); `git diff --name-status` over `src/migrations/`
prints nothing. With no migration added, the pending count has no
reason to move from AG's attested 3 of 217; that the host's count is
still 3 is not attested for AH, and is not inferred.
`scripts/check-pending-migrations.js` and `DEVELOPMENT_WORKFLOW.md` are
unchanged in the range (`git diff --stat 5a60f3278 2b2584fbd --
scripts/check-pending-migrations.js DEVELOPMENT_WORKFLOW.md` prints
nothing).

## §5. What went live

**MEASURED**, from the commits' own diffs and messages, lines cited at
`95418e943`. That these are live rests on the ATTESTED deploy (§2). The
PR numbers are the merged PRs; the task numbers are from each commit
body.

- **The AG record (#1934, `82bb47f60`, `Task: #1930`).**
  `docs/audit/F-Deploy-1_Deploy_2026-09-25_AG.md`, 590 lines added. Not
  served.
- **The styling game shows the real garment images (#1935,
  `732246135`, `Task: #1931`).**
  - One resolver, `resolveWardrobeImageUrl`
    (`frontend/src/utils/wardrobeImage.js` line 67, over
    `resolveWardrobeImage`, line 51), picks the URL named by
    `primary_image_variant` first (line 54; order documented lines
    11–16).
  - `GarmentImage` (`frontend/src/components/EpisodeWardrobeGameplay.jsx`
    lines 84–86, with `GarmentImageInner` from line 89) draws each item
    card, each filled slot and the inspect modal through that resolver.
    The category emoji stays as the placeholder when an item has no
    image and replaces an image that fails to load (`onError`).
- **The approval handlers use EpisodeWardrobe's registered alias
  (#1936, `95418e943`, `Task: #1926`).**
  - `src/models/index.js` registers `EpisodeWardrobe` → `Wardrobe` as
    `'wardrobeItem'` (line 1273). The approval handlers now include that
    alias (`src/controllers/wardrobeApprovalController.js` lines 41, 94,
    141, 185, 230) and `getSuggestions` does too
    (`src/controllers/wardrobeLibraryController.js` line 1347).
  - The response key stays `wardrobe`: `withWardrobeKey`
    (`wardrobeApprovalController.js` line 8).
  - The handlers read Episode's `show_id`, not the undefined `showId`
    (`wardrobeApprovalController.js` lines 82, 173, 359;
    `wardrobeLibraryController.js` line 1368).
  - `EpisodeWardrobe.associate()`, which declared the same association
    a second time as `'wardrobe'` and was never called, is removed
    (`src/models/EpisodeWardrobe.js`, 21 lines changed; the `indexes`
    block untouched).

### §5.1 Post-deploy checks

Evoni's deploy account (§0) attests `/health` 200 and the restart. Her
app-test results, given afterwards on issue #1944, are recorded below
verbatim and as ATTESTED.

**ATTESTED (Evoni, 2026-09-26, app test part 1, verbatim):**

> The images work. Real garments in the cards, the inspect modal and the slot chip — sage midi, polka dot mini, the pearl earrings. That's #1935 confirmed live. … The earrings are in the outfit, Outfit Synergy moved from 0 to 32 with its breakdown (+16 base, +15 tier harmony, +2 coverage), and Lala's line changed from "I don't know about this…" to "It's… something." The game is working. … "For This Event" shows only unaffordable items while affordable owned ones exist.

**ATTESTED (Evoni, 2026-09-26, the lock, verbatim):**

> Deploy AH app-test results, ATTESTED 2026-09-26. Step 3, the lock: PASS. After Evoni granted 2000 coins by direct UPDATE, she equipped and locked a dress, shoes and jewellery. Three episode_wardrobe rows were written, all approval_status 'approved' at 00:39:29 — the first rows that table has ever held. The three items are now is_owned = true. Coins went 2000 → 945, matching 285 + 385 + 385 exactly, so the purchases deducted correctly and the lock did not half-succeed. Step 4, read-back: PASS — the Wardrobe tab shows "Outfit Locked, Synergy 36/100" and Getting Ready 3/5 with outfit, shoes and jewellery ticked.
>
> One new bug: the COINS figure in the styling header does not refresh after a purchase. It showed 2000 while the database held 945. Display only; the balance is correct.

**Also ATTESTED earlier that evening (Evoni's correction, recorded on
#1932 and in the AG record §5.1).** Show 9bd0655f has 15 owned items;
AG's step 3 was blocked only by a 385-coin item against 350 coins.

**The coin grant is a production data write outside the app.** Evoni
granted 2000 coins "by direct UPDATE". That is recorded here as
ATTESTED, as she gave it, with no ruling. The repository records no
SQL for it and this record does not measure it.

| Step | What was checked | Standing |
|---|---|---|
| — | Real garment images in the cards, the inspect modal and the slot chip (#1935) | ATTESTED PASS |
| — | Synergy and Lala's line react to an equipped item | ATTESTED (0 → 32, "It's… something.") |
| 3 | A locked pick writes `episode_wardrobe` rows | ATTESTED PASS: three rows, all `approved`, at 00:39:29; the first the table has held |
| 3 | The purchases deduct correctly and the lock does not half-succeed | ATTESTED PASS: 2000 → 945; three items now `is_owned = true` |
| 4 | The rows read back as the episode's look | ATTESTED PASS: "Outfit Locked, Synergy 36/100", Getting Ready 3/5 |
| — | "For This Event" offers only unaffordable items while affordable owned ones exist | ATTESTED observation; filed as #1937 |
| — | The COINS header does not refresh after a purchase | ATTESTED observation ("Display only; the balance is correct") |

**AH completes AG's steps 3 and 4.** AG's step 3 was BLOCKED and step 4
not reached (AG record §5.1). AH's lock is the first attested write of
`episode_wardrobe` rows and their read-back, so #1929's check carried in
the AG record is now **ATTESTED**, in this record. The AG record is not
edited.

**Beside the lock, MEASURED at `95418e943`.**
- **The lock used the per-piece `/select` path.** `lockOutfit`
  (`frontend/src/components/EpisodeWardrobeGameplay.jsx` line 502)
  awaits one `POST /api/v1/wardrobe/select` per filled slot (line 508).
  `/select` (`src/routes/wardrobe.js` line 1210) auto-purchases a
  coin-locked, unowned item when the balance covers it (lines
  1231–1281): one transaction that deducts `coins = coins - :cost` and
  writes the ledger row (lines 1251–1269), then, outside that transaction, marks the
  item `is_owned = true` (lines 1270–1276). It then upserts the link as
  `approval_status = 'approved'`, `approved_at = NOW()` (lines
  1295–1297). Three pieces each passing this path give three approved
  rows, three owned items and a total deduction of the three costs,
  which is what Evoni attests: 285 + 385 + 385 = 1055, and
  2000 − 1055 = 945. Each piece is its own transaction, so a later
  failure could have left earlier pieces bought; this lock did not
  half-succeed (ATTESTED), and the all-or-nothing lock is #1940,
  deployed in AI (AI record §5).
- **Why the header stayed at 2000.** The header prints `coins`
  (line 556), which is `localCoins ?? characterState.coins`
  (line 193). `purchaseItem` sets `localCoins` from `coins_after`
  (line 479), but `lockOutfit` ignores `/select`'s responses and never
  sets it, so a lock's auto-purchases leave the header at the balance
  the page loaded with. That matches the attested bug.
- **Synergy is a browser figure.** The 32 and 36 come from
  `calculateSynergy` (`EpisodeWardrobeGameplay.jsx` line 126), a
  formula in the page. The AI record §5.1 sets out why the same outfit
  later shows 20 after a reload (#1943).

**Findings filed from AH's test** (issue titles read from GitHub, not
written):
- **#1937**, "Styling game: the pool, the tabs and Lock ignore whether
  Lala can actually wear an item" (the "For This Event" observation,
  the Closet/Search tabs, and the piece-by-piece lock). Fixed by #1940,
  deployed in AI.
- **#1939**, "WorldAdmin wardrobe edit can silently unown an item after
  a bulk op (tier '', lock_type 'none', is_owned false)". Open.
- **#1941**, "Styling game follow-ups: items aren't checked against the
  show; Closet/Search empty state reads the pool". Open.

This record rules on none of them.

**Carried forward from the AG record §5.1.** AH attests #1929's write
and read-back. The rest remain **NOT ATTESTED at filing**, and none is
inferred:

| PR | What to watch | Standing |
|---|---|---|
| #1929 (AG) | A locked pick writes `episode_wardrobe` rows, and they read back as the episode's look | ATTESTED by AH steps 3 and 4 |
| #1935 (AH) | The styling game shows real garment images | ATTESTED (part 1) |
| #1936 (AH) | Approve, reject, approval-status and suggestions answer without an eager-loading error | NOT ATTESTED |
| #1912 (AF §5.1) | Start Episode lands on Production → Assets | NOT ATTESTED |
| #1914 (AF §5.1) | The Phone tab leads with Preview Phone | NOT ATTESTED |
| #1922 (AF §5.1) | Save draft persists across a reload | NOT ATTESTED |
| #1915 (AF §5.1) | The version routes answer 501 | NOT ATTESTED |
| #1896 (AE §5.1) | Stream events arrive live through nginx, not buffered into one burst | NOT ATTESTED |
| #1896 (AE §5.1) | No doubled updates between live events and the REST refresh | NOT ATTESTED |
| #1900 (AE §5.1) | The Assistant streams, and an AI Writer action returns text | NOT ATTESTED |

Seven checks carried from AF and AE remain NOT ATTESTED, plus AH's own
#1936 check. `/health` 200 is a process check; it is not these.

## §6. Restarts

**ATTESTED (Evoni).**

| Restart | Deploy |
|---|---|
| 46 → 47 | AH |

**Beside it, from the register.** Deploy AG's restart was 45 → 46 (AG
record §6). AH's 46 → 47 follows it with no gap.

## §7. Hand-run schema changes

None. Evoni attests "No migrations in the range", and the range changes
no file under `src/migrations/` (§2). The coin grant (§5.1) is a data
write, not a schema change, and is recorded there.

## §8. Basis statement

**MEASURED.** After Deploy AH, production's tree is this record's basis,
`95418e943`. No commit on `origin/main` up to and including `95418e943`
is undeployed, on Evoni's attested list.

**Merged after AH** (MEASURED at filing):

```
$ git log --oneline --first-parent 95418e943..2b2584fbd
2b2584fbd fix(wardrobe): the styling game offers, shows and locks only what Lala can wear [skip-automerge] (#1940)
ccccafff5 fix(coins,wardrobe): coins never go below zero; episode_wardrobe keeps one index of each [skip-automerge] (#1938)
$ git log --oneline --first-parent 2b2584fbd..origin/main
```

Both were deployed as Deploy AI (AI record §2). The second command
prints nothing: `origin/main` is `2b2584fbd` at filing (§1).

## §9. What this document does not do

This document:

- does not rule on the coin grant by direct `UPDATE` (§5.1), and
  re-derives no production data;
- does not rule on any §5.1 check or on #1937, #1939 or #1941, beyond
  citing them;
- does not rule on the pending host restart (§2.2), and does not act on
  it;
- does not edit the AG record, the AF record or any migration. AG's
  steps 3 and 4 are recorded as completed here, not there;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS,
  database or Cognito contact. Every ATTESTED claim above is Evoni's own
  account, taken outside any agent session. Every MEASURED claim is a
  repository read this filing session performed itself; the issue titles
  and creation time are GitHub reads, with nothing written;
- records no secret anywhere above.

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

Unchanged from the AG record §10. Nothing minted here.

## §Standing

- §1–§4 each carry an ATTESTED clause and a MEASURED clause, marked
  separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host, database and running app, not reproducible from a
    clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- No attested count differs from the measurement (§2). The time is
  recorded as attested, with the end commit's merge beside it (§3).
- §2.1 and §2.2 are ATTESTED only; the host restart is still pending.
- §5 is MEASURED for what the code does; that it is live rests on §2.
  §5.1's image check, lock (step 3) and read-back (step 4) are ATTESTED
  PASS; they complete AG's steps 3 and 4. The coin grant by direct
  `UPDATE` is ATTESTED, with no ruling. The per-piece `/select` path and
  the unrefreshed header are MEASURED beside the attested results and
  agree with them. #1936's check and seven carried checks are NOT
  ATTESTED at filing.
- No migration ran (§7).
- Nothing in this document is labelled RULED, and nothing is INFERRED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1);
  agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1944.*
