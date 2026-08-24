# F-AUTH-1 Branch A prerequisite scope and sequence - 2026-08-24

| | |
|---|---|
| **Purpose** | Resolve the `prerequisite scope and sequence` item in `F-AUTH-1_BranchA_Costing_2026-08-24.md` section 7. |
| **Basis** | `main` at `c30b5d9c31c09f092b45e4eb3f0acb63da48635e`, confirmed by `git ls-remote origin refs/heads/main`. |
| **Ruling** | The costing was wrong at its own basis: the environment split already existed. The remaining prerequisite is an explicit, fail-loud dev Cognito configuration source consumed by the dedicated dev deployment before PM2 restart. |
| **Scope** | Specification only. No code implementation, AWS call, host contact, workflow dispatch, Cognito operation, or production operation was performed. |

---

## 1. The costing was wrong at its own basis

The costing document was based on `f6a6933f` and concluded that one process
environment served both applications. That conclusion was false when filed.

The controlling deployment changes predate `f6a6933f`:

- `9557df38` rewrote the dev deploy to SSM RunCommand targeting the dedicated
  instance on 2026-07-10;
- `1844e56b` split the root production manifest from the dev-only manifest on
  2026-07-21; and
- `f6a6933f`, the costing basis, was committed on 2026-08-24.

Both earlier commits are ancestors of `f6a6933f`. A direct read of
`.github/workflows/deploy-dev.yml` at `f6a6933f` contains
`INSTANCE_TAG: episode-dev-backend`, `aws ssm send-command`, and deployment of
`ecosystem.dev.config.js`. A direct read of `ecosystem.dev.config.js` at the
same basis begins by identifying itself as the dev-box-only manifest.

The authority available at that basis also stated the topology plainly:
`F-Deploy-1_Fix_Plan_v1.49.md:49` records the tag-targeted SSM path, and
`F-Deploy-1_Fix_Plan_v1.49.md:68` records a dedicated development instance
whose deploy path can no longer write to production. The costing did not reach
that controlling evidence.

Primary-source anchors at `c30b5d9c`:

- `.github/workflows/deploy-dev.yml:13` states that the dev workflow targets by
  instance tag and has no host secret.
- `.github/workflows/deploy-dev.yml:87` sets `INSTANCE_TAG` to the dedicated
  development target.
- `.github/workflows/deploy-dev.yml:413` sends the deployment through SSM to
  the instance selected by that tag.
- `ecosystem.dev.config.js:1` identifies a dev-box-only manifest.
- `ecosystem.dev.config.js:4` states that the dev box cannot materialize a
  production-configured process.
- `ecosystem.config.js:69` defines the production application in the separate
  root manifest.
- `F-Deploy-1_Fix_Plan_v1.49.md:49` records the SSM path targeting the
  `episode-dev-backend` instance tag.
- `F-Deploy-1_Fix_Plan_v1.49.md:68` records that the path targets a dedicated
  development instance and can no longer write to production.

The prerequisite named in the costing as `separating the two environments'
configuration surfaces` is therefore already satisfied by **distinct process
environments on distinct instances with distinct PM2 manifests**.

### 1.1 What remained true, and why it did not support the conclusion

Several observations in the costing were literal reads but were assigned a
topological meaning they could not carry:

- Both manifests use `/home/ubuntu/episode-metadata` as `script` and `cwd`.
  Those are identical path strings on different instances, not one filesystem
  or one process environment.
- Both manifests define a process named `episode-worker`. PM2 process names are
  local to each instance's PM2 daemon. The dev-only manifest describes its
  worker as a per-box instantiation.
- `.github/scripts/deploy-production.sh` calls its production worker `shared`.
  That comment describes the production manifest's logical worker policy; it
  does not prove that the dev and prod deployments operate one physical worker
  process. The dedicated dev workflow separately starts `episode-worker` from
  the dev-only manifest.
- The dev workflow still writes no `.env` and supplies no Cognito variables.
  That correctly establishes an **unsourced dev Cognito environment**, not a
  shared prod/dev environment.

