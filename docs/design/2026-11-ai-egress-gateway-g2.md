# AI egress gateway: G2, the Postgres ledger

**Status:** draft PR, 2026-11-08. Not merged, not deployed, not wired. The migration has run only on disposable local and CI test databases. The role script (`scripts/aigw/sql/aigw-roles.sql`) has not been run anywhere in production. Baseline: `docs/design/2026-11-ai-egress-gateway-m0.md` (M0, frozen).

## What G2 adds

- Migration `20261108120000-create-aigw-ledger`: six new tables, SECURITY DEFINER functions with a pinned `search_path`, and guard triggers. No existing table changes. The migration grants EXECUTE to nobody.
- `src/aiGateway/pgLedger.js`: the ledger interface of the G1 reference (`memoryLedger.js`), over injected query ports, one port per database role. It loads no driver and opens no connection.
- `src/aiGateway/aigwDbGrants.js`: the roles and their exact grants. It is the source for the role script and the tests.
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

## Permission model

All roles are NOLOGIN group roles. The role script creates them, and it has not been run. Grants are listed in `aigwDbGrants.js`.

| Role | May |
|---|---|
| `aigw_owner` | Owns every aigw table and function. No login, and nobody is a member of it |
| `aigw_caller` | authorize, abandon an unused permit, read the Stop state |
| `aigw_gateway` | get permit, dispatch, mark not forwarded, record outcome, sweep, find by task, ack, read control, exposure |
| `aigw_admin` | Stop, request, confirm and cancel Resume, pause, caps, reconcile, read control, exposure |
| `aigw_inspector` | SELECT on the six tables, read control, exposure |

- The existing application login gets **no** administrative function. At most it could later join `aigw_caller`; that is a G3 decision.
- No role writes a table directly. Writes happen only through the owner's SECURITY DEFINER functions, and the history records `actor via <database login>`.

## Remaining G3 dependencies

1. **Approval to run the role script in production.** This is gated, and the ownership step needs whoever owns the aigw objects on RDS (the master user is not a superuser).
2. **Which logins join which role.** That covers the gateway process login, the admin console path (including the Cognito recent sign-in check before `aigw_confirm_resume`), and whether the application or the worker joins `aigw_caller`.
3. **Wiring.** The gateway process uses `createPgLedger`, reads `aigw_read_control` into `stopState` (`dbStateFromControl`) and acks through `aigw_gateway_ack`. Callers authorize through the caller port.
4. **Reconciliation path.** Decide who reconciles and with what evidence. Provider status reads are admin-only in G2.
5. **A verified price catalogue**, before any strict work can be authorized. A schema for verified prices, and a strict-path check against it, are not in G2.
6. **Bounded multipart billing-field verification**, before strict multipart work can be authorized.
7. **Production limits** (permit TTL, sweep timeout, lock timeouts). The G2 values are test and design defaults.
8. **The open items carried from M0**: the worker requeue blocker and the Runway 429 handling.
