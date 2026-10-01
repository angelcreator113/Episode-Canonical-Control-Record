| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CW, 2026-10-01, backend and frontend. One migration ran before the restart, there was no dependency change, and there was one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. P15, the S1 follow-up fix, S2, the pricing and Terms fixes with Echo Park as Lala's home, and wardrobe W1–W3 go live. CFO 89/100 with 4 warnings, unchanged from CV. Evoni's app check passed for the banner and the wardrobe. Production is level with `origin/main`.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_CV.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f9b5271f3723f816b0bf7d3b9a1c32cc05de51cd` (#2426),
read 2026-10-01. Deploy CW moved production to that same commit (§8).

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

**The letter.** This deploy is lettered **CW**. It follows CV
(`F-Deploy-1_Deploy_2026-10-01_CV.md`, filed in #2420).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
12:40–12:47 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `d919ff8f`, fetched 8 commits to `f9b5271f` (#2418, #2419, #2421,
   #2420, #2422, #2424, #2425, #2426) and **stopped at step 3** on
   `20261001210000-lala-home-city-echo-park`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty, so no `npm ci` was run.
   - `git merge --ff-only` to `f9b5271f`: 51 files.
   - `check-pending-migrations` against the canon instance: **1 pending of
     240**, exit 1.
3. **Migrate.** `db:migrate` as a separate database user (name left out).
   Its password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261001210000`, 0.029 s: `lala_home` city set to Echo Park on 1
     show.
   - Re-check: **0 pending of 240**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 35.67 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 52, online.
   - Ready at 12:46:40.
   - `/health` at 2026-10-01T12:46:54Z: healthy, database connected,
     uptime 20.1 s.
   - No `FONT FILE MISSING` lines.
5. **CFO.** 12:46:48–12:46:52: **89/100**, 0 critical, **4 warnings**.

**App check (Evoni), ATTESTED, given after the deploy:** "the title image
is gone from under the banner; the Full Closet, multi-accessory wardrobe
and matching sets work."

