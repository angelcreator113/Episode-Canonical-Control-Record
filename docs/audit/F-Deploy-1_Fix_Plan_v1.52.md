| **PRIME STUDIOS** **F-DEPLOY-1 FIX-PLANNING DOCUMENT** *2026-09-18 reconciliation session.* |
| --- |

**Document version**

v1.52 — successor to v1.51. Basis: `origin/main` at
`91193483fce433b85ec591a3811d138c7b3228a0`, measured 2026-09-18.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. This revision records Evoni's account of the 2026-09-18
reconciliation session. It closes no keystone, re-enables no workflow, and
mints nothing.

## §Measured repository basis

The basis SHA above is **MEASURED** from `origin/main`.

The following command was run to confirm the newest F-Deploy-1 fix plan:

```text
ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -3
F-Deploy-1_Fix_Plan_v1.49.md
F-Deploy-1_Fix_Plan_v1.50.md
F-Deploy-1_Fix_Plan_v1.51.md
```

v1.51 is the newest existing fix plan. Its §2 authority is cited below for
the record that no migrations were run.

## §Backup — ATTESTED

Evoni attests that the RDS snapshot `canon-pre-reconcile-20260918` was taken
of the canon instance and restored to the scratch instance
`canon-verify-20260918`. Evoni read the restored copy and saw 143 tables and
2,760 `information_schema.columns` rows, matching the 2026-08-29 and
2026-09-17 captures. Evoni then deleted the scratch instance. The snapshot
is retained.

Only the instance names are recorded here.

## §Deploy — ATTESTED

Evoni attests that the deployment actions occurred in this order:

1. Local uncommitted edits on the box were saved to a patch file and
   discarded.
2. The working tree moved from `13002465` to `origin/main` at
   `91193483` by `git pull --ff-only`.
3. `npm ci --omit=dev` ran.
4. Frontend `npm ci` ran and the Vite build completed.
5. The served frontend directory was copied to a dated backup and then
   replaced with the new build.
6. The API process was restarted.

No migrations were run. v1.51 §2 is the authority for running none.

## §Finding 1 — database split-brain — ATTESTED

Evoni attests that the database split-brain described by the hazard document
did not exist at the start of this session: the on-disk `.env` already named
the canon instance, the running process was connected to that same instance,
and the `.env` file's mtime was 2026-07-11.

The hazard document's header says that the on-disk `.env` “points at a
verified-empty one.” Those two statements disagree. This note takes no
position on when or how the state changed. It does not amend the hazard
document, which is immutable; an additive banner is separate work.

## §Finding 2 — credential failure — ATTESTED

Evoni attests that the actual failure was credential-related, not
configuration-related. After the restart, the API reported the database
disconnected with a password authentication failure for the application
role.

The old process had held connections opened before the password last changed,
so the stale value was invisible until a restart. A correct value in `.env`
did not reach the application because PM2 retained the environment from the
original 2026-08-22 start. Restarting with `--update-env` did not replace it.
Restarting from the ecosystem file, which loads `.env`, resolved the issue.

This is recorded as a property of the deployment path, not as a defect
assigned to any file. Nothing is minted.

## §Post-state — ATTESTED

Evoni attests that the application role's password was rotated and `.env` and
the Secrets Manager secret were both updated. Evoni's Cognito user was in
`FORCE_CHANGE_PASSWORD`; a permanent password was set, after which login
succeeded end to end through the site. The login route now performs a real
Cognito exchange, and the 2026-08-22 `AUTH_LOGIN_DISABLED` stub is gone from
the deployed code.

## §What this revision does not do

This revision:

- closes no keystone;
- does not re-enable Deploy to Development or Deploy to Production; v1.50
  stands;
- creates none of the tables scoped by v1.51 and takes no position on which
  routes fail without them;
- does not amend the hazard document or `PROJECT_CONTEXT.md`;
- rules nothing.

The FD, XK, and PE tails remain unminted.

## §Standing

This is a reconciliation record of Evoni-attested actions. No operational
fact in this document was performed, witnessed, or verified by an agent
session. The measured repository basis is labelled separately above.
