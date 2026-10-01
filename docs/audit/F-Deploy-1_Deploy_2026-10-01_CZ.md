| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CZ, 2026-10-01, backend and frontend, by `scripts/deploy-prod.sh` end to end. A fast-forward of 3 commits and 18 files from `a077ad55` to `21d4172e`: no migration and no package or lock file, 0 pending of 243, one plain restart. Season Arc PRs 5 and 6 go live, with the CY deploy record. CFO 89/100 with 4 warnings, unchanged from CY. The app check has not been done yet. The restart count is continuous from CY (55 → 56). Production is one commit behind `origin/main` (#2445, Season Arc PR 7, merged after CZ, with a migration).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_CY.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `20cb81db69e23955de7dc0c136af6865185d9464` (#2445),
read 2026-10-01. Deploy CZ moved production to `21d4172e` (#2444), one
commit behind it (§7).

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
path, account number, database user or ARN. The script's output names the
database user its pending-migrations check read as; it is left out here,
as in the CW, CX and CY records.

**The letter.** This deploy is lettered **CZ**. It follows CY
(`F-Deploy-1_Deploy_2026-10-01_CY.md`, filed in #2443).

**The account's source.** Evoni's request to file CZ carried a
"[paste the CZ summary]" placeholder instead of a summary. This record is
filed from the script output she pasted twice earlier the same afternoon,
headed "Deploy (Evoni, 2026-10-01, via scripts/deploy-prod.sh)". If the
summary she meant differs, a banner or an amendment corrects this record.

## §0. Evoni's account, as given

**ATTESTED.** The script's output as Evoni pasted it, 2026-10-01, about
19:29–19:33 UTC (the hidden host, the database user and the log prefixes
left out):

1. **Tree.** `a077ad55` → `21d4172e`, fast-forward. Range: 3 commits, 18
   files; PRs #2442, #2443, #2444. "No migration or package/lock file in
   the range."
2. **Backup.** `frontend/dist` backed up, stamped 20261001T192942Z.
3. **Build.** `vite build`, 40.01 s.
4. **Pending check.** The pending-migrations check read `SequelizeMeta`
   with `NODE_ENV=production` against the production database:
   "OK: 0 pending of 243 migration files checked. (exit 0)"; the database
   confirmed by Evoni.
5. **The AI key.** `ANTHROPIC_API_KEY` in `.env`: count 1, value not read.
6. **Restart.** One plain `pm2 restart` of the API process: restart count
   56.
   - Ready at 19:33:08: "Ready to accept requests".
   - `/health` at 2026-10-01T19:33:10Z: healthy, production, database
     connected, uptime 9.2 s.
7. **CFO.** 19:33:16–19:33:20: **89/100**, 0 critical, **4 warnings**,
   3779 ms.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main a077ad55 21d4172e
20cb81db69e23955de7dc0c136af6865185d9464
a077ad55e2ac1c38113ca550d1a74d929bd7b4b2
21d4172ec5d6ff3604dd17bbcef4e7f51d174981
$ git merge-base --is-ancestor a077ad55 21d4172e && echo "ancestor: yes"
ancestor: yes
```

CY left production at `a077ad55` with restart count 55 (CY record §6,
§8). CZ starts at `a077ad55` and its one restart brings the count to 56
(ATTESTED, §0). **No gap:** no deploy ran between CY and CZ that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count a077ad55..21d4172e
3
$ git log --oneline a077ad55..21d4172e
21d4172ec feat(season): suggestions read the next slot, goals and repeats; Event Package shows Season Context (Season Arc PR 6) [skip-automerge] (#2444)
0d699289b docs(audit): deploy record CY [skip-automerge] (#2443)
d760ba00d feat(season): slot intentions, edited or auto-drafted; the range sets the brief (Season Arc PR 5) [skip-automerge] (#2442)
$ git diff --shortstat a077ad55 21d4172e
 18 files changed, 1683 insertions(+), 6 deletions(-)
$ git diff --name-only a077ad55 21d4172e -- src/migrations/ | wc -l
0
$ git diff --name-only a077ad55 21d4172e -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only a077ad55 21d4172e -- frontend/
frontend/src/components/Episodes/NextEventSuggestionsOverlay.jsx
frontend/src/components/Episodes/NextEventSuggestionsOverlay.season.test.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/pages/EventPackagePage.seasonContext.test.jsx
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/WorldAdmin.seasonRoadmap.test.jsx
$ git diff --name-only a077ad55 21d4172e -- src/
src/routes/arcRoutes.js
src/routes/worldEvents.js
src/services/episodeCompletionService.js
src/services/seasonIntentionService.js
src/services/seasonSlotService.js
src/services/seasonSuggestionService.js
$ git diff --name-only a077ad55 21d4172e -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_CY.md
tests/integration/seasonIntention.integration.test.js
tests/integration/seasonSuggestions.integration.test.js
tests/unit/routes/arc-routes-tier-promotion.test.js
```

This agrees with the script's own count:
- 3 commits, the three PRs it named;
- 18 files (7 frontend, 6 backend, 2 docs, 3 tests);
- no migration;
- no package or lock file, so no `npm ci` was needed.

The 5 non-test frontend files needed the `vite build`; the 6 backend
files needed the restart.

## §3. The time

**ATTESTED.** Backup stamped 19:29:42Z; ready at 19:33:08, `/health` at
19:33:10Z, CFO done 19:33:20.

**MEASURED.** The range's last commit, #2444, is at 19:24:38 UTC:

```
$ git log --first-parent --format="%h %cI" a077ad55..21d4172e
21d4172ec 2026-10-01T15:24:38-04:00
0d699289b 2026-10-01T15:13:33-04:00
d760ba00d 2026-10-01T15:01:08-04:00
```

**INFERRED.** The script's fetch reached `21d4172e`, so it ran at or after
19:24:38; the backup stamp at 19:29:42 fits.

## §4. Migrations

**MEASURED.** The tree holds 243 migration files, the same as at CY; the
range adds none:

```
$ git ls-tree -r --name-only 21d4172e src/migrations | grep -c '\.js$'
243
```

**ATTESTED (§0):** 0 pending of 243, exit 0. This agrees with CY's
after-check (0 pending of 243) and with the range. CY's record said the
next deploy, carrying #2442, would add no migration (CY §8); it did not.

## §5. What went live — MEASURED

- **#2442 (`d760ba00`): Season Arc PR 5.** Slot intentions: a future
  slot's story purpose, career focus, desired pressure and outcome range,
  edited by Evoni or auto-drafted by AI (the next open slot only, on
  acceptance and on demand, §8(ff) Q12). At Start Episode the outcome
  range sets the brief's `designed_intent` (the top of the range) and
  `allowed_outcomes`.
- **#2443 (`0d699289`):** the CY deploy record. No runtime effect.
- **#2444 (`21d4172e`): Season Arc PR 6.** Next-event suggestions read the
  next open slot's intention, Lala's goals and repeats within the last
  three episodes (§8(ff) A4, Q8); the Event Package shows a read-only
  Season Context; the "What's next" overlay names the slot and warns on
  repeats.

New routes in the range, all behind `requireAuth`:

```
$ git diff a077ad55 21d4172e -- src/routes | grep "^+router\.\(get\|post\|put\|delete\)"
+router.put('/world/:showId/season/slots/:slotId/intention', requireAuth, async (req, res) => {
+router.post('/world/:showId/season/slots/:slotId/intention/draft', requireAuth, aiRateLimiter, async (req, res) => {
+router.get('/world/:showId/season/event/:eventId', requireAuth, async (req, res) => {
```

The intention draft route calls the Anthropic API (behind
`aiRateLimiter`, logged and budget-gated by `aiCostTracker`). The key's
presence (count 1, §0) is what that route needs. INFERRED: acceptance
also drafts the next open slot's intention in the background when that
slot has none or only an earlier draft (PR 5), so an accepted episode
after CZ can make one Haiku call.

## §6. Restarts and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 56.
- `.env` was read only for the key's presence; no change to it is
  reported, so a plain restart fits.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CX and CY.

The account does not mention `FONT` lines or `episode-worker`; this
record says nothing about either.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy CZ is `21d4172e` (#2444).
`origin/main` at filing is one commit ahead: Season Arc PR 7, merged after
CZ ran.

```
$ git log --oneline 21d4172e..origin/main
20cb81db6 feat(season): story threads for the show; a slot continues one, acceptance advances it (Season Arc PR 7) [skip-automerge] (#2445)
$ git rev-parse --is-shallow-repository
false
```

**Next.** #2445 adds one migration, so the next deploy has a pending
file and needs the migrate step before the restart (`DEVELOPMENT_WORKFLOW.md`
§7.1):

```
$ git diff --name-only 21d4172e origin/main -- src/migrations/
src/migrations/20261001250000-create-show-story-threads.js
```

## §8. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §9. Tails — re-derived, not carried

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

- **Continuity:** continuous from CY (`a077ad55`, restart 55). The tree
  agrees with the script's account: 3 commits, 18 files, no migration, no
  package or lock file. Production is at `21d4172e`, one commit behind
  `origin/main` (#2445, which carries a migration).
- **Deploy:** by the script end to end: backup, build, 0 pending of 243,
  the AI key present, one restart (count 56), ready, `/health` healthy and
  connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CY.
- **App check:** not done yet (Evoni).
- **Source of the account:** the script output Evoni pasted, since the
  filing request held a placeholder instead of a summary.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
