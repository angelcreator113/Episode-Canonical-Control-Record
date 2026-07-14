# F-Deploy-1 Fix Plan v1.41

**§4.2 MEMORY SYNTHETIC EXECUTED and FAILED 2026-07-14: kernel-attested OOM
at 08:35:14 UTC — `libvips worker invoked oom-killer`, driver (pid 4372)
killed at anon-RSS 485,340 kB (≈474 MiB) / total-VM 1.8 GiB; the kill landed
inside the pm2-ubuntu.service cgroup and took the API, worker, and PM2
daemon with it. Peak criterion FAIL by kernel-exhaustion inference; sampler
max 820 MiB used / 5 MiB avail, at-threshold on a 5s sampling floor.
Iterations 31–32 stalled 505s and 1183s (reclaim thrashing, zero-swap box)
before the kill. Formal §5.2 idle baseline: 378 MiB loaded (20 samples /
5 min, spread 7 MiB). VERDICT: FAIL on all three criteria. Route: §6.1 —
in-place class change to t3.small, full §4.2 re-run at ≤ 1.64 GiB, its own
gated session, with the W1 SG-rule collision as a BLOCKING input (see §3).
t3.micro is PROVEN insufficient for a drained-queue render burst plus the
app tier. The gate did its job: this is exactly the discovery §4.2 exists
to make pre-cutover, on a box serving nothing. Mints no FD. Register tail:
FD-61 at open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.40 (P5 CLOSED-placeholder; merged #929, 0b70ca92) |
| **Author date** | 2026-07-14 |
| **Gate effect** | §4.2 scored FAIL; §6.1 fallback becomes the live frontier item (t3.small class change + re-run). §4.3 remains blocked on §4.2 pass. Re-enablement untaken, unproposed. FD-27's t3.micro lock is now contradicted by field evidence; FD-27 confirm-or-revise resolves as REVISE at the §6.1 re-run's close, per §6.1 step 4. |

**Basis (live reads and writes 2026-07-14, this session, transcribed from
live terminal output, not memory):**
- Wake-up trio: origin/main at 0b70ca92 (#929, v1.40); `gh pr list` -> none.
- Block A: pm2 tree empty (v1.40 continuity); idle 221 MiB; disk 3.3G free.
- Contract read live in full (G2 v1.3) before drafting; synthetic designed
  from source reads of ThumbnailGeneratorService, ecosystem.config.js,
  compositions.js — not from memory.

## §1 Execution record

- **B1** clone to `~/episode-metadata-synthetic` (deliberately NOT the
  deploy path) + `npm ci --production`: npm-exit=0; sharp 0.34.5 /
  libvips 8.17.3 native binding verified exit 0. Disk after: 2.7G free.
- **B2** P4 loader maiden run: `print-db-env.js` resolved 5 DB_* exports
  from `episode-metadata/dev/database` via instance role, exit 0, values
  never echoed (names-only verification read). P3 thereby re-verified in
  the field. Loader rides AWS SDK v2 (end-of-support warning) — migration
  note for P4's code PR, recorded not chased.
- **B3 (first attempt) FAILED CLEAN:** `pm2 start ecosystem.config.js
  --only ...` — Script not found. **Finding: ecosystem.config.js hardcodes
  absolute paths** (`/home/ubuntu/episode-metadata/...`); the config is
  non-relocatable and works for the deploy leg only because its extract
  path matches exactly. No process spawned; restart counters untouched.
  Observation filed, not fixed (Path A).
- **B3-revised:** direct-path scoped starts of `src/server.js` +
  `src/workers/start.js` with env replicated from the config's dev blocks
  (read live: sharedEnv is env-or-empty for all non-DB keys — no secrets
  needed beyond the B2 shell env). Both online, ↺ 0. **Health: first
  attempt** — app boots on this box, empty JWT_SECRET tolerated at boot,
  RDS pool opens from this box (first-ever proof of that network path).
  Loaded-idle 376 MiB.
- **B4** driver written on-box (63 lines, heredoc, node --check +
  wc/tail completeness reads): replicates ThumbnailGeneratorService's
  Sharp operation sequence VERBATIM from source — base canvas
  sharp({create}), per-layer resize(fit:cover).toBuffer(), all resized
  buffers held, single composite().png().toBuffer(). Design pivot recorded:
  `generateFromTemplateStudio` is DB+S3+fetch-coupled top to bottom
  (own Sequelize handle against DATABASE_URL, template_studio query,
  node-fetch per layer) and was disqualified as an entry point; the driver
  replicates the memory shape, not the plumbing. Inputs: noise PNGs
  (incompressible, worst-case-leaning) — 1920×1080 bg, three 2048×2048
  RGBA layers, 512×512 logo; two MVP formats per iteration
  (YOUTUBE 1920×1080, INSTAGRAM_FEED 1080×1080); concurrency 3.

## §2 Gate record (Block C)

- **C1 formal idle baseline (§5.2, discharged):** 20 samples @15s, 5 min,
  hands-off. Loaded-idle 374–381, number of record **378 MiB**.
  Bare idle (session open): 221. Budget at bar: 820 − 378 = 442 MiB.
- **C2:** sampler @5s (pid 4345, outside the pm2 cgroup — survived the
  kill and was terminated at teardown); driver under PM2. Iterations
  25–30 at ~4.2–4.9s; iter 31 = 505s, iter 32 = 1183s — reclaim thrashing
  in the flesh. Driver self-reported RSS max 477 MiB before the log ends.
- **C3 evidence:**
  - Sampler max: 820 used / 5 avail (at-threshold on a 5s grid).
  - VmHWM: unreadable — all node PIDs dead at read time. The kernel kill
    record substitutes: anon-RSS 485,340 kB (≈474 MiB) at kill (driver
    self-reported RSS max 477 MiB in its final logged iterations;
    474 at kill ≤ 477 max — internally consistent ordering).
  - OOM: **one, kernel-attested** (sudo dmesg): killer invoked by libvips
    worker; pid 4372 killed; cgroup-scoped kill took the full
    pm2-ubuntu.service tree (API + worker + daemon) — hence pm2 list
    showing ABSENCE post-kill, not stopped apps.
  - Restart counters: superseded — the tree did not survive to be counted
    (see §3 criterion 3).
- **C4 teardown:** sampler killed; tree empty, zero node processes;
  evidence logs (c1-idle-baseline.log 560B, c2-synthetic-sampler.log
  3119B) preserved into the clone. pm2 save NOT run (ruled at draft:
  saving any manifest seeds resurrect-state; resurrect is banned).
  End state: substrate + clone + evidence logs, nothing serving.

## §3 Verdict and route

FAIL on all three criteria.
Criterion 1 (peak ≤ 820): sampled max 820 used / 5 avail — at-threshold on
a 5s sampling grid, which bounds the true peak from below only; the kernel
OOM invocation attests the true peak reached exhaustion (> 820 by
inference — the killer does not fire otherwise). Scored FAIL by kernel
evidence, not sampler evidence; overdetermined by criteria 2 and 3
regardless.
Criterion 2 (zero OOM): failed, kernel-attested.
Criterion 3 (zero PM2 restarts per §5.2): failed a fortiori — the tree was
killed outright, a strictly stronger event than a restart.
The §5.2 rationale line — "too close to the ceiling for safe operation" —
was observed literally: multi-minute allocation stalls preceded the kill.

**Route: §6.1.** Class change to t3.small + full §4.2 re-run at ≤ 1.64 GiB
(80% of 2 GiB). Its own gated session, own draft. BLOCKING INPUTS, in order:
(a) EIP status: VERIFIED ABSENT (reviewer-attested W1 session read,
2026-07-10/11: `describe-addresses` -> empty for this instance; not
independently in this session's transcript — the §6.1 pre-reads re-run
describe-addresses as one-line corroboration, cheap and conclusive).
Consequence: stop/start WILL release 98.93.190.74 and assign a new
public IP.
(b) W1 SG rule collision: the standing W1 constraint (sgr-0113dd1f15b1f7e9b,
TCP 5432 from 98.93.190.74/32 on sg-002578912805d1930, DISPOSABLE,
revoke-or-ratify owed) forbids stop/start of i-016395bb5f7a51a0b until
ruled — §6.1's stop -> modify -> start is exactly the forbidden operation.
The §6.1 draft carries rule disposition as a BLOCKING input: verify live
whether already ruled; if extant, revoke-before-stop is the coherent path
(a /32 pinned to an IP the stop releases cannot be ratified as-is).
(c) IP-bearing doc sweep at re-run close: every artifact carrying
98.93.190.74 goes stale at the stop; sweep owed in the re-run's closing
revision.
Cost note: ~$22–30/month α adder at t3.small per G2 v1.3 §6.1 arithmetic.
If t3.small also fails: PE filing per §6.1 step 5; G2 does not ship until
resolved.

**Free wins banked for first dispatch regardless of class:** P4 loader
field-proven · P3 re-verified · app boots + RDS path from this box proven
· ecosystem absolute-path finding on record.

## §4 Corrections and disclosures

- **FD-51 own-goal, mine, severity noted:** the C3 OOM check as first
  drafted was `dmesg -T 2>/dev/null | grep ...` — on Ubuntu 22.04
  (kernel.dmesg_restrict=1) unprivileged dmesg FAILS, the redirect ate
  the permission error, grep saw empty input, and exit 1 was read as
  "clean." A silent failure was BUILT INTO A PASS CONDITION by the
  session's own author. Retracted in-session; corrected read (sudo dmesg)
  produced the kill record. Named class: privileged-read-behind-redirect
  — never stack 2>/dev/null on a read whose failure mode is
  permission-denied when its empty output would score as pass.
- **Ride-along class, FIFTH occurrence:** B3-revised executed ahead of its
  confirm ("confirm B3-revised" arrived post-hoc). Mitigation held for B1,
  B2, B4 and all of Block C. Additionally: repeated paste-transit mangling
  observed all session (B3 echo truncated, B4 heredoc echo garbled, a pm2
  logs invocation self-concatenated) — display-layer, no execution harm
  proven, but it motivated hand-typing short commands late in session.
- **Scoping judgment (disclosed at draft, restated at close):** the
  synthetic exercised the Sharp/Canvas peak per the contract's own naming
  of the peak path; DB and S3 contributions to peak were NOT modeled
  (service entry points are plumbing-coupled; driver replicates the
  operation sequence). The fail verdict is CONSERVATIVE under this
  scoping: real load adds memory the synthetic didn't, so t3.micro fails
  a fortiori.
- **CloudWatch deviation (ruled at draft, executed as ruled):** custom
  memory metric absent, not provisioned; dual on-box channels substituted
  (sampler log + driver RSS self-report; VmHWM intended as third,
  superseded by the kernel kill record). Contract deviation, named.
- max_memory_restart interaction, recorded: config caps (1G/2G) exceed
  physical (913 MiB) — on t3.micro they are decorative; kernel OOM always
  wins. On t3.small the API's 1G cap becomes live and sits UNDER the
  1.64 GiB bar; PM2's cap check polls (~30s), so the cap produces LAGGING
  soft-restarts — the §6.1 re-run must distinguish cap-restart
  (↺ increments, pm2 event log) from kernel kill (dmesg) as separate
  event classes.

## §5 Retained

v1.36–v1.40 in full. Prerequisite register: P1–P3 CLOSED, P4 folds to
first dispatch (loader now field-proven), P5 CLOSED-placeholder.
deploy-dev.yml runtime: `disabled_manually`, unchanged. FD-61 OPEN, parked.
Cutover-inherits-six list (v1.40 §3) unchanged; prod certbot cleanup due
~mid-August stands.

## §6 Register hygiene

Tail at open: FD-61. Minted: none. Scored: §4.2 gate FAIL (live-verified,
kernel-attested; not an FD — a gate outcome routing to a contract-
anticipated fallback). Writes this session: dev-box only (clone, npm ci,
two PM2 starts + one failed start attempt, driver file, log copies,
teardown kills); zero repo writes before this revision; zero AWS control-
plane writes. FD-21 check on commit message. Ships [skip-automerge] in
title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.41.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-14. Predecessor: v1.40 (0b70ca92, #929).*
*Scored: §4.2 FAIL (OOM, kernel-attested, all three criteria). Route: §6.1*
*(t3.small; W1 rule disposition blocking). Minted: none. Tail: FD-61.*
*Frontier: §6.1 class change + re-run.*
*[skip-automerge]*