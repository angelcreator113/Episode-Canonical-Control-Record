# AI egress gateway — P0a: the Anthropic client factory

Status: P0a-1 (factory, tests, ratchet guard). No call site is migrated. Approved by Evoni, 2026-11-08: the nine-slice plan, with P0a-1 authorized alone.

Related: M0 design (`2026-11-ai-egress-gateway-m0.md`, the Routing bullet in §1 and the G4 row in §13), G2 (`2026-11-ai-egress-gateway-g2.md`).

## What the factory is

`src/services/anthropicClient.js` exports `createAnthropicClient(options)`. It is a **routing seam**: once every call site builds its client there, a later approved change can route all Anthropic traffic through the gateway by changing one file. The M0 design calls for exactly this: one client factory that sets the base URL, with `maxRetries: 0`.

## What it is not

It is **not gateway enforcement**. P0a adds no base URL, no transport, no permit, no retry policy and no model policy. It also does not consult the emergency Stop or the gateway ledger. A client from the factory is the same as `new Anthropic(options)`:

- options pass through unchanged, and no options still means `new Anthropic()`;
- the SDK reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` when the client is built, as today;
- SDK defaults are kept: 2 retries (up to 3 requests per call) and a 10-minute timeout;
- the client shares the `Messages` prototype that `aiCostTracker` (budget gate, usage log) and `aiResponseCache` patch;
- the caller keeps the client's lifetime: the factory returns a new client on every call and caches none.

Loading the module builds nothing, reads no environment variable and starts no timer. It requires only the SDK, so it cannot form a require cycle. It resolves the SDK each time it builds a client, so existing `jest.mock('@anthropic-ai/sdk', …)` mocks keep working for migrated callers.

Until the gateway is deployed and the provider key is removed from the application, nothing stops code from building a client another way. The key removal and rotation phases (M-phases) are the enforcement; P0a only makes them possible without editing 120 files at that time.

## The ratchet guard

`tests/unit/guards/anthropicDirectConstruction.test.js` runs the scanner `scripts/aigw/anthropicInventory.js` over `src/`, `scripts/`, `lambda/`, `frontend/src/` and top-level files.

The scanner parses each file with espree, so comments and strings don't count. It follows the SDK through aliases, destructuring, `.default`/`.Anthropic`, inline `new (require(…))()`, calls without `new`, ESM and dynamic imports, and other `@anthropic-ai/*` packages. As a backstop it also counts any `new X()` whose name starts or ends with `Anthropic`.

The guard fails on any of these:
- a new direct construction or SDK import;
- a raised count;
- a stale (too high) baseline entry;
- a baseline above its frozen ceilings;
- a string naming the provider host outside `src/aiGateway/`;
- a file that cannot be parsed.

Exempt: the factory, `aiCostTracker` and `aiResponseCache`.

Baseline at `46c613d7`: **146 constructions in 120 files; 140 SDK imports in 120 files; 0 host references.**

Limits: `require()` with a computed name, code under `tests/` or `node_modules/`, and a constructor passed as a function argument are not detected.

Regenerate the counts with `node scripts/aigw/anthropicInventory.js --json`. A migration PR lowers the baseline in the same commit.

## Migration slices (each its own PR, behaviour-preserving, `[skip-automerge]`)

| PR | Scope |
|---|---|
| P0a-1 | Factory, tests, ratchet guard (this) |
| P0a-2 | Pilot: admin-only cast suggestion services |
| P0a-3 | Memories hub routes, including the 4 streaming sites |
| P0a-4 | WriteMode services, including fire-and-forget |
| P0a-5 | Character registry, generator, cast |
| P0a-6 | Feed, Pulse, social (schedulers stay off) |
| P0a-7 | World, events, episodes, seasons (with the two `maxRetries: 0` / timeout sites) |
| P0a-8 | Scenes, images, wardrobe (with the worker-reachable files) |
| P0a-9 | Dead-code decision; the allowlist empties; the SDK is required only by the three exempt files |

Each migration replaces `new Anthropic(X)` with `createAnthropicClient(X)`, with `X` byte-identical, and keeps the client where it was: module level, lazy, or per call. Retries, models and lifetimes change only in later, separately approved work (G4).
