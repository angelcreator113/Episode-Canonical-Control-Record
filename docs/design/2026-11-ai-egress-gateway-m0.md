# AI egress gateway: M0 specification (accepted design baseline)

**Status:** accepted by Evoni as the architectural baseline (M0) on 2026-11-07. The architecture is frozen. Implementation proceeds in separately approved phases. **G1**, the decision core in `src/aiGateway/`, is the only implemented part; it is not wired to anything.

**Scope:** Emergency Stop enforcement at the network boundary for every paid AI provider call. Budget enforcement, sessions and the Operations Center UI are covered only where they meet the gateway.

**Threat model:** the gateway protects against *accidental or automatic* paid submissions: bugs, retries, timers, scripts, frozen processes and new unguarded code. It does **not** protect against a malicious operator with shell or root access on the host, or with database write access.

---

## 1. Shape

- **One gateway process (`aigw`).**
  - It runs as its own OS user with its own service unit, outside the application's pm2.
  - Callers reach it only through Unix sockets, one per caller class (`api`, `worker`, `script`). There is no TCP listener.
  - It forwards to providers over HTTPS with no TLS interception, **no retries and no redirects**.
- **Credential custody.** The provider keys live **only** in the gateway's key file, readable by the gateway's OS user alone.
  - They are not in AWS Secrets Manager or SSM readable by the instance role, because every process on the host can use that role.
  - They are removed from the application, worker, scripts, ecosystem files and the pm2 dump, then **rotated**, so every stray copy stops working.
- **Routing.**
  - The Anthropic SDK is pointed at the gateway through its `baseURL` option, set in one client factory with `maxRetries: 0`.
  - The Replicate SDK uses its `baseUrl` and `fetch` options.
  - axios call sites use base-URL constants.
  - ElevenLabs goes through a provider module.
  - **Cloudinary** signs requests client-side with its secret, so the gateway performs those uploads itself through a semantic endpoint.
  - The `claude` CLI and AWS-role services (Transcribe) cannot be routed (§9).

## 2. Request classes (`operationCatalog`)

| Class | Meaning | Under Stop |
|---|---|---|
| `submission` | a paid create, e.g. Anthropic `POST /v1/messages`, OpenAI image generations and edits, fal model runs, Runway `image_to_video`, Replicate predictions, ElevenLabs TTS, remove.bg | refused |
| `status` | the status of an already-submitted task: Runway `GET /v1/tasks/{id}`, Replicate `GET /v1/predictions/{id}` | allowed for known tasks (§6) |
| anything else | not allowlisted: cancellation endpoints, Anthropic `count_tokens` and batches, Runway `remove-background` (existence unverified), query strings | refused |

Output downloads from provider CDNs need no key and submit nothing, so they stay outside the gateway.

## 3. Permits (addendum A and B)

A permit is the ledger row created by the Authorize step. It is **single use** and bound to:
- **the caller:** caller class and instance, plus a 256-bit permit secret returned once to the authorizing process (only its SHA-256 is stored);
- **the provider, operation, model and job** (logical key and attempt);
- **the budget reservation:** estimate in micro-dollars, price catalogue entry, strictness, day, session, activation;
- **the expiry;**
- **the exact request:** body SHA-256 and length, the normalized billing fields (`billingFields` per operation), and the billing headers (`anthropic-version`, `anthropic-beta`, `x-runway-version`).

**Verification (`verifyAgainstPermit`)** happens before anything is forwarded. It checks:
- the secret (constant-time);
- the caller socket;
- the method, path and host;
- the exact body hash and length;
- the re-parsed billing fields (JSON bodies; a multipart body is bound by its exact hash);
- the header allowlist, where caller authentication headers are removed and the key injected.

**A permit for one operation can never authorize another.** The ledger's dispatch step then moves the permit `authorized` → `dispatching` exactly once, and only if it is unexpired and still allowed.

Socket permissions are an **additional** boundary only; authorization is the permit (C).

## 4. Stop state (addendum D and H; requirement R-3; `effectiveState`)

**Inputs:**
- the database control state (`RELEASED` / `STOPPED` / `RESUME_PENDING`, version, service pauses);
- the local emergency state;
- the version this gateway has applied.

**Rules:**
- **The most restrictive verified state wins.** Any source that says stopped restricts.
- **A missing, unreadable or stale required state is `UNVERIFIED`,** never shown as resumed, and never allows submissions.
- **`RELEASED` only** when both states are verified and released, nothing relevant is paused, and the gateway has applied the current version.
- A database Resume **never** clears a local emergency stop; a local release **never** clears a database Stop.
- **Status reads** are allowed when the state is verified (even stopped). When it is unverified, only task references the gateway itself recorded may pass.

