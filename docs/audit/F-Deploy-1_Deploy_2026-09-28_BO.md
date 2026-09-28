| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BO, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. F-Reg-2 fix group 2's characterRegistry.js sites (parts 1 and 2) go live.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BN.md`, filed with this one, whose deploy this
one follows. This document edits no filed document. Basis: `origin/main` at
`9e4a57aa368d6fd5609d7af8813bbb965fd9e947` (#2183) at filing (§8). Deploy BO
moved production to `272a9681192551f4f6fa4d4355ee7c9112fe6300` (#2181).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. **ATTESTED** covers the script's summary block as Evoni pasted it;
**MEASURED** covers what this repository shows, with output pasted. Nothing
is upgraded. This document closes no keystone, discharges no owed item,
mints no FD, XK or PE number, and rules on nothing. It records no token,
email, password, hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BO**. BN ends at `ff2ed851` (BN
record §1), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: ff2ed851f850b484682ddc12972c1b74b2d119af -> 272a9681192551f4f6fa4d4355ee7c9112fe6300 (fast-forward)
Range: 2 commit(s), 3 file(s); PRs: #2179 #2181
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T184250Z
vite build: built in 35.50s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 16
/health at 2026-09-28T18:43:51Z: {"status":"healthy","timestamp":"2026-09-28T18:43:51.735Z","uptime":6.116512038,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 18:43:50 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 18:43:59 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 18:44:04 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 5054ms
  1|episode- | 2026-09-28 18:44:04 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 18:44:04 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
```

No app check was supplied.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor ff2ed851 272a9681 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BN ends at `ff2ed851` (BN record §1), this deploy's start. BP
begins at `272a9681` (BP record §1), this deploy's end.

## §2. The range — MEASURED

```
$ git rev-list --count ff2ed851..272a9681
2
$ git log --oneline ff2ed851..272a9681
272a96811 fix(registry): serialize characterRegistry.js RMW sites, part 2 (F-Reg-2 v1.2 R2) [skip-automerge] (#2181)
4f2a4baa1 fix(registry): serialize characterRegistry.js RMW sites, part 1 (F-Reg-2 v1.2 R2) [skip-automerge] (#2179)
$ git diff --shortstat ff2ed851 272a9681
 3 files changed, 582 insertions(+), 86 deletions(-)
$ git diff --name-only ff2ed851 272a9681
src/routes/characterRegistry.js
tests/integration/registryRmwGroup2CharRegPart1.integration.test.js
tests/integration/registryRmwGroup2CharRegPart2.integration.test.js
$ git diff --name-only ff2ed851 272a9681 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 2 commits, 3 files, #2179 and #2181. One file
changes runtime code, `src/routes/characterRegistry.js`.

## §3. The time

**ATTESTED.** Backup stamped 18:42:50Z, `Ready to accept requests` at
18:43:50, `/health` at 18:43:51Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2181, 18:37:27 UTC:

```
$ git log --first-parent --format="%h %cI %s" ff2ed851..272a9681 | head -1
272a96811 2026-09-28T14:37:27-04:00 fix(registry): serialize characterRegistry.js RMW sites, part 2 (F-Reg-2 v1.2 R2) [skip-automerge] (#2181)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0. The database was confirmed by
Evoni. **MEASURED:** the range adds no migration (§2).

## §5. What went live — MEASURED

This is F-Reg-2 fix group 2 (v1.2 R2) for `characterRegistry.js`. After this
deploy, no row of v1.0 §4.2's table is open in this file.
- **#2179 (`4f2a4baa`), Task #2178, part 1 (rows 18, 19, 20, 30, 33):**
  - plot-thread add and delete are atomic SQL;
  - plot-thread edit runs under a row lock;
  - registry backfill-sections fills with `COALESCE`;
  - the character backfill writes after its AI call, under a row lock, only
    where the field is still empty.
- **#2181 (`272a9681`), Task #2180, part 2 (rows 34, 35, 37, 38, 39):**
  - `relationships_map` normalization runs under a row lock on the current
    value;
  - plot threads after an AI call are one `UPDATE` that sets only
    `plot_threads`, only while they are empty;
  - backfill-all sections are written under a lock only where still empty.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings (BN: 82/100, 5 warnings). The warning that is gone
is not identified.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the count
is now 16, one past BN's 15 (BN record §6). `ANTHROPIC_API_KEY` count 1
(value not read).

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** `origin/main` at filing is
`9e4a57aa368d6fd5609d7af8813bbb965fd9e947` (#2183), not shallow (BM record
§8). No open PR.

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It discharges and mints nothing.
- It makes no host, AWS, database or Cognito contact.

## §10. Tails

Re-derived at this basis; output in the BM record §10: FD-69, XK-4, PE 68.
Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with the summary (2 commits, 3 files, no
  migration, no package change), with no gap after BN.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 16.
- **CFO:** 84/100, 1 critical, 4 warnings. No app check was supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
