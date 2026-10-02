| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DM, 2026-10-02, backend and frontend. Seven commits, 65 files, from `fa701417` to `1ffd56bc`: the L14 note (#2493), L14 (a) angles as zones (#2494), the Beat Plan display fix (#2495), D1–D2 scene-set uses and shows (#2497), the S8 note (#2496), S8 scene image work in Scene Sets only (#2498) and L14 (b) zone generation (#2500), with one migration; no package change; one plain restart. Production was at `fa701417`, not at `d3f2edb8` where DL left it: **a gap**. One script deploy ran between DL and DM that no record shows, carrying #2491 and #2492 (restart count 68 → 69); nothing more about it can be told. `scripts/deploy-prod.sh` stopped on the pending migration as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 84/100 with 5 warnings, the same as DL. The app check has not been done yet. Restart count 70.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DL.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DM moved production to,
`1ffd56bcb59c7f61e4a57fd277a44e47acc03d54` (#2500), read 2026-10-02 from
`origin/main` at the same commit (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **CANNOT-TELL**: what neither the account nor the repository shows.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database user, process name, backup directory
name or ARN. The database user the migration ran as is left out, as in
the CW–DL records.

**The letter.** This deploy is lettered **DM**, the letter after DL, as
Evoni named it ("deploy record DM"). It follows DL
(`F-Deploy-1_Deploy_2026-10-02_DL.md`, filed in #2491). The unrecorded
deploy between them (§1) gets no letter here.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
19:55–20:04 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `fa701417`, fetched 7 commits to `1ffd56bc` (#2493, #2494, #2495,
   #2496, #2497, #2498, #2500). The script **stopped at step 3** on
   `20261002170000-scene-angle-zones`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `1ffd56bc`: 65 files.
   - `check-pending-migrations` against the canon instance: **1 pending
     of 254**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002170000` migrated, 0.047 s. Its log: "zones: front 8 (+5
     extras), inside 8 (+0 extras), extras on Inside 36".
   - Re-check: **0 pending of 254**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 38.51 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 70, online.
   - Ready at 20:03:30.
   - `/health` at 2026-10-02T20:03:44Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 20:03:38–20:03:42: **84/100**, 0 critical, **5 warnings**.

**App check: not done yet.** ATTESTED (Evoni): not checked yet.

## §1. Identity and continuity: a gap

**MEASURED.**

```
$ git rev-parse d3f2edb8 fa701417 1ffd56bc
d3f2edb863a593dc2d84df3b8994466cac9f8d71
fa701417c707fa551af82ef056067854993e30a0
1ffd56bcb59c7f61e4a57fd277a44e47acc03d54
$ git merge-base --is-ancestor d3f2edb8 fa701417 && git merge-base --is-ancestor fa701417 1ffd56bc && echo "ancestors: yes"
ancestors: yes
```

DL left production at `d3f2edb8` with restart count 68 (DL record §0).
DM's script started at `fa701417`, and DM's one restart brought the count
to 70 (ATTESTED, §0). **Gap:** the tree moved and one more restart
happened between DL and DM, and no record shows it.

What the gap carried. MEASURED:

```
$ git log --oneline d3f2edb8..fa701417
fa701417c fix(scenes): scene prompts open with the place, furnished; no people as a closing constraint; any described set in the comparison [skip-automerge] (#2492)
6e18c3f75 docs(audit): deploy record DL [skip-automerge] (#2491)
$ git diff --shortstat d3f2edb8 fa701417
 21 files changed, 468 insertions(+), 79 deletions(-)
$ git diff --name-only d3f2edb8 fa701417 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
```

- The DL record (#2491), with no runtime effect.
- The scene-prompt fix (#2492): scene prompts open with the place,
  furnished; "no people" is a closing constraint; any described set can
  be used in the base model comparison.
- No migration and no package change, so a script run would have
  completed without stopping.

**INFERRED.** The script deploys whatever `origin/main` is when it
fetches:

```
$ grep -n 'TARGET_SHA="$(git rev-parse origin/main)"' scripts/deploy-prod.sh
148:TARGET_SHA="$(git rev-parse origin/main)"
```

So the gap deploy fetched while `fa701417` was the head of main: after
#2492 merged (16:16:05 UTC) and before #2493 merged (16:49:51 UTC); see
§3 for the times. One script run in that window, with one restart (68 →
69), fits the account. That it was `deploy-prod.sh` comes from Evoni's
account ("one unrecorded script deploy").

**CANNOT-TELL.** Beyond the range and the restart: its exact time, its
CFO result, its `/health`, and whether anything was checked after it.

## §2. The range — MEASURED

```
$ git rev-list --count fa701417..1ffd56bc
7
$ git log --oneline fa701417..1ffd56bc
1ffd56bcb feat(l14b): each zone is generated from the set's approved base or its base, cost shown first [skip-automerge] (#2500)
96eea22ed feat(s8): scene image work happens in Scene Sets only; other pages show status with Open in Scene Sets [skip-automerge] (#2498)
d2798f85b docs(flow): record ruling S8 (scene image work in Scene Sets only), where that work happens today, and its questions [skip-automerge] (#2496)
717f04252 fix(scene-sets): deleting a set moves its uses to a replacement; new sets get their show; Move my beats [skip-automerge] (#2497)
993e28bd9 fix(beat-plan): each beat shows its set and its picture, labelled; images refresh while generating [skip-automerge] (#2495)
dc0a67ea5 feat(scenes): L14 (a): angles as zones of the place; the beat mapping to zones [skip-automerge] (#2494)
4701072c8 docs(flow): record ruling L14 (angles as zones) and its design note with questions [skip-automerge] (#2493)
$ git diff --shortstat fa701417 1ffd56bc
 65 files changed, 3232 insertions(+), 678 deletions(-)
$ git diff --name-only fa701417 1ffd56bc -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only fa701417 1ffd56bc -- src/migrations/
src/migrations/20261002170000-scene-angle-zones.js
$ for p in frontend src tests docs; do printf "%s %s\n" $p $(git diff --name-only fa701417 1ffd56bc -- $p | wc -l); done
frontend 39
src 14
tests 11
docs 1
$ git diff --name-only fa701417 1ffd56bc -- . ":!frontend" ":!src" ":!tests"
docs/EVENT_EPISODE_FLOW.md
```

This agrees with Evoni's account:
- 7 commits, the seven PRs she named;
- 65 files (39 frontend, 14 backend including the migration, 11 tests,
  1 doc);
- exactly the one migration the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 19:55–20:04 UTC; ready at 20:03:30, CFO 20:03:38 to
20:03:42, `/health` at 20:03:44Z.

**MEASURED.** Merge times on main, DL to DM:

```
$ git log --first-parent --format="%h %cI" d3f2edb8..1ffd56bc
1ffd56bcb 2026-10-02T15:47:39-04:00
96eea22ed 2026-10-02T15:35:39-04:00
d2798f85b 2026-10-02T14:12:53-04:00
717f04252 2026-10-02T14:01:42-04:00
993e28bd9 2026-10-02T13:39:25-04:00
dc0a67ea5 2026-10-02T13:15:04-04:00
4701072c8 2026-10-02T12:49:51-04:00
fa701417c 2026-10-02T12:16:05-04:00
6e18c3f75 2026-10-02T12:05:44-04:00
```

**INFERRED.** #2500, the range's last commit, merged at 19:47:39 UTC,
before Evoni's window, so DM's fetch found it.

## §4. Migrations

**MEASURED.** The tree holds 254 migration files, one more than at
`fa701417`:

```
$ for c in fa701417 1ffd56bc; do git ls-tree -r --name-only $c src/migrations | grep -c "\.js$"; done
253
254
```

**ATTESTED (§0):** 1 pending of 254 before the run, 0 pending of 254
after it. DL recorded 0 pending of 253, and the gap range adds no
migration (§1), so this agrees with the tree.

**The script behaved as designed.** It stopped on the pending file, and
the migration ran **before** the restart, as §7.1 requires on exit 1.
The new code needs it: `SceneAngle` now declares `zone_angle_id`, so
every model read of `scene_angles` selects that column.

## §5. What went live — MEASURED

- **#2494 (`dc0a67ea`). L14 (a), angles as zones** (§8(hh), answers 1–9):
  - zone kinds `front`, `inside`, `back`, `area`, `zone`, and `extra` for
    a framing on a zone (`scene_angles.zone_angle_id`);
  - beats map to zones: arrival (10) → Front; the event (11, 12) → Inside,
    which is the set's base unless an Inside angle has an image;
  - a missing zone reads "Front zone missing".
- **#2495 (`993e28bd`). The Beat Plan display fix:** each beat shows its
  set and its picture (the set's base when no angle is asked for),
  labelled; images refresh while generating.
- **#2497 (`717f0425`). D1–D2:**
  - deleting a set that is in use moves its uses to a chosen replacement,
    or says how many uses will be left;
  - new sets get their show; an existing set's edit form has a Show
    choice;
  - "Move my beats" for an episode whose beats point at removed sets.
- **#2498 (`96eea22e`). S8:** scene image work happens in the set's panel
  in Scene Sets (looks, dressed angles, the exterior video on Front);
  other pages show status and "Open in Scene Sets →", which lands on the
  set and zone with a way back.
- **#2500 (`1ffd56bc`). L14 (b), zone generation:** each zone is one Flux
  Kontext edit of the set's approved base, or its base when none is
  approved, with its own establishing camera; its brief shows that image
  and the cost first; a set with no base refuses (409 `NO_BASE`).
- **#2493 (`4701072c`) and #2496 (`d2798f85`).** Docs. No runtime effect.

Four routes were added in the range:

```
$ git diff fa701417 1ffd56bc -- src/routes | grep -E "^[+-]router\."
+router.get('/:episodeId/dressed-angles', requireAuth, async (req, res) => {
+router.get(
+router.post(
+router.get('/:id/uses', validateUUIDParam('id'), requireAuth, async (req, res) => {
$ git diff fa701417 1ffd56bc -- src/routes | grep -E "^\+router\.(get|post)\($" -A2
+router.get(
+  '/:episodeId/removed-sets',
+  validateUUIDParam('episodeId'),
--
+router.post(
+  '/:episodeId/move-removed-sets',
+  validateUUIDParam('episodeId'),
```

All four are behind `requireAuth`, and none makes an image or AI call.
D1's replacement (`?replacement_id=`) is a change to the existing
`DELETE /scene-sets/:id`, not a new route. L14 (b)'s paid call goes through the existing
angle generate route, which keeps `requireAuth` and `aiRateLimiter`.

## §6. Schema change and restart

**Schema.** MEASURED (from the migration file); ATTESTED (that it ran
and what it logged, §0).

```
$ grep -nE "ALTER TABLE|UPDATE scene_angles|console.log" src/migrations/20261002170000-scene-angle-zones.js
50:     UPDATE scene_angles a SET angle_kind = :zone, zone_angle_id = NULL
54:    `UPDATE scene_angles a SET angle_kind = 'extra',
69:        'ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS zone_angle_id UUID REFERENCES scene_angles(id) ON DELETE SET NULL',
78:        `UPDATE scene_angles SET angle_kind = 'extra', zone_angle_id = NULL
81:      console.log(`[migration 20261002170000] zones: front ${front.kept} (+${front.extras} extras), inside ${inside.kept} (+${inside.extras} extras), extras on Inside ${count(rest)}`);
90:        `UPDATE scene_angles SET angle_kind = CASE
98:      await sequelize.query('ALTER TABLE scene_angles DROP COLUMN IF EXISTS zone_angle_id', { transaction });
```

- **`scene_angles.zone_angle_id`** (new, uuid, nullable, references
  `scene_angles`; `ON DELETE SET NULL`).
- **Re-kinding.** The migration writes only `angle_kind` and
  `zone_angle_id`; it touches no image column, so no image was
  regenerated or deleted. Its log, ATTESTED: 8 Front zones kept (5 more
  front-kind angles became extras on them), 8 Inside zones kept (none
  became extras), and 36 angles became extras on Inside. **INFERRED:**
  57 angles were re-kinded in all (8 + 5 + 8 + 36); `area` angles were
  left as they were and are not in that count.
- Guarded and re-runnable. `down` restores the earlier kinds, except
  "other" and the extras' zones, then drops the column.

**Restart.** ATTESTED.
- One plain `pm2 restart`: restart count 70, online.
- `.env` unchanged, so a plain restart was right.

**CFO.** ATTESTED: 84/100, 0 critical, 5 warnings, the same as DK and DL.
The likely cause of the fifth warning was RULED at DK (§6a of that
record); nothing here changes it.

## §7. The app check, when done

Not done yet (ATTESTED). INFERRED from the range, these are what this
deploy changed that a check would see:
- Scene Sets: the Show choice on a set's edit form (Evoni's three new
  sets, Lala's bedroom, lala's closet and Lala's home, still need their
  show); Delete on a set in use asks for a replacement.
- Beat Plan and Scenes tab: each beat shows its set and picture, and
  "Open in Scene Sets →" lands on the set and zone; a banner offers
  "Move my beats" when beats point at removed sets.
- A set's angles read as zones (Front, Inside, extras); a zone's Generate
  shows the image it is made from and its Kontext cost first.
- Looks and dressed angles are made in the set's panel, no longer on the
  Event Package or World Admin.

## §8. Basis statement

**MEASURED.** Production's tree after Deploy DM is `1ffd56bc` (#2500),
which is `origin/main` at filing:

```
$ git rev-parse origin/main
1ffd56bcb59c7f61e4a57fd277a44e47acc03d54
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential, database user, process name or host.
- It edits no filed document, including the DL record.
- It reads no production schema, calls no production endpoint, and
  queries nothing in production.
- It letters, dates or measures nothing about the unrecorded deploy
  beyond §1.
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

- **Continuity: a gap.** DL left production at `d3f2edb8` (restart 68).
  One unrecorded script deploy moved it to `fa701417` (#2491, #2492; no
  migration, no package change; restart 69). Its time is INFERRED to
  fall between 16:16:05 and 16:49:51 UTC; nothing else about it can be
  told.
- **Range:** `fa701417` → `1ffd56bc`, 7 commits, 65 files, one migration,
  no package or lock file. The tree agrees with Evoni's account.
- **Deploy:** the script stopped on the pending migration as designed.
  By hand, per §7.1:
  - fast-forward; 1 pending, migrated (`scene_angles.zone_angle_id`
    added; angles re-kinded as zones, no image touched), then 0 pending
    of 254;
  - build; one restart (count 70); ready; `/health` healthy and
    connected.
- **CFO:** 84/100, 0 critical, 5 warnings, unchanged from DL.
- **App check:** not done yet (ATTESTED). §7 lists what to look at.
- **Live:** L14 (a) zones; the Beat Plan display fix; D1–D2; S8; L14 (b)
  zone generation.
- RULED here: nothing. Nothing is minted. The filing session made no
  host, AWS, database or Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
