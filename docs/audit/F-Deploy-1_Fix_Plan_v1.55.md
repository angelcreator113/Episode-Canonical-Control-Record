| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *Box maintenance, 2026-09-26: v1.54 §6 discharged; the reboot outage and its fix.* |
| --- |

**Document version**

v1.55 — successor to v1.54. Basis: `origin/main` at
`88a41b85c13e3415cdbcf6f5bbd8b41d91d158ae`, measured 2026-09-26.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

ATTESTED (§1–§6, §8) + MEASURED (§Basis, §7) + INFERRED where marked. This
revision records, from Evoni's terminal output, her 2026-09-26 maintenance of
the production box: the deletion v1.54 §6 owed, cache cleanup, a hung package
refresh, security updates, a reboot, the outage the reboot caused, and the
fix. It rules nothing and mints no FD, XK, or PE. Task #1975.

**Recording rule for this document.** No password, database host or user id
appears below. Where Evoni compared a password or host, only the result
(SAME or DIFFERENT) is recorded.

---

# F-Deploy-1 Fix Plan v1.55 — box maintenance and the reboot outage

## §Measured repository basis

The basis SHA above is **MEASURED** from `origin/main`, read by this session's
`/wake-up` before this file existed.

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
88a41b85c13e3415cdbcf6f5bbd8b41d91d158ae 2026-09-26 fix(auth): stop logging tokens and user details at login [skip-automerge] (#1977)
$ ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -2
F-Deploy-1_Fix_Plan_v1.53.md
F-Deploy-1_Fix_Plan_v1.54.md
```

v1.54 is the newest existing fix plan; this revision is v1.55, as expected.

**Standing for §1–§6 and §8: ATTESTED** (Evoni, 2026-09-26, outside any agent
session), from her pasted terminal output. An agent session cannot re-derive
any of it. They are numbered in the order she worked, except that §1 (the
deletion v1.54 owed) comes first because it is what this revision discharges;
§2's cleanup came before it.

## §1. Discharges v1.54 §6 — the three directories deleted

- Deleted with `rm -rf`: `/home/ubuntu/episode-metadata-parallel`,
  `/home/ubuntu/episode-nodemodules-staging-20260625`,
  `/home/ubuntu/episode-metadata-deploy`: the three paths
  `F-Deploy-1_Fix_Plan_v1.54.md` §1 retired.
- **Order:** v1.54 merged, then the directories were deleted (Evoni). v1.54
  merged as `f240f3af` (MEASURED: `git log --format='%h %cI' -1 f240f3af` gives
  `2026-09-26T09:40:48-04:00`, 13:40:48 UTC).
- `df -h /` before: 7.6G size, 6.2G used, 1.4G available, 82%. After: 5.1G
  used, 2.6G available, 67%.
- The `.env` copy inside `episode-metadata-parallel` (v1.29 §4.4; v1.54 §6
  item 2) was deleted with it.

v1.54 §6 item 1 is discharged by this section. Item 2 was a recorded
consequence, not an action, and needs nothing further.

## §2. Cache cleanup (before §1)

- `npm cache clean --force`; `rm -rf ~/.cache/node-gyp`;
  `journalctl --vacuum-size=50M` (freed 72.0M).
- Disk: 90% used with 822M available → 82% with 1.4G available.
- The first `apt clean` failed: the apt lock was held by `apt-get`, pid
  1744331 (§3).

## §3. The hung package refresh

- The lock holder was `apt-get -qq -y update`, elapsed `21-09:15:11`: started
  about 2026-09-05 and still running three weeks later. While it held the apt
  lock, the automatic security updates could not run.
- It was killed, and `systemctl stop apt-daily.service` run.
  `apt-daily.timer` remains enabled.
- `apt.systemd.daily install` then ran and completed. `apt clean` succeeded.
  `apt-get update` completed with every source `Hit`, and one legacy-keyring
  warning for the PostgreSQL repository.
- After the updates: the app online, restart count 52, `/health` 200.
  `/var/run/reboot-required` present.

## §4. Pre-reboot checks

- `pm2-ubuntu` enabled (pm2 starts at boot).
- `~/.pm2/dump.pm2` (the snapshot pm2 restores at boot) dated
  2026-07-22 11:58.
- Snapshot against the live API process: `NODE_ENV`, `PORT` (3000),
  `DB_NAME` and `DB_USER` equal; `DB_HOST` SAME. The snapshot's worker entry
  has status stopped, and its env has `PORT` 3002 and `DB_USER` postgres.
- **`DB_PASSWORD` was not compared** between the snapshot and the live
  process. That comparison is the one that would have caught §6's cause
  before the reboot.

## §5. Reboot and outage

- `sudo reboot`.
- After the reboot, pm2 had renumbered its processes (API 13 → 1,
  worker 1 → 0) and reset their restart counts. The API was online, but
  `/health` returned 503 with the database disconnected:
  `password authentication failed for user "episode_app_dev"`, first logged
  14:24:05 UTC.
- The outage ran from the reboot until the §6 restart. **End time: not
  timestamped (Evoni).**

## §6. Cause and fix

- **Cause.** `DB_PASSWORD` in `.env`, compared against the snapshot's:
  DIFFERENT. `.env`'s `DB_USER` is `episode_app_dev`. The snapshot had
  restored a superseded password.
- **Fix.** `DB_PASSWORD=<.env value> pm2 restart episode-api-prod-hotfix
  --update-env` (the value is not recorded). After it: restart count 1;
  `/health` healthy, database connected, `currentDatabase` `episode_metadata`,
  `episodeCount` 7. The earlier 74 counted deleted rows, as she reads it.
  - MEASURED beside it: `/health` counts
    `SELECT COUNT(*) … FROM episodes WHERE deleted_at IS NULL`
    (`src/app.js:316` at the basis).
- **Live check.** In the browser, sign-in returned 200 and the show "Styling
  Adventures with Lala" loaded.
- **`pm2 save`** then wrote a new snapshot. After it: `NODE_ENV`
  production, `PORT` 3000, `DB_NAME` `episode_metadata`, `DB_USER`
  `episode_app_dev`. Live `DB_HOST` against `.env`: SAME.
- **One superseded host check.** One host check returned DIFFERENT because
  it compared against a shell variable lost with the pre-reboot session. The
  `.env` comparison above supersedes it.

## §7. The hazard — recorded, not ruled

**ATTESTED facts, combined.** The snapshot dated 2026-07-22 (§4) carried a
password that had since been superseded (§6). pm2 restores that snapshot at
boot. So any reboot between the password change and this `pm2 save` would
have caused the same outage. The reboot on 2026-09-26 was the first to do so
on the record.

**MEASURED, the configuration beside it** (at the basis):

```
$ sed -n '1,2p' ecosystem.config.js
// Load .env so API keys are available when PM2 evaluates this config
try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch {}
$ sed -n '12,16p' ecosystem.config.js
  DB_HOST: process.env.DB_HOST || '',
  DB_PORT: process.env.DB_PORT || '5432',
  DB_NAME: process.env.DB_NAME || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
```

`ecosystem.config.js` reads `.env` and copies `DB_PASSWORD` into the apps'
env when pm2 *evaluates the config*: at `pm2 start ecosystem.config.js`.

**INFERRED, not measured:**
- A reboot restores the saved snapshot (`dump.pm2`) rather than
  re-evaluating the config. So a password changed in `.env` reaches a restored
  process only after the config is re-evaluated or the process is restarted
  with the new value.
- `pm2 restart … --update-env` merges the invoking shell's environment into
  the process, which is how §6's fix took effect.

Both readings follow pm2's documented behaviour; neither was measured on the
box.

**Not ruled here:** whether to re-save the snapshot after any credential
change, or to compare `DB_PASSWORD` before a reboot. §4's gap is recorded as
the missing check, not ruled as a procedure.

## §8. For the F-AUTH-1 register — cited, not ruled

**ATTESTED (Evoni).** After §6's fix, the sign-in response's `user.id`
matched the id she attested for the 2026-09-26 08:36:18 `decision_log` row
(`F-Deploy-1_Deploy_2026-09-26_AL.md` §5.2). The value is not recorded.

This is not the `/auth/me` comparison that
`F-AUTH-1_G3Clause3_Retarget_Correction_2026-09-26.md` §5 names as the
production check for clause 3. The AL record §5.2 leaves that check's
standing to the F-AUTH-1 register; so does this revision.

## §9. What this revision does not do

- rules nothing: not the hazard's remedy (§7), the apt timer, the
  legacy-keyring warning, or clause 3's standing (§8);
- amends no filed document — v1.54, the AL and AM records, the clause-3
  amendment and v1.29 are cited, not edited;
- re-enables no workflow and edits no workflow, script or config;
- edits no other file — `PROJECT_CONTEXT.md` is untouched;
- mints no FD, XK, or PE number;
- records no password, database host or user id.

## §Standing

§1–§6 and §8 are ATTESTED: Evoni's own account of her own actions on the box,
outside any agent session, recorded as she gave it and never upgraded. The
basis line, the v1.54 merge time (§1), the `/health` query (§6) and the
configuration (§7) are MEASURED from this repository at the basis SHA; every
command and its output is pasted. §7's two readings of pm2's behaviour are
INFERRED and marked. Nothing is RULED.

No host, AWS, database, or Cognito contact by this session. F-Deploy-1
remains CLOSED (v1.50, v1.52); this revision records maintenance and rules on
nothing.

---

**Type:** Attestation (§1–§6, §8) + measured configuration (§7).
**Rules:** nothing. **Mints:** nothing. **Discharges:** v1.54 §6 item 1.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts,
AWS, RDS or Cognito (`CLAUDE.md`).
