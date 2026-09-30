| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CR, 2026-09-30, backend and frontend, no migration, no dependency change, one plain restart. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. The invitation's deal statement (#2380), the Event Package outfit picker (#2381) and the Full Closet fix (#2382) go live. Production stops one commit short of origin/main: #2383 (Reopen terms) merged after the deploy.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CQ.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `9c0648504f769d27cafc9dde01514876b5572cda` (#2383),
read 2026-09-30. Deploy CR moved production to `b7d80aa5` (#2379), one
commit before it (§8).

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
path, account number, database user or ARN. Two things in Evoni's paste
are left out:
- the database user named in the pending-check line;
- the home-directory path of the `frontend/dist` backup. Only its sortable
  timestamp is kept.

**The letter.** This deploy is lettered **CR**. It follows CQ
(`F-Deploy-1_Deploy_2026-09-30_CQ.md`, filed in #2384). CQ's record was
still an open PR when CR ran, so CQ's own file is not in CR's range.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
18:03–18:05 UTC, from `scripts/deploy-prod.sh` in its order:

1. **Fast-forward.** Tree `3ba0e38a` → `b7d80aa5` (fast-forward): 4
   commits, 14 files; PRs #2379, #2380, #2381, #2382. The script reported
   no migration and no package or lock file in the range.
2. **Backup.** `frontend/dist` was backed up (sortable name, stamped
   2026-09-30T18:03:02Z).
3. **Build.** `vite build`, built in 34.72 s.
4. **Pending migrations.** The check read `SequelizeMeta` with
   `NODE_ENV=production` against the `episode_metadata` database (the host
   was hidden by the script; the user is left out here): **0 pending of
   229** migration files, exit 0. Evoni confirmed the database.
5. **Environment.** `ANTHROPIC_API_KEY` appears in `.env` once (count 1;
   the value was not read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 47.
   - Ready line at 18:04:23: "Ready to accept requests".
   - `/health` at 2026-09-30T18:04:26Z: healthy, database connected,
     environment production, uptime 9.3 s.
7. **CFO.** Scheduled audit 18:04:31–18:04:35: **89/100**, 0 critical, 4
   warnings (4259 ms).

**App check:** none given with this account.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 3ba0e38ae5dbc88da5a3fa72addc95566719d675 b7d80aa587702283bf8189cad919e2befcfd3780 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CQ ends at `3ba0e38a` (CQ record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CQ left it at 46 (CQ
record §6), and CR's single restart brings it to 47.

## §2. The range — MEASURED

```
$ git rev-list --count 3ba0e38a..b7d80aa5
4
$ git log --oneline 3ba0e38a..b7d80aa5
b7d80aa58 docs(flow): record the Reopen terms and invitation rulings in §8(cc) [skip-automerge] (#2379)
34be9c3f8 fix(wardrobe): every item appears in the Full Closet, by category [skip-automerge] (#2382)
3206648d2 fix(events): choose Lala's outfit in the Event Package before Start Episode [skip-automerge] (#2381)
44667a3ae fix(invitation): state the deal per the invitation ruling [skip-automerge] (#2380)
$ git diff --shortstat 3ba0e38a b7d80aa5
 14 files changed, 1379 insertions(+), 421 deletions(-)
$ git diff --name-only 3ba0e38a b7d80aa5 -- src/migrations/
$ git diff --name-only 3ba0e38a b7d80aa5 -- package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 3ba0e38a b7d80aa5 -- frontend/ | wc -l
9
$ git diff --name-only 3ba0e38a b7d80aa5 -- src/ | wc -l
3
```

This agrees with Evoni's account:
- 4 commits, the four PRs named;
- 14 files;
- no migration;
- no package or lock file.

9 frontend files changed, so the build used new sources. 3 backend files
changed:
- `src/controllers/wardrobeController.js`
- `src/services/invitationCompositingService.js`
- `src/services/invitationGeneratorService.js`

The restart was needed to load them.

## §3. The time

**ATTESTED.** The deploy ran about 18:03–18:05 UTC: backup stamped
18:03:02Z, ready 18:04:23, `/health` 18:04:26, CFO done 18:04:35.

**MEASURED.** The range's last commit, #2379, is at 17:52:40 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 3ba0e38a..b7d80aa5
b7d80aa58 2026-09-30T13:52:40-04:00 docs(flow): record the Reopen terms and invitation rulings in §8(cc) [skip-automerge] (#2379)
34be9c3f8 2026-09-30T13:40:34-04:00 fix(wardrobe): every item appears in the Full Closet, by category [skip-automerge] (#2382)
3206648d2 2026-09-30T13:33:44-04:00 fix(events): choose Lala's outfit in the Event Package before Start Episode [skip-automerge] (#2381)
44667a3ae 2026-09-30T13:27:09-04:00 fix(invitation): state the deal per the invitation ruling [skip-automerge] (#2380)
```

## §4. Migrations

**MEASURED.** The tree holds 229 migration files, as at CQ:

```
$ git ls-tree -r --name-only b7d80aa5 src/migrations | grep -c '\.js$'
229
```

**ATTESTED (§0):** 0 pending of 229. This agrees with the tree and with CQ,
which ran the last two.

## §5. What went live — MEASURED

- **#2380 (`44667a3a`), Task #2375:** the invitation states the deal, per
  Evoni's invitation ruling of 2026-09-30 (`docs/EVENT_EPISODE_FLOW.md`
  §8(cc)).
  - It speaks in the host's voice, in Prime Coins: fees, each deliverable
    with its fee, a self-funded entry, what the host or brand covers, and
    any bonus.
  - Comped and gifted events are stated without price talk.
  - The old bug is fixed: every non-free event had read "N coins per
    guest", because the boolean `is_paid` was compared to a string.
  - Existing invitations are unchanged until regenerated.
- **#2381 (`3206648d`), Task #2376:** the Event Package's Style area gets
  Choose outfit / Change outfit on an unused event. The closet picker moves
  out of WorldAdmin into `EventOutfitPicker`.
- **#2382 (`34be9c3f`), Task #2377:** every wardrobe item appears in the
  Episode Wardrobe's Full Closet by category.
  - Every page is loaded, where before one request stopped at 200.
  - Categories match more loosely.
  - A browse-only Other group catches the rest.
  - Bottom is reachable with a dress on.
  - The layout wraps at 375px.
  - `wardrobeController`'s raw-SQL fallback now includes items with no
    show.
- **#2379 (`b7d80aa5`), Task #2378:** the Reopen terms and invitation
  rulings recorded in §8(cc). A document with no runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 47.
- `ANTHROPIC_API_KEY` is present in `.env` (count 1; value not read).
- The account does not mention `episode-worker`.

## §7. Schema changes

None. The range carries no migration (§2, §4).

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CR is `b7d80aa5` (#2379).
`origin/main` at filing is one commit ahead of it: #2383 (Reopen terms,
code, no migration) merged after the deploy.

```
$ git log --oneline b7d80aa5..origin/main
9c0648504 feat(events): reopen locked terms per the Reopen ruling [skip-automerge] (#2383)
$ git log -1 --format='%H %ad %s' --date=short origin/main
9c0648504f769d27cafc9dde01514876b5572cda 2026-09-30 feat(events): reopen locked terms per the Reopen ruling [skip-automerge] (#2383)
$ git rev-parse --is-shallow-repository
false
```

**INFERRED:** #2384 (the CQ record, docs only) was still open at filing;
it adds no runtime change when it merges.

## §9. What this document does not do

- It records no credential, database user, host or home path.
- It edits no filed document.
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

- **Continuity:** the tree agrees with Evoni's account (4 commits, 14 files,
  no migration, no package change), with no gap after CQ. Production is at
  `b7d80aa5`, one commit behind `origin/main` (#2383, Reopen terms, for the
  next deploy).
- **Deploy:** `scripts/deploy-prod.sh`: fast-forward, backup, build, 0
  pending of 229, one restart (count 47). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** none given.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
