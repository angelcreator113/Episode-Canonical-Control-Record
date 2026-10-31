| **PRIME STUDIOS** **F-TOOLS-2 — READ-ONLY PRODUCTION VISIBILITY, AMENDMENT 1: THE DAILY DATABASE SNAPSHOT** *Adds a scheduled, read-only Diagnostics snapshot of production's schema, row counts and allowlisted content samples, written only to the private output repository, and lets every session read it at `/wake-up` as standing access. Additive only: `F-Tools-2_ReadOnlyProdVisibility_Ruling_2026-10-29.md` and `F-Tools-3_TaskScopedProductionReads_Ruling_2026-10-29.md` are merged and unedited. Mints nothing.* |
| --- |

**Document version**

v1.0. **Additive.** It narrows nothing in F-Tools-2 or F-Tools-3. It adds one check, one schedule and one standing read, and carves one exception out of F-Tools-3 §1, limited to the report this document defines.

**Basis:** `origin/main` at `b16fded1b68ce4a24711824ad63081e6aacc92bd`, 2026-10-31.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** RULED. Evoni's decision in the session of 2026-10-31, in her words: "B. In the amendment, allow sessions to read the allowlisted content samples at /wake-up as standing access, not per task." It takes effect only when every condition in §7 holds.

**Task:** #3659.

---

# §1. Why

Sessions plan and write code against what the models and migrations say, not against what production holds. The register has recorded drift between the two more than once (`docs/MIGRATION_DRIFT_READ.md`; the schema-agreement ratchets). A dated, read-only picture of production's schema, sizes and a few real content rows, read at the start of every session, lets a session work from the database as it is.

**Rejected alternatives** (MEASURED against the merged rulings, 2026-10-31):
- **A new workflow that publishes into this repository** (an orphan branch or a workflow artifact). F-Tools-2 §3 bars this: this repository is public. Any signed-in GitHub user can download a public repository's artifacts, as F-Tools-3 §3.1.2 records, and an orphan branch is world-readable.
- **A database password in a GitHub secret.** `CLAUDE.md` (Rule 7 ruling) says database credentials stay on the server.
- **A second read-only database user.** `prime_readonly` (`scripts/diagnostics/sql/readonly-role.sql`) already has SELECT only, read-only transactions by default and a 30 s statement timeout.

# §2. The snapshot

**Delivered by the Diagnostics workflow** (F-Tools-2 §3), on its existing path, with no new path to the database:
- OIDC → `PrimeStudios-ReadOnly-GHA` (15 minutes) → SSM `PrimeStudios-Diagnostics` → `on-box.sh` as `ubuntu` → `db-check.js` as `prime_readonly`.

**Schedule.** Once a day, from a `schedule:` trigger on `main`, in the `prod-readonly` environment. The scheduled job is named `db-snapshot`. It runs three checks and publishes one report.

| Part | Check | Content |
|---|---|---|
| (a) Schema | `db-schema`, extended | Every table in `public`: its columns, with type, nullability and default; and its indexes, with name, columns and uniqueness. No row data. |
| (b) Sizes | `db-counts`, extended | An exact `count(*)` for every table in `public`. |
| (c) Content samples | `db-samples`, new | The rules in §3. |

**Who may start what:**
- `db-schema` and `db-counts` stay startable by a session under F-Tools-2 §4.
- **`db-samples` runs only from the schedule.** A session never dispatches it. The workflow refuses `db-samples` on `workflow_dispatch`, and the guard blocks a session from dispatching it.
- Evoni may run the scheduled job by hand from GitHub, as she can any workflow.

# §3. What may be sampled (the rules `db-samples` enforces)

