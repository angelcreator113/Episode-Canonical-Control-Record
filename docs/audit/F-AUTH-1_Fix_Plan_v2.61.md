| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *G4 procedure dispositions. Mints FD-67 and FD-68.* |
| --- |

**Document version**

v2.61 — **DISPOSITIONS THE TWO PROCEDURE FINDINGS SURFACED BY v2.59
DIMENSION 3. MINTS FD-67 (P2) AND FD-68 (P1).** Rules that v1.5 §7 is
unexecutable as a G4 procedure at §7.7 because it requires removal of a global
`optionalAuth` mount retained by later architecture. Rules that CP1 deliberately
superseded F-Auth-2 boot-fail with lazy runtime configuration checking; the code
timing stands, but §7.1 was never updated and current request handling
misclassifies missing config as `401 AUTH_INVALID_TOKEN` while explicit
placeholder values are not rejected.

**Corrects v2.59 forward:** §7.6's behavior checks do not require Step 6b
cleanup. Step 6b remains open and separable, but it is not established as a G4
procedure blocker. Dimension 3 remains **NOT PERFORMED** for the live half and
cannot pass until FD-67/FD-68 receive remedies and the procedure is restated.

FD tail advances **FD-66 → FD-68**. XK tail remains **XK-3**; PE tail remains
**PE #67**. Basis: `origin/main` at
`e1086702972dcedabcf7a6ac471fcead330c4bd4`, 2026-08-22. Derived from source,
history, tests, and one local no-network request probe. No deployed host
contacted. No AWS call issued. Prod FROZEN.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP — **REOPENED-QUALIFIED**, unchanged. **G3 — PARTIALLY
DISCHARGED, OPEN**; limbs 1 and 3 open. Limb 3 assessment remains NOT COMPLETED.
Dimension 2 PASS; Dimension 3 NOT PERFORMED; Dimension 4 FAIL; Dimension 5 NOT
PERFORMED. **G4 — not enterable.** FD-67 OPEN/P2; FD-68 OPEN/P1. FD-63,
FD-64, FD-65, FD-66 remain open. G5 BLOCKED. G6 not reached. Prod FROZEN.*

---

# §1. What v2.59 found, and what this revision corrects

v2.59 Dimension 3 recorded three repository findings:

1. F-Auth-2 boot behavior contradicts v1.5 §7.1;
2. v1.5 §7.7 requires removal of the global `optionalAuth` mount, which remains
   at `src/app.js:236`; and
3. Step 6b remains open while §7.6 requires Step 6 behavior.

The first two are real procedure defects, but their mechanisms differ. **The
third does not hold after reading the individual assertions and v2.52's Step 6
ruling.** This revision dispositions all three rather than inheriting v2.59's
grouping.

## §1.1 Why this is a procedure revision, not a readiness reassessment

Dimension 3 asks whether every G4 operation can be performed and observed. A
procedure whose expected result contradicts authorized current architecture
cannot be made executable by deploying a healthier candidate. The procedure
must first be corrected or the architecture changed under its own authority.

This revision performs neither live G4 operations nor the five-dimension
assessment. It identifies which text is stale, which code contract governs,
and what remains undecided.

---

# §2. F-Auth-2 authority chain — boot-fail was deliberately superseded

## §2.1 v1.5's original contract

v1.5 §4.1 and §7.1 require:

- a top-of-module check;
- missing `COGNITO_USER_POOL_ID` or `COGNITO_CLIENT_ID` throws at require time;
- explicit placeholder strings throw at require time; and
- valid values permit normal boot.

The purpose was diagnostic: a config defect should not boot cleanly and make
every authenticated request look like a bad token.

## §2.2 CP1 chose the opposite timing contract

Step 3 CP1 commit `05cd536d` (merged as `fa6ad759`) replaced eager verifier
construction with lazy getters. v2.37 §5.7 records the completed work product:

