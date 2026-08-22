| **PRIME STUDIOS** **FINDING — FD-69** *Mints FD-69. Ships no code. Changes no gate. Selects no remedy.* |
| --- |

# Finding — FD-69: `/api/v1/auth/login` issues valid tokens for arbitrary identities

**Date:** 2026-08-22
**Status:** **DRAFT.** Mints **FD-69**; FD tail advances **FD-68 → FD-69**.
**Priority P0, ruled** — see §0.1. Ships no code. Changes no gate. Authorizes
nothing. Selects no remedy.
**Session:** FD-67 Class A adjudication under v2.66. **This finding was
surfaced by that work, not sought by it.**
**Derived from:** source and `git` against `origin/main` at `4e403a81`.
**Environment contact — stated in full:** **No deployed host was contacted. No
request was issued to any host, local or remote. No AWS call. No database
connection. No Cognito contact.** Derivation is by reading source only. **Prod
remains FROZEN and untouched.**
**Additive on:** F-AUTH-1 Fix Plan v2.66. Supersedes nothing.
**Related, not subsumed:** **FD-68** (configuration failure misclassified at the
HTTP boundary) and **FD-65 / the parked `JWT_SECRET` environment read**. Same
subsystem, different defect (§7).

---

## §0.1 Priority — P0, ruled

**Ruled P0 rather than P1, on two grounds.**

**It is composable, and it makes requests succeed.** FD-68 is P1 because a
missing configuration is reported as a bad token: the failure mode is denial.
**This defect grants.** An unauthenticated caller obtains a validly-signed token
carrying `groups: ['USER']`, which is precisely the shape the ungated
`authenticateJWT` handlers accept (§3).

**It undermines the premise the F-AUTH-1 program reasoned from.** The Step 3
sweep adjudicated the write surface against Tier dispositions on the
understanding that authenticated routes are entered by authenticated callers.
**If `/login` mints arbitrary identities, "protected by authentication" was
never the property being reasoned about.** This does **not** invalidate the
sweep's findings, and this finding does not reopen them — but it changes what
those findings were findings *about*.

## §1 Statement

**`POST /api/v1/auth/login` (`src/routes/auth.js:41`) performs no credential
verification. It validates the shape of its input and then issues a signed
token pair for an identity constructed from the submitted email. The route is
mounted unconditionally in every environment.**

## §2 Mechanism from source

The handler's entire authentication logic is two shape checks:

- `email` must be present and contain `@` — otherwise `400 AUTH_INVALID_EMAIL`;
- `password` must be present with `length >= 6` — otherwise
  `400 AUTH_INVALID_PASSWORD`.

**The password is not compared against anything.** The source says so:

```js
// For development: accept any password (in production, verify against Cognito)
```

It then constructs the principal from the request body and signs it:

```js
const user = {
  id: `user-${email.split('@')[0]}-${Date.now()}`,
  email,
  name: email.split('@')[0],
  groups: ['USER'],
  role: 'USER',
};
const tokens = TokenService.generateTokenPair(user);
```

**The token is valid, not a stub.** `TokenService` signs with `JWT_SECRET` and
refuses to operate without it, requiring presence and a minimum length of 32
characters. **The issued token is therefore indistinguishable from a legitimately
issued one**, because by the system's own definition it is one.

### §2.1 There is no environment guard

**`src/app.js:425` mounts the router unconditionally:**
`app.use('/api/v1/auth', authRoutes)`. No condition, no environment test, no
feature flag.

**`auth.js` refers to `NODE_ENV` four times and none of them gates this route:**

| site | effect |
|---|---|
| `:24`, `:33` | rate limiters **skip** in `development`/`test` — *more* permissive, not less |
| `:77`, `:167` | sets the cookie `secure` flag |

**The comment says "for development." Nothing in the code makes that true.**

## §3 Blast radius, from source

The token is accepted by `authenticateJWT` — Decision D20's separate
verification path. **Nine declarations use it: two in `auth.js`, seven in
`compositions.js`.**

| declaration | gate |
|---|---|
| `auth.js:150` `POST /logout` | `authenticateJWT` only |
| `auth.js:192` `GET /me` | `authenticateJWT` only |
| `compositions.js:480` `PUT /:id` | `authenticateJWT` only |
| `compositions.js:511` `PUT /:id/approve` | + `requireGroup('ADMIN')` |
| `compositions.js:534` `PUT /:id/primary` | `authenticateJWT` only |
| `compositions.js:557` `PUT /:id/publish` | + `requireGroup('ADMIN')` |
| `compositions.js:595` `POST /:id/generate` | + `requireGroup('ADMIN')` |
| `compositions.js:817` `PUT /:id` | `authenticateJWT` only — **unreachable, see §3.1** |
| `compositions.js:886` `DELETE /:id` | `authenticateJWT` only |

