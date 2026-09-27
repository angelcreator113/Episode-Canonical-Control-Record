| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BF, 2026-09-27, backend only, one plain restart, no migration, performed personally by Evoni, outside any agent session. Confirmed memories and generate-section's dilemma and plot threads are saved.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BE.md` (the BE record, filed with this one).
This document follows that one rather than editing it. Basis:
`2063168c397d11e79929a52c3a69ed27baf0d77d` (#2102), the tree Deploy BF moved
production to. `origin/main` at filing is `2063168c` (§8).

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

The deploy is lettered BF, continuing after Deploy BE. It is one of two
records (BE and BF) filed together under Task #2104.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27), verbatim:**

> Deploy BF is done:
>
> * The box is at `2063168c`, with only `memories/core.js` and `characterRegistry.js` in the backend diff.
> * 0 pending of 219 migrations, `parse ok`.
> * The restart count went 6 → 7, online, and `/health` reports `healthy` and `connected`.
>
> The `echo~` error at the end was just a stray `~` typed after the command. The health check itself printed fine.
> Confirmed memories now save. If you confirm two on one character, both will be there.

Her account gives no `/health` timestamp and no pending-check exit code; none
is recorded here. The pending check's connection line is not recorded.

## §1. Identity and continuity

**ATTESTED.** The box is at `2063168c`.

**MEASURED.** Both SHAs resolve, and Deploy BE's end is an ancestor of BF's:

```
$ git rev-parse 03b9276c 2063168c
03b9276c3b5bdb76200bf61eee27f1a37c0e437a
2063168c397d11e79929a52c3a69ed27baf0d77d
$ git merge-base --is-ancestor 03b9276c 2063168c; echo "exit=$?"
exit=0
```

Deploy BE ends at `03b9276c` (the BE record, §1, §8); Deploy BF begins there.

## §2. The range — MEASURED

```
$ git log --first-parent --format="%h %cI %s" 03b9276c..2063168c
2063168c3 2026-09-27T17:54:26-04:00 fix(registry): memory confirmations and generate-section save every change [skip-automerge] (#2102)
be8b93f29 2026-09-27T17:33:37-04:00 docs(audit): F-Reg-2 Fix Plan, scope and first fixes [skip-automerge] (#2100)
2c3e4f021 2026-09-27T17:15:47-04:00 docs(audit): open F-Reg-2, scoping [skip-automerge] (#2098)
b470a47c5 2026-09-27T16:55:12-04:00 docs(context): Phase B and F-Ward-1 complete; sequence at F-Reg-2 [skip-automerge] (#2097)
$ git diff --name-only 03b9276c 2063168c -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json
src/routes/characterRegistry.js
src/routes/memories/core.js
$ git diff --name-only 03b9276c 2063168c -- . ':!frontend/src' ':!docs/audit'
PROJECT_CONTEXT.md
src/routes/characterRegistry.js
src/routes/memories/core.js
tests/integration/registryJsonWrites.integration.test.js
$ git diff --name-only 03b9276c 2063168c -- frontend/src | wc -l
0
```

Four commits: #2097, #2098, #2100 and #2102.
- #2098 and #2100 are register documents only; #2097 is `PROJECT_CONTEXT.md`
  only.
- #2102 carries the code: `src/routes/characterRegistry.js` and
  `src/routes/memories/core.js`, the only files changed under `src/`,
  `frontend/src` or a package manifest. Its other file is an integration test,
  not served.

No frontend file, no migration file, no package manifest or lockfile.

**Beside her account.** "Only `memories/core.js` and `characterRegistry.js`
in the backend diff" agrees with the measurement.

## §3. The time

**ATTESTED.** Not given: her account names no time.

**MEASURED.** The newest commit in the range is #2102, 21:54:26 UTC on
2026-09-27 (§2), so the deploy followed it.

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 0 pending of 219. "`parse ok`".

**MEASURED.** The migration tree holds 219 files at the end of the range,
matching the check's total:

```
$ git ls-tree -r --name-only 2063168c src/migrations | wc -l
219
```

## §5. What went live

### §5.1 The change, MEASURED

#2102 (`2063168c`, Task #2101), `fix(registry)`, F-Reg-2 Fix Plan v1.0 fix
group 1, part 1 (O-b):

- `POST /memories/memories/:memoryId/confirm` appends the confirmed memory to
  `extra_fields.memories` in one `UPDATE` built from the column. Before, only
  the first confirmed memory was saved.
- `POST /character-registry/characters/:id/generate-section` sets the
  `dilemma` or `plot_threads` key of `extra_fields` in one `UPDATE`. Before,
  both were lost whenever `extra_fields` was already set.

```
$ git show 2063168c:src/routes/memories/core.js | grep -n "jsonb_build_array(CAST(:entry AS text))"
432:                  || jsonb_build_array(CAST(:entry AS text))
$ git show 2063168c:src/routes/characterRegistry.js | grep -n "extraFieldsSets.push\|ARRAY\[CAST(:key AS text)\]"
1627:          extraFieldsSets.push(['dilemma', generated]);
1644:          extraFieldsSets.push(['plot_threads', threads]);
1710:                  ARRAY[CAST(:key AS text)],
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` reported `healthy` and
`connected`, and the process is online at restart count 7. She states that
an `echo~` error at the end of her output came from a stray `~` typed after
the command, and that the health check printed. She also states: "Confirmed
memories now save. If you confirm two on one character, both will be there."

**MEASURED.** A healthy answer after the restart shows that the app started
with #2102's files loaded. The statement about confirmed memories matches the
code (§5.1) and #2102's integration tests, which ran against a
migration-built database, not production. Whether two memories were confirmed
live is not stated.

### §5.3 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart.

**No frontend build.** Her account names none, and no file under
`frontend/src` changed (§2).

## §6. Restarts

**ATTESTED.** One restart. The restart count went from 6 to 7, and the
process is online.

**MEASURED.** Backend files changed (§2), so a restart was needed for them to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BD took the count from 4 to 5 (BD record §6).
- BE took it from 5 to 6 (the BE record, filed with this one).
- BF took it from 6 to 7.

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 219.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BF, production's tree is this record's basis,
`2063168c`. At filing, after `git fetch origin`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
2063168c397d11e79929a52c3a69ed27baf0d77d 2026-09-27 fix(registry): memory confirmations and generate-section save every change [skip-automerge] (#2102)
```

Nothing has merged to main since Deploy BF's end.

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
- The tree agrees with her account: four commits; the backend change is
  `src/routes/characterRegistry.js` and `src/routes/memories/core.js`, from
  #2102; no frontend file, no migration, no package change (§2).
- **The live check (§5.2):** after a plain restart (6 → 7, online),
  `/health` reported healthy and connected. A live memory confirmation: not
  stated.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2104.*
