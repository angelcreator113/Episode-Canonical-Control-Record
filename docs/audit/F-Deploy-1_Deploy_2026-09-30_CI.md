> **BANNER 1 — APP CHECK SUPPLIED (added 2026-09-30, after `6de09fe0`,
> additive).**
>
> This record's body is preserved exactly as merged at `6de09fe0` (#2343) and
> is not edited. Its "App check: not supplied" (§0, §Standing) is answered
> here.
>
> **ATTESTED.** Evoni, 2026-09-30: "CI app check: I processed an image and it
> looked normal."
>
> The check ran after the deploy, on sharp 0.35.5 (§0 step 4). It does not
> say which image or which processing path was used.

| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CI, 2026-09-30, backend only, a dependency change (sharp 0.34.5 → 0.35.5), no migration, two restarts. Evoni ran it herself, outside any agent session, as a manual deploy because the range changed `package.json` and `package-lock.json`. The first restart ran before `npm ci`, so for about two minutes the new code ran on the old sharp; the one changed call behaves the same on both. The CFO's `dependency_audit` count falls from 2 to 1.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CH.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `3de08be45c652cd3c340e66f0760ca946ddb1a9f` (#2336),
read 2026-09-30. This is the tree Deploy CI moved production to (§8).

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
account number or ARN.

**The letter.** This deploy is lettered **CI**. It follows CH
(`F-Deploy-1_Deploy_2026-09-30_CH.md`), the register's last deploy record.

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
00:38–00:43 UTC, in her order:

1. **Fetch and fast-forward.**
   - `git fetch` found the range `b4627dcf..3de08be4`: 1 commit (#2336,
     sharp 0.35).
   - `package.json` and `package-lock.json` changed; there is no
     migration.
   - `frontend/dist` was backed up (sortable name).
   - `git merge --ff-only` moved the tree to `3de08be4`.
2. **The script.** `scripts/deploy-prod.sh` was then run and correctly
   reported nothing to deploy, since the tree was already at `origin/main`.
3. **Out of order: the restart ran before `npm ci`.**
   - Restart count 37, healthy at 00:41:14Z.
   - CFO 88/100, with `dependency_audit` 1.
   - The installed sharp was still 0.34.5 at that point (confirmed
     afterwards), so the app ran the new code with the old library.
   - The only code change, `.sharpen({ sigma: 0.5 })`, behaves the same on
     0.34, so there was no fault.
4. **Then the install and a second restart.**
   - Installed sharp was 0.34.5; `npm ci` exited 0; installed sharp was then
     0.35.5.
   - `pm2 restart` again: restart count 38, online.
   - `/health` at 2026-09-30T00:42:58Z: healthy, database connected, uptime
     20.1 s.
   - No frontend change, so no build.

**Evoni's note.** The CFO's `dependency_audit` reads the lockfile, so step
3's "1" reflected the lockfile, not the installed modules.

**App check: not supplied.** Evoni's message carried "App check: [processed
an image OK / not checked]" with both options still in brackets. No choice
was made, so this record claims neither.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor b4627dcf 3de08be4 && echo "ancestor: yes"
ancestor: yes
```

**No gap.** CH ends at `b4627dcf` (CH record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CH left it at 36 (CH
record §6). CI's two restarts bring it to 37, then 38.

## §2. The range — MEASURED

```
$ git rev-list --count b4627dcf..3de08be4
1
$ git log --oneline b4627dcf..3de08be4
3de08be45 chore(deps): sharp 0.34 -> 0.35, keeping smoothSkin's sigma 0.5 [skip-automerge] (#2336)
$ git diff --shortstat b4627dcf 3de08be4
 5 files changed, 250 insertions(+), 138 deletions(-)
$ git diff --name-only b4627dcf 3de08be4
package-lock.json
package.json
src/services/AssetProcessingService.js
tests/unit/services/AssetProcessingService.sharpen.test.js
tests/unit/services/sharp.sharpenSigma.test.js
$ git diff --name-only b4627dcf 3de08be4 -- src/migrations/ frontend/; echo "EXIT: $?"
EXIT: 0
$ git diff b4627dcf 3de08be4 -- package.json
-    "sharp": "^0.34.5",
+    "sharp": "^0.35.5",
$ git show b4627dcf:package-lock.json | grep '"node_modules/sharp"' -A1 | tail -1
      "version": "0.34.5",
$ git show 3de08be4:package-lock.json | grep '"node_modules/sharp"' -A1 | tail -1
      "version": "0.35.5",
