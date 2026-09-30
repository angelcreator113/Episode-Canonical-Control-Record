| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CM, 2026-09-30, a script deploy (`scripts/deploy-prod.sh`), backend and frontend code, no migration, no dependency change, one plain restart. Evoni ran it herself, outside any agent session. The wardrobe price-floor removal (#2349) goes live, and production reaches origin/main. After it, Evoni's real email send failed on Gmail credentials, a pre-existing fault she has parked as an owed item.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CL.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `f32fb543ee5b363b4a68c3b28f160fe9575da4fc` (#2349),
read 2026-09-30. This is the tree Deploy CM moved production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **RULED**: Evoni's decision, quoted.
- **INFERRED**: marked where used.

This document closes no keystone and discharges no owed item. It records
one owed item as parked (§9), by Evoni's ruling. It mints no FD, XK or PE
number.

It records no token, email address, password, hostname, IP address, key
path, account number, database user or ARN.

**The letter.** This deploy is lettered **CM**. It follows CL
(`F-Deploy-1_Deploy_2026-09-30_CL.md`, PR #2354), the register's last
deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's summary of the `scripts/deploy-prod.sh` run,
2026-09-30, about 12:02–12:04 UTC, in its order:

1. **Tree.** `2faae32b -> f32fb543`, a fast-forward.
   - Range: 1 commit, 6 files; PR #2349.
   - "No migration or package/lock file in the range."
2. **Backup.** `frontend/dist` was backed up (sortable name, 12:02:52Z).
3. **Build.** `vite build` "built in 36.84s".
4. **Pending migrations.** The script's check read the production
   database (host hidden; the database was confirmed by Evoni): 0 pending
   of 226 (exit 0).
5. **Key presence.** `ANTHROPIC_API_KEY` count 1 (value not read).
6. **Restart.**
   - One plain `pm2 restart`: restart count 42.
   - `/health` at 2026-09-30T12:03:41Z: healthy, database connected. Ready
     at 12:03:40.
7. **CFO.** 12:03:48–12:03:53: **89/100**, 0 critical, 4 warnings.

**App check: not checked** (Evoni). This record claims none.

**Email send test: failed** (Evoni, after this deploy):

> "534-5.7.9 Application-specific password required"

Evoni: "pre-existing, not caused by nodemailer 10." See §9.

**Not recorded.** The database's host and user in the paste are left out.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 2faae32b6aba30c55a03aef95d6a5fa9e7604f80 f32fb543ee5b363b4a68c3b28f160fe9575da4fc && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CL ends at `2faae32b` (CL record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CL left it at 41 (CL
record §6), and CM's single restart brings it to 42.

## §2. The range — MEASURED

```
$ git rev-list --count 2faae32b..f32fb543
1
$ git log --oneline 2faae32b..f32fb543
f32fb543e fix(wardrobe): remove the $150 price floor; price by item type and tier, fill only an empty price [skip-automerge] (#2349)
$ git diff --shortstat 2faae32b f32fb543
 6 files changed, 220 insertions(+), 12 deletions(-)
$ git diff --name-only 2faae32b f32fb543
frontend/src/pages/WorldAdmin.jsx
frontend/src/utils/wardrobeAutoFill.js
frontend/src/utils/wardrobeAutoFill.test.js
src/routes/wardrobeLibrary.js
src/utils/wardrobePriceGuide.js
tests/unit/utils/wardrobePriceGuide.test.js
$ git diff --name-only 2faae32b f32fb543 -- src/migrations/ package.json package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with Evoni's account: 1 commit, 6 files, #2349, no migration
and no package or lockfile change. Unlike CJ and CL, this range changes
the frontend (`WorldAdmin.jsx`, `wardrobeAutoFill.js`), so the script's
`vite build` built new sources.

## §3. The time

**ATTESTED.** The deploy ran about 12:02–12:04 UTC: backup 12:02:52Z,
ready 12:03:40, `/health` 12:03:41Z, CFO done 12:03:53.

**MEASURED.** The range's one commit, #2349, is at 11:51:47 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 2faae32b..f32fb543
f32fb543e 2026-09-30T07:51:47-04:00 fix(wardrobe): remove the $150 price floor; price by item type and tier, fill only an empty price [skip-automerge] (#2349)
```

## §4. Migrations

**MEASURED.** The tree holds 226 migration files, the same as CL, and the
range adds none:

```
$ git ls-tree -r --name-only f32fb543 src/migrations | grep -c '\.js$'
226
```

**ATTESTED (§0):** the script's pending check read 0 pending of 226. The
two agree.

## §5. What went live — MEASURED

- **#2349 (`f32fb543`), Task #2347: the wardrobe price floor is removed.**
  - Both analyze-image prompts (`src/routes/wardrobeLibrary.js`) drop
    "minimum $150" and carry the price guide by item type and tier
    (`src/utils/wardrobePriceGuide.js`), approved by Evoni on 2026-09-30.
  - The WorldAdmin auto-fill no longer clamps to 150.00, fills the price
    only when it is empty, and suggests the coin cost from a price Evoni
    has already set (`frontend/src/utils/wardrobeAutoFill.js`).

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart`: restart count 42.
- `ANTHROPIC_API_KEY` present in `.env` (count 1, value not read).
- `episode-worker` is not reported.

## §7. Schema changes

**MEASURED.** None (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy CM, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
f32fb543ee5b363b4a68c3b28f160fe9575da4fc 2026-09-30 fix(wardrobe): remove the $150 price floor; price by item type and tier, fill only an empty price [skip-automerge] (#2349)
$ git rev-parse --is-shallow-repository
false
```

## §9. The email send, and the parked owed item

**ATTESTED (Evoni, 2026-09-30).** After this deploy she ran a real send.
It failed:

> "534-5.7.9 Application-specific password required"

She states it is "pre-existing, not caused by nodemailer 10": the Gmail
account's password changed on 30 June, which revokes that account's app
passwords.

**MEASURED: what sends mail, and with what credential.** The only mailer is
`src/services/notifications.js`. It logs in to Gmail with the address in
`LALAVERSE_EMAIL` and the app password in `LALAVERSE_EMAIL_PASSWORD`, and
logs a failure as `[Notifications] Email failed: <message>`:

```
$ grep -n "console.error('\[Notifications\] Email failed" src/services/notifications.js
60:    console.error('[Notifications] Email failed:', err.message);
```

`sendEmail` catches its own error, so the requests that trigger a send
(the therapy knock, the wardrobe brand alert, coverage ready) still succeed
when it fails; the failure shows only in the process logs.

**INFERRED:** `534-5.7.9` is Gmail refusing the login itself, before any
message is built, so it does not depend on the nodemailer version, which is
consistent with Evoni's statement. Whether sends failed between 30 June and
today is not measured here; that would need the production logs.

**The owed item: RULED, PARKED (Evoni, 2026-09-30).** In her words: "app
emails need a Google app password in .env; not wanted for now." Owner:
Evoni (a Google account change and a production `.env` edit, neither of
which an agent session performs). Standing: owed, parked by her, not
scheduled. Also carried in `PROJECT_CONTEXT.md` §6.5.

## §10. What this document does not do

- It records no credential, email address or host.
- It edits no filed document.
- It sends no email and reads no production log.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §11. Tails — re-derived, not carried

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

- **Continuity:** the tree agrees with Evoni's account (1 commit, #2349, no
  migration, no package change), with no gap after CL. Production is at
  `origin/main`, `f32fb543`.
- **Deploy:** by `scripts/deploy-prod.sh`: backup, build, 0 pending
  migrations, one restart (count 42). `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings.
- **App check:** not checked.
- **Email:** the real send failed on credentials (`534-5.7.9`), pre-existing
  per Evoni. The app password is an owed item, **parked** by Evoni (§9).
- **Deal PR 3:** Evoni named CM as her confirmation for merging #2350; its
  deploy (CN) is manual, with the migration first. Recorded here as her
  instruction; this record rules nothing about it.
- The filing session made no host, AWS, database or Cognito contact.

*Type: deploy record. Rules: nothing of its own; records one owed item
parked by Evoni's ruling (§9). Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