**Four ungated declarations; three reachable.** The three admin-gated handlers
would reject a `groups: ['USER']` token, so `requireGroup` holds.

**`DELETE /:id` (`:886`–`:911`) contains no `req.user` reference, no ownership
check and no 403 path.** The full handler body was read, not sampled.

**Established: an unauthenticated caller can mint an arbitrary identity and use
it to update or delete compositions.**

### §3.1 A second dead-route instance, recorded not ruled

**`PUT /:id` is declared twice in the same router — `:480` and `:817`.** Express
matches in declaration order, and PR #1084 established that no `next(` occurs
anywhere in `:458`–`:1030`, so `:480` never falls through. **`:817` is
unreachable.**

This is a **second instance of the pattern PR #1084 filed** for
`GET /search`. It is recorded here because it explains the four-declared /
three-reachable difference above. **It is not ruled here and belongs to whatever
instrument owns the route-order hazard.**

## §4 What is NOT established

**Whether any deployed host serves this code is UNKNOWN and is not assumed in
either direction.**

- **No host was contacted.** No such read was authorized and none was performed.
- Prod is **FROZEN**; `Deploy to Production` is `disabled_manually`.
- `Deploy to Development` is **active**, manual-dispatch-only, and per v2.60 its
  latest verified end-to-end run was against `1844e56b`.

**The finding as stated is: this code is on `main` and is mounted
unconditionally.** Whether it is being served is a **host-gated read**.

**§8 requests that read.** It is the first item in this docket where the
prod/host-gated question carries operational urgency rather than completeness.

## §5 Effect on FD-67 — Class A is blocked

**v2.66 §4.1 grounds Class A on a constitutive argument:** *"An authentication
endpoint cannot require authentication to reach it; unauthenticated access is
constitutive, not a defect."*

**That argument presupposes that the endpoint authenticates.** `/login` does
not. **The premise is false for this member**, so the `// PUBLIC:` rationale
v2.66 anticipated cannot be written for it.

**Class A is held entire — all three members — and none is adjudicated.**
`/refresh` and `/validate` are not themselves disturbed by this finding and may
prove adjudicable, **but adjudicating two of three and reopening the class later
would repeat deliberately the partition error v2.65 §6 corrected.** The class
moves when it moves together.

**FD-67 is not reopened, re-ruled, or otherwise disturbed.** v2.65's branch
ruling and v2.66's Class B disposition stand.

## §6 Recorded, not ruled — the `/validate` oracle

**`POST /api/v1/auth/validate` (`:215`) carries no rate limiter**, while
`/login` and `/refresh` carry `loginLimiter` and `refreshLimiter`. An
unauthenticated, unthrottled token-validation endpoint is an oracle.

**v2.66 §4.1 places rate-limiting outside the auth disposition, and that
boundary holds here even though the finding beside it is severe.** Recorded so
it is not lost; **not ruled, and not folded into this finding.**

## §7 Relation to FD-68 and to the `JWT_SECRET` read

**Same subsystem, different defect, neither subsumes the other.**

FD-68 concerns what happens when Cognito configuration is **absent**: the
structured cause is lost and a server fault is reported as a caller fault.
**FD-69 concerns a path that never consults Cognito at all.** FD-68's remedy —
now landed — does not touch this route.

**The parked `JWT_SECRET` environment read is adjacent and is not a
precondition.** A weak or default secret would compound this finding, but
**FD-69 does not depend on it**: `/login` issues tokens under whatever secret is
configured, and `TokenService` enforces a 32-character minimum. **The bypass
does not require the secret to be guessable.**

## §8 Remedy — not selected, and one read requested

**No remedy is selected. The contract precedes the code**, as with FD-68.

Candidate dispositions, stated without preference:

1. **Verify credentials** against Cognito, making `/login` what its docstring
   describes.
2. **Gate the route by environment** so it cannot be served outside
   development.
3. **Remove the route** and require callers to obtain tokens through the
   Cognito path directly.

These differ materially in blast radius — (3) breaks any client currently
depending on the endpoint, and **whether such clients exist is not established
here.**

**One read is requested of the ruling party:** whether any deployed host
currently serves `/api/v1/auth/login`, beginning with the active development
host. **This finding does not perform it and does not authorize it.**

## §9 What FD-69 does not do

- **Mints FD-69 and nothing else.** XK tail remains **XK-3**; PE tail remains
  **PE #67**.
- **Ships no code, selects no remedy, authorizes no change.**
- Does not contact, test, or probe any host.
- Does not reopen the F-AUTH-1 Step 3 sweep or any Tier disposition (§0.1).
- Does not reopen FD-67, and does not disturb v2.65 or v2.66's rulings.
- Does not rule the `/validate` oracle (§6) or the `:817` dead route (§3.1).
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.

---

*Type: finding. Mints FD-69 at P0. Ships no code. Selects no remedy. No host,
AWS, database, or Cognito contact. Prod FROZEN.*
