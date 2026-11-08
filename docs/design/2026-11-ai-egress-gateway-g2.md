# AI egress gateway: G2, the Postgres ledger

**Status:** draft PR, 2026-11-08. Not merged, not deployed, not wired. The migration has run only on disposable local and CI test databases. The role script (`scripts/aigw/sql/aigw-roles.sql`) has not been run anywhere in production. Baseline: `docs/design/2026-11-ai-egress-gateway-m0.md` (M0, frozen).

## What G2 adds

- Migration `20261108120000-create-aigw-ledger`: six new tables, SECURITY DEFINER functions with a pinned `search_path`, and guard triggers. No existing table changes. The migration grants EXECUTE to nobody.
- `src/aiGateway/pgLedger.js`: the ledger interface of the G1 reference (`memoryLedger.js`), over injected query ports, one port per database role. It loads no driver and opens no connection.
- `src/aiGateway/aigwDbGrants.js`: the runtime roles and their exact grants. It is the source for the role script and the tests. Ownership stays with the migration login (see Ownership below).
- `memoryLedger.js` stays the non-production reference. It now applies the same stricter rules as the database (see Retry and uncertainty below), and both ledgers pass one shared contract (`tests/unit/aiGateway/ledgerConformance.js`).

## Decisions applied

| Decision | Where it is enforced |
|---|---|
| Seed STOPPED, no caps | Migration seed row: `global_state = 'STOPPED'`, version 1, both caps NULL |
| Missing caps refuse | `aigw_authorize` → `CAP_UNAVAILABLE` (the image cap is also required for image work) |
| Strict unpriced work refused | `aigw_authorize` refuses all strict work with `PRICE_NOT_VERIFIED`, because no verified price catalogue exists yet |
| Strict multipart refused | `aigw_authorize` → `MULTIPART_FIELDS_UNVERIFIED`; the table also has a constraint forbidding strict with `hash_bound_only` |
| Exposure computed, not counted | Under the day lock, `aigw_exposure_internal` sums reserved + confirmed + uncertain from the permits themselves |
| Append-only history | Permit events, reconciliations and audit refuse UPDATE, DELETE and TRUNCATE. Permits refuse DELETE and TRUNCATE, and their bound fields are immutable |

**Recorded limitation (multipart):** a multipart permit is bound by body hash and length only. Its billing fields are not parsed, so `billing_fields_verification = 'hash_bound_only'`. Strict multipart work stays refused until bounded billing-field verification exists.

## Lock order

Every function takes a subset of these locks, always in this order:

1. **L1, the control row.**
   - Read with `FOR SHARE` by `aigw_authorize` and `aigw_dispatch`.
   - Changed with `FOR UPDATE` or `UPDATE` by Stop, Resume, pause, caps and ack.
   - It is never taken with `FOR KEY SHARE`, which would let a pause pass an authorization that is in progress. Mutation M1 checks this.
2. **L2, the logical-key advisory lock** (`aigw:lk:<key>`). The attempt and prior-attempt checks happen under it.
3. **L3, the day advisory lock** (`aigw:day:<day>`). The cap decision happens under it. Outcomes and reconciliations take it before the permit row.
4. **L4, permit rows** with `FOR UPDATE`. Where several are taken (the sweep), they are taken in id order with `SKIP LOCKED`.

Each call is one statement and one short transaction, with `lock_timeout` 2 s (10 s for admin functions). No transaction is held across a provider call (ruling R1).

## Retry and uncertainty

- A new attempt is allowed only when every earlier attempt of the same logical key is `not_sent` or `failed_confirmed`. Otherwise it is refused with `PRIOR_ATTEMPT_UNKNOWN`, `PRIOR_ATTEMPT_NOT_RETRYABLE` or `ATTEMPT_EXISTS`.
- `dispatching → not_sent` requires proof. Only the gateway instance that dispatched the request can give it, either with `aigw_mark_not_forwarded` or with a pre-send outcome. Otherwise the guard trigger refuses the change.
- The sweep turns expired, never-dispatched permits into `not_sent`. It turns stale `dispatching` rows into `unknown`, never into `not_sent`.
- `unknown` is left only by `aigw_reconcile`. That requires evidence, a reason and the admin role. The gateway's outcome call refuses with `UNKNOWN_REQUIRES_RECONCILIATION`.
- If the database authorizes a request but its result is lost (the connection drops, or there is a timeout), `pgLedger` throws. The caller must treat the request as uncertain. The row stays `dispatching` until the sweep makes it `unknown`. The ledger never assumes that an authorized request was sent, or that it was not.

