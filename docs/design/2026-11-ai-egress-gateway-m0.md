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
  - on boot, a missing file means not stopped, while an unreadable or corrupt file means **stopped**. *(Superseded by E3 below: a missing file now means stopped.)*
- **Audit:** an append-only, hash-chained, fsynced log (`verifyLogChain`), copied to the operations audit when the database is reachable.

### 5.1 Corrections E1–E4 (G3 v1.0 decision D-D; recovery per Option A, approved 2026-11-08)

These tighten addendum E. Everything above still holds unless stated here.

- **Command format.** Every command is an Ed25519-signed `{action, reason, target, seq, commandId, issuedAt}`, where `action` is `stop`, `release` or `recover`.
  - `commandId` is recorded for audit traceability only; it is not a replay control.
  - The ±5-minute `issuedAt` skew still applies.
- **E1, ordering.**
  - `seq` must be higher than the last sequence applied for the signing key, and each key has its own counter.
  - Counters are persisted, so replay protection survives restarts.
  - A delayed `release` can never override a newer `stop` from the same key.
  - `seq` replaces the earlier nonce list.
- **Cross-key ordering.** Per-key counters cannot order commands signed by different keys, so the signed `issuedAt` does.
  - The gateway keeps a **stop floor**: the highest `issuedAt` of any applied `stop` or `recover`. It is persisted as `stopIssuedAt` in the state file and recorded in every log entry.
  - A `release` is applied only when its `issuedAt` is **strictly later** than the stop floor; otherwise it is refused with `RELEASE_PREDATES_STOP`. A tie goes to the stop.
  - Time never blocks a `stop`, and a `stop` only ever raises the floor. Two cases differ:
    - **An older stop from another key.** It is applied when it carries a fresh sequence for its own key, even if it was issued before a release that another key already applied. This fails safe.
    - **A stale stop from the same key.** A delayed stop whose `seq` is at or below the last sequence applied for its key is refused with `SEQ_STALE` (E1). That key has since signed a later command, which supersedes the stop.
  - So a delayed `release` from key B cannot undo a newer `stop` from key A, including after a restart, a key rotation or a revocation.
  - **Clock dependency.** The rule trusts the signers' clocks (each `issuedAt` is still bounded by the ±5-minute skew). If a release is signed on a clock running behind the stop signer's clock, it is refused and must be signed again later. This fails closed.
- **E2, target.** `target` must equal the gateway's target id exactly. The id is assigned at provisioning and passed in explicitly; it is never hardcoded or derived.
- **E3, state.** The gateway is **stopped and untrusted** when its state file is:
  - missing;
  - corrupt;
  - of an unknown version;
  - written for another target;
  - inconsistent with the log (head, per-key sequences, or a stop floor below the latest logged `stop` or `recover`);
  
  or when the log is unreadable. In that condition `stop` and `release` are refused, and **a normal release never initializes state**.
- **Recovery (Option A).** Initialization and recovery use a separately authorized signed `recover` command.
  - **Challenge.** It must carry the current challenge: 32 fresh random bytes, held in memory only, so it dies with the process. A challenge expires after 15 minutes and is single-use.
  - **Key.** It must be signed by a key with the `recover` role.
  - **Floors.** It must carry a sequence floor for every active key, taken from the signing authority's durable records. No floor may be lower than any sequence the gateway still knows from its log or state.
  - **Stop floor.** `recover` does not carry a stop floor; the gateway computes it. The floor is the highest of: the recover command's own `issuedAt`; every `stop` and `recover` the log still records; the state file's floor, when the state is readable; and any verified `stop` refused while the state was untrusted, in this process. The sequence floors cannot lower it. So a `release` issued before the `recover`, or before a known `stop`, is refused, whatever its sequence.
  - **Effect.** `recover` leaves the gateway **stopped** and never authorizes dispatch. A newly signed `release`, with a sequence above the floor, is required afterwards.
  - **Corrupt log.** A log whose hash chain is broken blocks recovery. The files must first be archived out of band, by a manual, separately authorized procedure.
- **E4, keys.**
  - Several active public keys are allowed, each with roles: `control` for stop and release, `recover` for recovery. An ordinary key has no recovery authority.
  - Revoked keys are listed by fingerprint and refused.
  - There is no key expiry in this slice.
