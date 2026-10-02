| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DF, 2026-10-02, backend and frontend, by `scripts/deploy-prod.sh` end to end. A fast-forward of 4 commits and 12 files from `e43014ed` to `22824569`: ESLint in CI (#2460) and fixes F1, F2 and F3 (#2461, #2463, #2464). No migration and no package or lock file; 0 pending of 246; one plain restart. CFO 89/100 with 4 warnings, unchanged from DD. The app check has not been done yet. The restart count is continuous from DE (61 → 62; `F-Deploy-1_Deploy_2026-10-01_DE.md`). Production is one commit behind `origin/main`: #2465, merged after DF's fetch, with no migration.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_DD.md` or of any other filed
document. It edits no filed document.

Basis: the commit Deploy DF moved production to,
`22824569edd72d1a86a25862589943dc9745462e` (#2464), read 2026-10-02 from
`origin/main` at `a63eb7b8` (§7).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database name or user, or ARN. The script's output
names the database and the user its pending-migrations check read as, the
API process and the backup's directory; they are left out here, as in the
CW–DD records.

**The letter.** This deploy is lettered **DF**, the letter after DE. It
follows DE (`F-Deploy-1_Deploy_2026-10-01_DE.md`, filed with this record,
in its own PR).

## §0. Evoni's account, as given

**ATTESTED.** The script's output as Evoni pasted it, 2026-10-02, about
00:19–00:21 UTC (the hidden host, the database and its user, the process
name, the backup's directory and the log prefixes left out):

1. **Tree.** `e43014ed` → `22824569`, fast-forward. Range: 4 commits, 12
   files; PRs #2460, #2461, #2463, #2464. "No migration or package/lock
   file in the range."
2. **Backup.** `frontend/dist` backed up, stamped 20261002T001943Z.
3. **Build.** `vite build`, 38.84 s.
4. **Pending check.** The pending-migrations check read `SequelizeMeta`
   with `NODE_ENV=production` against the production database: "OK: 0
   pending of 246 migration files checked. (exit 0)"; the database
   confirmed by Evoni.
5. **The AI key.** `ANTHROPIC_API_KEY` in `.env`: count 1, value not read.
6. **Restart.** One plain `pm2 restart` of the API process: restart count
   62.
   - Ready at 00:20:37: "Ready to accept requests".
   - `/health` at 2026-10-02T00:20:38Z: healthy, production, database
     connected, uptime 6.2 s.
7. **CFO.** 00:20:45–00:20:50: **89/100**, 0 critical, **4 warnings**,
   5123 ms.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main e43014ed 22824569
22824569edd72d1a86a25862589943dc9745462e
e43014edb80d91ca90728f2ee00da8fd03dc9f2a
22824569edd72d1a86a25862589943dc9745462e
$ git merge-base --is-ancestor e43014ed 22824569 && echo "ancestor: yes"
ancestor: yes
```

DE left production at `e43014ed` with restart count 61 (DE record §0, §6;
Evoni's account of DE, given 2026-10-02). DF starts at `e43014ed`, and its
one restart brings the count to 62 (ATTESTED, §0). **No gap:** no deploy ran
between DE and DF that this account does not show. DE's two migrations
were applied at DE (DE record §4), which is why DF found 0 pending of 246.

## §2. The range — MEASURED

```
$ git rev-list --count e43014ed..22824569
4
$ git log --oneline e43014ed..22824569
22824569e fix(events): attaching an event with no scene set uses its venue's sets, never a loose first match (F3) [skip-automerge] (#2464)
669d7fdc4 fix(events): attaching an event commits its required links together; a scene set that can't be linked asks to reconnect (F2) [skip-automerge] (#2463)
f4df79616 fix(venue): Generate Venue Images makes the missing image for an attached scene set and reports what happened (F1) [skip-automerge] (#2461)
fea8b5953 ci: run ESLint (npm run lint) on every PR and push [skip-automerge] (#2460)
$ git diff --shortstat e43014ed 22824569
 12 files changed, 1056 insertions(+), 118 deletions(-)
$ git diff --name-only e43014ed 22824569 -- src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only e43014ed 22824569 -- frontend/
frontend/src/components/SceneBriefConfirm.jsx
frontend/src/pages/WorldAdmin.injectSceneSet.test.jsx
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/WorldAdmin.venueBrief.test.jsx
$ git diff --name-only e43014ed 22824569 -- src/
src/routes/worldEvents.js
src/services/eventSceneSetLinkService.js
src/services/venueGenerationService.js
$ git diff --name-only e43014ed 22824569 -- . ':!frontend' ':!src'
.github/workflows/validate.yml
tests/integration/injectSceneSetLink.integration.test.js
tests/integration/injectVenueSceneSet.integration.test.js
tests/integration/venueAttachedSet.integration.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
```

This agrees with the script's own count:
- 4 commits, the four PRs it named;
- 12 files (4 frontend, 3 backend, 1 workflow, 4 tests);
- no migration;
- no package or lock file, so no `npm ci` was needed.

The frontend files needed the `vite build`; the backend files needed the
restart. The workflow file affects CI only.

## §3. The time

**ATTESTED.** Backup stamped 00:19:43Z; ready at 00:20:37, `/health` at
00:20:38Z, CFO done 00:20:50.

**MEASURED.** The range's last commit, #2464, is at 00:16:19 UTC:

```
$ git log --first-parent --format="%h %cI" e43014ed..22824569
22824569e 2026-10-01T20:16:19-04:00
669d7fdc4 2026-10-01T20:04:22-04:00
f4df79616 2026-10-01T19:57:27-04:00
fea8b5953 2026-10-01T19:45:50-04:00
```

**INFERRED.** The script's fetch reached `22824569`, so it ran at or after
00:16:19; the backup stamp at 00:19:43 fits.

## §4. Migrations

**MEASURED.** The tree holds 246 migration files, the same as at
`e43014ed`; the range adds none:

```
$ git ls-tree -r --name-only 22824569 src/migrations | grep -c '\.js$'
246
$ git ls-tree -r --name-only e43014ed src/migrations | grep -c '\.js$'
246
```

**ATTESTED (§0):** 0 pending of 246, exit 0.

## §5. What went live — MEASURED

- **#2460 (`fea8b595`), ESLint in CI.** The Validate workflow gains an
  ESLint job running `npm run lint`. CI only: no runtime effect. Making
  it a required check is a branch-protection setting, not in this range.
- **#2461 (`f4df7961`), F1.** "Generate Venue Images" on an event whose
  scene set is attached:
  - If the set has its image, nothing is generated and the toast says it
    is already available.
  - If not, the set's Scene Brief and cost are shown, then its base is
    generated for this event.
  - A set that no longer exists is treated as none: a new venue is
    generated and linked.
  - The outcome is reported as generated, already available or failed.
  - The page's toast no longer reads "💉✅ … Event tag injected into
    script" for every message: it shows the message alone, a failure in
    red.
- **#2463 (`669d7fdc`), F2.** Attaching an event to an episode:
  - The script tag, the event's episode and its invitation's episode
    commit in one transaction, or not at all.
  - The scene-set link runs in a savepoint inside it. A link that can't be
    made leaves the event attached, and the editor shows "Event attached ·
    Scene set needs reconnecting" with a Retry.
- **#2464 (`22824569`), F3.** With no scene set chosen, the venue's World
  Location lists its sets:
  - one is used;
  - several ask Evoni to choose;
  - none gives the reconnect prompt.
  - The old loose name match across every show is gone.

New routes in the range, behind `requireAuth`:

```
$ git diff e43014ed 22824569 -- src/routes | grep "^+router\.\(get\|post\|put\|delete\)"
+router.post('/world/:showId/events/:eventId/scene-set-link', requireAuth, async (req, res) => {
```

The new route writes the event's scene set and its episode link. It makes
no AI call.

## §6. Restart and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 62.
- `.env` was read only for the key's presence; no change to it is
  reported.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DD.

The account does not mention `FONT` lines or `episode-worker`; this
record says nothing about either.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DF is `22824569` (#2464).
`origin/main` at filing is one commit ahead: the A9 draft change, merged
after DF's fetch.

```
$ git log --oneline 22824569..origin/main
a63eb7b86 feat(season): Draft with AI on a started slot drafts from its episode, never over a purpose Evoni edited (A9 as changed) [skip-automerge] (#2465)
$ git diff --name-only 22824569 origin/main -- src/migrations | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**Next.** #2465 adds no migration, so the next deploy can run by script
end to end.

## §8. What this document does not do

- It records no credential, database name or user, process name or host.
- It edits no filed document. Deploy DE has its own record.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §9. Tails — re-derived, not carried

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

- **Continuity:** continuous from DE (`e43014ed`, restart 61). The tree
  agrees with the script's account: 4 commits, 12 files, no migration, no
  package or lock file. Production is at `22824569`, one commit behind
  `origin/main` at filing (#2465, no migration).
- **Deploy:** by the script end to end: backup, build, 0 pending of 246,
  the AI key present, one restart (count 62), ready, `/health` healthy and
  connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DD.
- **App check:** not done yet (Evoni).
- **Live:** F1, F2, F3; ESLint runs in CI.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
