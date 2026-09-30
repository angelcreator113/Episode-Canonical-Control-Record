| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CO, 2026-09-30, backend and frontend, no migration, no dependency change, one plain restart. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. The Event Package back-link (#2358) and the Events page redesign (#2362, #2364) go live. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CN.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `0c20714a3d647d421238dd6d1dca6dc612c87ed9` (#2364),
read 2026-09-30. This is the tree Deploy CO moved production to (§8).

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
path, account number, database user or ARN. The pending-migration line in
Evoni's paste named the database user the check read as; it is left out
here.

**The letter.** This deploy is lettered **CO**. It follows CN
(`F-Deploy-1_Deploy_2026-09-30_CN.md`, #2357), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
14:04–14:05 UTC, from `scripts/deploy-prod.sh` in its order:

1. **Fast-forward.** Tree `c043eb0b` → `0c20714a` (fast-forward): 4
   commits, 20 files; PRs #2357, #2358, #2362, #2364. The script reported
   no migration and no package or lock file in the range.
2. **Backup.** `frontend/dist` was backed up (sortable name, stamped
   2026-09-30T14:04:17Z).
3. **Build.** `vite build`, built in 34.47 s.
4. **Pending migrations.** The check read `SequelizeMeta` with
   `NODE_ENV=production` against the canon instance's `episode_metadata`
   database (the user is left out): **0 pending of 227** migration files,
   exit 0. Evoni confirmed the database.
5. **Environment.** `ANTHROPIC_API_KEY` appears in `.env` once (count 1;
   the value was not read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 44.
   - Ready line at 14:05:11: "Ready to accept requests".
   - `/health` at 2026-09-30T14:05:13Z: healthy, database connected,
     environment production, uptime 9.2 s.
7. **CFO.** Scheduled audit 14:05:18–14:05:22: **89/100**, 0 critical, 4
   warnings (4297 ms).

**App check (Evoni):** "the Events page is much clearer." This is her
look at the redesigned Events page. It covers that page, not every change
in the range.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor c043eb0b16adefad07ca6c18d074a202aa999cf2 0c20714a3d647d421238dd6d1dca6dc612c87ed9 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CN ends at `c043eb0b` (CN record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CN left it at 43 (CN
record §6), and CO's single restart brings it to 44.

## §2. The range — MEASURED

```
$ git rev-list --count c043eb0b..0c20714a
4
$ git log --oneline c043eb0b..0c20714a
0c20714a3 feat(events): Events cards and a deal-type filter (redesign B) [skip-automerge] (#2364)
7b752e034 feat(events): Events page cleanup and pagination (redesign A) [skip-automerge] (#2362)
4b3f4724d feat(events): link back to the Event Package after Start Episode [skip-automerge] (#2358)
cf05e95bd docs(audit): deploy record CN [skip-automerge] (#2357)
$ git diff --shortstat c043eb0b 0c20714a
 20 files changed, 1397 insertions(+), 423 deletions(-)
$ git diff --name-only c043eb0b 0c20714a -- src/migrations/
$ git diff --name-only c043eb0b 0c20714a -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only c043eb0b 0c20714a -- frontend/ | wc -l
18
$ git diff --name-only c043eb0b 0c20714a -- src/
src/routes/worldEvents.js
```

This agrees with Evoni's account:
- 4 commits, the four PRs named;
- 20 files;
- no migration;
- no package or lock file.

18 of the 20 files are under `frontend/`, so the build used new sources. One
backend file changed, `src/routes/worldEvents.js`, so the restart was
needed to load it.

## §3. The time

**ATTESTED.** The deploy ran about 14:04–14:05 UTC: backup stamped
14:04:17Z, ready at 14:05:11, `/health` at 14:05:13Z, CFO done 14:05:22.

**MEASURED.** The range's last commit, #2364, is at 14:02:59 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" c043eb0b..0c20714a
0c20714a3 2026-09-30T10:02:59-04:00 feat(events): Events cards and a deal-type filter (redesign B) [skip-automerge] (#2364)
7b752e034 2026-09-30T09:54:33-04:00 feat(events): Events page cleanup and pagination (redesign A) [skip-automerge] (#2362)
4b3f4724d 2026-09-30T09:23:42-04:00 feat(events): link back to the Event Package after Start Episode [skip-automerge] (#2358)
cf05e95bd 2026-09-30T09:15:09-04:00 docs(audit): deploy record CN [skip-automerge] (#2357)
```

## §4. Migrations

**MEASURED.** The tree still holds 227 migration files, as at CN:

```
$ git ls-tree -r --name-only 0c20714a src/migrations | grep -c '\.js$'
227
```

**ATTESTED (§0):** 0 pending of 227. This agrees with the tree and with CN,
which left 0 pending.

## §5. What went live — MEASURED

- **#2358 (`4b3f4724`), Task #2356: link back to the Event Package after
  Start Episode.**
  - A used event's card shows View Event Package next to Open Episode.
  - The episode header and Overview link to the source event's Event
    Package; the source event is found through `episode_briefs.event_id`
    (§8(w) P2).
  - The package GET (`src/routes/worldEvents.js`) now returns
    `termsLockedBy`, from `findTermsLockEpisode`. A locked package opens
    read-only, with a "Locked at Start Episode" note.
- **#2362 (`7b752e03`), Task #2360: Events page redesign A.**
  - The panels below the queue are removed: Story Logic Warnings and its
    badge, Draft Events, the Episode → Event map, the coverage, difficulty
    and budget totals, and the Season Arc.
  - Ideas opens as a drawer from the header.
  - Wardrobe conflicts are a chip on the affected card.
  - 9 cards a page, with the page kept in the URL.
- **#2364 (`0c20714a`), Task #2361: Events page redesign B.**
  - Each card shows its name; organizer · date · deal type; one status
    chip; a readiness bar; and one primary button.
  - A deal-type filter sits next to the status filters.
- **#2357:** the CN deploy record. A document with no runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 44.
- `ANTHROPIC_API_KEY` is present in `.env` (count 1; value not read).
- The account does not mention `episode-worker`.

## §7. Schema changes

None. The range carries no migration (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy CO, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
0c20714a3d647d421238dd6d1dca6dc612c87ed9 2026-09-30 feat(events): Events cards and a deal-type filter (redesign B) [skip-automerge] (#2364)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential, database user or host.
- It edits no filed document. CN's app check stays as CN recorded it
  ("not checked yet"); the app check above is CO's.
- It reads no production schema and queries nothing in production.
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

- **Continuity:** the tree agrees with Evoni's account (4 commits, 20 files,
  no migration, no package change), with no gap after CN. Production is at
  `origin/main`, `0c20714a`.
- **Deploy:** `scripts/deploy-prod.sh`: fast-forward, backup, build, 0
  pending of 227, one restart (count 44). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** the Events page is much clearer (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
