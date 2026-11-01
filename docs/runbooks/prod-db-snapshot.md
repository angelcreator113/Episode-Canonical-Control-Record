# Runbook: the daily production database snapshot

Once a day, the Diagnostics workflow writes a snapshot of the production database to the private repository `prime-diagnostics`, as `latest-db-snapshot.md`. Every session reads the newest one at `/wake-up`, so it starts from the real schema and real content instead of guessing.

The rules come from `docs/audit/F-Tools-2_ReadOnlyProdVisibility_Ruling_Amendment1_2026-10-31.md` (Evoni, 2026-10-31; Task #3659). This runbook covers how the snapshot is made, what Evoni sets up, and what a session may do with it. The Diagnostics workflow itself is in `docs/runbooks/diagnostics-workflow.md`.

## 1. What is in it

`latest-db-snapshot.md` has three parts. They match the ruling's checks, built in one pass by the `snapshot` mode of `scripts/diagnostics/db-check.js`.

| Part | Ruling's name | Content |
|---|---|---|
| 1. Schema | `db-schema`, extended | Every table in `public`. For each column: its type, `not null`, and its default. For each index: whether it is unique, its method and its columns. No row data. |
| 2. Row counts | `db-counts`, extended | An exact `count(*)` for every table in `public`, including the tables that are never sampled. |
| 3. Content samples | `db-samples` | The latest 20 rows of each table on `SAMPLE_TABLES`, with the column rules below. |

**The sampling rules** (Amendment 1 §3), in `db-check.js`:
- **Tables.** Only the 20 tables in `SAMPLE_TABLES` are sampled. `NEVER_TABLES` lists the categories that may never be added: users, accounts, roles, permissions, auth, sessions, tokens, private and therapy writing, DMs, social-media imports, AI and activity logs, `user_decisions`, and media records. `sampleSql()` refuses any table that is not on the allowlist, or that is on the never-list.
- **Columns.** `dropColumn()` splits each name on `_` and on camelCase. It drops the column if any part is on the denylist (`password`, `token`, `email`, `phone`, `url`, `path`, `s3`, `user`, `owner` and the rest), or begins with `passw`, `secret`, `token` or `credential`. `bytea` columns are always dropped. The query names its columns; there is no `SELECT *`.
- **Rows.** At most 20 per table, newest first: by `updated_at`, else `created_at`, else `id`. Rows with a `deleted_at` are left out.
- **Values.** `boundValue()` cuts each value at 200 characters (`…[cut]`). The samples section stops at 200 KB.
- **Names.** Every table and column name is passed through `ident()` before it reaches SQL. Nothing comes from input.
- **Masking.** `redact.js` masks the whole report on the box, and again on the runner before it is published.

## 2. How it gets there

```
schedule (06:17 UTC daily, main) ─► Diagnostics, CHECK = db-snapshot, environment prod-readonly
  runner.sh snapshot()
    page 0 ─► SSM PrimeStudios-Diagnostics ─► on-box.sh db-snapshot <sha> 0 <run>
                 db-check.js snapshot (as prime_readonly) │ redact.js │ gzip │ base64
                 ─► /tmp/prime-db-snapshot-<run>.b64 (mode 600)
                 returns: pages, sha256, database exit, slice 0
    page 1…n ─► the same document returns slice n; the last page deletes the file
    joins the slices ─► checks the sha256 ─► base64 -d │ gunzip ─► the report
  redact.js ─► publish.sh ─► prime-diagnostics: runs/<date>/<run>-db-snapshot.md, latest-db-snapshot.md
```

**Why pages.** SSM returns at most 24,000 characters per command, and a full snapshot is larger. The box builds the snapshot once, then hands it back in slices of 18,000 characters.

**Why masking happens before packing.** Masking could alter base64 text, so the box masks the report first and then packs it.

**Checks along the way.** The runner joins the slices and checks them against the box's sha256. If any page is missing, or the sums differ, or the report does not unpack, the run fails and publishes no report.

**Leftovers.** The file on the box is named for the run. Page 0 removes leftovers more than an hour old from interrupted runs.

**Schedule-only** (Amendment 1 §2):
- `db-snapshot` is not a dispatch option of the workflow.
- `runner.sh` refuses it unless `GITHUB_EVENT_NAME` is `schedule`.
- The session guards refuse a session's attempt to start it. They cover `gh workflow run … check=db-snapshot` or `db-samples`, a dispatch API call, an `aws ssm send-command` naming it (`.claude/hooks/guard-dangerous-commands.js`), and the GitHub tool's `run_workflow` with that input (`.claude/hooks/guard-github-tools.js`).

Evoni can run it by hand by re-running a scheduled run from GitHub: Actions → Diagnostics → a run marked *schedule* → Re-run. A re-run keeps the event name.

**The public log** shows only what F-Tools-2 allows for every Diagnostics run: the byte count, the exit status, the private path and a sha256 prefix. `tests/unit/scripts/diagnostics.test.js` pins this.

## 3. Setup (Evoni, once, after this merges)

The Diagnostics one-time setup (`docs/runbooks/diagnostics-workflow.md` §3) must already be done, and Level 1 in effect. Then:

1. **Register the new SSM document version.** Systems Manager → Documents → `PrimeStudios-Diagnostics` → Actions → Create new version → paste `scripts/diagnostics/ssm-document.json` from `main` → Create. Then make it the default version: Actions → Set default version → the new one.
   - This version adds `db-snapshot` to `allowedValues`, and the `page` and `run` parameters.
   - The ruling (§7.3) calls the check `db-samples`. The samples are part 3 of the one `db-snapshot` check on the box, because the snapshot is built once and paged; see §1.
   - The old checks are unchanged, and both new parameters default to `0`.
2. **Nothing else is new.** The snapshot uses the same role, environment, `prime_readonly` user and deploy key. The password stays on the box in `~/.episode-readonly.env`.
3. **The first run.** Wait for the first scheduled run (06:17 UTC), or re-run a scheduled run as above.
   - Read `latest-db-snapshot.md` in `prime-diagnostics` yourself, and confirm it holds nothing you do not want sessions to see (§7.4).
   - Then commit the `CLAUDE.md` line from Amendment 1 §6 (§7.5). Until both are done, `/wake-up` records the snapshot as NOT IN EFFECT.

## 4. What a session may do with it (Amendment 1 §5)

- **At `/wake-up`** (`.claude/skills/wake-up/SKILL.md` step 8), it reads the newest `latest-db-snapshot.md` without a task authorization.
  - It reports the date, the age in days, and the sha256 prefix, checked against the scheduled run's publish line.
  - It says "no snapshot", or flags one more than 3 days old.
  - The wake-up report carries no rows.
- **During the session**, it may use what the snapshot shows to do its work: real column names, enum values in use, the shape of a real record.
- **Never.**
  - A session never starts a snapshot, by dispatch or by re-run.
  - It never copies sample rows or values into a commit, PR, issue, comment, test fixture, log, external service or `docs/audit/`.
  - In chat, it quotes only what the task needs.
  - Schema facts and counts (parts 1 and 2) may be cited anywhere.

## 5. When something is wrong

| Symptom | Likely cause | What to do |
|---|---|---|
| `/wake-up` says "no snapshot" | the setup in §3 is not done, or no scheduled run has succeeded | Check Actions → Diagnostics for *schedule* runs and their result |
| snapshot more than 3 days old | `DIAG_ENABLED` is off, or the scheduled runs fail, or GitHub paused the schedule (it does that after 60 days without repository activity) | Look at the latest scheduled run. If the schedule was paused, Actions → Diagnostics → Enable workflow |
| run fails with `page 0 did not arrive` | the SSM document is still the old version (`db-snapshot` not allowed), or the agent is offline | §3 step 1; then `health` |
| run fails with `do not match the box's checksum` | a page was cut or changed in transit | Re-run the scheduled run; if it repeats, open an issue |
| report says `database part exit 1` | a count or a sample query failed (the report says which) | Usually a table added without the read-only grant: `GRANT SELECT ON ALL TABLES IN SCHEMA public TO prime_readonly;` on the box |
| sha256 prefix does not match the run log | the file was changed after publishing, or a different run is being compared | Compare with the run named in the private repository's commit message |

## 6. Costs and limits

- One run a day: about 1 to 3 minutes of Actions time (free on a public repository), and a few SSM commands (free).
- The private repository grows by the snapshot's size each day, roughly what the samples cap allows plus the schema. To purge the history, delete and recreate the repository and its deploy key (`docs/runbooks/diagnostics-workflow.md` §7).
- The rules are enforced by code and tests, not by database grants: `prime_readonly` can read every table (Amendment 1 §3, enforcement standing). A `prime_snapshot` role limited to the allowlisted columns is a possible later hardening.

## 7. Turning it off

| To stop | Do |
|---|---|
| the daily run only | Actions → Diagnostics → ⋯ → Disable workflow (this also stops manual checks), or revert the `schedule:` lines by PR |
| all Diagnostics runs | set `DIAG_ENABLED` to anything but `true` |
| sessions reading it | remove the Amendment 1 §6 line from `CLAUDE.md`, or remove `prime-diagnostics` from the Claude App's repository access |
| the box side | create a document version without `db-snapshot` in `allowedValues` and make it the default |
