# Jest network guard

Status: **Stage 1 (report-only)**, approved by Evoni on 2026-11-09. Stages 2 to 4 each need their own approval.

## Why

During the AI egress gateway work (P0a-3b, PR #3759), a test under development removed its SDK mock. It then sent requests to Anthropic with a dummy key: they were rejected with 401, with no billing and no credentials used. Nothing in the suite stopped a test from opening an outbound connection. The guard makes every Jest run record, and from Stage 3 refuse, connections to anything but loopback.

## What it does

The code is in `tests/networkGuard/` and is wired in `jest.config.js`. No special command is needed, locally or in CI.

| Part | Role |
|---|---|
| `core.js` | Host classification and the hooks. Hooks `net.Socket.prototype.connect` (both call shapes), `http`/`https` `request` and `get`, `globalThis.fetch`, and `dns` (`lookup`, `lookupService`, `resolve*`, `reverse`; callback and promise APIs; module functions and `Resolver` classes). |
| `setup.js` (`setupFiles`) | Installs the hooks in each worker before every test file, so they are back after a worker is recycled. |
| `afterEnv.js` (first in `setupFilesAfterEnv`) | Attributes attempts to the running test. Writes a heartbeat at file start and a file-end record with the file's attempt count. |
| `globalSetup.js` | Clears the previous run, creates the run's event directory and start marker, and refuses `NETWORK_GUARD=off` in CI. |
| `reporter.js` | At the end of the run, writes `tmp/network-guard/report.json` and `summary.md`. |
| `verify.js` | The CI step after the tests. Fails on a missing, stale, unfinalized or incomplete report, or a disabled guard in CI. Appends the summary to the step summary. |
| `allowlist.json` | Reviewed exceptions. Empty in Stage 1. Paid AI and media providers can never be listed. |

**Allowed without review:**
- loopback: `127.0.0.0/8`, `::1`, IPv4-mapped loopback, and the name `localhost`;
- Unix sockets and named pipes.

**Not allowed without review:**
- `0.0.0.0` and `::`, which are not treated as loopback;
- hosts from environment variables, such as database URLs. A non-loopback database host needs a reviewed allowlist entry.

**Modes:**
- `report` (Stage 1, the default): records each attempt and lets the call proceed, so behaviour is unchanged.
- `enforce` (Stage 3): fails the call with `ERR_TEST_NETWORK_BLOCKED` before any DNS lookup or packet.
- `off`: allowed locally only. The report then says "disabled", never "0 attempts".

The hooks are plain assignments, so `jest.restoreAllMocks()` cannot remove them. A hook found removed mid-run is put back, and the run is marked incomplete.

## Integrity: no data never reads as zero attempts

A run is **complete** only when all of these hold:
- every executed test file has a heartbeat, with every hook in place;
- every test file has a file-end record whose count matches its recorded attempts;
- the start marker matches this run;
- no event line was unreadable.

Otherwise it is **incomplete**, and CI fails, even though Stage 1 never fails on attempts. A missing report, which happens when the reporter did not run or the run did not finish, also fails CI. So do overriding the reporters, the setup files or the config.

## Rollout

1. **Stage 1 (this):** report-only, with the CI step summary and an artifact. The test results are unchanged.
2. **Stage 2:** fix the attempts Stage 1 finds. Known: `episodeTitleOverlay.integration.test.js` calls the flourish route without its `axios` mock, which reaches `img.test`. Done when the report is empty in at least 2 CI runs.
3. **Stage 3:** enforce by default. An attempt fails its test; a late attempt fails the run.
4. **Stage 4 (separate design review first):** child `node` processes, which are not covered by Stages 1 to 3.

## Limits

- **Child processes** started by tests are not instrumented until Stage 4.
- **Late attempts:** an attempt made after its test file ended (a fire-and-forget call) is attributed to the file that is running at the time.
- **Frontend tests:** the guard covers backend Jest only. The frontend Vitest suite is out of scope.
