| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CJ, 2026-09-30, a script deploy (`scripts/deploy-prod.sh`), backend and frontend, no migration, no dependency change, one plain restart. Evoni ran it herself, outside any agent session. The sharpen m1/m2 fix (#2337) and the addDropShadow fix (#2338) go live, with the CH and CI records. Production reaches origin/main.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CI.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `2b941b4c3d23b49b253e04a9467abe875eb00ed4` (#2351),
read 2026-09-30. Deploy CJ moved production to `6de09fe0` (#2343), two
docs-only commits behind it (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number, database user or ARN.

**The letter.** This deploy is lettered **CJ**. It follows CI
(`F-Deploy-1_Deploy_2026-09-30_CI.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's paste of the `scripts/deploy-prod.sh` summary,
2026-09-30, about 02:01–02:03 UTC, in its order:

1. **Tree.** `3de08be4 -> 6de09fe0`, a fast-forward.
   - Range: 4 commits, 8 files; PRs #2337, #2338, #2342, #2343.
   - "No migration or package/lock file in the range."
2. **Backup.** `frontend/dist` was backed up (sortable name, 02:01:32Z).
3. **Build.** `vite build` "built in 35.13s".
4. **Pending migrations.**
   - The script's check read `SequelizeMeta` on the production database
     (host hidden in the paste; the database was confirmed by Evoni).
   - Result: "OK: 0 pending of 226 migration files checked." (exit 0).
5. **Key presence.** `ANTHROPIC_API_KEY` in `.env`: count 1 (value not
   read).
6. **Restart.**
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 39.
   - `/health` at 2026-09-30T02:02:48Z: healthy, database connected, uptime
     6.2 s, environment production.
   - Ready line at 02:02:48.
7. **CFO.** Scheduled audit 02:02:56–02:03:00: **88/100**, 1 critical,
   4 warnings; `[dependency_audit] 1 critical/high`.

**App check: not supplied.** The paste carries none. Evoni's follow-up
message carried "App check for CJ: [I tried "add shadow" on a transparent
wardrobe item and it worked / not checked]" with both options still in
brackets. No choice was made, so this record claims neither.

**CJ confirmed (ATTESTED).** Evoni, 2026-09-30: "Yes: my deploy paste is the
CJ confirmation." 

**Not recorded.** The paste's trailing shell prompt carried a hostname. It
is left out, as are the database's host and user.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 3de08be45c652cd3c340e66f0760ca946ddb1a9f 6de09fe0f4bd7a79b94cb417b2ed1fb8277556b2 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CI ends at `3de08be4` (CI record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CI left it at 38 (CI
record §6), and CJ's single restart brings it to 39.

## §2. The range — MEASURED

```
$ git rev-list --count 3de08be4..6de09fe0
4
$ git log --oneline 3de08be4..6de09fe0
6de09fe0f docs(audit): deploy record CI [skip-automerge] (#2343)
405d68321 docs(audit): deploy record CH [skip-automerge] (#2342)
4f51e990b fix(wardrobe): addDropShadow builds its shadow at canvas size [skip-automerge] (#2338)
f68b1c248 fix(images): sharpen passes m1/m2 so the intended settings apply [skip-automerge] (#2337)
$ git diff --shortstat 3de08be4 6de09fe0
 8 files changed, 770 insertions(+), 38 deletions(-)
$ git diff --name-only 3de08be4 6de09fe0
docs/audit/F-Deploy-1_Deploy_2026-09-30_CH.md
docs/audit/F-Deploy-1_Deploy_2026-09-30_CI.md
src/services/postProcessingService.js
src/services/wardrobeImageService.js
tests/integration/wardrobeAddShadow.integration.test.js
tests/unit/services/postProcessingService.test.js
tests/unit/services/sharpenSettingsApply.test.js
tests/unit/services/wardrobeImageService.addDropShadow.test.js
$ git diff --name-only 3de08be4 6de09fe0 -- src/migrations/ package.json package-lock.json; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 3de08be4 6de09fe0 -- frontend/ | wc -l
0
```

This agrees with Evoni's account:
- 4 commits, 8 files, the four PRs named;
- no migration, and no `package.json` or `package-lock.json` change.

**Noted:** nothing under `frontend/` changed. The script builds the
frontend on every deploy, so its `vite build` rebuilt the same sources
(INFERRED from the script's step order; the build output was not compared).

## §3. The time

**ATTESTED.** The deploy ran about 02:01–02:03 UTC: backup 02:01:32Z,
`/health` 02:02:48Z with an uptime of 6.2 s, CFO done 02:03:00.

**MEASURED.** The range's last commit, #2343, is at 01:24:37 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 3de08be4..6de09fe0
6de09fe0f 2026-09-29T21:24:37-04:00 docs(audit): deploy record CI [skip-automerge] (#2343)
405d68321 2026-09-29T21:17:14-04:00 docs(audit): deploy record CH [skip-automerge] (#2342)
4f51e990b 2026-09-29T21:09:12-04:00 fix(wardrobe): addDropShadow builds its shadow at canvas size [skip-automerge] (#2338)
f68b1c248 2026-09-29T20:57:23-04:00 fix(images): sharpen passes m1/m2 so the intended settings apply [skip-automerge] (#2337)
```

## §4. Migrations

**MEASURED.** The tree holds 226 migration files, the same as CI, and the
range adds none:

```
$ git ls-tree -r --name-only 6de09fe0 src/migrations | grep -c '\.js$'
226
```

**ATTESTED (§0):** the script's pending check read 0 pending of 226. The
two agree.

## §5. What went live — MEASURED

- **#2337 (`f68b1c24`): sharpen passes m1/m2.** `postProcessingService`
  now applies the intended flat and jagged settings.
- **#2338 (`4f51e990`): addDropShadow builds its shadow at canvas size.**
  In `wardrobeImageService`, the shadow's padding is no longer opaque.
- **#2342 and #2343:** deploy records CH and CI. They are register
  documents with no runtime effect.

**The CFO count stays at 1 (ATTESTED, §0).**
- **INFERRED:** it is nodemailer. The range changes no lockfile (§2), and
  the CI record (§5) measured the one remaining finding as nodemailer. The
  nodemailer upgrade (PR #2339) is not in this tree.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 39.
- `ANTHROPIC_API_KEY` present in `.env` (count 1, value not read).
- `episode-worker` is not reported.

## §7. Schema changes

**MEASURED.** None (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy CJ, production's tree is `6de09fe0` (#2343).
`origin/main` at filing is two commits ahead, both docs only, with no
runtime effect:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
2b941b4c3d23b49b253e04a9467abe875eb00ed4 2026-09-29 docs(audit): banner on deploy record CI, app check supplied [skip-automerge] (#2351)
$ git rev-list --count 6de09fe0..origin/main
2
$ git diff --name-only 6de09fe0 origin/main
docs/WARDROBE_PRICE_READ_2026-09-30.md
docs/audit/F-Deploy-1_Deploy_2026-09-30_CI.md
$ git diff --name-only 6de09fe0 origin/main -- src/ frontend/ package.json package-lock.json | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
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

- **Continuity:** the tree agrees with Evoni's account (4 commits, 8 files,
  no migration, no dependency change), with no gap after CI. Production is
  at `6de09fe0`; `origin/main` is two docs-only commits ahead (§8).
- **Deploy:** by `scripts/deploy-prod.sh`: backup, build, 0 pending
  migrations, one restart (count 39). `/health` healthy and connected.
- **CFO:** 88/100, 1 critical, 4 warnings; `dependency_audit` 1.
- **App check:** not supplied (both options left in brackets).
- **CJ confirmed** by Evoni (ATTESTED, §0).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
