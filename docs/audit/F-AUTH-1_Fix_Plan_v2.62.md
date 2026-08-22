| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *FD-68 contract ruling, half 1 only.* |
| --- |

**Document version**

v2.62 — **RULES AND AUTHORIZES FD-68 HALF 1: HTTP CLASSIFICATION AND
OPERATOR VISIBILITY.** Missing Cognito configuration is a server configuration
fault, never a caller-token fault. Every auth middleware path must classify the
structured `AUTH_CONFIG_MISSING` cause before transient Cognito/JWKS errors and
before token rejection, return HTTP **500** with stable response code
`AUTH_CONFIG_MISSING`, and emit a structured error-level operator log naming
the missing variables and request path.

**Does not rule or authorize FD-68 Half 2.** Explicit-placeholder policy and
`.env.example` remain for v2.63. Does not implement code. FD-68 remains OPEN/P1
until authorized halves are implemented, tested, and closed. FD tail remains
FD-68; XK tail XK-3; PE tail PE #67. Basis `origin/main` at
`3f2e20e1de591502aa63c72e9fb71ea9095497a1`. No host, AWS, database, or Cognito
contact. Prod FROZEN.

---

# §1. Question ruled

FD-68 §3.4 requires a contract decision before code:

> classify `AUTH_CONFIG_MISSING` ahead of token rejection and return an
> operator-visible contract, or state why caller-attributed 401 is correct.

The local discriminator at v2.61 established:

- internal cause: `AUTH_CONFIG_MISSING` with message naming absent Cognito
  configuration;
- client response: `401 AUTH_INVALID_TOKEN`; and
- no Cognito/network or handler/database execution before the response.

**Ruling:** caller-attributed 401 is incorrect. The caller supplied a
structurally valid Cognito-routed token; the server could not attempt
verification because required server configuration was absent. The fault
belongs to the server/operator boundary.

# §2. HTTP contract

## §2.1 Status and stable code

Every HTTP auth middleware path that encounters `AUTH_CONFIG_MISSING` must
return:

```json
{
  "error": "Authentication configuration error",
  "message": "Authentication is not configured on this server.",
  "code": "AUTH_CONFIG_MISSING"
}
```

with **HTTP 500**.

- `500` identifies a server configuration fault.
- `AUTH_CONFIG_MISSING` preserves the structured code already authorized at
  CP1 instead of inventing a second internal name.
- The response is generic and discloses no pool ID, client ID, secret, or value.
- It must not be rewritten to `AUTH_INVALID_TOKEN`, `AUTH_REQUIRED`, or
  `AUTH_SERVICE_UNAVAILABLE`.

## §2.2 Why not `AUTH_SERVICE_UNAVAILABLE`

`AUTH_SERVICE_UNAVAILABLE` is already the F-Auth-3 contract for transient
Cognito/JWKS/network failure: the service is configured and an upstream
operation failed. Missing configuration is deterministic local state and will
not heal through retry. Sharing one code would collapse operator action:
retry/wait for transient outage versus repair deployment configuration.

## §2.3 Classification order

The shared classifier order is locked:

1. `AUTH_CONFIG_MISSING` — local deterministic server configuration fault;
2. recognized Cognito/JWKS/network causes — transient upstream infrastructure
   fault, existing `503 AUTH_SERVICE_UNAVAILABLE` contract;
3. verifier rejection — caller token fault, existing `401 AUTH_INVALID_TOKEN`
   contract.

The implementation may use a dedicated helper or equivalent exact cause-chain
check. It must inspect `Error.cause`, because `verifyToken` wraps the original
cause.

# §3. Middleware scope

The authorization covers every current path that consumes `verifyToken` and
selects an HTTP response:

- global/route `optionalAuth`, including `degradeOnInfraFailure: true`;
- `requireAuth`; and
- the legacy `authenticateToken` path while Step 6b remains open.

**Configuration failure never degrades to anonymous.** The
`degradeOnInfraFailure` option applies only to transient upstream availability;
it cannot make local missing configuration safe.

Step 6b remains separable. This authorization does not delete or consolidate
middleware; it prevents the same server fault from taking different meanings
while duplicate paths remain.

# §4. Operator-visible surface

Correcting only the response code does not close the diagnosis gap. The
required operator surface is a **structured error-level server log** emitted at
the HTTP classification boundary.

Required fields:

- event name: `auth_configuration_missing`;
- missing variable names (names only, never values);
- request path and method;
- middleware mode/path (`optionalAuth`, `requireAuth`, or
  `authenticateToken`); and
- HTTP code/status selected.

The log must not include bearer tokens, authorization headers, decoded payloads,
pool/client values, or secrets. It must be emitted at `console.error` or the
project's equivalent alertable error level, not `console.log`.

**Health/readiness integration is not authorized here.** An alertable request-
path error plus a deterministic 500 contract is the bounded Half 1 deliverable.
Adding a startup/health check changes operational readiness semantics and needs
its own scope if later required.

# §5. Verification contract

The implementation must add focused tests for all three middleware modes.
Minimum assertions:

1. construct/load the app or middleware with valid startup state;
2. remove required Cognito config after module load so CP1 lazy initialization
   is exercised;
3. send a structurally valid RS256-shaped token;
4. assert `500 AUTH_CONFIG_MISSING`;
5. assert the structured error log, including missing variable names and no
   values/token;
6. assert no `next()`/handler invocation;
7. assert `degradeOnInfraFailure: true` does not degrade configuration failure;
8. retain existing `503 AUTH_SERVICE_UNAVAILABLE` tests for transient errors;
9. retain existing `401 AUTH_INVALID_TOKEN` tests for genuine verifier
   rejection.

The v2.61 probe is a discriminator, not a committed regression test. The code PR
must convert it into stable automated coverage without loading the full app if
a narrower middleware harness can prove the same boundary.

# §6. Authorization boundary

**Authorized:**

- exact classification of `AUTH_CONFIG_MISSING` in the auth middleware;
- HTTP 500 / `AUTH_CONFIG_MISSING` response contract;
- structured error-level operator log;
- focused tests and any minimal helper needed to avoid duplicated logic.

**Not authorized:**

- placeholder validation or `.env.example` edits (v2.63);
- startup boot-fail restoration;
- health endpoint/readiness changes;
- Step 6b deletion or middleware consolidation;
- changes to Cognito/JWKS transient classification;
- frontend behavior changes;
- deployed-host, AWS, Cognito, or database actions.

# §7. Gate effect

This ruling makes FD-68 Half 1 implementable locally. It does not close FD-68,
change Dimension 3, complete limb 3, or make G4 enterable. FD-67 remains open.

No implementation is shipped here. Changes no gate. Prod FROZEN.

---

*Type: FD-68 contract ruling and bounded authorization, Half 1 only. Rules
missing Cognito config as HTTP 500 AUTH_CONFIG_MISSING with structured
error-level operator visibility across all auth middleware paths. Selects no
placeholder policy. Ships no code. FD-68 OPEN/P1; FD tail FD-68; XK-3; PE #67.
No host/AWS/database/Cognito contact. Prod FROZEN. [skip-automerge]*
