# F-Deploy-1 Fix Plan v1.42

**§4.2 RE-RUN PASSED at t3.small 2026-07-14: sampler peak 1,121 MiB used /
617 avail — 558 MiB under the contract-literal bar of 1,679 MiB (≤ 1.64 GiB);
driver VmHWM 802,224 kB (≈783 MiB) kernel-attested WHILE ALIVE (yesterday's
evidence gap closed); OOM check clean on a privileged unredirected read
(exit 1, genuinely empty); ↺ 0 on all three apps, neither restart class
fired. Sustained load exceeded spec: >1 hour at equilibrium, iteration
times flat. The same workload that killed t3.micro at 474 MiB anon runs at
equilibrium on t3.small with a third of the box free — §6.1's hypothesis
confirmed in both directions: CLASS problem, not architecture. No PE filing.
En route: W1 revoke-or-ratify DISCHARGED (revoked pre-stop per ruling);
class change t3.micro -> t3.small executed (stop/modify/start; new IP
184.73.130.72; SSM re-registered; host-key continuity proven);
sgr-069e6deadaa82f08a minted with description and RATIFIED this revision
as the standing app-tier RDS rule. FD-27 resolves REVISE: t3.small.
Mints no FD. Register tail: FD-61 at open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.41 (§4.2 FAIL, §6.1 routed; merged #930, 371d12f6) |
| **Author date** | 2026-07-14 |
| **Gate effect** | §4.2 gate CLOSED (PASS at t3.small). §6.1 fallback executed and closed. FD-27 REVISED per §6.1 step 4 / §8 criterion 2: locked class is t3.small. Frontier advances to G2 Implementation v1.4 (class-commit bump, own PR), then §4.3 (deploy-dev retargeting) — which under the FD-57 rewrite reduces to the re-enablement ruling (Rule 7, untaken, now PROPOSABLE) + first dispatch. Burn-in §7.1 weekday-landing guidance applies to §4.3 scheduling. |

**Basis (live reads and writes 2026-07-14, this session, transcribed from
live terminal output, not memory):**
- Wake-up trio: origin/main at 371d12f6 (#930, v1.41); `gh pr list` -> none.
- Pre-reads: `describe-addresses` -> [] (EIP absent, now FIRST-HAND — the
  v1.41 §3(a) provenance chain closed); W1 rule live read -> extant.
- Live SG enumeration (reviewer-run): four specific ingress rules on
  sg-002578912805d1930, NO wildcard — basis for the AF amendment (§4).
- All control-plane writes and on-box work per §1–§2 below.

## §1 W1 discharge and class change

- **W1 ruling (Rule 7, taken in-channel):** REVOKE before stop. Leg 1:
  ratify-as-is incoherent — a /32 pinned to an IP the stop releases.
  Leg 2 (CORRECTED in review): revoke is free solely because stop/start
  orphans the referent — NOT because a wildcard subsumes it; the live
  enumeration shows no wildcard, and tonight's/yesterday's RDS pools rode
  the W1 rule. W1 was LOAD-BEARING. Leg 3 (INVERTED accordingly):
  a replacement rule for the new IP is a named planned step, not optional.
- **Revoke executed:** sgr-0113dd1f15b1f7e9b revoked (`Return: true`, rule
  echoed); verification read [] at exit 0 — clean-empty-under-ruling.
  The W1 revoke-or-ratify obligation, open since 2026-07-10, is DISCHARGED.
- **Class change executed:** stop -> modify (t3.small) -> start on
  i-016395bb5f7a51a0b. Verified in one read: running + t3.small +
  new public IP 184.73.130.72. SSM re-registered Online (agent 3.3.4793.0)
  — the stop/start sibling of v1.39's reboot-survival proof, now also
  field-attested. SSH host-key continuity: the new IP offered the SAME
  ED25519 key known_hosts held for 98.93.190.74 — cryptographic proof of
  same-box-new-address, the benign inverse of a changed-key warning.
- **Replacement rule minted:** sgr-069e6deadaa82f08a —
  184.73.130.72/32 tcp/5432 on sg-002578912805d1930, WITH description
  (retiring the W1 no-description deviation): "episode-dev-backend
  app-tier RDS access; minted F-Deploy-1 session 2026-07-14;
  revoke-or-ratify bounded to 4.2 re-run close." (§ dropped from the
  description deliberately — AWS SG descriptions reject non-ASCII.)
  Field-proven in B1′: the app's RDS pool opened through it, first attempt.
- **Rule disposition (Rule 7, taken in-channel this revision):** RATIFIED
  as the standing app-tier RDS rule. Caveat recorded: it staleness-couples
  to the box's public IP; any future stop/start orphans it again. The EIP
  question (allocate an Elastic IP to end the coupling) is a NAMED INPUT
  to the §4.3 draft — scoped as "end the coupling for every consumer":
  the same staleness binds any host-bearing mechanism §4.3 touches
  (e.g. EPISODE_DEV_BACKEND_HOST or whatever FD-57's tag-targeting has
  retired vs. retained), not the SG rule alone.

## §2 Re-run execution record

- **A′:** memory of record 1,910 MiB total at t3.small; bare idle 209;
  tree empty, no resurrect state; driver + both v1.41 evidence logs
  survived the stop/start; disk 2.7G free.
- **B1′:** loader second field execution (5 DB_* exports, values dark);
  direct-path scoped starts (B3-revised verbatim); health FIRST attempt —
  simultaneously field-proving the minted rule. Loaded-idle 367;
  process footprints matched yesterday's within 3 MiB (api 135.7 vs 138.2,
  worker 113.1 vs 114.4) — resident footprint is class-independent.