- module import succeeds without Cognito env vars;
- verifier initialization occurs on first Cognito-routed token;
- missing config throws `AUTH_CONFIG_MISSING` at runtime; and
- the error survives under `Error.cause` through `wrapVerifierError`.

v2.37 §5.9 locks the module-load safety test pattern. Current tests require:

1. `require('../../../src/middleware/auth')` **does not throw** with both env
   vars absent; and
2. `verifyToken()` rejects with `cause.code === 'AUTH_CONFIG_MISSING'`.

**Ruling: CP1 supersedes v1.5's boot-fail timing.** Restoring a module-load
crash would reverse a completed, tested architectural decision and is not the
owed remedy. v1.5 §4.1's top-of-module instruction and §7.1's three boot-fail
checkboxes are stale.

## §2.3 What CP1 did not settle

CP1 settled when configuration is checked and how the internal error is
wrapped. It did not settle:

- whether explicit placeholder-shaped values must be rejected by
  `getCognitoConfig()`;
- whether `AUTH_CONFIG_MISSING` is an infrastructure error, server
  misconfiguration, or token error at the HTTP boundary; or
- which HTTP status/code G4 should assert for missing configuration.

A completion marker for lazy initialization cannot supply those missing
semantics.

---

# §3. FD-68 — F-Auth-2 configuration failure loses its meaning at the HTTP boundary (P1, OPEN)

## §3.1 Statement

**FD-68 (F-AUTH-1): `getCognitoConfig()` produces the structured
`AUTH_CONFIG_MISSING` cause CP1 authorized, but neither `optionalAuth` nor
`requireAuth` classifies that cause as configuration/infrastructure failure.
Both fall through to token-rejection handling. A missing Cognito configuration
therefore returns `401 AUTH_INVALID_TOKEN` at a protected route. Explicit
placeholder-shaped values are accepted by the only config guard because it
checks truthiness only.**

**Severity: P1.** The defect is dormant while real values are present, but a
misconfigured deployment can boot healthy, pass module loading, and turn every
RS256-protected request into an authentication denial attributed to the caller.
That is the failure F-Auth-2 exists to make diagnostically loud. It creates an
availability and diagnosis failure across the authentication surface, not a
single route.

## §3.2 Mechanism from source

`getCognitoConfig()` reads the two env vars and throws only when either is
falsey. It does not compare either value against known placeholders.

`verifyViaCognito()` wraps that error. `findCognitoInfraCause()` recognizes
network error names/codes only; it does not recognize `AUTH_CONFIG_MISSING`.
Consequently:

- global `optionalAuth` logs *token rejected* and degrades to anonymous; and
- route `requireAuth` logs *token rejected* and returns
  `401 AUTH_INVALID_TOKEN`.

The internal structured cause exists and is lost at the boundary where the
operator/client contract is chosen.

## §3.3 Local discriminator

A no-network local request probe was run at this basis:

1. load `src/app` under production mode;
2. delete both Cognito env vars **after** app load, so dotenv cannot restore
   them and lazy initialization is exercised;
3. send a structurally valid RS256-shaped bearer token to the
   `requireAuth`-gated `POST /api/v1/decision-logs`; and
4. read status and response code.

Observed server log:

> `Token verification failed: COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID not configured`

Observed response:

```json
{"status":401,"code":"AUTH_INVALID_TOKEN","message":"The provided token is invalid or expired."}
```

No Cognito request completed: the lazy config guard threw before verifier
construction/network use. No database write occurred; `requireAuth` returned
before the handler.

## §3.4 Disposition required, not selected here

The remedy must choose both semantics explicitly:

1. **Placeholder policy:** reject known placeholder forms, or rule that only
   absence is invalid and retire v1.5's placeholder requirement.
2. **HTTP classification:** map `AUTH_CONFIG_MISSING` to an operator-visible
   server/config failure contract, or state why caller-attributed 401 is
   correct.

A likely implementation is to classify `AUTH_CONFIG_MISSING` before token
rejection and return a distinct 5xx code, but this revision does not authorize
that choice. `AUTH_SERVICE_UNAVAILABLE` describes transient Cognito/JWKS
failure; configuration absence may warrant a different stable code. The
contract decision precedes code.

