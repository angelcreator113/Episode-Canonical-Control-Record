| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *FD-68 contract ruling, half 2 only.* |
| --- |

**Document version**

v2.63 — **RULES AND AUTHORIZES FD-68 HALF 2: EXACT PLACEHOLDER REJECTION AND
COUPLED TEMPLATE CORRECTION.** In non-test operation, the two exact literals
the repository itself identifies and ships as Cognito placeholders are invalid
configuration:

- `COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX`; and
- `COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx`.

The config guard must reject them with the `AUTH_CONFIG_MISSING` contract ruled
at v2.62. `.env.example` must stop presenting those rejected literals as usable
values in the same implementation. Broad pattern-based rejection is not
authorized. Test sentinels remain valid.

**Does not authorize v2.62 Half 1 implementation by implication; Half 1 already
has its own authorization.** The two code changes may land in separate PRs.
Half 2 may also be implemented alone only if its error path preserves the
current internal `AUTH_CONFIG_MISSING` cause until v2.62 lands. FD-68 remains
OPEN/P1 until both authorized halves are implemented, tested, and closed.

FD tail remains FD-68; XK tail XK-3; PE tail PE #67. Basis `origin/main` at
`abf659c48e9fc22f6c0937508226f79617aedc6e`. No host, AWS, database, or
Cognito contact. Prod FROZEN.

---

# §1. Question ruled

FD-68 §3.4 leaves two choices:

1. reject known placeholder forms; or
2. rule that only absence is invalid and retire v1.5's placeholder requirement.

The repository supplies the discriminator itself. `src/middleware/auth.js`
documents the pre-fix fallback as:

```js
process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX'
```

`.env.example` ships that exact pool literal and the adjacent all-`x` client
literal. The current truthiness guard accepts both.

**Ruling:** known placeholders are invalid configuration. The placeholder
requirement is retained, narrowed to exact repository-known literals, and made
implementable without guessing at broad patterns.

# §2. Exact policy

## §2.1 Rejected values

Outside `NODE_ENV === 'test'`, reject exact equality after trimming surrounding
whitespace:

| Variable | Rejected exact value |
|---|---|
| `COGNITO_USER_POOL_ID` | `us-east-1_XXXXXXXXX` |
| `COGNITO_CLIENT_ID` | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |

Absence/empty strings remain invalid under the existing guard.

**Not authorized:**

- wildcard rejection of every `us-east-1_*` value;
- rejecting values merely because they contain `X`, `x`, `test`, `dummy`, or
  nonproduction words;
- validating the full Cognito identifier grammar;
- network existence checks;
- rejecting `COGNITO_CLIENT_SECRET` under FD-68 (the current verifier contract
  does not consume it); or
- applying production placeholder policy to the test environment.

## §2.2 Test environment

Existing tests use values such as `us-east-1_test123` and `test-client-id`.
Those are not the exact rejected literals and remain valid. `NODE_ENV ===
'test'` is explicitly exempt from this placeholder policy so focused auth tests
can control the Cognito path without real infrastructure.

The exemption does not make missing values valid in tests where a test
intentionally exercises `AUTH_CONFIG_MISSING`; current lazy-init tests remain.

# §3. Coupled `.env.example` correction

A rule that rejects the repository's own template must not ship while the
template still advertises the rejected values as configuration.

The Half 2 implementation must change `.env.example` in the same PR:

```dotenv
# Required for Cognito auth outside tests. Supply real values; blank values are invalid.
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
COGNITO_REGION=us-east-1
```

Blank template values are deliberate: copying the template does not silently
create plausible-but-invalid configuration. The first Cognito-routed request
then follows the explicit missing-config contract until real values are
supplied.

`COGNITO_CLIENT_SECRET` is blanked for template consistency but is not added to
`getCognitoConfig()` or FD-68 validation scope.

# §4. Implementation boundary

**Authorized:**

- exact literal constants or a minimal exact-value helper in auth config code;
- trim-before-compare behavior;
- non-test rejection through the existing `AUTH_CONFIG_MISSING` cause;
- the coupled `.env.example` blank/comment change; and
- focused tests proving exact rejected values, nearby valid values, test
  sentinels, absence, and whitespace handling.

**Not authorized:**

- broad format/schema validation;
- Cognito API calls or pool/client existence checks;
- changes to region policy;
- client-secret runtime validation;
- changes to startup timing;
- HTTP/frontend behavior beyond v2.62's separate authorization;
- health endpoint changes; or
- deployed environment edits.

# §5. Verification contract

Minimum tests:

1. non-test exact pool placeholder → `AUTH_CONFIG_MISSING` cause;
2. non-test exact client placeholder → `AUTH_CONFIG_MISSING` cause;
3. surrounding whitespace on either exact placeholder → rejected;
4. real-shaped value not equal to the literals → accepted by config guard;
5. existing test sentinels → accepted;
6. missing value behavior remains covered;
7. `.env.example` contains neither rejected literal; and
8. no network call is needed to prove any case.

Tests should call the narrow config/verifier boundary rather than boot the full
app where practical. The FD-68 contract is lazy by CP1 ruling.

# §6. Gate effect

This ruling makes FD-68 Half 2 implementable locally and independently scoped.
It does not close FD-68, re-score Dimension 3, complete limb 3, or make G4
enterable. FD-67 remains open.

No implementation is shipped here. Changes no gate. Prod FROZEN.

---

*Type: FD-68 contract ruling and bounded authorization, Half 2 only. Retains
placeholder invalidity for two exact repository-known literals, exempts test
operation, and couples code with `.env.example` correction. Authorizes no broad
pattern validation or infrastructure check. Ships no code. FD-68 OPEN/P1; FD
tail FD-68; XK-3; PE #67. No host/AWS/database/Cognito contact. Prod FROZEN.
[skip-automerge]*