**Global Resume** requires the same administrator, a fresh sign-in (Cognito hosted re-authentication, pending verification of the AWS documentation), a reason and a second confirmation.

## 5. Local emergency control (addendum E; `emergencyControl`)

- **Commands** are Ed25519-signed `{action, reason, issuedAt, nonce}`.
  - The private key is held off the host by Evoni.
  - A command is refused for a bad signature, a missing reason, an `issuedAt` outside the allowed skew, or a reused nonce.
  - Host access is also required, but it is not the authentication.
- **Durability:**
  - a stop takes effect in memory first, then is persisted;
  - a release is persisted first, then applied (if it cannot be persisted, the gateway stays stopped);
  - writes are atomic (temporary file, fsync, rename);
  - on boot, a missing file means not stopped, while an unreadable or corrupt file means **stopped**.
- **Audit:** an append-only, hash-chained, fsynced log (`verifyLogChain`), copied to the operations audit when the database is reachable.

## 6. Dispatch and Stop acknowledgement (`dispatcher`)

**Submission sequence:**
1. the safety state allows submissions;
2. the permit exists and is unused;
3. the body is read within bounds and hashed (§8);
4. the request is verified against the permit;
5. the ledger dispatch (T2) succeeds;
6. **in one synchronous section**, the local Stop flag and the safety state are re-checked, and the request is either refused (proven not forwarded) or registered in flight and forwarded;
7. the outcome is classified (§7) and recorded. **Never retried.**

**Applying a Stop** happens synchronously: the gateway sets the local flag, records the version and snapshots the in-flight set, then emits the acknowledgement.

| | Guarantee |
|---|---|
| N1 | No Authorize (T1) or Dispatch (T2) that starts after the Stop commits succeeds (database ordering; G2). |
| N2 | No forward starts in any turn after the one in which the gateway applied the Stop. The acknowledgement is written after that turn, so **from the moment it is visible, the only holder of the keys initiates no submission.** |
| N3 | A frozen gateway applies and acknowledges nothing. The UI shows "Stop requested: network not yet blocked". |
| N4 | Requests forwarded before the apply turn are listed in the acknowledgement. They continue (Stop never cancels) and their outcomes settle into the ledger. **They are never reclassified as not sent.** |

**Not guaranteed:**
- the delay between the Stop commit and the acknowledgement (shown, not bounded);
- bytes of in-flight requests;
- provider-side processing;
- any key outside the gateway (closed by rotation, detected by reconciliation).

## 7. Outcomes, uncertainty and retries (addendum F; Q7; `classifyOutcome`)

- `not_sent` **only** for a pre-send transport failure with no request bytes written (DNS, connection refused, TLS certificate failure), or a refusal before forwarding.
- `unknown` for: a 429; 408, 409 and 425; any 5xx; a timeout; a reset; a **caller disconnect**; an upstream close; an incomplete stream; or a 2xx without its result.
- A definitive 4xx gives `failed_confirmed`. A 2xx with a result gives `accepted` (task id) or `provider_succeeded`.
- **Only `not_sent` allows a new attempt,** and only with a new permit (`attempt + 1`). A new attempt of a logical request with an `unknown` attempt cannot be authorized.
- A disconnect or closed connection **does not** prove billing stopped. The gateway drains the upstream response for evidence. Without evidence the row stays `unknown`, with its reservation counted as uncertain exposure.
- **Age never turns a dispatched request into `not_sent`.** A stale `dispatching` row becomes `unknown`; only an expired, never-dispatched `authorized` row becomes `not_sent`.

## 8. Request bodies (requirement R-1; `bodyReader`)

- `Content-Length` is required and must equal the permit's length **before** any byte is read.
- JSON is read in memory up to `jsonBodyMax`.
- Multipart uploads are spooled to disk up to `uploadBodyMax`, with a total quota (`spoolTotalMax`), a concurrency cap (`spoolConcurrency`) and a read deadline. The SHA-256 is computed while reading.
- Nothing can be forwarded before the whole body is hashed and verified.
- Spool files are removed after forwarding or refusal, and swept at boot.
- The limits in `constants.js` are **test and design defaults, not approved production limits.**

## 9. Provider inventory (requirement R-2)

**No path is Stop-protected** until credential isolation, routing and enforcement are each verified in production.

