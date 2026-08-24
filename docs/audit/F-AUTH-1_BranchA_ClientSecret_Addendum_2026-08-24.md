# F-AUTH-1 Branch A client-secret addendum - 2026-08-24

| | |
|---|---|
| **Purpose** | Resolve the `COGNITO_CLIENT_SECRET` item in `F-AUTH-1_BranchA_Costing_2026-08-24.md` section 7. |
| **Basis** | `origin/main` at `52a29d07`. All repository reads were local git reads against that commit. |
| **Ruling** | Create the new dev Cognito app client **without a client secret** (`GenerateSecret: false`). |
| **Scope** | Resolves one app-client creation parameter. Does not create a pool or client, inspect AWS, execute G4, close `PE #65`, or authorize any prod-touching operation. |

---

## 1. Established application contract

The application verifies Cognito-issued JWTs. It does not authenticate users
against Cognito or issue Cognito tokens.

Primary-source anchors at the basis commit:

- `src/config/environment.js:35` reads `COGNITO_CLIENT_SECRET` into
  `config.cognito.clientSecret`.
- No executable code consumes `config.cognito.clientSecret`.
- `src/middleware/auth.js:113` and `src/middleware/auth.js:120` construct
  ID-token and access-token verifiers from `userPoolId` and `clientId` only.
- `src/middleware/auth.js:127` states that verification fetches and caches
  Cognito JWKS keys.
- `src/routes/auth.js:41` returns `401 AUTH_LOGIN_DISABLED` before its legacy
  local issuance body can run.
- `src/routes/auth.js:126` refreshes through the application's `TokenService`,
  not a Cognito refresh operation.
- `frontend/src/services/authService.js:16` submits login to the local
  `/api/v1/auth/login` route, and
  `frontend/src/services/authService.js:128` submits refresh to the local
  `/api/v1/auth/refresh` route.

Repository-wide searches found no `SECRET_HASH`, `SecretHash`, `createHmac`,
`InitiateAuth`, or `AdminInitiateAuth` implementation. A separate dependency
and call-site search found no Cognito authentication library path hidden behind
different operation names.

The discriminating reads were:

```text
git grep -n -E "clientSecret|InitiateAuth|jwks|JWKS|CognitoJwtVerifier" origin/main -- src/
git grep -n -E "COGNITO_CLIENT_SECRET|clientSecret|SECRET_HASH|SecretHash|createHmac|InitiateAuth|AdminInitiateAuth|SignUp|ConfirmSignUp" origin/main -- . ":(exclude)src/"
git grep -n -E "CognitoIdentityProvider|amazon-cognito|aws-amplify|Auth\.signIn|signIn\(|/login|/refresh" origin/main -- frontend/ package.json frontend/package.json src/routes src/services
```

An app client with a secret would require a secret-hash-capable authentication
caller for applicable Cognito operations. This repository has no such caller.
The supported Branch A parameter is therefore a no-secret app client.

---

## 2. AWS-side state - NOT PERFORMED

The repository establishes what the application supports. It does not establish
whether the existing shared-pool app client was created with a secret.

`DescribeUserPoolClient` could establish that AWS-side fact, but the read would
target the shared Cognito pool. Under `F-AUTH-1_Fix_Plan_v2.58.md` section 2.5,
an identity operation against that pool is not made dev-only by the caller's
environment label. No freeze authorization was given for that AWS operation.

**AWS app-client inspection: NOT PERFORMED.** No AWS call was issued.

If a later authorized read establishes that the existing client has a secret,
that is a live application/infrastructure mismatch: the repository contains no
authentication path capable of satisfying the corresponding secret-hash
contract.

---

## 3. Configuration disposition

`COGNITO_CLIENT_SECRET` is vestigial at this basis:

- it is present as an empty value in `.env.example:40` and
  `.env.production.template:54`;
- it is read once at `src/config/environment.js:35`;
- it is not consumed by executable code; and
- the deployment manifests do not forward it.

One proposed observation was checked and rejected: at `52a29d07`,
`.github/scripts/deploy-production.sh:12` does **not** include
`COGNITO_CLIENT_SECRET` in `REQUIRED_KEYS`. Its required Cognito values are
`COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`. No stale `REQUIRED_KEYS`
finding is recorded here.

This addendum records disposition only. It does not remove the vestigial
configuration key or amend templates.

---

## 4. Dimension 3 observation - unverified

`F-AUTH-1_Fix_Plan_v2.58.md` section 2.3 requires limb 3 to establish that the
full v1.5 section 7 G4 checklist is available, authorized, and observable. That
checklist requires authenticated requests, interceptor redirect-to-login
behavior, and a working mid-session refresh path.

The application route named by the frontend for login is disabled, and the
repository contains no Cognito issuance path. This creates a testable
availability question: **what authorized mechanism will obtain a valid token
for the named no-secret dev client during G4?** An external hosted-UI flow,
separately provisioned test principal, or other issuance mechanism could answer
the question; none is established by the reads in this addendum.

This is an **unverified dimension 3 observation**, not a finding and not a
readiness ruling. It must be checked against the named G4 candidate and its
authorized token-acquisition procedure during the limb 3 assessment.

---

## 5. Effect on Branch A costing

The section 7 item `COGNITO_CLIENT_SECRET handling` is **RESOLVED** for the new
dev app client: create it without a secret.

All other section 7 items remain in their prior state, including callback and
logout URLs, domain configuration, prerequisite topology work, execution
authorization, and verification procedure. `PE #65` remains open.

This document mints no FD, XK, or PE number and closes no finding.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | Resolves the Branch A app-client secret parameter as `GenerateSecret: false`; records repository evidence, AWS inspection as freeze-gated and NOT PERFORMED, the rejected `REQUIRED_KEYS` assertion, and the unverified dimension 3 token-acquisition question. |

---

*Recorded 2026-08-24. Basis `origin/main` at `52a29d07`. No AWS call issued. No deployed host contacted. No workflow dispatched. Prod FROZEN.*