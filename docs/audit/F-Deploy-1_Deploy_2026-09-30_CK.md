| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CK, 2026-09-30, backend only, a dependency change (nodemailer 8.0.11 → 10.0.12), no migration, one plain restart. Evoni ran it herself, outside any agent session, as a manual deploy because the range changed `package.json` and `package-lock.json`. The CFO's `dependency_audit` count falls from 1 to 0, and the CFO reports no critical finding for the first time.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CJ.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `2faae32b6aba30c55a03aef95d6a5fa9e7604f80` (#2348),
read 2026-09-30. Deploy CK moved production to `80a4bd75` (#2352), one
commit behind it (§8).

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

**The letter.** This deploy is lettered **CK**. It follows CJ
(`F-Deploy-1_Deploy_2026-09-30_CJ.md`, #2352), the register's last deploy
record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
11:20–11:27 UTC, in her order:

1. **Fetch and fast-forward.**
   - `git fetch` found the range `6de09fe0..80a4bd75`: 4 commits (#2345,
     #2351, #2339, #2352).
   - `package.json` and `package-lock.json` changed (nodemailer); there is
     no migration.
   - `frontend/dist` was backed up (sortable name).
   - `git merge --ff-only` moved the tree to `80a4bd75`.
2. **Install.**
   - `npm ci` exited 0; installed nodemailer 10.0.12.
   - `npm audit --omit=dev`, critical plus high: **0**.
3. **Restart.**
   - No frontend change, so no build.
   - One plain `pm2 restart episode-api-prod-hotfix`: restart count 40,
     online.
   - `/health` at 2026-09-30T11:26:44Z: healthy, database connected, uptime
     20.1 s. Ready at 11:26:28.
   - CFO 11:26:37–11:26:40: **89/100**, **0 critical**, 4 warnings, "the
     first audit with no critical".

**Real email test: not supplied.** Evoni's message carried "Real email
test: [a notification arrived by Gmail / not yet sent]" with both options
still in brackets. No choice was made, so this record claims neither. The
nodemailer PR (#2339) asked for one real send after this deploy; that check
is still open.

**The order was right.** `npm ci` ran before the restart, as the PR asked,
unlike CI's first restart (CI record §4).

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 6de09fe0f4bd7a79b94cb417b2ed1fb8277556b2 80a4bd75e0bad53a2da22a7f9451bda01e79ad0e && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CJ ends at `6de09fe0` (CJ record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CJ left it at 39 (CJ
record §6), and CK's single restart brings it to 40.

## §2. The range — MEASURED

```
$ git rev-list --count 6de09fe0..80a4bd75
4
$ git log --oneline 6de09fe0..80a4bd75
80a4bd75e docs(audit): deploy record CJ [skip-automerge] (#2352)
709b413aa chore(deps): nodemailer 8 -> 10, package.json and lockfile only [skip-automerge] (#2339)
2b941b4c3 docs(audit): banner on deploy record CI, app check supplied [skip-automerge] (#2351)
c360df825 docs(wardrobe): read-only trace of price, price_estimate and coin_cost [skip-automerge] (#2345)
$ git diff --shortstat 6de09fe0 80a4bd75
 6 files changed, 495 insertions(+), 6 deletions(-)
$ git diff --name-only 6de09fe0 80a4bd75
docs/WARDROBE_PRICE_READ_2026-09-30.md
docs/audit/F-Deploy-1_Deploy_2026-09-30_CI.md
docs/audit/F-Deploy-1_Deploy_2026-09-30_CJ.md
package-lock.json
package.json
tests/unit/services/notifications.nodemailer.test.js
$ git diff --name-only 6de09fe0 80a4bd75 -- src/migrations/; echo "EXIT: $?"
EXIT: 0
$ git diff --name-only 6de09fe0 80a4bd75 -- frontend/ | wc -l
0
$ git diff 6de09fe0 80a4bd75 -- package.json
-    "nodemailer": "^8.0.1",
+    "nodemailer": "^10.0.12",
```

The locked versions, read from each tree's `package-lock.json`:

```
nodemailer @6de09fe0: 8.0.11
nodemailer @80a4bd75: 10.0.12
sharp @6de09fe0: 0.35.5
sharp @80a4bd75: 0.35.5
```

This agrees with Evoni's account:
- 4 commits, the four PRs named;
- `package.json` and `package-lock.json` changed, for nodemailer only;
- no migration and no frontend change.

No source file under `src/` changed. The one runtime change is the
nodemailer library itself, used by `src/services/notifications.js`.

## §3. The time

**ATTESTED.** The deploy ran about 11:20–11:27 UTC: ready at 11:26:28,
`/health` at 11:26:44Z with an uptime of 20.1 s, CFO done 11:26:40.

**MEASURED.** The range's last commit, #2352, is at 02:46:19 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" 6de09fe0..80a4bd75
80a4bd75e 2026-09-29T22:46:19-04:00 docs(audit): deploy record CJ [skip-automerge] (#2352)
709b413aa 2026-09-29T22:39:17-04:00 chore(deps): nodemailer 8 -> 10, package.json and lockfile only [skip-automerge] (#2339)
2b941b4c3 2026-09-29T22:21:43-04:00 docs(audit): banner on deploy record CI, app check supplied [skip-automerge] (#2351)
c360df825 2026-09-29T22:14:48-04:00 docs(wardrobe): read-only trace of price, price_estimate and coin_cost [skip-automerge] (#2345)
```

## §4. The install, and the CFO count

**ATTESTED (§0).** `npm ci` exited 0 before the restart; the installed
nodemailer is 10.0.12, matching the lockfile (§2).

**MEASURED: the audit count agrees with this repository.** PR #2339's
branch, with main merged in, measured the same lockfile before merge:

```
root --omit=dev {"info":0,"low":0,"moderate":4,"high":0,"critical":0,"total":4} critical+high = 0
```

**ATTESTED:** Evoni's production audit gave 0, and the CFO read 89/100
with 0 critical.

**INFERRED:** the CJ record (§5) inferred that the one remaining finding
was nodemailer. It falls to 0 with nodemailer as the only dependency
change in this range, which is consistent with that inference. Production's
CFO count has now matched the local `--omit=dev` count at 15, 2, 1 and 0.

## §5. What went live — MEASURED

- **#2339 (`709b413a`), Task #2335: nodemailer 8 → 10.** `package.json`
  and the lockfile only, plus a compatibility test
  (`tests/unit/services/notifications.nodemailer.test.js`). The only call
  site is `src/services/notifications.js` (Gmail transport, `sendMail`).
- **#2345, #2351 and #2352:** the wardrobe price read, the CI record's
  banner and the CJ record. Documents with no runtime effect.

## §6. Restarts and workers

**ATTESTED.**
- One plain `pm2 restart` of `episode-api-prod-hotfix`: restart count 40,
  online.
- The account does not mention `.env`, `ANTHROPIC_API_KEY` or
  `episode-worker`.

## §7. Schema changes

**MEASURED.** None (§2). The tree holds 226 migration files, the same as
CJ:

```
$ git ls-tree -r --name-only 80a4bd75 src/migrations | grep -c '\.js$'
226
```

## §8. Basis statement

**MEASURED.** After Deploy CK, production's tree is `80a4bd75` (#2352).
`origin/main` at filing is one commit ahead: #2348, which Evoni cleared to
merge after CK. It is code (the Finalize `coin_cost` fix), not yet
deployed, with no migration, package or frontend change:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
2faae32b6aba30c55a03aef95d6a5fa9e7604f80 2026-09-30 fix(finalize): store coin_cost in the event outfit snapshot so Finalize charges it [skip-automerge] (#2348)
$ git rev-list --count 80a4bd75..origin/main
1
$ git diff --name-only 80a4bd75 origin/main
src/routes/worldEvents.js
src/services/financialTransactionService.js
tests/integration/outfitSnapshotCoinCost.integration.test.js
$ git diff --name-only 80a4bd75 origin/main -- src/migrations/ package.json package-lock.json frontend/ | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document.
- It sends no email and checks none.
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

- **Continuity:** the tree agrees with Evoni's account (4 commits, the
  package files, no migration), with no gap after CJ. Production is at
  `80a4bd75`, on nodemailer 10.0.12; `origin/main` is one undeployed code
  commit ahead (#2348, §8).
- **Deploy:** manual: backup, fast-forward, `npm ci`, then one restart
  (count 40). `/health` healthy and connected.
- **CFO:** 89/100, **0 critical**, 4 warnings; `dependency_audit` 0.
- **Real email test:** not supplied; the check #2339 asked for is open.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