- **Audit.** Every applied command records its `target`, command `seq`, signer fingerprint, `commandId` and `issuedAt`. `recover` also records the challenge id, the floors and the prior condition.
- **Limitation.** *(See 5.2: the log is now authenticated and anchored.)* The state file and the hash-chained log are writable by the gateway's own account. They detect edits and inconsistencies, but they cannot prove that no history was deleted: removing both files looks like a new gateway. Two things limit the damage:
  - nothing initializes without a fresh challenge, so replay fails;
  - the floors come from the signing authority, not from the gateway.

  For the same reason, when history was deleted, the stop floor can only reflect the stops the gateway still knows. A `stop` refused while the state was untrusted is remembered only until the process restarts, because writing it would need trusted state. Such a stop was answered with `RECOVERY_REQUIRED`, never reported as applied, and the gateway stays stopped until a recovery operator signs `recover`. An operator who needs that stop to hold should send it again after recovery.

### 5.2 Corrections E5 (security review of 2026-11-12; approved by Evoni the same day)

These tighten 5.1. Where they differ, 5.2 holds. Nothing here is wired or activated.

**Findings fixed**
- **A command that reached the log is never forgotten.** Before, a release that was logged but whose state write failed was not remembered in memory, and a RECOVER signed on a slower clock let the same release be replayed. Now the log entry is the commitment: memory follows it at once, a failed write leaves the gateway stopped and untrusted until the files are read again, and recovery floors can never go below a logged sequence.
- **History from a key that is no longer active.** RECOVER keeps the sequence counters of keys its floors do not name, so a restart after a revocation and a recovery is trusted. Before, every such restart came up `state_inconsistent`.
- **A malformed challenge is refused, not thrown.** The challenge must be 64 lower-case hex characters and is compared by byte length before the constant-time compare.

**What is trusted.** Only the target id and the key set (provisioning configuration) and the external anchor. Everything else is derived.

**Layer 1: files (`fsStores.js`, `securityProblems`).** At load the state directory must be a real directory owned by the gateway's user with mode 0700, and each of `emergency.json` and `emergency.log` that exists must be a regular file, not a link, with one name, the same owner and mode 0600. Files are opened without following links and checked again once open. Any failure is `store_insecure`: stopped, and RECOVER cannot clear it; the files are fixed by hand and the gateway restarted.

**Layer 2: the log is authenticated and replayed (`replayLog`, `evaluate`).**
- Each log entry holds the original signed `payload` and `signature`, the gateway's `at`, and the chain fields. Nothing else.
- At load every entry is verified and replayed under the same rules as a live command (`evaluate` is the one implementation of both):
  1. the chain links;
  2. the signature verifies under a key in the set, active or revoked;
  3. the target matches and the key's role permits the action (`control`: stop, release; `recover`: recover, revoke);
  4. the command's `seq` exceeds that key's counter (counters start at zero, or at the floors of the latest RECOVER);
  5. a release's `issuedAt` is later than the stop floor;
  6. **head binding**: a release, a RECOVER and a revoke carry `head`, the hash of the entry before them, inside the signed payload.
  An entry that a live gateway would have refused makes the log `log_unverifiable`: stopped, RECOVER blocked.
- **Why head binding.** The hash chain is unkeyed, so whoever can write the file can recompute it. Without head binding a Stop could be cut out from before a later, genuine release. With it, that release was signed over the Stop and no longer verifies. A stop carries no head, so nothing must be read before stopping. To sign a release, the operator reads the current head from the gateway's status.
- **The state file can only restrict.** It must equal the replayed state exactly. If it is missing, corrupt, of another version or differs in any field, the gateway is stopped and untrusted, and the file is left as it is; only a signed RECOVER writes it again. The clock-skew check is not replayable (it needs the time of receipt) and is a live check only.
- **A stop while untrusted is recorded** (ruling of 2026-11-12). When the log is sound and only the state file is not (missing, lost, corrupt, unknown version, another target, inconsistent), a valid stop is appended to the log and the state file is left alone; the answer is `ok` with `recoveryRequired: true`. It survives a restart: a RECOVER signed before it no longer matches the head, the floors of the next RECOVER cannot go below its sequence, and the stop floor it raises binds every later release, whatever the RECOVER's `issuedAt`. A stop may be the first entry of a log, before any RECOVER; it initializes nothing. When the log itself cannot be relied on or written (`store_insecure`, `log_corrupt`, `log_unverifiable`, `log_unreadable`, `anchor_ahead`, `anchor_fork`, `revocation_mismatch`, `persist_failed`) the stop is answered `RECOVERY_BLOCKED`; the gateway is stopped, and the only way out is the manual procedure followed by a RECOVER carrying a new challenge. This replaces the in-memory floor described in 5.1.