## §3.5 Effect on G4

v1.5 §7.1 cannot be executed as written and no complete replacement exists.
A successor G4 procedure must at minimum test:

- module-load safety with missing config;
- valid config through a Cognito-routed request;
- missing-config HTTP classification after FD-68's contract is selected; and
- explicit placeholder behavior after its policy is selected.

**FD-68 blocks Dimension 3 PASS until the contract is ruled, implemented, and
the replacement checks are specified.**

---

# §4. FD-67 — v1.5 §7.7 requires removal of a retained global mount (P2, OPEN)

## §4.1 Statement

**FD-67 (F-AUTH-1): v1.5 §7.7 requires that `app.js` no longer apply global
`optionalAuth`, but the mount remains live at `src/app.js:236`. Later F-AUTH-1
work remediated write-route declarations while explicitly retaining the mount
for legitimate consumers and leaving its own disposition open. The G4
procedure therefore requires an architectural state no landed revision
implemented or authorized.**

**Severity: P2.** This finding creates no new exposure beyond FD-63 and the
mount it already owns. It blocks reliable execution of the readiness procedure:
a required checkbox cannot pass against the authorized current architecture.
Its urgency is inherited from limb 3/G4, not from an independent production
incident.

## §4.2 Later architecture governs

v2.43 establishes the global mount as FD-63's mechanism. v2.47 records after
the 95-handler remediation:

> *"the global `app.use(optionalAuth)` at `src/app.js:236` remains. It is now
> the fallback for routes that no longer rely on it ... No change to it is
> proposed here — it has legitimate consumers and its own disposition
> question."*

**The mount's presence is not an accidental incomplete delete.** The sweep
shifted the control boundary to explicit route/router disposition while
retaining optional identity for legitimate reads. No later revision authorizes
removing the global mount.

## §4.3 The rest of §7.7 is not a sufficient substitute

The third §7.7 checkbox says:

> *"No bare optionalAuth on a write route without a `// PUBLIC:` justifying
> comment."*

FD-63 proves that token-based declaration greps miss bare declarations under
the global mount, router presets, multiline declarations, and non-`router`
variables. A check for literal `optionalAuth` cannot replace the stale mount-
removal assertion.

The corrected procedure must inspect the effective middleware of every write
declaration, including inherited/global/router middleware, and tie each to its
Tier disposition. That is also why limb 1's qualitative adjudicator pass cannot
be replaced by a grep.

## §4.4 Disposition required, not selected here

Two architectural choices remain possible:

1. remove the global mount and place optional identity explicitly on every
   legitimate consumer; or
2. retain the mount and define a complete effective-middleware verification
   procedure proving every write is protected independently of it.

Current history points toward option 2 but does not rule it. Choosing either is
a separate authorization and must account for FD-63 and limb 1.

**FD-67 blocks Dimension 3 PASS until §7.7 is superseded by an executable
procedure or the architecture is changed to satisfy it.**

---

# §5. §7.6 and Step 6b — v2.59 blocker withdrawn

## §5.1 What §7.6 actually asserts

§7.6 checks observable behavior:

- BookEditor keepalive save with Authorization;
- `AUTH_REQUIRED` redirects to login;
- `AUTH_INVALID_TOKEN` attempts one refresh, then redirects on failure;
- mid-session expiry refreshes without silent logout;
- decision-log actor persistence; and
- zero `req.user.sub` residue.

None asserts that the duplicate `authenticateToken` function has been deleted.

## §5.2 Later ruling is explicit

v2.52 §1.3 records F-Auth-4 as partial:

- frontend half done — distinct interceptor paths, Gate G3 clause 4 MET;
- backend duplicate deferred as Step 6b; and
- **Step 6b gates nothing currently open and is separable.**

