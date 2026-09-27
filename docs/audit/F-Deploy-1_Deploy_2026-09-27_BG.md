| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BG, 2026-09-27, backend only, one plain restart, no migration, performed personally by Evoni, outside any agent session. The deep-profile merges and the Story Engine registry update are saved.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BF.md` (the BF record). This document follows
that one rather than editing it. Basis:
`acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf` (#2107), the tree Deploy BG moved
production to. `origin/main` at filing is `acdb6c7d` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output. It cannot be
  reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered BG, continuing after Deploy BF.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27), verbatim:**

> Deploy BG is done:
>
> * The box is at `acdb6c7d`, with only `characterRegistry.js` and `memories/engine.js` in the backend diff.
> * 0 pending of 219 migrations, `parse ok`.
> * The restart count went 7 → 8, online, and `/health` reports `healthy` and `connected`.
>
> The deep-profile merges and Story Engine updates now save every change, safely under concurrent edits.

Her account gives no `/health` timestamp and no pending-check exit code; none
is recorded here. The pending check's connection line is not recorded.

## §1. Identity and continuity

**ATTESTED.** The box is at `acdb6c7d`.

**MEASURED.** Both SHAs resolve, and Deploy BF's end is an ancestor of BG's:

```
$ git rev-parse 2063168c acdb6c7d
2063168c397d11e79929a52c3a69ed27baf0d77d
acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf
$ git merge-base --is-ancestor 2063168c acdb6c7d; echo "exit=$?"
exit=0
```

Deploy BF ends at `2063168c` (BF record §1, §8); Deploy BG begins there.

## §2. The range — MEASURED

```
$ git log --first-parent --format="%h %cI %s" 2063168c..acdb6c7d
acdb6c7dc 2026-09-27T18:16:50-04:00 fix(registry): deep-profile and Story Engine updates save every change [skip-automerge] (#2107)
40771848c 2026-09-27T18:12:54-04:00 docs(audit): file deploy records BE and BF [skip-automerge] (#2106)
$ git diff --name-only 2063168c acdb6c7d -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json
src/routes/characterRegistry.js
src/routes/memories/engine.js
$ git diff --name-only 2063168c acdb6c7d -- . ':!frontend/src' ':!docs/audit'
src/routes/characterRegistry.js
src/routes/memories/engine.js
tests/integration/registryJsonWrites2.integration.test.js
$ git diff --name-only 2063168c acdb6c7d -- frontend/src | wc -l
0
```

Two commits: #2106 and #2107.
- #2106 is register documents only (the BE and BF records).
- #2107 carries the code: `src/routes/characterRegistry.js` and
  `src/routes/memories/engine.js`, the only files changed under `src/`,
  `frontend/src` or a package manifest. Its other file is an integration test,
  not served.

No frontend file, no migration file, no package manifest or lockfile.

**Beside her account.** "Only `characterRegistry.js` and `memories/engine.js`
in the backend diff" agrees with the measurement.

## §3. The time

**ATTESTED.** Not given: her account names no time.

**MEASURED.** The newest commit in the range is #2107, 22:16:50 UTC on
2026-09-27 (§2), so the deploy followed it.

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 0 pending of 219. "`parse ok`".

**MEASURED.** The migration tree holds 219 files at the end of the range,
matching the check's total:

```
$ git ls-tree -r --name-only acdb6c7d src/migrations | wc -l
219
```

## §5. What went live

### §5.1 The change, MEASURED

#2107 (`acdb6c7d`, Task #2105), `fix(registry)`, F-Reg-2 Fix Plan v1.0 fix
group 1, part 2 (O-b):

- `POST /character-registry/characters/:id/deep-profile/accept` and
  `POST /character-registry/characters/bulk-deep-profile` merge into a copy of
  `deep_profile`, re-read under a row lock inside a transaction. Before,
  additions to existing dimensions were not saved. Bulk now merges after its
  AI call, onto the current value.
- `POST /memories/story-engine-update-registry` merges `relationships_map`,
  `evolution_tracking` and `personality_matrix` the same way, after its AI
  call. Before, `personality_matrix` additions were not saved.

```
$ git show acdb6c7d:src/routes/characterRegistry.js | grep -n "lock: transaction.LOCK.UPDATE"
2132:        lock: transaction.LOCK.UPDATE,
2247:          lock: transaction.LOCK.UPDATE,
$ git show acdb6c7d:src/routes/memories/engine.js | grep -n "lock: transaction.LOCK.UPDATE"
5493:          lock: transaction.LOCK.UPDATE,
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` reported `healthy` and
`connected`, and the process is online at restart count 8. She also states:
"The deep-profile merges and Story Engine updates now save every change,
safely under concurrent edits."

**MEASURED.** A healthy answer after the restart shows that the app started
with #2107's files loaded. The statement matches the code (§5.1) and #2107's
integration tests, which ran against a migration-built database, not
production. Whether any of the three endpoints was exercised live is not
stated.

### §5.3 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart.

**No frontend build.** Her account names none, and no file under
`frontend/src` changed (§2).

## §6. Restarts

**ATTESTED.** One restart. The restart count went from 7 to 8, and the
process is online.

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BE took the count from 5 to 6 (BE record §6).
- BF took it from 6 to 7 (BF record §6).
- BG took it from 7 to 8.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 219.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BG, production's tree is this record's basis,
`acdb6c7d`. At filing, after `git fetch origin`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf 2026-09-27 fix(registry): deep-profile and Story Engine updates save every change [skip-automerge] (#2107)
```

Nothing has merged to main since Deploy BG's end.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and records the pending check's result, not its connection line;
- does not edit any filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, restart, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: two commits; the backend change is
  `src/routes/characterRegistry.js` and `src/routes/memories/engine.js`, from
  #2107; no frontend file, no migration, no package change (§2).
- **The live check (§5.2):** after a plain restart (7 → 8, online),
  `/health` reported healthy and connected. A live request to the three
  endpoints: not stated.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2108.*
