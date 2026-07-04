# Finding: Frontend Vitest Suite — ~181 Pre-Existing Failures, Silent CI Runner Gap

**Date:** 2026-07-04  
**Discovered via:** `chore/ghost-page-deletion` baseline comparison (PR #896)  
**Cluster:** F-Deploy-1 / `3002`-port fingerprint  
**Severity:** Pre-existing, non-blocking to ghost deletion; blocking to reliable frontend test enforcement  
**Status:** Documented — fix unverified, separate PR required

---
## ⚠ SUPERSEDE NOTICE — 2026-07-04

**Status (superseded):** fix VERIFIED locally — 99/99 files, 793/793 tests pass. Three faults identified. Real gap = CI never runs frontend Vitest. (Original `**Status:**` header above shows the doc as first filed.)

**The 181 failures were a local-environment artifact, not a main-state fault.** A clean CI checkout of `main` has no `frontend/.env`. With `VITE_API_URL` unset, the `|| '/api/v1'` and `|| ''` fallbacks both resolve correctly — the tests pass without any fix. The suite was never red *on main*; it was red on any developer machine with a local `frontend/.env` setting `VITE_API_URL=http://localhost:3002/api/v1`. CI never ran the suite, so the failures were invisible.

**Three distinct faults were found, not one:**

| Fault | Description | Fix |
|---|---|---|
| A | `VITE_API_URL` absolute URL from local `.env`; `API_BASE` in ~24 page modules builds absolute URLs while tests assert relative paths | Local `frontend/.env.test`, `VITE_API_URL=` empty — gitignored (`.env.*`), not committed |
| B | `${API}` prefix collision: `StoryDashboard`, `WritingRhythm`, `AmberCommandCenter` use `API = VITE_API_URL \|\| ''`; an `.env.test` value of `/api/v1` double-prefixed these. Empty string fixes both A and B | Same `.env.test` (empty value) |
| C | Windows-only `new URL(import.meta.url).pathname` returns `/C:/...`, doubling to `C:\C:\...` (ENOENT, 0 tests collected) in `WorldStudio.test.jsx`. Linux/CI unaffected — regex is a no-op on `/home/...` | **Committed** — `.replace(/^\/([A-Za-z]:)/, '$1')` |

**The real enforcement gap is unchanged and is now the primary finding.** CI still does not run frontend Vitest. Until `cd frontend && npm test -- --run` is wired into the `Validate` workflow, there is no environment of record for this suite and any regression is invisible. The env-var fixes are local workarounds on top of an unrun suite.

**Original finding body preserved below.**

---

## How It Was Found

During the ghost-page deletion PR (#896), a measured baseline comparison between `main` and the branch produced:

| | `main` (`7d2f6949`) | branch (`07a6122a`) |
|---|---|---|
| Test files | 26 failed / 75 passed (101) | 24 failed / 75 passed (99) |
| Tests | 181 failed / 629 passed (810) | 159 failed / 599 passed (758) |

The branch had _fewer_ failures. The −52 tests and −2 failed files were the three deleted ghost test files leaving the suite — which were themselves already red on `main`. The 159 remaining failures post-deletion were confirmed pre-existing by re-running main. That investigation surfaced both the root cause and the silent-runner gap documented here.

---

## The Fault

### Root Cause (verified by source read)

Every failing test follows the same assertion mismatch:

```
Expected: "/api/v1/stories/social/s-1/detect-lala"
Received: "http://localhost:3002/api/v1/stories/social/s-1/detect-lala"
```

The source of the absolute URL is not `apiClient.baseURL`. It is a module-level constant present across the failing page files:

```javascript
// frontend/src/pages/SocialImport.jsx (representative — same pattern across ~24 failing files)
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const detectLalaApi = (id) =>
  apiClient.post(`${API_BASE}/stories/social/${id}/detect-lala`);
```

**Vitest loads `frontend/.env` by default** (Vite's standard env loading, `mode=test`, no `.env.test` exists to override). `frontend/.env` contains:

```
VITE_API_URL=http://localhost:3002/api/v1
VITE_API_BASE_URL=http://localhost:3002
```

In the test environment, `import.meta.env.VITE_API_URL` resolves to `http://localhost:3002/api/v1`. The `|| '/api/v1'` fallback is never reached. All module-scope API helpers construct absolute URLs, while the tests assert bare paths. The mismatch is total and uniform across all ~24 failing files.

### What `apiClient.baseURL` Actually Does (verified — not the cause)

`frontend/src/services/api.js`:
```javascript
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',  // Empty for production (relative URLs)
  ...
});
```

`VITE_API_BASE` is **not set** in `frontend/.env` (only `VITE_API_BASE_URL` is set — a different variable name). So `apiClient.baseURL = ''` in all environments including tests. The `apiClient.baseURL` hypothesis was a reasonable first inference from the test error output; source reads disproved it. The actual fault is in the `VITE_API_URL` constant, not in axios's base URL configuration.

### Variable Name Inventory

| Variable | Set in `.env` | Read by |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3002/api/v1` | `API_BASE` constant in page modules |
| `VITE_API_BASE_URL` | `http://localhost:3002` | (not traced to a reader in this investigation) |
| `VITE_API_BASE` | **not set** | `apiClient.baseURL` fallback → `''` |

The three-variable split with inconsistent naming is itself a finding — no single source of truth for the API base URL.

---

## The `3002` Lineage

`http://localhost:3002` is the dev-backend port. It appears throughout the F-Deploy-1 audit cluster:

- **F-Deploy-G1-H**: `ecosystem.config.js` default-env bug — processes defaulted to port 3002 in production because dev env values were committed as defaults
- **This finding**: `frontend/.env` (the dev env config file) carries `VITE_API_URL=http://localhost:3002/api/v1` and is loaded by Vitest without test-mode override, hardcoding the dev port into the test environment

The same `3002` fingerprint in both findings is not a coincidence. Both trace to the same root pattern: dev-environment configuration values that should be absent or overridden in non-dev contexts (production in G1-H, test runner here) are instead inherited unchanged.

---

## The Silent-Runner Gap

**No CI step runs the frontend Vitest suite.**

The project's `Validate` CI workflow (`validate.yml`) runs three checks on pull requests:

1. **Cost Exposure Audit** — passes/fails on AI API budget patterns
2. **Route Validation** — passes/fails on backend route registration
3. **Tests** — runs `npm test -- --coverage` with `DATABASE_URL` set; this is **backend Jest** (`tests/unit/**`, `tests/integration/**`)

No step in any workflow executes `cd frontend && npm run test`. The frontend Vitest suite has had no CI enforcement at any point. The ~181 failures were invisible not because nobody looked — there was no mechanism to surface them. They accumulated as test files were added (CP5, CP6, CP8, CP9 batch additions visible in test names) without ever being run in a gate where failure would block a merge.

This is the more structurally significant half of the finding. A broken `VITE_API_URL` env config can be fixed in an afternoon; a suite with no runner is invisible indefinitely.

---

## Scope of Failure (post-deletion, `d3b76e4a`)

- **Test files:** 24 failed / 75 passed (99 total)
- **Tests:** 159 failed / 599 passed (758 total)
- **All failures:** Same single fault — `VITE_API_URL` loaded from `.env` into test environment
- **Affected files include** (representative): `SocialImport.test.jsx`, `StoryProposer.test.jsx`, `EpisodeScenesTab.test.jsx`, and ~21 others across `src/pages/` and `src/components/`

---

## Fix Directions (unverified — separate PR, separate investigation)

The following directions are named here to orient the fix session. **None are prescribed.** Each requires reading the relevant files and verifying behavior in dev, test, and production before implementation.

**Direction A — Add `frontend/.env.test` with `VITE_API_URL=` (empty or relative)**  
Vitest would load `.env.test` in preference to `.env` for the `test` mode. Setting `VITE_API_URL=` (empty) would cause `API_BASE` to fall back to `'/api/v1'`, matching test assertions. Minimal blast radius — no code changes, no production impact. Requires verifying that clearing `VITE_API_URL` doesn't break any test that depends on the absolute URL being set.

**Direction B — Add `define` override in `vite.config.js` test block**  
The `vite.config.js` currently has no `test:` section. Adding one with `define: { 'import.meta.env.VITE_API_URL': '"/api/v1"' }` achieves the same effect as Direction A without a new env file. Same blast-radius profile.

**Direction C — Change page modules to use relative paths directly**  
Replace `const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'` with a hardcoded `const API_BASE = '/api/v1'`. In dev, the Vite proxy (`/api → http://127.0.0.1:3002`) handles routing; in production, relative URLs resolve against origin. Would make the suite pass without env config changes. High churn (~24 files), but removes the env-var dependency from individual page modules — arguably the correct long-term shape.

**Direction D — Rewrite test assertions to expect absolute URLs**  
Not recommended. Inverts the correct direction: tests should assert what the production-shape code does (relative paths via proxy), not what the dev-env misconfiguration produces.

**Prerequisite before choosing:** Confirm that Direction A/B doesn't break any test currently passing that relies on `VITE_API_URL` being set. Confirm that Direction C's Vite-proxy assumption holds for the deployed nginx config.

---

## What This Finding Does Not Do

- Does not prescribe the fix
- Does not open a fix PR
- Does not block PR #896 (already merged — the ghost deletion neither caused nor worsened this fault)
- Does not claim the frontend suite is currently green (it is not, on `main`)

---

## Next Steps

1. Open fix PR against `main` — whichever direction is chosen after reading the prerequisite
2. Add frontend Vitest to CI `Validate` workflow (separate, can be same PR or follow-on)
3. Close this finding as resolved once the suite is green on `main` and CI enforces it