| Provider | Credential | Transport | Gateway route |
|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | SDK (146 constructions) | factory `baseURL` |
| OpenAI images | `OPENAI_API_KEY` | axios | base-URL constants; multipart spooled |
| fal | `FAL_KEY` | axios | base-URL constants |
| Runway | `RUNWAY_ML_API_KEY` **and** `RUNWAY_API_KEY` (consolidate) | axios | base-URL constants; `remove-background` refused until verified |
| Replicate | `REPLICATE_API_TOKEN` | SDK, plus one raw fetch | `baseUrl` + `fetch` |
| ElevenLabs | `ELEVENLABS_API_KEY` | fetch | provider module |
| remove.bg | `REMOVEBG_API_KEY` **and** `REMOVE_BG_API_KEY` (consolidate) | axios | base-URL constants; multipart spooled |
| Cloudinary | `CLOUDINARY_*` (signing secret) | SDK | gateway-signed semantic endpoint |
| `claude` CLI | inherits the API environment | child process | **not routable**; execution disabled (`AMBER_CLI_EXECUTION_ENABLED`) |
| AWS Transcribe | Lambda IAM role | AWS SDK | **not routable**; investigation pending |

No other paid AWS AI service is used. A CI inventory scan fails the build when a provider host, SDK constructor, CLI invocation or credential variable appears outside the gateway client modules.

## 10. Budget accounting (`budget`, the ledger)

- Money is in integer micro-dollars.
- **Reserved:** unsettled submissions, at their estimate. **Confirmed:** billed amounts. **Uncertain:** unknown outcomes at their estimate, never decaying by age.
- **Exposure** = reserved + confirmed + uncertain. Every limit (daily caps, image cap, session cap, activation budget) uses exposure, and none substitutes for another.
- **Strict work** (automated, session-required, worker) needs a price with status `verified_primary_doc` or `verified_billing_export`, and a maximum unit count for time-billed units. Owner-supplied prices are provisional.

## 11. Failure, restart, rollback (addendum I)

- **Gateway down:** paid AI fails closed. Rows stay `authorized`, then expire and become `not_sent`.
- **Restart:** the gateway is stopped until it has read the state. Its own `dispatching` rows become `unknown` through the sweep.
- **Database down:** submissions refused; status reads only for cached tasks.
- **Emergency without the database:** a signed local stop.
- **Rollback after the keys have moved:**
  - roll back the gateway build (the keys stay); or
  - paid AI stays off; or
  - **break-glass direct mode**: a gated secrets change, after which the UI shows "network Stop not enforced", and returning to gateway mode needs another rotation.

## 12. Acceptance tests for the full gateway (A1–A16; G3)

| # | Test |
|---|---|
| A1 | Multi-process randomized Stop |
| A2 | App frozen after Authorize |
| A3 | Gateway frozen between T2 and forward |
| A4 | SIGKILL at each boundary |
| A5 | Gateway absent |
| A6 | Database down with a local stop |
| A7 | Permit reuse, expiry or mismatch |
| A8 | Non-allowlisted paths |
| A9 | Key present in the app environment |
| A10 | Direct provider call detected |
| A11 | Stop mid-stream |
| A12 | Caller disconnect leaves `unknown` |
| A13 | Upload size limits |
| A14 | Polling under Stop |
| A15 | Resume replays nothing |
| A16 | No retry or redirect configuration |

## 13. Phases and gates

| Phase | Scope | Status / gate |
|---|---|---|
| **G1** | Decision core in `src/aiGateway/`, inert, with an in-memory **non-production** reference ledger | implemented as a draft PR |
| G2 | Postgres ledger and control adapters reproducing the reference semantics, plus migrations | migration approval |
| G3 | Gateway server, sockets, upstream forwarding, A1–A16; no deployment | code approval |
| G4 | App wiring: client factory, Authorize in the transport hooks, base URLs **defaulting to direct**, CI inventory scan, credential-name consolidation | code approval |
| M2–M8 | Host preparation; key copy; routing switch with one approved paid test call per provider; observation; key removal; rotation (irreversible, per provider); Stop-protected claims | production and secrets approvals, one each |

The episode worker stays stopped throughout, and receives no keys. Its re-queue of unknown outcomes is an activation blocker.

## 14. G1 code map

| Module | Responsibility |
|---|---|
| `constants.js` | default limits (test and design defaults) |
| `canonical.js` | canonical JSON, SHA-256, constant-time compare |
| `operationCatalog.js` | allowlist and billing fields |
| `permit.js` | permit secrets and binding |
| `requestVerifier.js` | exact-request verification |
| `bodyReader.js` | bounded intake and spooling |
| `stopState.js` | effective Stop state |
| `emergencyControl.js` | signed local stop |
| `signature.js` | Ed25519 verifier |
| `fsStores.js` | filesystem stores (the only filesystem user) |
| `outcome.js` | gateway-only outcome classification |
| `budget.js` | accounting and authorization decision |
| `memoryLedger.js` | reference ledger (**non-production**) |
| `dispatcher.js` | the decision procedure |

The tests are in `tests/unit/aiGateway/`. `inert.test.js` proves nothing outside the module references it, and that in a real Node process it loads only `crypto`, `fs` (in `fsStores.js` only) and `path`, makes no network call and reads no environment variable.
