| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CH, 2026-09-30, backend and frontend, one plain restart, no migration. Evoni ran it herself with `scripts/deploy-prod.sh`, outside any agent session. Deal build PR 2 goes live: the deal type on the event, drafted by a fixed rule, editable in the Event Package's Terms area until the terms lock.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-29_CG.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `3de08be45c652cd3c340e66f0760ca946ddb1a9f` (#2336),
read 2026-09-30. Production is one commit behind it, at `b4627dcf` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: the script's summary block, as Evoni pasted it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email, password, hostname, IP address, key path,
account number or ARN. The shell prompt after the pasted block named the
host, so it is not reproduced.

**The letter.** This deploy is lettered **CH**. It follows CG
(`F-Deploy-1_Deploy_2026-09-29_CG.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** The summary block of `scripts/deploy-prod.sh`, as Evoni pasted
it on 2026-09-30:

```
Deploy (Evoni, 2026-09-30, via scripts/deploy-prod.sh)
Tree: 1ffe8b5ae2c571835e7ae11f95b2e4f28bcad263 -> b4627dcf1598501c4ead679dea44416edfb3cba0 (fast-forward)
Range: 3 commit(s), 20 file(s); PRs: #2328 #2329 #2331
No migration or package/lock file in the range.
Backup: frontend/dist -> ~/dist-backup-20260930T001516Z
vite build: built in 33.55s
Pending check: [pending-migrations] reading SequelizeMeta: NODE_ENV=production → [host hidden]/episode_metadata as episode_app_dev
Pending result: [pending-migrations] OK: 0 pending of 226 migration files checked. (exit 0); database confirmed by Evoni
ANTHROPIC_API_KEY in .env: count 1 (value not read)
Restart: plain pm2 restart episode-api-prod-hotfix; restart count 36
/health at 2026-09-30T00:16:06Z: {"status":"healthy","timestamp":"2026-09-30T00:16:06.800Z","uptime":9.240937756,"version":"v1","environment":"production","database":"connected"}
Ready line: 1|episode- | 2026-09-30 00:16:05 +00:00: 🔗 Ready to accept requests
CFO lines:
  1|episode- | 2026-09-30 00:16:12 +00:00: [CFO] ⏰ Scheduled audit starting...
  1|episode- | 2026-09-30 00:16:16 +00:00: [CFO] ✅ Audit complete — Score: 86/100 | 1 critical | 4 warnings | 4035ms
  1|episode- | 2026-09-30 00:16:16 +00:00: [CFO] 🚨 Critical issues found:
  1|episode- | 2026-09-30 00:16:16 +00:00:   → [dependency_audit] 2 critical/high security vulnerabilities found!
===== end =====
```

**App check: not supplied.** Evoni's message carried the line "App check:
[Deal type field seen in Terms / not checked]" with both options still in
brackets. No choice was made, so this record claims neither.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 1ffe8b5a b4627dcf && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CG ends at `1ffe8b5a` (CG record §1 and §8), and that is where
this deploy starts.

**The restart count is continuous (ATTESTED):** CG left it at 35 (CG
record §6), and CH's single restart brings it to 36.

## §2. The range — MEASURED

```
$ git rev-list --count 1ffe8b5a..b4627dcf
3
$ git log --oneline 1ffe8b5a..b4627dcf
b4627dcf1 feat(deals): deal build PR 2, the deal type on the event [skip-automerge] (#2331)
8a18f82d9 docs(audit): deploy record CG [skip-automerge] (#2329)
043133797 docs(audit): deploy record CF [skip-automerge] (#2328)
$ git diff --shortstat 1ffe8b5a b4627dcf
 20 files changed, 1293 insertions(+), 7 deletions(-)
$ git diff --name-only 1ffe8b5a b4627dcf
docs/audit/F-Deploy-1_Deploy_2026-09-29_CF.md
docs/audit/F-Deploy-1_Deploy_2026-09-29_CG.md
frontend/src/components/EventPackage/EventTermsSection.jsx
frontend/src/components/EventPackage/EventTermsSection.test.jsx
frontend/src/constants/dealTypes.json
frontend/src/pages/EventPackagePage.css
frontend/src/utils/eventTerms.js
frontend/src/utils/eventTerms.test.js
src/routes/calendarRoutes.js
src/routes/eventDeliverables.js
src/routes/eventGeneratorRoute.js
src/routes/worldEvents.js
src/services/careerPipelineService.js
src/services/dealTypeDraftService.js
src/services/eventAutomationService.js
src/services/feedEventPipelineService.js
src/utils/eventTermsLock.js
tests/integration/dealTypeDraft.integration.test.js
tests/unit/models/WorldEvent.dealTypeMirror.test.js
tests/unit/services/dealTypeDraftService.test.js
$ git diff --name-only 1ffe8b5a b4627dcf -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "EXIT: $?"
EXIT: 0
```

This agrees with the summary: 3 commits, 20 files, the same three PRs, and
no migration or package change.

The runtime files are:
- **backend:**
  - the new `dealTypeDraftService.js`;
  - the event creation paths in `worldEvents.js`, `calendarRoutes.js`,
    `eventGeneratorRoute.js`, `careerPipelineService.js`,
    `eventAutomationService.js` and `feedEventPipelineService.js`;
  - the deliverable routes;
  - `eventTermsLock.js`;
- **frontend:**
  - `EventTermsSection.jsx`;
  - `eventTerms.js`;
  - the new `constants/dealTypes.json`;
  - the Event Package CSS.

The rest are tests and two register documents (CF, CG).

## §3. The time

**ATTESTED.** The backup is stamped 00:15:16Z. `Ready to accept requests` is
at 00:16:05. `/health` answered at 00:16:06Z with an uptime of 9.2 s.

**MEASURED.** The newest commit in the range is #2331, at 00:06:27 UTC, so
the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 1ffe8b5a..b4627dcf | head -1
b4627dcf1 2026-09-29T20:06:27-04:00 feat(deals): deal build PR 2, the deal type on the event [skip-automerge] (#2331)
```

## §4. Pre-deploy checks

**ATTESTED (§0).** 0 of 226 migrations pending, exit 0, and Evoni confirmed
the database.

**MEASURED.** The range adds no migration (§2). The tree holds 226 migration
files: `git ls-tree -r --name-only b4627dcf src/migrations | grep -c '\.js$'`
returns `226`, the same as CG.

## §5. What went live — MEASURED

**#2331 (`b4627dcf`), Task #2330: deal build PR 2, the deal type on the
event** (`docs/DEAL_DESIGN.md` §2.2; Evoni's QUESTIONS 2, 9 and 14,
`docs/EVENT_EPISODE_FLOW.md` §8(cc)).

**The rule.** `deal_type` is drafted by a fixed rule, not the AI, in this
order:
1. the opportunity type, when there is one;
2. `brand_partnership` when `host_brand` is set and a deliverable is owed to
   a brand;
3. `invited_comped` for invite, guest and upgrade events;
4. otherwise `self_funded`.

**Where it applies.** Every creation path drafts it. The draft is recorded
as rule 14 requires.

**While it is still Auto-drafted and the terms are not locked,** it is
re-drafted on a change to a deliverable, `host_brand` or `event_type`.

**Never touched:**
- an Edited value;
- a locked event;
- an event created before this tree, which is not backfilled.

**Editing and the lock:**
- The event PUT accepts `deal_type`.
- `deal_type`, `appearance_fee`, `bonus_terms` and `gifted_value` join the
  terms lock.
- The Event Package's Terms area shows a Deal type field.

**No money reads `deal_type` in this tree.**

**Register only:** #2328 (deploy record CF) and #2329 (deploy record CG).

**INFERRED.** Events created before this deploy show "Not set" for Deal
type; new events show "Auto-drafted · rule" or "Auto-drafted ·
opportunity". This is from the code, not an app check (§0).

**ATTESTED (§0).** CFO: 86/100, 1 critical (`dependency_audit`, 2
critical/high), 4 warnings, the same as at CG.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 36.
- `ANTHROPIC_API_KEY` count 1 (value not read).
- `episode-worker` is not reported in the summary.

## §7. Schema changes

**MEASURED.** None (§2). The columns PR 2 writes (`world_events.deal_type`
and the other deal terms) came with Deploy CF's migrations (CF record §4).

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CH is `b4627dcf`. `origin/main`
has moved one commit since: #2336, the sharp 0.34 → 0.35 upgrade, which
merged after this deploy on Evoni's word that CH was done.

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
3de08be45c652cd3c340e66f0760ca946ddb1a9f 2026-09-29 chore(deps): sharp 0.34 -> 0.35, keeping smoothSkin's sigma 0.5 [skip-automerge] (#2336)
$ git rev-parse --is-shallow-repository
false
```

#2336 changes `package-lock.json`, so its deploy is manual (`npm ci`, then
restart), as recorded in its PR.

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

- **Continuity:** the tree agrees with the summary (3 commits, 20 files, no
  migration, no package change), with no gap after CG. Production is at
  `b4627dcf`, one commit behind `origin/main` (#2336, merged after).
- **Deploy:** 0 pending of 226; `/health` healthy and connected; restart
  count 36.
- **CFO:** 86/100, 1 critical (2 critical/high), 4 warnings.
- **Live here:** the deal type on the event (deal build PR 2).
- **App check:** not supplied; the choice was left open.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
