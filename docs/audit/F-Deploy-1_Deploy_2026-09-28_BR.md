| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BR, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. Amber's alive-character delete guard and F-Reg-2 fix group 2's consciousness.js sites go live; production reaches origin/main.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BQ.md`. BR's deploy follows BQ's, and BR is
filed with it. This document edits no filed document. Basis: `origin/main` at
`3c41e368d4351e8d9571f7f166b51e672f482f2f` (#2198), the tree Deploy BR moved
production to (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED** covers the script's summary block as Evoni pasted it.
- **MEASURED** covers what this repository shows, with output pasted.

Nothing is upgraded. This document closes no keystone, discharges no owed
item, mints no FD, XK or PE number, and rules on nothing. It records no
token, email, password, hostname, IP address, key path, account number or
ARN. The shell prompt that followed the pasted block named the host, so it is
not reproduced.

**The letter.** This deploy is lettered **BR**. BQ ends at `e5c3fc82` (BQ
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: e5c3fc82008436be234a9d62058d0957deabb49e -> 3c41e368d4351e8d9571f7f166b51e672f482f2f (fast-forward)
Range: 2 commit(s), 4 file(s); PRs: #2197 #2198
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T205005Z
vite build: built in 34.07s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 19
/health at 2026-09-28T20:52:30Z: {"status":"healthy","timestamp":"2026-09-28T20:52:30.137Z","uptime":6.137769038,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 20:52:29 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 20:52:37 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 20:52:41 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4183ms
  1|episode- | 2026-09-28 20:52:41 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 20:52:41 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.**

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor e5c3fc82 3c41e368 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BQ ends at `e5c3fc82` (BQ record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count e5c3fc82..3c41e368
2
$ git log --oneline e5c3fc82..3c41e368
3c41e368d fix(registry): serialize consciousness.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2198)
660eb7752 fix(registry): Amber delete guard loads the field it checks [skip-automerge] (#2197)
$ git diff --shortstat e5c3fc82 3c41e368
 4 files changed, 231 insertions(+), 20 deletions(-)
$ git diff --name-only e5c3fc82 3c41e368
src/routes/consciousness.js
src/routes/memories/assistant.js
tests/integration/amberDeleteAliveGuard.integration.test.js
tests/integration/registryRmwGroup2Consciousness.integration.test.js
$ git diff --name-only e5c3fc82 3c41e368 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 2 commits, 4 files, #2197 and #2198, and no
migration or package change. Two runtime files change. The other two are
integration tests.

## §3. The time

**ATTESTED.** The backup is stamped 20:50:05Z, `Ready to accept requests` is
at 20:52:29, and `/health` answered at 20:52:30Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2198, at 20:48:10 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" e5c3fc82..3c41e368 | head -1
3c41e368d 2026-09-28T16:48:10-04:00 fix(registry): serialize consciousness.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2198)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database. **MEASURED:** the range adds no migration (§2), and the tree holds
220 migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2197 (`660eb775`), Task #2195.** Amber's `delete_character` action
  (`src/routes/memories/assistant.js`, `executeAssistantAction`) now refuses
  to delete a character at `depth_level` 'alive'. Its guard selected `status`
  and tested `depth_level`, so it never fired
  (`docs/CHARACTER_REGISTRY_READ.md` §4.1 row 8).
- **#2198 (`3c41e368`), Task #2196, F-Reg-2 fix group 2 (v1.2 R2), rows 42
  and 43.** POST `/consciousness/save` and POST
  `/consciousness/dilemma-triggers` now read, merge and write `writer_notes`
  under a row lock.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BQ.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 19, one past BQ's 18 (BQ record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BR, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
3c41e368d4351e8d9571f7f166b51e672f482f2f 2026-09-28 fix(registry): serialize consciousness.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2198)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It discharges nothing and mints nothing.
- It makes no host, AWS, database or Cognito contact.

## §10. Tails

Re-derived at this basis, with the same commands as the BQ record §10: FD-69,
XK-4, PE 68. Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with the summary (2 commits, 4 files, no
  migration, no package change), with no gap after BQ. Production is at
  `origin/main`, `3c41e368`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 19.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check:** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