**Revocation: the rotation boundary is a log entry.**
- A key is revoked by `revoke`: signed by a `recover` key, head-bound, naming the key's fingerprint. It leaves the gateway **stopped** and raises the stop floor.
- In a replay, the revoked key's entries before that entry are valid history; any entry by it afterwards fails the replay. The boundary cannot be moved: the revoke was signed over the head it saw, so nothing can be inserted before it or removed from before it.
- Position before a RECOVER is not the rule and is not relied on.
- The configuration must agree with the log. A key the configuration marks revoked with no revoke entry yet: `revocation_pending`, stopped, accepting only stop and revoke. A key the log revoked that the configuration still lists as active: `revocation_mismatch`, untrusted until the configuration is corrected.
- A revoked key's public key stays in the key set. A key removed altogether leaves its history unverifiable (`log_unverifiable`).
- Rotation procedure: send `revoke`; mark the key revoked in the key set; restart; send a new head-bound release.

**The external anchor: truncation.**
- **Signed entries alone cannot detect removal of the newest entries.** A log cut back to an earlier genuine prefix replays cleanly; if the removed entry was a STOP, the prefix may end RELEASED. Head binding does not help: the prefix is exactly what was once signed.
- The anchor holds the latest log head (`seq`, `hash`) outside the gateway's files. Its `advance` must be atomic, conditional on the current value and forward by exactly one; the gateway has no way to move it back. Reset is for the anchor's administrator only.
- The gateway reports **RELEASED only while the anchor was read within `anchorStaleMs` and equals the local head**:

  | Anchor | Effective local state | Clears |
  |---|---|---|
  | read recently, equal to the local head | as replayed | n/a |
  | unavailable, or last read too long ago | not readable (submissions refused) | by itself, on the next successful read that is equal |
  | behind the local head, by entries this process applied itself | not RELEASED | when the pending write is confirmed (`refresh`) |
  | behind the local head, by entries this process found in the files at start (`unconfirmed`) | not RELEASED, and the anchor is not moved | only by a fresh command applied by this process: a stop keeps it stopped; a release signed over the current head releases |
  | ahead of the local head | `anchor_ahead`: stopped, untrusted, RECOVER blocked | files archived out of band, anchor reset by its administrator, restart, RECOVER |
  | another hash at the same position | `anchor_fork`: the same | the same |

- **An unanchored release found after a restart never becomes effective by itself** (ruling of 2026-11-12). Entries a process finds past the anchor may be a release logged just before a crash, or one written into the files; it cannot tell. It does not move the anchor over them and stays stopped until it applies a fresh command itself. So a validly signed, undelivered release written into the files is not honoured, and an ordinary crash during an anchor write also needs a new release.

**Order of persistence.** Commands are applied one at a time.
- **stop:** stopped in memory before anything is awaited; then log, state file, anchor. No later failure can undo it, and it never waits for the anchor.
- **release:** validate (signature, sequence, head, stop floor, and the anchor confirming the current head); log; state file; anchor write confirmed; only then RELEASED. An unconfirmed anchor write is `RELEASE_PENDING_ANCHOR`: the release is in the log and the gateway stays stopped until the anchor confirms it in the same process; after a restart it is not confirmed and a fresh release is required.
- **recover, revoke:** as release; both end stopped.
- **A Stop racing a Release.** A stop that arrives while a release is in flight holds the gateway stopped from that instant and is logged after the release, so the log ends stopped. A release queued behind a stop was signed over the earlier head and is refused (`HEAD_MISMATCH`).
- A failed log or state write is `persist_failed`: stopped and untrusted until the files are read again.