1. **Allowlist only.** Rows are read only from tables on an explicit list kept in code (`scripts/diagnostics/db-check.js`, a constant named `SAMPLE_TABLES`). Any table not on the list is never sampled, including a table added to the database later. The initial list is franchise and production content:

   `shows`, `show_configs`, `episodes`, `episode_briefs`, `characters`, `character_registries`, `registry_characters`, `world_characters`, `universes`, `book_series`, `social_profiles`, `feed_posts`, `world_events`, `world_locations`, `scene_sets`, `scene_angles`, `wardrobe`, `wardrobe_library`, `lalaverse_brands`, `phone_missions`.

2. **Never on the list, at any time, without a new ruling.** These categories may never be added to the list:
   - users, accounts, roles and permissions;
   - authentication, sessions and tokens;
   - any table holding personal or private writing or therapy content: `storyteller_*`, `therapy_*`, `character_therapy_profiles`, `brain_*`, `author_notes`, `writing_*`;
   - direct messages: `pulse_dm_*`;
   - imports of real social-media accounts: `social_media_imports`;
   - AI logs, usage logs and prompts: `ai_*`, `activity_logs`;
   - `user_decisions`;
   - media and storage records: `assets`, `raw_footage`, `media_asset_sources`, `audio_clips`, and similar.

   Adding any other content table to the list is a reviewed PR. It must name the table's columns in the PR.
3. **Column denylist, applied at query time.** `db-samples` builds an explicit column list for each table and never uses `SELECT *`. It splits each column name into parts on `_` and on lower-to-upper case changes, and compares the parts case-insensitively. A column is dropped:
   - if **any part** is one of: `password`, `passwd`, `pwd`, `pass`, `secret`, `token`, `hash`, `salt`, `api`, `private`, `auth`, `session`, `cookie`, `otp`, `mfa`, `email`, `phone`, `mobile`, `address`, `ip`, `ssn`, `dob`, `birthdate`, `birthday`, `url`, `uri`, `link`, `href`, `path`, `s3`, `bucket`, `signed`, `credential`, `credentials`, `cognito`, `sub`, `user`, `owner`;
   - or if **any part begins with** `passw`, `secret`, `token` or `credential`.

   Matching on whole parts, not substrings, keeps content columns such as `description`, `relationship` and `character_key` (the slug `CLAUDE.md` names). A plain `key` part is therefore not dropped. `api_key` and `private_key` are dropped through their `api` and `private` parts.

   `url`, `link`, `path` and `s3` are dropped because F-Tools-3 §1.4 bars private URLs and signed links from any report. Columns of type `bytea` are always dropped.
4. **Values are bounded.** Every text or JSON value is cut to 200 characters and marked `…[cut]`. Each table gives at most **20 rows**: the latest by `updated_at`, else `created_at`, else the primary key. Rows with a non-null `deleted_at` are excluded. The whole `db-samples` section is capped at 200 KB.
5. **Redaction still runs.** The report passes through `redact.js` (F-Tools-2) before publishing, like every Diagnostics report.
6. **Tests enforce 1–4.** The implementation PR adds tests that fail if:
   - a table outside `SAMPLE_TABLES`, or in a §3.2 category, is read;
   - a denylisted or `bytea` column reaches the output;
   - a value exceeds the bound.

**Enforcement standing (INFERRED, stated plainly):** rules 1–4 are enforced by application code and tests. The database grants are not involved: `prime_readonly` can SELECT every table. A stronger, grant-enforced version is possible as a later hardening, with a separate `prime_snapshot` role granted SELECT only on the allowlisted tables' permitted columns. It needs one more SQL step on the box by Evoni and is **not** required by this amendment.

# §4. Where it goes

- **Only the private repository `prime-diagnostics`**, as `runs/<date>/<run>-db-snapshot.md` and `latest-db-snapshot.md`. `publish.sh`'s privacy gate applies: it refuses unless a signed-out request gets 404.
- **Nothing in this repository.** No row, column value or table content goes to this repository's Actions log, step summary, artifacts, branches, commits, issues or PRs. The public log carries only the fixed lines F-Tools-2 allows: byte count, exit status, the published path, and a sha256 prefix.
- **History.** Reports accumulate in the private repository's history. Purging is the existing F-Tools-2 route: delete and recreate the repository and its deploy key (`docs/runbooks/diagnostics-workflow.md` §7).