- **The title image under the banner** is gone as P15 (#2418) intends.
  MEASURED: `EVENT_EPISODE_FLOW.md` §8, P15's "Banner chip" reads "The title
  card strip under the banner is replaced by a chip, "Title · Approved /
  Outdated / Not made"". INFERRED: the chip is what now shows there; the
  account does not mention it.
- **W3, W2 and W1** (#2424, #2425, #2426) work as built.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor d919ff8f f9b5271f && echo "ancestor: yes"
ancestor: yes
$ git rev-parse d919ff8f f9b5271f
d919ff8f429ee25885c8883fbdbc0e6c587abda7
f9b5271f3723f816b0bf7d3b9a1c32cc05de51cd
```

**No gap.** CV ends at `d919ff8f` (CV record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CV left it at 51 (CV
record §6), and CW's single restart brings it to 52. The script's stopped
run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count d919ff8f..f9b5271f
8
$ git log --oneline d919ff8f..f9b5271f
f9b5271f3 feat(wardrobe): matching sets, worn as one look (W1) [skip-automerge] (#2426)
2b53ba51b feat(wardrobe): several accessories and jewellery pieces at once (W2) [skip-automerge] (#2425)
358251cbe fix(wardrobe): the Full Closet opens on All, counts every piece, and reloads (W3) [skip-automerge] (#2424)
70d0d0d75 fix(deals): price at Lala's tier; record the pricing version; one Auto-drafted; Echo Park is home [skip-automerge] (#2422)
640e97e3c docs(audit): deploy record CV [skip-automerge] (#2420)
c26d33220 feat(scenes): show the Scene Brief before every paid scene generation (S2) [skip-automerge] (#2421)
516349750 fix(scenes): the Scene Brief reads through the models' own connection [skip-automerge] (#2419)
b48a71371 feat(episodes): Production → Overlays, every on-screen piece of the episode (P15) [skip-automerge] (#2418)
$ git diff --shortstat d919ff8f f9b5271f
 51 files changed, 4433 insertions(+), 218 deletions(-)
$ git diff --name-only d919ff8f f9b5271f -- src/migrations/
src/migrations/20261001210000-lala-home-city-echo-park.js
$ git diff --name-only d919ff8f f9b5271f -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only d919ff8f f9b5271f -- frontend/ | wc -l
23
$ git diff --name-only d919ff8f f9b5271f -- src/ | wc -l
14
```

This agrees with Evoni's account:
- 8 commits, the eight PRs she named;
- 51 files;
- exactly the one migration the check listed;
- no package or lock file changed, so skipping `npm ci` was right.

23 frontend files changed, so the `vite build` was needed. 14 backend files
changed (one of them the migration); the restart was needed to load the
others.

## §3. The time

**ATTESTED.** The deploy ran about 12:40–12:47 UTC: ready at 12:46:40,
CFO done 12:46:52, `/health` at 12:46:54.

**MEASURED.** The range's last commit, #2426, is at 12:43:10 UTC:

```
$ git log --first-parent --format="%h %cI" d919ff8f..f9b5271f | head -2
f9b5271f3 2026-10-01T08:43:10-04:00
2b53ba51b 2026-10-01T08:31:13-04:00
```

**INFERRED.** The script's fetch reached `f9b5271f`, so it ran at or after
12:43:10; the "about 12:40" start is approximate. Everything Evoni timed
(ready, CFO, `/health`) follows the merge.

## §4. Migrations

**MEASURED.** The tree holds 240 migration files, one more than at CV:

```
$ git ls-tree -r --name-only f9b5271f src/migrations | grep -c '\.js$'
240
```

**ATTESTED (§0):** 1 pending of 240 before the run, 0 pending of 240 after
it. This agrees with the tree: CV recorded 0 pending of 239, and the range
adds exactly this one file.

**The script behaved as designed.** It stopped on the pending file, and the
migration ran **before** the restart, as §7.1 requires on exit 1. The new
code started with Lala's home already in Echo Park.

**The migration's own count.** The count Evoni gave is the one the
migration logs, with the label `up` passes. MEASURED:

```
$ git show f9b5271f:src/migrations/20261001210000-lala-home-city-echo-park.js | grep -nE 'console\.log|UPDATE shows|tableExists\(sequelize'
48:    if (!(await tableExists(sequelize, 'shows', transaction))) return;
55:      await sequelize.query('UPDATE shows SET metadata = :metadata WHERE id = :id', {
61:    console.log(`[migration 20261001210000] ${label} on ${changed} show(s)`);
```

`up` passes the label "lala_home city set to Echo Park". "1 show" agrees
with CV, whose `20261001190000` wrote `lala_home` on 1 show (CV record §0).

## §5. What went live — MEASURED

- **#2418 (`b48a7137`): P15.** Production → Overlays, every on-screen piece
  of the episode, with Beat 1 for the title.
- **#2419 (`51634975`): the S1 follow-up fix.** The Scene Brief reads
  through the models' own connection.
- **#2421 (`c26d3322`): ruling S2.** The Scene Brief is shown before every
  paid scene generation.
- **#2422 (`70d0d0d7`): the pricing ruling, the Terms fixes, the home-city
  correction and the accommodation ruling.**
  - Deal prices use Lala's own career tier, not the event's.
  - The pricing version is recorded; one "Auto-drafted" note.
  - Lala's home city is Echo Park, one of the five DREAM cities.
  - Between DREAM cities, travel is drafted but accommodation is not.
- **#2424 (`358251cb`): W3.** The Full Closet opens on All, counts every
  piece, and reloads.
- **#2425 (`2b53ba51`): W2.** Several accessories and jewellery pieces at
  once.
- **#2426 (`f9b5271f`): W1.** Matching sets, worn as one look. Three new
  routes under `/api/v1/wardrobe/matching-sets`, behind `requireAuth`.
- **#2420:** the CV deploy record. It has no runtime effect.

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 52, online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- The account does not mention `episode-worker`.
- No `FONT FILE MISSING` lines. As the CV record §6 sets out, no font check
  runs at startup, so this shows little on its own.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CV.

## §7. Schema changes

**MEASURED** (from the migration file); **ATTESTED** (that it ran, §0).
- No column, table or constraint changes.
- It rewrites `shows.metadata.lala_home` where the city is Los Angeles and
  the neighbourhood Echo Park, to city Echo Park with no neighbourhood,
  keeping the address. Any other home is left as it is.
- It is skipped when the `shows` table is absent; a re-run changes nothing.
- `down` restores the old value only where `lala_home` still equals what
  `up` wrote.

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CW is `f9b5271f` (#2426), and
`origin/main` at filing is the same commit:

```
$ git log --oneline f9b5271f..origin/main | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**Two items in the CV record, read against this deploy.** The CV record is
not edited; this is what happened.
- **The S1 failure (CV record §8, INFERRED there).** Worker-run, queued and
  angle-regenerate scene generations failed for scene sets with a World
  Location until #2419 shipped. #2419 is live with CW, so that open item
  closes. INFERRED: no production generation was run or read.
- **"CW can run through `scripts/deploy-prod.sh` to the end" (CV record
  §8, INFERRED there).** That held for the two commits at CV's basis.
  #2422, merged after CV was filed, added `20261001210000`, so the script
  stopped as designed and CW was finished by hand.

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
  CV:
  - 8 commits and 51 files;
  - the one migration;
  - no package change.

  Production is at `f9b5271f`, level with `origin/main`.
- **Deploy:** the script stopped on the pending migration as designed.
  Finished by hand per §7.1:
  - 1 pending of 240;
  - migrated (Echo Park on 1 show), then 0 pending of 240;
  - build;
  - one restart (count 52);
  - `/health` healthy and connected;
  - no font-missing lines.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CV.
- **CV's open S1 item:** closed by #2419 going live (INFERRED, §8).
- **App check (Evoni, ATTESTED):** the title strip under the banner is
  gone, as P15 intends; the Full Closet, multi-accessory wardrobe and
  matching sets work (§0).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