- **C1′ formal baseline:** 374 MiB (20 samples @15s, spread 7, band
  368–375). Budget at bar: 1,679 − 374 = 1,305 MiB.
- **C2′:** sampler @5s (pid 1162, outside the pm2 cgroup); driver under
  PM2, identical artifact to v1.41's (63 lines, on-disk survivor).
  Iterations 4.0–6.0s, FLAT for the full run — no stall signature.
  Run length >1 hour of sustained load (sampler timestamps 13:31->14:47),
  exceeding the ~10-minute spec; equilibrium held throughout.
- **C3′ evidence (dual-channel, gaps closed):**
  - VmHWM read WHILE PIDS ALIVE (v1.41's substitute-evidence gap closed):
    driver 802,224 kB (≈783 MiB); api 177,988 kB (≈174 MiB); worker
    166,304 kB (≈162 MiB).
  - Sampler max: 1,121 used / 617 avail — 558 under the bar; the
    pre-registered 1,638–1,679 scoring window was never approached.
  - OOM: clean — `sudo dmesg` (privileged, NO stderr redirect; the v1.41
    FD-51 class structurally cannot fire), grep exit 1. Note: dmesg
    cleared at stop/start, so this attests the new boot only, which is
    the boot under test.
  - Restarts: ↺ 0 all three; NEITHER event class fired (kernel kill: none
    in dmesg; cap-restart: API at 143 MiB never approached its live 1G
    PM2 cap).
- **C4′ teardown to true substrate:** driver deleted; api + worker stopped
  THEN DELETED (stopped-in-tree definitions are FD-54 seed material — a
  future un-namespaced restart would resurrect them with a dead shell's
  env; empty tree is the ruled end-state); sampler killed; all four
  evidence logs (c1/c2 and c1-prime/c2-prime) preserved in the clone;
  pm2 save NOT run (resurrect ban stands; the stale dump is correct).

## §3 Verdict, FD-27, and §5.2 numbers of record

**PASS on all three criteria at t3.small.**
Criterion 1: peak 1,121 (sampler) / 783 driver VmHWM ≤ 1,679 — dual-channel,
558 MiB margin. Criterion 2: zero OOM, privileged read. Criterion 3: zero
restarts, either class.

**Bar ruling (pre-registered before the run):** the contract's §6.1 equation
is internally off — 80% of 2048 MiB = 1,638.4, but the written figure is
"≤ 1.64 GiB" = 1,679. Consistent with v1.41's criterion-1 scoring (literal
contract figure), the bar of record is 1,679, with peaks in 1,638–1,679 to
be scored explicitly against this ruling. Moot at 1,121, but the ruling
stands for any future re-measurement.

