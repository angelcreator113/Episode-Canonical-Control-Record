| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BP, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. F-Reg-2 fix group 2's registrySync.js sites go live; production reaches origin/main.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BO.md`, filed with this one, whose deploy this
one follows. This document edits no filed document. Basis: `origin/main` at
`9e4a57aa368d6fd5609d7af8813bbb965fd9e947` (#2183), the tree Deploy BP moved
production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. **ATTESTED** covers the script's summary block as Evoni pasted it;
**MEASURED** covers what this repository shows, with output pasted. Nothing
is upgraded. This document closes no keystone, discharges no owed item,
mints no FD, XK or PE number, and rules on nothing. It records no token,
email, password, hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BP**. BO ends at `272a9681` (BO
record §1), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: 272a9681192551f4f6fa4d4355ee7c9112fe6300 -> 9e4a57aa368d6fd5609d7af8813bbb965fd9e947 (fast-forward)
Range: 1 commit(s), 2 file(s); PRs: #2183
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T184444Z
vite build: built in 36.20s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 17
/health at 2026-09-28T18:45:43Z: {"status":"healthy","timestamp":"2026-09-28T18:45:43.684Z","uptime":6.108096476,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 18:45:41 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 18:45:50 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 18:45:54 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 3939ms
  1|episode- | 2026-09-28 18:45:54 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 18:45:54 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
```

No app check was supplied.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 272a9681 9e4a57aa && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BO ends at `272a9681` (BO record §1), this deploy's start.

## §2. The range — MEASURED

```
$ git rev-list --count 272a9681..9e4a57aa
1
$ git log --oneline 272a9681..9e4a57aa
9e4a57aa3 fix(registry): serialize registrySync.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2183)
$ git diff --shortstat 272a9681 9e4a57aa
 2 files changed, 344 insertions(+), 152 deletions(-)
$ git diff --name-only 272a9681 9e4a57aa
src/services/registrySync.js
tests/integration/registryRmwGroup2RegistrySync.integration.test.js
$ git diff --name-only 272a9681 9e4a57aa -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 1 commit, 2 files, #2183.

## §3. The time

**ATTESTED.** Backup stamped 18:44:44Z, `Ready to accept requests` at
18:45:41, `/health` at 18:45:43Z with uptime 6.1 s.

**MEASURED.** The range's only commit is #2183, 18:43:27 UTC:

```
$ git log --first-parent --format="%h %cI %s" 272a9681..9e4a57aa | head -1
9e4a57aa3 2026-09-28T14:43:27-04:00 fix(registry): serialize registrySync.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2183)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0. The database was confirmed by
Evoni. **MEASURED:** the range adds no migration (§2), and the tree holds 220
migration files.

## §5. What went live — MEASURED

**#2183 (`9e4a57aa`), Task #2182, F-Reg-2 fix group 2 (v1.2 R2) for
`registrySync.js`, rows 70–73.** The four triggers now read, compute and
write under a row lock:
- `onTherapySessionClose`;
- `onMemoryConfirmed`, which hands a pain point to `onPainPointTagged` after
  its transaction;
- `onLineApproved`, which appends to the row's current notes after its AI
  call;
- `onPainPointTagged`.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BO.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the count
is now 17, one past BO's 16 (BO record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BP, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
9e4a57aa368d6fd5609d7af8813bbb965fd9e947 2026-09-28 fix(registry): serialize registrySync.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2183)
$ git rev-parse --is-shallow-repository
false
```

GitHub MCP `list_pull_requests` (state open) returned `[]`.

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

- **Continuity:** the tree agrees with the summary (1 commit, 2 files, no
  migration, no package change), with no gap after BO. Production is at
  `origin/main`, `9e4a57aa`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 17.
- **CFO:** 84/100, 1 critical, 4 warnings. No app check was supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
