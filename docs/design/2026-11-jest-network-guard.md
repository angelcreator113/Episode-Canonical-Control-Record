# Jest network guard

Status: **Stage 3a**, approved by Evoni on 2026-11-09 (Stage 1 merged in #3760, Stage 2 in #3761). Still report-only: the only blocking is inside the canaries. Stages 3b to 3d and Stage 4 each need their own approval.

## Why

During the AI egress gateway work (P0a-3b, PR #3759), a test under development removed its SDK mock. It then sent requests to Anthropic with a dummy key: they were rejected with 401, with no billing and no credentials used. Nothing in the suite stopped a test from opening an outbound connection. The guard makes every Jest run record, and from Stage 3 refuse, connections to anything but loopback.

## What it does

The code is in `tests/networkGuard/` and is wired in `jest.config.js`. No special command is needed, locally or in CI.

| Part | Role |
|---|---|
| `core.js` | Host classification, the endpoint policy and the hooks. Hooks `net.Socket.prototype.connect` (both call shapes), `net.Server.prototype.listen` (tracked, never trusted by itself), `http`/`https` `request` and `get` (classified by the destination they name, before any agent or proxy), `globalThis.fetch`, `dns` (`lookup`, `lookupService`, `resolve*`, `reverse`; callback and promise APIs; module functions and `Resolver` classes), and `dgram` (`send`, `connect`). |
| `registry.js`, `endpoints.json` | The reviewed endpoint registry (Stage 3a): which loopback ports and Unix sockets are legitimate. |
| `proxyEnv.js` | Finds and removes proxy settings (Stage 3a). |
| `canary.js`, `canary-manifest.json` | The canary helper and manifest (Stage 3a). The canary file is `tests/unit/guards/networkGuard.canary.test.js`. |
| `setup.js` (`setupFiles`) | Installs the hooks in each worker before every test file, so they are back after a worker is recycled. |
| `afterEnv.js` (first in `setupFilesAfterEnv`) | Attributes attempts to the running test. Writes a heartbeat at file start and a file-end record with the file's attempt count. |
| `globalSetup.js` | Clears the previous run, creates the run's event directory and start marker, and refuses `NETWORK_GUARD=off` in CI. |
| `reporter.js` | At the end of the run, writes `tmp/network-guard/report.json` and `summary.md`. |
| `verify.js` | The CI step after the tests. Fails on a missing, stale, unfinalized or incomplete report, or a disabled guard in CI. Appends the summary to the step summary. |
| `verify.js --focused` | For a CI job that runs a fixed few test files (the PostgreSQL 17 job, `a2-constraints-pg17`), where the canary file is not in the run. It waives one requirement only: that the canaries ran (`canaryAbsent` in `report.js`: the canary file is not among the executed files, has no results, and no canary event was recorded). Everything else still fails it, and so does any recorded external attempt. A canary file that ran and failed is never waived. The flag is the only way in; the Tests job never passes it. |
| `allowlist.json` | Reviewed exceptions. Empty in Stage 1. Paid AI and media providers can never be listed. |

**Loopback** means `127.0.0.0/8`, `::1` (also IPv4-mapped) and the exact name `localhost`. Not loopback: `0.0.0.0`, `::`, numeric shortcut names (`127.1`, `0x7f.1`, `2130706433`), `::a.b.c.d`, NAT64 and 6to4 addresses.

**Stage 3a endpoint policy (report-only).** A non-loopback destination is an *attempt*. A loopback destination is allowed only through the registry; anything else is a *finding*:
- **TCP on loopback:** the port must be the test database's (from `TEST_DATABASE_URL`, only when its host is loopback), or a registered server: the server the installed supertest starts for `request(app)` (recognised by the exact caller of `Server#listen`, the reviewed supertest version, and the server instance, only while it listens), or a server a listed test file registers with `trustTestServer()`. Opening a listener authorizes nothing. Otherwise: `loopback-unregistered`.
- **UDP on loopback:** never registered: `loopback-unregistered`.
- **Unix sockets:** only an exact path registered with `trustTestSocket()` by a listed test file (absolute, normalized, under the system temp directory with no symlinked component, a socket and not a symlink, opened by this process). Otherwise: `unix-unregistered`. Abstract sockets and named pipes are never allowed.
- **After lookup:** a name expected to be loopback that resolves elsewhere is `post-lookup-nonloopback` (and `localhost-resolution-mismatch` for `localhost`). Reported, not corrected, until Stage 3c.
- Redis is listed but disabled until a test shows a legitimate need.

**Proxy settings.** `globalSetup` removes `HTTP(S)_PROXY`, `ALL_PROXY`, `NO_PROXY` and their variants (upper and lower case), `npm_config_*proxy`, `GLOBAL_AGENT_*`, `NODE_USE_ENV_PROXY` and `--use-env-proxy` from the Jest process before any worker starts, and records their names (never values). `setup.js` removes them again in every test file and the heartbeat records any that reached it. In CI any proxy setting refuses the run. A non-loopback test database also refuses the run in CI.

**Canaries.** `networkGuard.canary.test.js` makes one call per transport inside `expectNetworkBlocked()`, where the guard always blocks (in every mode). Destinations cannot leave the machine even if the guard failed: `0.0.0.0` and `::`, the file's own unregistered witnesses (a TCP server, a UDP socket and a Unix socket, which count what reaches them), and the name `canary.invalid`, only ever handed to a local witness proxy or resolver. Provider canaries point real SDK clients (Anthropic, Replicate) at `http://0.0.0.0:9` with dummy keys. Verification fails on any missing, extra, skipped, unblocked or misdirected canary, a witness count above zero, or a witness record that differs from the manifest.

**Modes:**
- `report` (the default): records each attempt and finding and lets the call proceed, so behaviour is unchanged.
- `enforce` (Stage 3): fails the call with `ERR_TEST_NETWORK_BLOCKED` before any DNS lookup or packet.
- `off`: allowed locally only. The report then says "disabled", never "0 attempts".

The hooks are plain assignments, so `jest.restoreAllMocks()` cannot remove them. Hooks are checked at every file start and before and after every test (`fetch` only at file start, since tests may replace it with a mock); a hook found removed is put back, and the run is marked incomplete. The reporter also checks that the Jest configuration wires the guard (setup files, global setup, reporter, test environment).

**The report** separates unexpected attempts, findings by kind (with files and targets), and canary events; it records per-file passed and skipped counts and the environment that explains known differences (Node version, `ffmpeg`/`ffprobe`, CI, test database), as the baseline for later enforcement.

## Integrity: no data never reads as zero attempts

A run is **complete** only when all of these hold:
- every executed test file has a heartbeat, with every hook in place;
- every test file has a file-end record whose count matches its recorded attempts. The one exception is a file in which Jest skipped every test (for example a `describe.skip` chosen by an environment check): Jest never runs its `afterAll`, so it cannot write a file-end. The reporter exempts such a file only when Jest reports it as skipped with no failure and no load error. It still needs its heartbeat with every hook in place, any attempt it makes is still counted, and the summary lists it;
- the start marker matches this run;
- no event line was unreadable.

Otherwise it is **incomplete**, and CI fails, even though Stage 1 never fails on attempts. A missing report, which happens when the reporter did not run or the run did not finish, also fails CI. So do overriding the reporters, the setup files or the config.

## Rollout

1. **Stage 1 (done):** report-only, with the CI step summary and an artifact. The test results are unchanged.
2. **Stage 2 (done):** fix the attempts Stage 1 found, still report-only. Done when the report is empty in at least 2 CI runs.
   - `episodeTitleOverlay.integration.test.js` asked for a flourish in its delete test without mocking the image download, so it fetched an `img.test` placeholder for real. Both flourish tests now mock the download, check it is called once with the generated URL, and check the flourish asset exists before the delete and is gone after it.
   - Source lines: the core-module hooks are installed once per worker, by the first test file, so attempts in later files had their stack built by that first file's `Error` and showed transformed line numbers. `setup.js` now registers a stack builder in every test file, so lines are mapped with the current file's source maps. A self-test runs three files in one worker, with coverage, and checks each line.
3. **Stage 3:** enforce by default, in phases, each with its own approval:
   - **3a (this):** the endpoint registry, proxy handling, UDP hooks, the post-lookup check, per-test tamper checks, the config fingerprint, per-file counts and the canaries. Report-only, except inside the canaries. Done when 2 CI runs show a complete report, 0 unexpected attempts, a verified canary manifest, and every finding fixed or approved.
   - **3b:** a written feasibility review of an OS-level firewall for the CI test step (no workflow change without approval).
   - **3c:** enforcement switchable: attempts and findings blocked, a blocked attempt fails its test even when caught, `localhost` answered by the guard; CI still in report mode.
   - **3d:** enforce by default, locally and in CI.
4. **Stage 4 (separate design review first):** child `node` processes, which are not covered by Stages 1 to 3.

## Limits

- **Child processes** started by tests are not instrumented until Stage 4.
- **Supertest** is recognised by its reviewed version and the exact caller of `Server#listen`; a different version, or a changed `serverAddress()`, disables that registrar, and its connections then show as findings (fail closed).
- **Late attempts:** an attempt made after its test file ended (a fire-and-forget call) is attributed to the file that is running at the time.
- **Frontend tests:** the guard covers backend Jest only. The frontend Vitest suite is out of scope.
- **Proxies:** the guard classifies the destination a request names, not the proxy it travels through, so a request through a loopback proxy (such as a cloud session's agent proxy) is still recorded under its real host. The independent tripwire used for local validation allows loopback, so local full-suite runs unset the proxy variables to keep such a request from leaving.
