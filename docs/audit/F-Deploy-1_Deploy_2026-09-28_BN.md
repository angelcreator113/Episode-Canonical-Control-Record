| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BN, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. F-Reg-2 fix group 1b goes live, and the script's summary names the CFO critical for the first time.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BM.md`, filed with this one, whose deploy this
one follows. This document edits no filed document. Basis: `origin/main` at
`9e4a57aa368d6fd5609d7af8813bbb965fd9e947` (#2183) at filing (§8). Deploy BN
moved production to `ff2ed851f850b484682ddc12972c1b74b2d119af` (#2177).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's account states, here the script's
  summary block as she pasted it.
- **MEASURED** covers what this repository shows; the output is pasted.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
hostname, IP address, key path, account number or ARN.

**The letter.** This deploy is lettered **BN**. BM ends at `1039859f` (BM
record §1), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: 1039859f334dc7c8dd899c7b70fc53cce389da7c -> ff2ed851f850b484682ddc12972c1b74b2d119af (fast-forward)
Range: 4 commit(s), 7 file(s); PRs: #2171 #2173 #2175 #2177
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T181105Z
vite build: built in 33.69s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 15
/health at 2026-09-28T18:12:14Z: {"status":"healthy","timestamp":"2026-09-28T18:12:14.808Z","uptime":6.154438017,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 18:12:14 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 18:12:22 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 18:12:27 +00:00: [CFO] ✅ Audit complete — Score: 82/100 | 1 critical | 5 warnings | 4915ms
  1|episode- | 2026-09-28 18:12:27 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 18:12:27 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
```

The script prints the database host as `[host hidden]`, and this record adds
no host. No app check was supplied.

## §1. Identity and continuity

**ATTESTED.** A fast-forward from `1039859f` to `ff2ed851`.

**MEASURED.**

```
$ git merge-base --is-ancestor 1039859f ff2ed851 && echo "ancestor: yes"
ancestor: yes
```

**MEASURED: no gap.** BM ends at `1039859f` (BM record §1), this deploy's
start. Deploy BO begins at `ff2ed851` (BO record §1), this deploy's end.

## §2. The range — MEASURED

```
$ git rev-list --count 1039859f..ff2ed851
4
$ git log --oneline 1039859f..ff2ed851
ff2ed851f fix(registry): scope the four remaining registry_dossiers_used sites per F-Reg-2 v1.2 R1 [skip-automerge] (#2177)
3a17e0232 docs(audit): F-Reg-2 Fix Plan v1.2 and banners [skip-automerge] (#2175)
a0ceb02be docs(audit): F-Reg-2 owed scoping [skip-automerge] (#2173)
649a14c46 docs(context): refresh for event workstream and deploys BH–BL [skip-automerge] (#2171)
$ git diff --shortstat 1039859f ff2ed851
 7 files changed, 824 insertions(+), 15 deletions(-)
$ git diff --name-only 1039859f ff2ed851
PROJECT_CONTEXT.md
docs/audit/F-Deploy-1_Deploy_2026-09-27_BH.md
docs/audit/F-Reg-2_Fix_Plan_v1.1.md
docs/audit/F-Reg-2_Fix_Plan_v1.2.md
docs/audit/F-Reg-2_OwedScoping_2026-09-28.md
src/routes/storyEvaluationRoutes.js
tests/integration/storyRegistryScopeGroup1b.integration.test.js
$ git diff --name-only 1039859f ff2ed851 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 4 commits, 7 files, the same four PRs, and no
migration or package change. One commit changes runtime code, #2177
(`src/routes/storyEvaluationRoutes.js`). The other three are documents: the
context refresh, the F-Reg-2 scoping read, and v1.2 with its two additive
banners.

## §3. The time

**ATTESTED.** 2026-09-28. Backup stamped 18:11:05Z, `Ready to accept
requests` at 18:12:14, `/health` at 18:12:14Z with uptime 6.2 s.

**MEASURED.** The newest commit in the range is #2177, 18:09:13 UTC:

```
$ git log --first-parent --format="%h %cI %s" 1039859f..ff2ed851 | head -1
ff2ed851f 2026-09-28T14:09:13-04:00 fix(registry): scope the four remaining registry_dossiers_used sites per F-Reg-2 v1.2 R1 [skip-automerge] (#2177)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** `episode_metadata` as `episode_app_dev`: 0 pending of 220,
exit 0. The database was confirmed by Evoni at the script's prompt.

**MEASURED.** The range adds no migration (§2); the tree holds 220 migration
files.

## §5. What went live

### §5.1 The change — MEASURED

**#2177 (`ff2ed851`), Task #2176, F-Reg-2 v1.2 R1 (fix group 1b).** Four
routes in `storyEvaluationRoutes.js` resolve the story's registry with
`resolveStoryRegistryId` (#2113's O-e shape) instead of the never-stored
`registry_dossiers_used[0].registry_id`. The routes are:
- evaluate-stories;
- propose-memory;
- propose-registry-update;
- the write-back's memory step, which no longer falls back to a key-only
  lookup.

### §5.2 The CFO critical is named — ATTESTED, beside MEASURED

**ATTESTED (§0).** The summary carries the detail line: `→ [dependency_audit]
14 critical/high security vulnerabilities found!`. The score is 82/100 with 5
warnings.

**MEASURED.** This is #2165's filter working. It merged in BM's range, so the
box's `scripts/deploy-prod.sh` carries it from this deploy on (BM record
§5.2). The critical and its count match BK's (BK record §0).

### §5.3 The build and the backup

**ATTESTED.** `frontend/dist` backed up to `~/dist-backup-20260928T181105Z`;
vite built in 33.69 s. Nothing in this range changes the frontend.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`; the count
is now 15. `ANTHROPIC_API_KEY` count 1 (value not read).

**MEASURED.** A backend file changed (§2), so a restart was needed.

## §7. Schema changes

**MEASURED.** None (§2, §4).

## §8. Basis statement

**MEASURED.** `origin/main` at filing is
`9e4a57aa368d6fd5609d7af8813bbb965fd9e947` (#2183), not shallow (BM record
§8). GitHub MCP `list_pull_requests` (state open) returned `[]`.

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It does not investigate the `dependency_audit` critical or the warnings.
- It discharges and mints nothing.
- It makes no host, AWS, database or Cognito contact.

## §10. Tails

Re-derived at this basis with the register's commands, output in the BM
record §10: FD-69, XK-4, PE 68. Nothing is minted here.

## §Standing

- **Continuity:** the tree agrees with the summary (4 commits, 7 files, no
  migration, no package change), with no gap after BM.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 15.
- **CFO:** the critical, `dependency_audit` (14 critical/high), is named for
  the first time; 82/100 with 5 warnings.
- **App check:** none supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
