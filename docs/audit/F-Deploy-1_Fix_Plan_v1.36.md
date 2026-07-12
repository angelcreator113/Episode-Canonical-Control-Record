# F-Deploy-1 Fix Plan v1.36

**G2 RECONCILIATION 2026-07-12: the FD-45 remediation window (v1.34) and P1 canon
close (v1.35) executed material portions of the G2 dispatch-prerequisite register
without scoring them against it — scored here. P3 CLOSES: `episode-metadata/dev/
database` born clean (v1.34 step 4), role read statement written and verified from
the dev box under the instance profile (v1.34 step 7, FD-58 executed), contents
independently validated byte-for-byte at v1.35 §1. P4 scored OPEN-CONFIRMED: true
empty per FD-51 (`git ls-tree origin/main scripts/` piped, empty at exit 0) —
`scripts/print-db-env.js` does not exist; the code PR was never opened. P1
corroborated live this session (`describe-instance-information` → Online). One
contract amendment recorded: G2 v1.3 §4.5 / §8 criterion 5 ("shared instance
contains only prod apps") collides with the standing Track B DB-2 decision — the
shipped ecosystem.config.js defines `episode-worker` as a deliberately shared,
non-split process. Criterion 5 is amended to: "shared instance's PM2 tree contains
no dev-ONLY apps" (`episode-api` dev, port 3002, is the retirement target;
`episode-worker` is excluded by prior decision, not by this revision's judgment).
Mints no FD. Register tail: EMPTY at open, EMPTY at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.35 (P1 canon close; merged #921, 4954677c) |
| **Author date** | 2026-07-12 |
| **Gate effect** | Closes prerequisite P3 (executed at v1.34, scored here). Confirms P4 open. Records the §4.5/criterion-5 amendment and the EPISODE_DEV_BACKEND_HOST orphan-secret disposition question. Restates the two-track frontier. Advances no other gate; authorizes no box action; fires no writes. |

**Basis (live reads 2026-07-12, this session):**
- `git log --oneline -1 origin/main` → 4954677c (v1.35, #921); `gh pr list` → none.
- Full-body reads from origin/main: Fix Plan v1.34, v1.35, v1.30, v1.32; G2
  Implementation v1.3; `.github/workflows/deploy-dev.yml` (rewrite at HEAD);
  `ecosystem.config.js` (pattern read: app names + dev markers).
- `aws ssm describe-instance-information` filtered Name=episode-dev-backend →
  `i-016395bb5f7a51a0b  Online` (P1 corroboration).
- `git ls-tree origin/main scripts/ | Select-String "print-db-env"` → empty,
  `$LASTEXITCODE` 0 — true empty per FD-51 (P4 basis).

## §1 Prerequisite register — state after this revision

| # | Prerequisite | State | Authority |
|---|---|---|---|
| P1 | Instance role SSM perms + registration | CLOSED (v1.32 §2) | Corroborated live this session: Online |
| P2 | GitHub OIDC provider + `episode-gha-deploy-dev` role | OPEN | v1.32 §5; no later record touches it. Gated IAM writes, own draft. Natural next enablement action |
| P3 | Secret + role read statement | **CLOSED here** | v1.34 steps 4+7 (FD-58 executed; dev-box read under profile: `username: episode_app_dev`); v1.35 §1 byte-validation |
| P4 | `scripts/print-db-env.js` | OPEN, absence confirmed | FD-51-clean read this session. Code PR, separate, own review. Note: the workflow's DB-env model is dead until P4 lands — first dispatch is structurally blocked here even if P2/P5 close first |
| P5 | Nginx provisioning on episode-dev-backend | OPEN | Unread. Read/verify first; provision if absent (gated dev-box action). Folds naturally into the §4.2 on-box session |

## §2 Contract amendment — G2 v1.3 §4.5 / §8 criterion 5

The contract (2026-05-26 origin) predates Track B DB-2 ("Shared WORKER (one) —
no prod/dev split", ecosystem.config.js on main). Read literally, criterion 5
can never be satisfied without reversing DB-2 — a decision G2 has no standing to
reverse. Amended reading, recorded here (contract text not edited, per house
convention): §4.5.2 retires dev-ONLY app definitions from the shared box
(`episode-api`, port 3002, and its nginx/dev-site surfaces); `episode-worker`
is out of §4.5 scope by prior decision. §8 criterion 5 reads accordingly. The
worker's future home (stays shared vs. splits) is a Track B question, not a G2
close blocker. Related carried item (v1.34 S4): worker stopped-state
investigation owed before any start — unchanged.

## §3 Orphan secret — EPISODE_DEV_BACKEND_HOST

Provisioned at §4.1 (v1.28 era), never referenced: the #917 rewrite targets by
instance tag and carries no host secret (spec delta recorded in the workflow
header). Disposition question parked for a future revision: delete (secret-
retirement discipline per v1.32 §4.1, consumer-syntax grep first) or retain as
documented-inert. No urgency; it points at nothing executable.

## §4 §4.1 gate — deliberately unscored here

Instance running (live), SSH reachable (v1.32 Branch B), IAM/secret leg proven
(P3 above). Remaining §4.1 gate elements are on-box facts (PM2 daemon state,
process tree). Scoring them from record prose would be FD-49-species; they are
owed as live reads at the top of the §4.2 session, which opens the box anyway.

## §5 Frontier after this revision — two independent tracks

- **Track 1 (hard gate): §4.2 memory synthetic.** Dev-box patch+reboot first
  (`/var/run/reboot-required` per v1.28 basis; SSM registration expected to
  survive reboot, verified in passing per v1.32 §5 note). Then the synthetic
  per G2 §4.2/§5.2 (pass ≤ 820 MiB, zero OOM, zero restarts). §4.1 residual
  gate elements verified at session open (§4 above).
- **Track 2 (dispatch enablement): P2 → P4 → P5.** P2 OIDC writes (own gated
  draft); P4 code PR (own review); P5 nginx verify. Order among them free;
  first dispatch blocked until all three close AND re-enablement passes its
  own Rule 7 gate (v1.28 §5, unchanged, untaken, unproposed).
- Burn-in (§4.4) clocks from first successful dispatch serving dev workload;
  §4.5 retirement (as amended §2) follows a clean burn-in; §4.6 closes G2.

## §6 Retained

v1.29–v1.35 in full. G2 Implementation v1.3 as contract, with: §4.1 443/80 line
struck (FD-57, v1.30); §4.6 host-secret disposition executed (v1.32 §3); §4.5/
criterion 5 as amended at §2 above. Freeze posture: unchanged (v1.20 verbatim).
deploy-dev.yml runtime: `disabled_manually`, re-enablement untaken/unproposed.
Carried obligations per v1.35 S4, unchanged except as scored here.

## §7 Register hygiene

Tail at open: EMPTY. Minted: none. Closed: prerequisite P3 (register state
change, live-verified authority; not an FD). Tail at close: EMPTY. FD numbers
minted only by Fix Plan revisions — conforms. Doc-only revision; zero writes
fired this session (all reads read-only). FD-21 check on commit message ("CLOSES
P3" is register-status form; no closing keyword adjacent to #N). Ships
[skip-automerge] in title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.36.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-12. Predecessor: v1.35 (4954677c, #921).*
*Closed: prerequisite P3. Minted: none. [skip-automerge]*