Current `requireAuth` emits the distinct codes §7.6 needs. Current
`frontend/src/services/api.js` carries the refresh-once and redirect branches.
Step 6b is cleanup of a duplicate implementation used by four controllers; its
open status does not make the §7.6 behavior checks impossible.

## §5.3 Governing correction to v2.59

**Withdrawn:** v2.59 §4.1's statement *"Step 6b remains open while §7.6
requires it"*, §7's Step 6b blocker row, and §8 item 2's inclusion of Step 6b
as a procedure-reconciliation prerequisite.

**What stands:** Step 6b remains OPEN and separately owed under v2.52 §6 item
2b. This revision neither closes nor deprioritizes it. It is simply not a
Dimension 3 blocker on the evidence currently recorded.

This correction does not rule that every §7.6 assertion passes. They remain
runtime G4 checks and were not executed here.

---

# §6. Procedure status after these rulings

| Procedure surface | Disposition |
|---|---|
| §7.1 boot-fail timing | **SUPERSEDED** by CP1 lazy-init/module-load safety |
| §7.1 explicit placeholder behavior | **UNRESOLVED**, owned by FD-68 |
| Missing-config HTTP behavior | **DEFECT**, FD-68 OPEN/P1 |
| §7.6 observable behavior checks | **EXECUTABLE IN FORM**, runtime results still owed |
| Step 6b deletion | **OPEN, SEPARABLE, NOT A DIMENSION 3 BLOCKER** |
| §7.7 global-mount removal | **STALE/UNEXECUTABLE**, FD-67 OPEN/P2 |
| Effective write-middleware verification | **UNSPECIFIED**, FD-67 / limb 1 |

Dimension 3 remains NOT PERFORMED because its live half was not attempted. In
addition, **even with host authorization, Dimension 3 cannot pass while FD-67
and FD-68 leave required procedure checks without executable expected results.**

No top-level assessment outcome moves. v2.59 remains ASSESSMENT NOT COMPLETED;
limb 3 remains open; G4 remains not enterable.

---

# §7. What v2.61 establishes

- CP1 deliberately superseded F-Auth-2 boot-fail timing with lazy runtime
  configuration checking (§2).
- Explicit-placeholder and HTTP-boundary semantics were not settled by CP1
  (§2.3).
- FD-68 is minted OPEN/P1 for lost configuration semantics at the HTTP boundary
  and absent placeholder rejection (§3).
- FD-67 is minted OPEN/P2 for the stale/unexecutable global-mount check (§4).
- v2.59's Step 6b procedure blocker is withdrawn; Step 6b remains open and
  separable (§5).
- Dimension 3, limb 3, and G4 do not advance (§6).

# §8. What v2.61 does not do

- **Does not choose or authorize an FD-67 or FD-68 remedy.**
- **Does not restore boot-fail, remove the global mount, delete
  `authenticateToken`, or edit §7's historical body.**
- **Does not perform any G4 runtime assertion, deploy, restart, or soak.**
- **Does not contact a deployed host, shared Cognito, or AWS.** The local probe
  failed before network use and before route-handler/database execution.
- **Does not perform limb 1 or resolve FD-63.**
- **Does not re-score Dimension 3; it remains NOT PERFORMED.**
- **Does not change v2.59's ASSESSMENT NOT COMPLETED outcome, discharge limb 3,
  or enter G4.**
- **Changes no gate. Prod FROZEN.**

---

*Type: Procedure disposition and finding mint. Mints FD-67 P2 and FD-68 P1.
Rules F-Auth-2 boot timing superseded by CP1, leaves placeholder/HTTP contract
open under FD-68, files §7.7 unexecutability under FD-67, and withdraws Step 6b
as a Dimension 3 blocker while leaving it separately open. Ships no code.
Dimension 3 NOT PERFORMED; v2.59 ASSESSMENT NOT COMPLETED; limb 3 OPEN; G4 not
enterable. FD tail FD-68; XK tail XK-3; PE tail PE #67. No host contact, AWS
call, or Cognito request. Prod FROZEN. [skip-automerge]*
