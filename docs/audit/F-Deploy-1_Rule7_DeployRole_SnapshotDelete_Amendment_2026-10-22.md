| **PRIME STUDIOS** **F-DEPLOY-1 AMENDMENT** *The Rule 7 ruling's deploy role may also delete older `deploy-*` snapshots of the database. An amendment note to `F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md`, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register document. It amends
`F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md` §1 item 5 for one
permission only, and edits nothing in it: an additive banner at the top of
that ruling points here (§4).

Basis: `origin/main` at `d9075eb34cbc5a0f79947d2d07a1d6a323e3e94f` (#3487),
read 2026-10-22.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

**RULED** (§1). Standings used here:
- **RULED**: Evoni's decision, quoted verbatim.
- **MEASURED**: this repository at the basis above; the command and its
  output are pasted.
- **NOT KNOWN to agent sessions**: anything in the AWS account (§3).

The filing session made no host, AWS, database or Cognito contact.

---

## §1. The decision — RULED

The ruling's §1 item 5, verbatim: "The workflow authenticates to AWS with a
short-lived role limited to: creating and describing that snapshot, and
running the deploy and migration commands on the application server."

On 2026-10-22, Deploy runs #145 and #146 stopped at the snapshot step:

> aws: [ERROR]: An error occurred (SnapshotQuotaExceeded) when calling the CreateDBSnapshot operation: cannot create more than 100 manual snapshots

(ATTESTED: the runs' logs, read by the filing session through GitHub.)

Evoni, verbatim, in order:

> yes open the PR for the snapshot cleanup

> merge the snapshot PR

and, asked whether to file "a register amendment for the deploy role's
delete permission, if you want the Rule 7 ruling's wording to match what the
role can now do":

> I agree with them all

Read together: the deploy role may also **delete `deploy-*` snapshots of the
database**, so that each run can remove the older ones it took before it
takes its own. Every other part of item 5, and items 1 to 4, 6 and 7, stand
unchanged. In particular, the role still deletes nothing else in RDS.

## §2. What the repository now says — MEASURED

PR #3482, merged as `c2a8031`:

```
$ git log --oneline -1 c2a80319d0475da5c147be38513cd90243d5561a
c2a8031 Deploy: remove older deploy-* snapshots before each run takes its own, so RDS's 100-snapshot limit no longer stops deploys [skip-automerge] (#3482)
```

The role's policy, as the runbook gives it to Evoni:
- allows `rds:DeleteDBSnapshot` on `snapshot:deploy-*` only (statement
  `DeleteOldDeploySnapshots`);
- moves `rds:Delete*` out of the `NeverThese` deny into its own deny,
  `NeverDeleteAnythingElse`, with `NotResource` `snapshot:deploy-*`.

```
$ grep -n "DeleteOldDeploySnapshots\|NeverDeleteAnythingElse\|\"rds:DeleteDBSnapshot\"" docs/runbooks/deploy-workflow.md
113:      "Sid": "DeleteOldDeploySnapshots",
115:      "Action": "rds:DeleteDBSnapshot",
145:      "Sid": "NeverDeleteAnythingElse",
155:   1. Add the `DeleteOldDeploySnapshots` statement above.
157:   3. Add the `NeverDeleteAnythingElse` statement above. It denies every other RDS delete (the instance, clusters, other snapshots) everywhere except `deploy-*` snapshots.
```

The workflow's step, before the snapshot. It keeps the newest
`DEPLOY_SNAPSHOTS_KEEP` (default 10, at least 3), and only warns, never
stops, when it may not delete:

```
$ grep -n "prune-snapshots.sh\|DEPLOY_SNAPSHOTS_KEEP" .github/workflows/deploy.yml
195:      # DEPLOY_SNAPSHOTS_KEEP (default 10, at least 3) deploy-* snapshots and
200:          KEEP: ${{ vars.DEPLOY_SNAPSHOTS_KEEP }}
201:        run: bash scripts/deploy/prune-snapshots.sh
```

## §3. What is not known — NOT KNOWN to agent sessions

Whether the role in the AWS account has been given the permission is not
known to agent sessions. Changing the role is Evoni's own action (the
ruling, item 6; runbook §2.1, "Adding the delete permission to an existing
role"). Until she makes it, a run warns at "Remove older deploy snapshots",
and old snapshots are removed by hand (runbook §7).

## §4. Filing

- An additive banner, dated 2026-10-22, is prepended to
  `F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md`. It points here and
  carries nothing.
- Instrument, before this filing:

```
$ grep -rl "SnapshotDelete" docs/audit | wc -l
0
```

---

*Type: amendment note to a ruling. Rules: the deploy role may also delete
`deploy-*` snapshots (§1, Evoni's words). Mints nothing: no FD, XK or PE
number. Host / AWS / DB / Cognito contact by the filing session: none.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
