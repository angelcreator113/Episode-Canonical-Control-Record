# Local-only dev login procedure

**Scope, stated first.** This document is local-only. It does not enable
login on any deployed environment, dev or production. `POST /api/v1/auth/login`
still returns `401 AUTH_LOGIN_DISABLED` unconditionally (FD-65, closed
`CLOSED-BY-REMOVAL` at `F-AUTH-1_Fix_Plan_v2.67.md`), on `main` and on any
host running it, and this document does not change that route, any
middleware, or any env-gated mount. The Tier 5 env-gated dev-only token
endpoint remains Evoni's ruling (`issue #1254`) — this document does not
pre-empt or presuppose it, and proposes no route of its own. Nothing here
touches a host, AWS, a database beyond the laptop's own Docker Postgres, or
Cognito.

**Basis:** `origin/main` at `c557781cdcee5f9a6ab9cc3ef7f84b90f4763bb2`.
All reads below are direct `git show` reads at that commit; no code was
changed to produce them.

---

## What was derived, and from where

### 1. Where the frontend reads the token

`frontend/src/services/api.js:16`:

```js
const token = localStorage.getItem('authToken') || localStorage.getItem('token');
```

The primary key is **`authToken`**; `token` is a fallback the interceptor
also accepts. The app's own login/refresh code only ever writes `authToken`
(`frontend/src/services/authService.js:29`, `:139`; `frontend/src/services/api.js:62`)
— `token` exists in the interceptor's read but nothing in the tree writes it.
**Use `authToken`.**

`frontend/src/services/authService.js:29-31` also writes two more keys on a
successful login response:

```js
localStorage.setItem('authToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);
localStorage.setItem('user', JSON.stringify(user));
```

`refreshToken` is only read if a request gets a 401 and the interceptor
attempts a refresh (`frontend/src/services/api.js:56-63`) — not required for
the app to render authenticated on load.

### 2. The route guard

There is one: `frontend/src/contexts/AuthContext.jsx`. It is not
cannot-tell — its gating mechanism is fully local and traced end to end.

- `isAuthenticated` initializes from `!!localStorage.getItem('authToken')`
  (`AuthContext.jsx:24-26`) and is re-derived on mount via
  `authService.isAuthenticated()`.
- `authService.isAuthenticated()` (`authService.js:87-89`) is `!!this.getToken()`
  — a synchronous local read, **no network call**.
- `authService.getProfile()` (`authService.js:78-80`) returns
  `JSON.parse(localStorage.getItem('user'))` — also local only.

**So the three keys that matter are `authToken`, `user`, and (only if a
refresh is ever triggered) `refreshToken`.** No backend call verifies
anything on mount; the gate is satisfied entirely by what's in
`localStorage`.

### 3. The claim shape `requireAuth` accepts on the HS256 branch

`src/middleware/auth.js:2`: `verifyHs256Token` is `TokenService.verifyToken`,
imported directly (`const { verifyToken: verifyHs256Token } = require('../services/tokenService');`).

`src/services/tokenService.js:108-114`, the required-claims check inside
`verifyToken`:

```js
if (!decoded.sub || !decoded.email) {
  throw new Error('Missing required token claims');
}
```

**`sub` and `email` are required; the call throws otherwise.** `groups` is
not enforced by `verifyToken` itself, but `requireAuth`
(`src/middleware/auth.js:563-565`) puts `decoded.groups || []` on
`req.user.groups`, and any route behind `authorize([...])` 403s if that
array doesn't intersect the required list — so for a session that needs to
reach admin-gated routes, `groups` must be set too.

`src/middleware/auth.js:563-572`, what lands on `req.user`:

```js
req.user = {
  id: decoded.sub,
  email: decoded.email,
  name: decoded.name,
  groups: decoded['cognito:groups'] || decoded.groups || [],
  tokenUse: decoded.token_use,
  issuedAt: decoded.iat,
  expiresAt: decoded.exp,
  source,
  raw: decoded,
};
```

`token_use` is Cognito-specific and will be `undefined` for a local HS256
token — harmless, nothing reads it as a gate.

**Also required, from `verifyToken`'s own options** (`tokenService.js:94-97`):
when `NODE_ENV !== 'test'`, `issuer`/`audience` are checked against
`TOKEN_ISSUER`/`TOKEN_AUDIENCE` (default `episode-metadata-api` /
`episode-metadata-app`). `generateToken` (`tokenService.js:47-50`) applies
the same defaults under the same condition, so minting and running the
server with the same environment (both non-test, no custom
`TOKEN_ISSUER`/`TOKEN_AUDIENCE`, or both set identically) is sufficient —
they don't need to be set at all if left at defaults on both sides.

