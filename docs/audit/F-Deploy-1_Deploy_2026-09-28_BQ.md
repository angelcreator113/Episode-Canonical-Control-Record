| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BQ, 2026-09-28, backend and frontend, one plain restart, no migration, performed personally by Evoni, outside any agent session, with `scripts/deploy-prod.sh`. F-Reg-2 fix group 2's characterGenerationRoutes.js sites and the promote-ghost role_type fix go live; production reaches origin/main.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-28_BP.md`, whose deploy this one follows. This
document edits no filed document. Basis: `origin/main` at
`e5c3fc82008436be234a9d62058d0957deabb49e` (#2194), the tree Deploy BQ moved
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

**The letter.** This deploy is lettered **BQ**. BP ends at `9e4a57aa` (BP
record §1, §8), and this deploy begins there.

## §0. Evoni's account, as given

**ATTESTED (the summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it, 2026-09-28):**

```
Deploy (Evoni, 2026-09-28, via scripts/deploy-prod.sh)
Tree: 9e4a57aa368d6fd5609d7af8813bbb965fd9e947 -> e5c3fc82008436be234a9d62058d0957deabb49e (fast-forward)
Range: 6 commit(s), 10 file(s); PRs: #2185 #2186 #2188 #2192 #2193 #2194
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260928T203726Z
vite build: built in 34.80s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 220 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 18
/health at 2026-09-28T20:38:25Z: {"status":"healthy","timestamp":"2026-09-28T20:38:25.461Z","uptime":6.104032586,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-28 20:38:25 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-28 20:38:33 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-28 20:38:37 +00:00: [CFO] ✅ Audit complete — Score: 84/100 | 1 critical | 4 warnings | 4479ms
  1|episode- | 2026-09-28 20:38:37 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-28 20:38:37 +00:00:   → [dependency_audit] 14 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.** The check Evoni named for this deploy is to
promote a ghost character, which failed on every call before #2188 (§5). No
result for it was supplied at filing.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 9e4a57aa e5c3fc82 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** BP ends at `9e4a57aa` (BP record §1, §8), which is this deploy's
start.

## §2. The range — MEASURED

```
$ git rev-list --count 9e4a57aa..e5c3fc82
6
$ git log --oneline 9e4a57aa..e5c3fc82
e5c3fc820 docs(registry): read registry schema, Feed links and references [skip-automerge] (#2194)
20d294579 docs(registry): record Character Registry rulings C1–C8 [skip-automerge] (#2193)
fcad7f772 fix(registry): serialize promote-ghost ghost_characters RMW (F-Reg-2 v1.2 R2) [skip-automerge] (#2192)
11ebb5d41 fix(registry): promote-ghost uses role_type 'support' [skip-automerge] (#2188)
9e36febe5 fix(registry): serialize characterGenerationRoutes.js RMW sites (F-Reg-2 v1.2 R2) [skip-automerge] (#2186)
7537e924a docs(audit): file deploy records BM, BN, BO and BP [skip-automerge] (#2185)
$ git diff --shortstat 9e4a57aa e5c3fc82
 10 files changed, 1474 insertions(+), 26 deletions(-)
$ git diff --name-only 9e4a57aa e5c3fc82
docs/CHARACTER_REGISTRY_READ.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BM.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BN.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BO.md
docs/audit/F-Deploy-1_Deploy_2026-09-28_BP.md
docs/navigation-architecture.md
src/routes/characterGenerationRoutes.js
tests/integration/promoteGhostRoleType.integration.test.js
tests/integration/registryRmwGroup2CharGen.integration.test.js
tests/unit/routes/authorOnlyFields-routes.test.js
$ git diff --name-only 9e4a57aa e5c3fc82 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 6 commits, 10 files, the same six PRs, and no
migration or package change. Only one runtime file changes,
`src/routes/characterGenerationRoutes.js`. The rest are tests, living docs
and register records.

## §3. The time

**ATTESTED.** The backup is stamped 20:37:26Z, `Ready to accept requests` is
at 20:38:25, and `/health` answered at 20:38:25Z with uptime 6.1 s.

**MEASURED.** The newest commit in the range is #2194, at 20:22:11 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 9e4a57aa..e5c3fc82 | head -1
e5c3fc820 2026-09-28T16:22:11-04:00 docs(registry): read registry schema, Feed links and references [skip-automerge] (#2194)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 pending of 220, exit 0, and Evoni confirmed the
database. **MEASURED:** the range adds no migration (§2), and the tree holds
220 migration files (`ls src/migrations/*.js | wc -l` → `220`).

## §5. What went live — MEASURED

- **#2186 (`9e36febe`), Task #2184, F-Reg-2 fix group 2 (v1.2 R2), row 4.**
  POST `/character-generation/confirm` now reads the character, computes
  `depth_level` and writes it under a row lock.
- **#2188 (`11ebb5d4`), Task #2187.** POST
  `/character-generation/promote-ghost/:characterId` creates the promoted
  character with `role_type: 'support'`. It used `'supporting'`, which
  `enum_registry_characters_role_type` does not have, so every call failed
  with a 500.
- **#2192 (`fcad7f77`), Task #2189, F-Reg-2 fix group 2 (v1.2 R2), row 8.**
  The same handler now marks the promoted ghost in the source character's
  `ghost_characters` under a row lock.
- **Docs only, no runtime effect:**
  - #2193 (`20d29457`, Task #2190): the Character Registry rulings C1–C8 in
    `docs/navigation-architecture.md`.
  - #2194 (`e5c3fc82`, Task #2191): `docs/CHARACTER_REGISTRY_READ.md`.
  - #2185 (`7537e924`): deploy records BM–BP.

**ATTESTED (§0).** CFO: 84/100, 1 critical (`dependency_audit`, 14
critical/high), 4 warnings, as at BP.

## §6. Restarts

**ATTESTED.** One plain `pm2 restart` of `episode-api-prod-hotfix`. The count
is now 18, one past BP's 17 (BP record §6). `ANTHROPIC_API_KEY` count 1
(value not read). `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2).

## §8. Basis statement

**MEASURED.** After Deploy BQ, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
e5c3fc82008436be234a9d62058d0957deabb49e 2026-09-28 docs(registry): read registry schema, Feed links and references [skip-automerge] (#2194)
$ git rev-parse --is-shallow-repository
false
```

Two PRs were open at filing and are not in production: #2197 (Task #2195)
and #2198 (Task #2196).

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It investigates no CFO finding.
- It discharges nothing and mints nothing.
- It makes no host, AWS, database or Cognito contact.

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

- **Continuity:** the tree agrees with the summary (6 commits, 10 files, no
  migration, no package change), with no gap after BP. Production is at
  `origin/main`, `e5c3fc82`.
- **Deploy:** 0 pending of 220; `/health` healthy and connected; restart
  count 18.
- **CFO:** 84/100, 1 critical, 4 warnings.
- **App check (promote a ghost character):** not supplied.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.*