# §5. How sessions may use it: standing access (Evoni's ruling)

1. **At `/wake-up`, every session may read the newest `latest-db-snapshot.md`,** including the content samples, without a per-task authorization. It reads the report through the GitHub tool after attaching `prime-diagnostics` with read access. This is standing access.
2. **`/wake-up` reports** the snapshot's date, its age in days, and its run's sha256 prefix, and checks that prefix against the public log line. If there is no snapshot, or the newest is more than 3 days old, it says so. It does not paste rows into its report.
3. **During the session,** the session may use what the snapshot shows to do its work: for example, real column names, real enum values in use, or what a real episode record looks like.
4. **The session never copies sample rows or values** into this repository: no commit, PR, issue, comment or `docs/audit/` file. They also never go into a test fixture, a log line or another external service. In chat, it quotes only what the work in hand needs. Schema facts and counts (part (a) and part (b)) may be cited anywhere, as the Diagnostics reports already may.
5. **The exception, and only it.** F-Tools-3 §1.1–§1.3 (default-deny; a task authorization; approved methods) still govern every other production read. This document makes one exception: the session may read **this one report** without a task authorization. It is not an approved method for any other read, and it gives the session no credential.

# §6. Exact `CLAUDE.md` amendment (Evoni commits it; a session may not edit the file that sets its own limits)

In **Non-negotiables**, at the end of the **Production access is default-deny** bullet, append:

```markdown
One standing exception (`docs/audit/F-Tools-2_ReadOnlyProdVisibility_Ruling_Amendment1_2026-10-31.md`, Evoni, 2026-10-31): at `/wake-up` a session may read the newest daily database snapshot (`latest-db-snapshot.md` in the private `prime-diagnostics` repository: schema, row counts and allowlisted content samples) without a task authorization. It never dispatches `db-samples`, and never copies sample rows or values into a commit, PR, issue, comment, test fixture, log or `docs/audit/`. In chat it quotes only what the task needs.
```

# §7. Takes effect when

All of these must hold. Until they do, F-Tools-2 and F-Tools-3 apply unamended.

1. This document has merged.
2. **Diagnostics Level 1 is in effect** (F-Tools-2 §6): its setup is done, the `self-test` has passed V1–V8, the result has been reported to Evoni, and she has committed the F-Tools-2 §5 `CLAUDE.md` amendment.
3. The implementation PR has merged (#3659, PR 2). It adds the schedule, the extended checks, `db-samples` with its tests, the guard rule from §2, and the `/wake-up` step. Evoni has then registered the new `PrimeStudios-Diagnostics` document version, which adds `db-samples` to `allowedValues`.
4. Evoni has read the first scheduled `latest-db-snapshot.md` in `prime-diagnostics` herself and confirmed that it holds nothing she does not want sessions to see.
5. Evoni has committed the §6 `CLAUDE.md` amendment.

# §8. What this amendment does not change

- No session holds an AWS key, a database password or any other credential. `prime_readonly`'s password stays on the box in `~/.episode-readonly.env`.
- No session runs `aws`, `ssh`, `scp`, `pm2` or `psql` against production. The guard is unchanged for those.
- No arbitrary SQL. `db-samples` is a fixed statement built from the allowlist and denylist in code.
- No object or media reads. F-Tools-3 M1 and M2 are unchanged.
- No writes of any kind. Level 3 still needs Evoni's approval for each action, and deploys and migrations still go only through the Deploy workflow.
- Rule 7 is unchanged.

---

*Type: ruling amendment (additive). Rules: §2–§7, on Evoni's word of 2026-10-31. Mints: nothing (no FD, XK or PE). Host, AWS, database or Cognito contact by the filing session: none. Production standing: production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`), and production access is default-deny (`F-Tools-3_TaskScopedProductionReads_Ruling_2026-10-29.md`).*