### 4. Minimum local environment

- **`JWT_SECRET`** — `tokenService.js:27-29`: must be present and
  **≥ 32 characters**, or `generateToken` throws.
- **Postgres** — `docker-compose.yml:4-12`: image `postgres:15-alpine`,
  `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`,
  `POSTGRES_DB=episode_metadata`, host port **5432** (`'5432:5432'`).
- **The app's own runtime pool** (`src/config/database.js:29-33`) defaults to
  exactly that: `DB_HOST=127.0.0.1`, `DB_PORT=5432`, `DB_NAME=episode_metadata`,
  `DB_USER=postgres`, `DB_PASSWORD=''` (empty — must be overridden to match
  compose's `postgres`).
- **Discrepancy worth stating plainly, not smoothing over:** the Sequelize
  CLI config used for migrations (`src/config/sequelize.js:89`) defaults
  `DB_NAME` to **`episode_metadata_dev`** — a different name than
  `database.js`'s `episode_metadata` and than compose's `POSTGRES_DB`. Left
  unset, `npm run migrate` targets a database the app itself never reads,
  and one that doesn't exist in the compose stack unless created. **Set
  `DB_NAME=episode_metadata` explicitly** so migrations and the app agree.
- **Backend port** — `npm run dev` runs `src/server.js`
  (`package.json:8`), whose own default is **3000** (`src/server.js:19`,
  `const PORT = process.env.PORT || 3000;`). Vite's dev proxy targets
  `http://127.0.0.1:3002` (`frontend/vite.config.js:33`) — so `PORT=3002`
  must be set when starting the backend, or the proxy has nothing to reach.
- **Frontend port** — `frontend/vite.config.js:26`: `5174`.

---

## Procedure

1. **Start Postgres.**
   ```
   docker compose up -d postgres
   ```
2. **Set backend env** (in the shell that runs the backend, or a local
   `.env` the app's own `dotenv` load picks up):
   ```
   export JWT_SECRET="local-dev-only-placeholder-secret-not-real-32chars"
   export DB_NAME=episode_metadata
   export DB_HOST=127.0.0.1
   export DB_PORT=5432
   export DB_USER=postgres
   export DB_PASSWORD=postgres
   export PORT=3002
   ```
   `JWT_SECRET` above is a placeholder shown for shape only — never a real
   value, and never one that's ever been used against a deployed host.
3. **Run migrations** (same env as above, so it targets `episode_metadata`,
   not the CLI config's `episode_metadata_dev` default):
   ```
   npm run migrate
   ```
4. **Start the backend:**
   ```
   npm run dev
   ```
5. **Start the frontend** (separate shell):
   ```
   cd frontend && npm run dev
   ```
6. **Mint a token directly from `tokenService`, with no HTTP call and no
   route involved** (same shell/env as step 2, so `JWT_SECRET` matches what
   the running backend has):
   ```
   node -e "
   const TokenService = require('./src/services/tokenService');
   const pair = TokenService.generateTokenPair({
     id: 'local-dev-user',
     email: 'dev@localhost',
     name: 'Local Dev',
     groups: ['USER', 'EDITOR'],
     role: 'USER',
   });
   console.log(JSON.stringify(pair, null, 2));
   "
   ```
   This prints `{ accessToken, refreshToken, expiresIn, tokenType }`.
7. **Put the values where the frontend looks** (browser devtools console,
   on `http://localhost:5174`, after loading the app once):
   ```js
   localStorage.setItem('authToken', '<accessToken from step 6>');
   localStorage.setItem('refreshToken', '<refreshToken from step 6>');
   localStorage.setItem('user', JSON.stringify({ id: 'local-dev-user', email: 'dev@localhost', name: 'Local Dev' }));
   ```
8. **Reload the page.** `AuthContext` re-checks on mount, finds `authToken`,
   and renders authenticated — no backend call is involved in that check
   (§2 above).

---

## What this does not do

- Does not add, modify, or enable any route, middleware, or env-gated mount.
- Does not re-enable `POST /api/v1/auth/login`, which returns
  `401 AUTH_LOGIN_DISABLED` unconditionally, unchanged by this document.
- Does not touch `src/` or `frontend/src/`.
- Does not pre-empt or presuppose the Tier 5 dev-only token endpoint ruling.
- Does not serve the dev stack on the LAN or configure phone access —
  separate issue.
- Contains no real secret, hostname, or credential anywhere above.
- Contacts no host, AWS, database beyond the laptop's own container, or
  Cognito.