The error was the inference, not the existence of every underlying match.
Sections 1 and 3, section 4's second term, section 5's prod-touching conclusion,
section 6's absent-separation claim, and section 2 row 7 of the costing are
superseded by this addendum. The remaining section 2 observations survive only
at their literal scope.

This does not close the section 7 item by itself. The dev Cognito values still
have no declared source in the deployment path.

---

## 2. The remaining gap

The dedicated dev manifest reads the Cognito pair from its process environment:

- `ecosystem.dev.config.js:31` reads `COGNITO_USER_POOL_ID`;
- `ecosystem.dev.config.js:32` reads `COGNITO_CLIENT_ID`.

Neither `.github/workflows/deploy-dev.yml` nor any executable file under
`scripts/` establishes those variables. The on-box script resolves only the
database environment through `scripts/print-db-env.js`, then invokes PM2 with
`--update-env`.

The dev Cognito pair is consequently ambient: a dispatch can preserve, replace,
or empty it according to pre-existing process or host state rather than a named
deployment input. Physical separation prevents a dev write from changing
production, but it does not make the dev repoint deterministic or provable.

---

## 3. Resolved prerequisite scope

The prerequisite is the following bounded implementation:

1. Create a dedicated dev configuration object at the by-role path
   `episode-metadata/dev/cognito`. It contains exactly the pool ID and client ID
   for the selected dev app client. The client-secret field is absent because
   `F-AUTH-1_BranchA_ClientSecret_Addendum_2026-08-24.md` resolved
   `GenerateSecret: false`.
2. Grant the `episode-dev-backend` instance role `secretsmanager:GetSecretValue`
   on that exact object only. Do not grant a wildcard secret path.
3. Add `scripts/print-cognito-env.js`, parallel to `scripts/print-db-env.js`.
   Its stdout contract is exactly two shell export lines; diagnostics go to
   stderr; any read, parse, missing-key, or empty-value error exits nonzero
   after writing zero bytes to stdout.
4. Add focused tests for complete output, shell quoting, missing/empty keys,
   malformed JSON, and provider failure. Each failure case asserts nonzero exit
   and zero stdout bytes.
5. In `.github/workflows/deploy-dev.yml`, evaluate the loader after DB config is
   resolved and before the PM2 recovery trap is armed. The existing
   `startOrRestart ... --update-env` call then receives the complete pair or is
   never reached.
6. Keep the existing variable names. Do not edit `ecosystem.config.js`,
   `.github/scripts/deploy-production.sh`, or the production `.env` surface.
   Do not add a dev `.env` write.

The dedicated Cognito object is separate from
`episode-metadata/dev/database`. Reusing the database object would couple auth
rollback and IAM scope to database credential rotation, creating a dependency
the current five-key `print-db-env.js` contract deliberately does not have.

---

## 4. Sequence

The sequence is fixed as follows:

| Step | Operation | Gate/result |
|---|---|---|
| P0 | Merge this specification | Documentation only; performs no prerequisite operation. |
| P1 | Finish the section 7 app-client set specification | Names callbacks, logout URLs, domain disposition, and the no-secret client before any resource is created. |
| P2 | Prepare and validate the loader, tests, exact-path IAM policy specification, and dev-workflow integration as one unmerged code PR | The code exists for review, but `main` does not yet depend on an absent object. |
| P3 | Under the separately required execution authorization, create the new dev pool and no-secret app client | Produces the two values; does not inspect or modify the existing shared client. |
| P4 | Create the dedicated dev Cognito object and apply the exact-path instance-role permission | Populate both values atomically. No production configuration changes. |
| P5 | From the dedicated dev instance role, read the object and assert both required keys are present and non-empty with values suppressed | Infrastructure preflight only; no PM2 restart and no repoint. Failure returns to P4. |
| P6 | Complete and approve the rollback and verification procedures | Both must exist before the first repointing dispatch. |
| P7 | Merge the held code PR inside the approved repoint window | The source has already passed P5; no broken dependency interval is admitted on `main`. |
| P8 | Dispatch the dev workflow once | The fail-loud loader supplies both values before PM2 restart; this is the repoint. |
| P9 | Execute the approved verification procedure | Failure invokes the approved rollback; no partial-credit success. |