## Ownership (Option A, Evoni, 2026-11-08)

- **Who runs migrations.** Production migrations run as the Deploy workflow's migration login (`~/.episode-migrate.env`), which is `postgres` according to `docs/reads/2026-11-04-deploy-migration-trusted-path.md`. The application connects as `episode_app_dev` and runs no migration. An earlier draft of this note assumed the application login runs migrations; that was wrong.
- **Who owns the gateway objects.** Every aigw table, sequence and function stays owned by that migration login. Nothing moves ownership, and no role is made a member of another.
- **Why.** The deploy's migration trust check (`scripts/deploy/migration-trust-check.js`, unchanged) refuses to run any migration while an object in `public` is owned by a role the migration login is not a member of. The first draft of the role script moved ownership to a NOLOGIN `aigw_owner` role; that would have stopped every later deploy's migrations. That design is withdrawn. A test keeps it as a control and shows the trust check refusing it.
- **Separation.** Migration ownership and runtime permissions are separate. The owner is the migration login. Runtime access is only what the role script grants: EXECUTE on specific functions, and SELECT for the inspector.

## Permission model

All roles are NOLOGIN group roles. The role script `scripts/aigw/sql/aigw-roles.sql` creates them and grants their privileges, and it has not been run. It is meant to run once, by hand, as the migration login: that login has CREATEROLE, owns the database (so it can grant USAGE on schema `public`) and owns the aigw objects (so it can grant on them). Grants are listed in `aigwDbGrants.js`.

| Role | May |
|---|---|
| `aigw_caller` | authorize, abandon an unused permit, read the Stop state |
| `aigw_gateway` | get permit, dispatch, mark not forwarded, record outcome, sweep, find by task, ack, read control, exposure |
| `aigw_admin` | Stop, request, confirm and cancel Resume, pause, caps, reconcile, read control, exposure |
| `aigw_inspector` | SELECT on the six tables, read control, exposure |

- The existing application login gets **no** administrative function. At most it could later join `aigw_caller`; that is a G3 decision. Tested both ways: with no grant, and as a member of `aigw_caller`, it gets 42501 on every admin function.
- The gateway and caller roles cannot change caps, Resume, Stop or pause, and cannot write any table. The gateway cannot mint a permit, and a dispatch without a permit is refused.
- PUBLIC has no EXECUTE on any aigw function and no privilege on any aigw table or sequence. The migration revokes the defaults and sweeps away default-privilege grants.
- No role writes a table directly. Writes happen only through the SECURITY DEFINER functions, which run as the owning migration login. The history records `actor via <database login>`.

## Remaining G3 dependencies

1. **Approval to run the role script in production.** This is gated. It runs as the migration login, which owns the objects, so no ownership step is needed. Before the run, confirm in production that the aigw objects are owned by the migration login (`SELECT relowner::regrole FROM pg_class WHERE relname = 'aigw_control'`).
2. **Which logins join which role.** That covers the gateway process login, the admin console path (including the Cognito recent sign-in check before `aigw_confirm_resume`), and whether the application or the worker joins `aigw_caller`.
3. **Wiring.** The gateway process uses `createPgLedger`, reads `aigw_read_control` into `stopState` (`dbStateFromControl`) and acks through `aigw_gateway_ack`. Callers authorize through the caller port.
4. **Reconciliation path.** Decide who reconciles and with what evidence. Provider status reads are admin-only in G2.
5. **A verified price catalogue**, before any strict work can be authorized. A schema for verified prices, and a strict-path check against it, are not in G2.
6. **Bounded multipart billing-field verification**, before strict multipart work can be authorized.
7. **Production limits** (permit TTL, sweep timeout, lock timeouts). The G2 values are test and design defaults.
8. **The open items carried from M0**: the worker requeue blocker and the Runway 429 handling.