```

This agrees with Evoni's account:
- 1 commit;
- `package.json` and `package-lock.json` changed;
- no migration and no frontend change.

The one runtime code change is `src/services/AssetProcessingService.js`
`smoothSkin`: `.sharpen(0.5)` → `.sharpen({ sigma: 0.5 })` (lines 177–179 at
`3de08be4`).

## §3. The time

**ATTESTED.** The deploy ran about 00:38–00:43 UTC:
- the first restart was healthy at 00:41:14Z;
- the second answered `/health` at 00:42:58Z with an uptime of 20.1 s.

**MEASURED.** The range's one commit, #2336, is at 00:35:37 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" b4627dcf..3de08be4 | head -1
3de08be45 2026-09-29T20:35:37-04:00 chore(deps): sharp 0.34 -> 0.35, keeping smoothSkin's sigma 0.5 [skip-automerge] (#2336)
```

## §4. The order of steps, and the window

**ATTESTED (§0).** The first restart (count 37) ran before `npm ci`. From
about 00:41:14Z until the second restart, just before 00:42:58Z, the app ran
`3de08be4`'s code on the installed sharp 0.34.5.

**MEASURED: the one changed call gives the same output on 0.34.5 as on
0.35.5.** The fixture is a 64×64 deterministic texture (byte i =
(i × 7919) mod 256), hashed as raw pixels (md5, first 8 hex digits).
- 0.34.5 was measured in a scratch install, not the repository, while
  filing this record.
- 0.35.5 was measured when #2336 was built.

```
sharp 0.34.5   sharpen(0.5) c35c8d5f   sharpen({sigma:0.5}) c35c8d5f   sharpen() 15ff4e88
sharp 0.35.5   sharpen(0.5) 15ff4e88   sharpen({sigma:0.5}) c35c8d5f   sharpen() 15ff4e88
```

In the window, `smoothSkin` called `sharpen({ sigma: 0.5 })` on 0.34.5 and
got `c35c8d5f`. That is what `sharpen(0.5)` gave on 0.34.5 before the
deploy, and what the object form gives on 0.35.5 after it. So `smoothSkin`
produced the same pixels in the window as before and after it. Evoni's "no fault" (§0) agrees with this. No other code in the range
calls sharp differently (§2).

**The step order the PR asked for:** `npm ci`, then restart (#2336,
"Deploy"). The second restart (count 38) is the one that runs 0.35.5.

## §5. What went live — MEASURED

- **#2336 (`3de08be4`), Task #2332: sharp 0.34 → 0.35.**
  - It fixes GHSA-f88m-g3jw-g9cj (libvips CVEs) and GHSA-rgj7-g3m4-5g8c
    (libheif).
  - `smoothSkin` keeps sigma 0.5 through the object form, which 0.35
    requires.

**The CFO count, 2 → 1 (ATTESTED, §0).** At step 3 it read 88/100 with
`dependency_audit` 1.
- **ATTESTED (Evoni's note):** the count follows the lockfile, not the
  installed modules.
- **MEASURED:** the root production-only audit of this lockfile gives 1,
  which is nodemailer. That was measured on #2336's branch before merge
  (`root --omit=dev {"moderate":4,"high":1,…} critical+high = 1 nodemailer`).
- **INFERRED:** npm audit builds its tree from `package-lock.json`, which is
  consistent with Evoni's note and with 1 appearing before `npm ci` ran.

The account gives the CFO line for the first restart only, not the second.

## §6. Restarts and workers

**ATTESTED.**
- Two plain `pm2 restart`s of `episode-api-prod-hotfix`: restart count 37,
  then 38, online.
- The account does not mention `ANTHROPIC_API_KEY` or `.env`.
- `episode-worker` is not reported.

## §7. Schema changes

**MEASURED.** None (§2). The tree holds 226 migration files, the same as CH.

## §8. Basis statement

**MEASURED.** After Deploy CI, production's tree is `origin/main` at filing:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
3de08be45c652cd3c340e66f0760ca946ddb1a9f 2026-09-29 chore(deps): sharp 0.34 -> 0.35, keeping smoothSkin's sigma 0.5 [skip-automerge] (#2336)
$ git rev-parse --is-shallow-repository
false
```

## §9. What this document does not do

- It records no credential or host.
- It edits no filed document. CH (PR pending) is cited by filename.
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

- **Continuity:** the tree agrees with Evoni's account (1 commit, the
  package files, no migration), with no gap after CH. Production is at
  `origin/main`, `3de08be4`, on sharp 0.35.5.
- **Deploy:** manual. The restart before `npm ci` is recorded, and its
  window was harmless (§4). The second restart put 0.35.5 live; restart
  count 38; `/health` healthy and connected.
- **CFO:** `dependency_audit` 1 (nodemailer), 88/100.
- **App check:** not supplied; the choice was left open.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