P2 is deliberately **prepared but not merged** before P3-P6. Landing the
fail-loud workflow dependency while its object is absent would create a window
in which an otherwise valid manual dev deployment must fail. P7 and P8 belong
to the same approved change window; no unrelated dispatch is permitted between
them.

The app-client set, rollback, execution authorization, and verification remain
separate section 7 items. This sequence orders them; it does not resolve them.

---

## 5. What is rejected

- **Distinct variable names:** unnecessary. Instance and manifest separation
  already provide the environment boundary; renaming would expand application
  configuration without adding isolation.
- **A dev `.env` file:** rejected. It recreates ambient host state, has no
  deployment provenance, and conflicts with the dev workflow's no-`.env`-write
  design.
- **The production `.env` file:** rejected. Reading or editing it would restore
  the production-touching mechanism this prerequisite removes.
- **The database secret:** rejected. It couples independent configuration and
  rollback domains and widens the database loader contract.
- **GitHub values passed through the SSM command:** rejected. The current SSM
  boundary deliberately carries only a presigned artifact URL and deployment
  SHA; adding identity configuration there would duplicate a capability-bearing
  transport surface and weaken the instance-role source-of-truth pattern.

---

## 6. Effect on Branch A costing

The section 7 item `prerequisite scope and sequence` is **RESOLVED AS A
SPECIFICATION**:

- the physical/process separation is already shipped;
- the remaining implementation is one exact-path dev configuration object,
  one least-privilege instance-role permission, one fail-loud loader with
  tests, and one dev-workflow integration point; and
- the first repoint is sequenced after the app-client set, authorization,
  rollback, and verification specifications.

### 6.1 Superseding the prod-touching conclusion does not un-gate Branch A

**The gating survives; only its host-topology justification falls.**

`Session_PE_Roster.md` `PE #64` records one shared Cognito pool serving dev and
prod. Under `F-AUTH-1_Fix_Plan_v2.58.md` section 2.5, an identity operation
against that pool **is not made dev-only by the caller's environment label**.
Nothing in this addendum touches that. Host separation changes where a
configuration file lives; it changes nothing about whose identity store Branch A
re-designates.

`F-AUTH-1_BranchA_ClientSecret_Addendum_2026-08-24.md` section 2 already applies
exactly this reasoning to a `DescribeUserPoolClient` read and records it
**NOT PERFORMED** on those grounds. The argument is already in the register at
`main`; this section invokes it rather than re-deriving it.

**Stated because the costing's pointer banner enumerates six supersessions by
section number.** A reader working that list would see the prod-touching
conclusion struck and have no route to the surviving ground — and would be
entitled to read Branch A as un-gated. A correction that leaves a reader wrong
about *whether* Branch A is gated is worse than the error it corrects, which was
wrong only about *why*.

**What the correction does move:** the configuration repoint is plausibly
dev-only, on a dedicated instance with its own manifest, and is cheaper than the
costing stated. **The identity promotion is unchanged and remains irreversible.**

Implementation is **NOT PERFORMED**. The other four section 7 items remain
open. `PE #65` remains open.

This document mints no FD, XK, or PE number and closes no finding.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | Establishes that the costing was wrong at its own `f6a6933f` basis; separates literal path/name matches from the false shared-environment inference; re-derives the prerequisite at `c30b5d9c`; records that dedicated instance and manifest separation already existed; scopes the remaining explicit dev Cognito source; fixes P0-P9 sequencing; rejects production, `.env`, database-secret, variable-rename, and SSM-argument alternatives; records at section 6.1 that superseding the prod-touching conclusion does not un-gate Branch A, the gating surviving on shared-pool grounds under `v2.58` section 2.5 with the already-merged ClientSecret addendum cited as the register's existing application of that reasoning; performs no implementation or AWS operation. |

---

*Recorded 2026-08-24. Basis `main` at `c30b5d9c`. No AWS call issued. No deployed host contacted. No workflow dispatched. Prod FROZEN.*
