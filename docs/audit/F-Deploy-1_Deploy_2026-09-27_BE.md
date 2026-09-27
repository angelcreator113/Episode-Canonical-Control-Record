| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BE, 2026-09-27, backend only, one plain restart, no migration, performed personally by Evoni, outside any agent session. The event-name suggester no longer sees the show's name.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_BD.md` (the BD record). This document follows
that one rather than editing it. Basis:
`03b9276c3b5bdb76200bf61eee27f1a37c0e437a` (#2094), the tree Deploy BE moved
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

The deploy is lettered BE, continuing after Deploy BD. It is one of two
records (BE and BF) filed together under Task #2104. Evoni asked for BE's
record to be filed with the next deploy's.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27), verbatim:**

> Deploy BE is done:
>
> * The box is at `03b9276c`, with only `worldEvents.js` in the backend diff.
> * 0 pending of 219 migrations, `parse ok`.
> * The restart count went 5 → 6, online, and `/health` reports `healthy` and `connected`.
>
> The event-name suggester no longer sees your show's name.

Her account gives no `/health` timestamp and no pending-check exit code; none
is recorded here. The pending check's connection line is not recorded.

## §1. Identity and continuity

**ATTESTED.** The box is at `03b9276c`.

**MEASURED.** Both SHAs resolve, and Deploy BD's end is an ancestor of BE's:

```
$ git rev-parse 7e2ea9ce 03b9276c
7e2ea9ce89e22336a1647d1c951963e810fa9072
03b9276c3b5bdb76200bf61eee27f1a37c0e437a
$ git merge-base --is-ancestor 7e2ea9ce 03b9276c; echo "exit=$?"
exit=0
```

Deploy BD ends at `7e2ea9ce` (BD record §1, §8); Deploy BE begins there.

## §2. The range — MEASURED

```
$ git log --first-parent --format="%h %cI %s" 7e2ea9ce..03b9276c
03b9276c3 2026-09-27T16:34:37-04:00 docs(audit): F-Ward-1 Fix Plan v1.1, F-Ward-1 closed [skip-automerge] (#2094)
a299b5ab5 2026-09-27T16:30:44-04:00 docs(audit): file deploy records BC and BD [skip-automerge] (#2093)
a0c795d67 2026-09-27T16:24:50-04:00 fix(events): drop show name from suggest-names prompt [skip-automerge] (#2090)
$ git diff --name-only 7e2ea9ce 03b9276c -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json
src/routes/worldEvents.js
$ git diff --name-only 7e2ea9ce 03b9276c -- . ':!frontend/src' ':!docs/audit'
src/routes/worldEvents.js
$ git diff --name-only 7e2ea9ce 03b9276c -- frontend/src | wc -l
0
```

Three commits: #2090, #2093 and #2094.
- #2093 and #2094 are register documents only.
- #2090 carries the code: `src/routes/worldEvents.js`, the only file changed
  under `src/`, `frontend/src` or a package manifest.

No frontend file, no migration file, no package manifest or lockfile.

**Beside her account.** "Only `worldEvents.js` in the backend diff" agrees
with the measurement.

## §3. The time

**ATTESTED.** Not given: her account names no time.

**MEASURED.** The newest commit in the range is #2094, 20:34:37 UTC on
2026-09-27 (§2), so the deploy followed it. Deploy BF (filed with this
record) followed Deploy BE.

## §4. Pre-deploy checks

**ATTESTED.** Pending-migration check: 0 pending of 219. "`parse ok`".

**MEASURED.** The migration tree holds 219 files at the end of the range,
matching the check's total:

```
$ git ls-tree -r --name-only 03b9276c src/migrations | wc -l
219
```

## §5. What went live

### §5.1 The change, MEASURED

#2090 (`a0c795d6`, Task #2086), `fix(events)`: the event-name suggester no
longer loads the show's name or puts it in the prompt. Doctrine rule 11 says
an event name never uses the show name.

```
$ git show --stat --format='%h %s' a0c795d6 | tail -2
 src/routes/worldEvents.js | 8 ++------
 1 file changed, 2 insertions(+), 6 deletions(-)
$ git show a0c795d6:src/routes/worldEvents.js | grep -n "No show name (Task #2086)"
290:    // No show name (Task #2086): doctrine rule 11 says an event name never
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** After the restart, `/health` reported `healthy` and
`connected`, and the process is online at restart count 6. Her account also
states: "The event-name suggester no longer sees your show's name."

**MEASURED.** A healthy answer after the restart shows that the app started
with #2090's file loaded. The statement about the suggester matches the code
(§5.1); whether a live suggest-names request was made is not stated.

### §5.3 Production's path, and no frontend build

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3. `DEVELOPMENT_WORKFLOW.md` §7.1 gives the backend steps: the
pending-migration check before the restart.

**No frontend build.** Her account names none, and no file under
`frontend/src` changed (§2).

## §6. Restarts

**ATTESTED.** One restart. The restart count went from 5 to 6, and the
process is online.

**MEASURED.** A backend file changed (§2), so a restart was needed for it to
take effect. No `.env` or credential change is in the range.

**The restart chain across the records:**
- BD took the count from 4 to 5 (BD record §6).
- BE took it from 5 to 6.
- BF takes it from 6 to 7 (the BF record, filed with this one).

## §7. Schema changes

**ATTESTED.** No migration: 0 pending of 219.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BE, production's tree was this record's basis,
`03b9276c`, until Deploy BF. At filing, after `git fetch origin`,
`origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
2063168c397d11e79929a52c3a69ed27baf0d77d 2026-09-27 fix(registry): memory confirmations and generate-section save every change [skip-automerge] (#2102)
```

That is Deploy BF's end (the BF record).

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
- The tree agrees with her account: three commits; the backend change is
  `src/routes/worldEvents.js`, from #2090; no frontend file, no migration, no
  package change (§2).
- **The live check (§5.2):** after a plain restart (5 → 6, online),
  `/health` reported healthy and connected. A live suggest-names request:
  not stated.
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.1.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2104.*