**FD-27: REVISE** (per G2 v1.3 §6.1 step 4 and §8 criterion 2): locked
instance class is **t3.small**, changed from t3.micro on §4.2 field
evidence (v1.41 FAIL kernel-attested; this revision's PASS with margin).
Cost: α adder becomes ~$22–30/month per §6.1 arithmetic, accepted.

**§5.2 numbers of record:** idle baseline 374 MiB · synthetic peak 1,121
(system) / 783 (driver VmHWM) · workload footprint 747 MiB. For the
audit trail: t3.micro's 913 MiB total could never have held the 747 MiB
footprint plus the 378 baseline — the v1.41 FAIL was arithmetic destiny.

## §4 Corrections and disclosures

- **AF dev-leg AMENDMENT:** F-Deploy-G1-AF's claim of 5432-from-0.0.0.0/0
  on the dev RDS SG (sg-002578912805d1930) is CONTRADICTED by live
  enumeration 2026-07-14: four specific ingress rules, no wildcard.
  Either the wildcard was removed between the 05-28 discovery and the
  07-10 W1 session, or AF misattributed it to this SG. AF's prod/staging
  legs are UNTOUCHED by this read and stand as filed; only the dev leg is
  amended. (This correction also felled the first draft of the W1 ruling's
  leg 2, which argued from the stale AF filing — caught in review before
  execution; the drafter's stale-register reasoning is the disclosure.)
- **Gate-skip, ride-along family SIXTH occurrence:** the class-change
  draft gated modify on `stopped` CONFIRMED; modify fired while the poll
  still showed `stopping`, and the confirmation read never happened.
  Outcome correct (AWS saw the instance stopped by arrival), path
  uncontrolled — "succeeded anyway" is the family signature. Recorded.
- **Paste-transit mangling, continued:** B1′'s start-command echo garbled
  identically to v1.41's B3 instance; acquitted without a pm2 env read
  this time via footprint matching (both processes within 3 MiB of
  yesterday's). The display-layer class persists across sessions.
- **Owed: IP-bearing doc sweep.** 98.93.190.74 is dead; every artifact
  carrying it is stale as an address (historical citations remain valid
  AS history). Live-reference sweep: memory/onboarding docs, session
  briefs, any runbook or draft naming the dev box by IP. The known_hosts
  entry pair is a minor local item. Sweep rides the next housekeeping
  pass; the register itself is self-correcting (this revision carries
  the new IP).
- **G2 Implementation doc revision OWED (named, not silent):** G2 v1.3 §3
  pre-wrote this exact scenario — "§4.2 reveals t3.micro is insufficient
  -> §4.1 must commit to t3.small, requiring a revision. Path A:
  substantive plan changes require version bump" — and §6.1 step 4
  carries the same note. This revision discharges the FIX PLAN side
  (FD-27 REVISE, §8 criterion 2); the IMPLEMENTATION doc's §4.1 still
  locks t3.micro, and §4.3 executes against that doc as its contract.
  Disposition: **G2 Implementation v1.4 (§4.1 class-commit bump to
  t3.small, citing v1.41 FAIL + this revision's PASS as the §6.1-step-4
  evidence) ships as its own doc-only PR BEFORE §4.3 opens** — the §4.3
  session must not open against a contract that contradicts the register.

## §5 Retained

v1.36–v1.41 in full. Prerequisite register: P1–P3 CLOSED, P4 folds to
first dispatch (loader now twice field-proven), P5 CLOSED-placeholder.
deploy-dev.yml runtime: `disabled_manually`, unchanged — re-enablement is
now the frontier's own gate, PROPOSABLE at §4.3. FD-61 OPEN, parked.
Cutover-inherits-six (v1.40 §3) unchanged; prod certbot cleanup
~mid-August stands. v1.41 §3's blocking inputs (a)(b) are DISCHARGED by
this revision; (c) the doc sweep is carried in §4 above.
Frontier: G2 Implementation v1.4 (class-commit bump, own PR) -> §4.3 —
re-enablement ruling (proposable) + first dispatch.

## §6 Register hygiene

Tail at open: FD-61. Minted: none (sgr-069e6deadaa82f08a is an AWS
resource with its disposition ratified in-register, not an FD). Closed:
§4.2 gate (PASS); §6.1 fallback (executed); W1 revoke-or-ratify
(discharged); the minted rule's bounded disposition (ratified). Revised:
FD-27 (t3.small). Amended: AF dev-leg. Writes this session: five AWS
control-plane calls (revoke, stop, modify, start, authorize) + on-box
(app starts, driver run, teardown to empty tree); zero repo writes
before this revision. FD-21 check on commit message. Ships
[skip-automerge] in title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.42.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-14. Predecessor: v1.41 (371d12f6, #930).*
*Closed: §4.2 (PASS at t3.small), §6.1, W1, rule disposition (ratified).*
*Revised: FD-27 (t3.small). Amended: AF dev-leg. Minted: none. Tail: FD-61.*
*Frontier: G2 Implementation v1.4 (own PR) -> §4.3 — re-enablement ruling*
*(proposable) + first dispatch.*
*Box: i-016395bb5f7a51a0b @ 184.73.130.72, t3.small, substrate-only.*
*[skip-automerge]*