**Before activation (none of this is done or approved):**
- a real anchor: the G2 ledger, with a forward-only advance function for the gateway's role and reset for the admin role only;
- its database grants verified: the application and worker roles can call neither;
- the gateway's own OS user and a 0700 state directory at provisioning;
- Evoni's separate approval.
On the dev box Postgres runs on the same host, so root there controls both the files and the anchor; on production the database is a separate host. A database owner or the admin role is outside this threat model, as in section 1.

#### 5.2.1 Adversarial review (2026-11-12): what holds and what does not

Each line is covered by a test in `tests/unit/aiGateway/emergencyControl.test.js` ("adversarial review").

**Confirmed**
- **A Stop while the state is untrusted** is recorded in the log in every recoverable condition, and the gateway is stopped either way. Across a restart, an earlier RECOVER (head, challenge), a RECOVER backdated by a slow clock (the floor comes from the logged stop), and a release signed or dated before the stop (head, stop floor) all fail.
- **Anchor freshness.** RELEASED lasts `anchorStaleMs` from the last successful read and no longer; a clock set back does not extend it; an anchor that answers with anything but a position and hash is unavailable; an anchor found ahead withdraws RELEASED for good in that process.
- **Insertion into the local files.** A forged command, a command already applied, a command signed over an older head, and any insertion without a matching state file are all refused or fail closed. A genuine but undelivered release, inserted with a matching state file, is never honoured: not at the next start, not on refresh, not after repeated restarts, and not when the anchor was unreachable at start. An inserted release cannot pass a pending revocation. An inserted Stop, RECOVER or revoke only ever ends stopped.
- **A Stop racing a release** holds the gateway stopped at every observed instant, whether the release is waiting to read the anchor or to write it, and when the anchor write then fails; the log ends with the Stop.
- **Revocation set in the configuration first** survives state loss, RECOVER and restarts as `revocation_pending`; each pending key needs its own revoke entry; undoing the configuration change before any revoke entry restores the key. A key cannot revoke itself.
- **A failure at any persistence stage** (log append, state write, anchor write refused, anchor write failed, anchor answer lost, process death between log and state, a torn final log line), for stop, release, RECOVER and revoke, never yields RELEASED.

**Resolved on 2026-11-12 (rulings after this review)**
- A stop while untrusted is now recorded in the log whenever the log is sound, so it survives a restart (above).
- An unanchored release found after a restart is never honoured; a fresh release is required (above).

**Limitations that remain**
1. **When the log itself cannot be relied on or written, a stop is not recorded.** The gateway is stopped and blocked. After the manual procedure a RECOVER needs a new challenge and every later release must be signed over the new head, so nothing signed earlier can be used; what is lost is the stop's `issuedAt` as a floor.
2. **E1 in a race.** A Stop from a key is superseded by a later-numbered command from the same key that is applied first; from any other key the same Stop always stops.
3. **A torn final log line** needs the manual archive procedure; RECOVER cannot clear it.
4. **A RECOVER's challenge cannot be re-checked in a replay** (it lives in memory). A RECOVER written into the files is authenticated by its signature, role, sequence and head only; it ends stopped and, being past the anchor, leaves the gateway unconfirmed.
5. **The anchor's own guarantees are assumed**: atomic, conditional, forward-only, and answering with current data. The real anchor and its grants are not built or verified.
6. **The consumer must poll** `refresh()` more often than `anchorStaleMs`, or the gateway reports not readable (fail closed).
7. **A crash during an anchor write costs a new release**, by the stricter rule.

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
| `emergencyControl.js` | signed local stop: authenticated log replay, head binding, signed revocation, anchor (5.2) |
| `signature.js` | Ed25519 verifier |
| `fsStores.js` | filesystem stores (the only filesystem user); ownership, mode and link checks |
| `outcome.js` | gateway-only outcome classification |
| `budget.js` | accounting and authorization decision |
| `memoryLedger.js` | reference ledger (**non-production**) |
| `dispatcher.js` | the decision procedure |

The tests are in `tests/unit/aiGateway/`. `inert.test.js` proves nothing outside the module references it, and that in a real Node process it loads only `crypto`, `fs` (in `fsStores.js` only) and `path`, makes no network call and reads no environment variable.
