# F-Deploy-1 — Cause Closed: AllStopped = Pre-#872 Deploy-Dev Workflow Cascade (2026-07-01)

> **STATUS: UNCOMMITTED — PRE-COMMIT REVIEW REQUIRED. Do not cite as settled.**
> This note closes the one variable the 06-30 cause-investigation left open (H1 agent:
> old-workflow-run vs. manual stop). The closure rests on three live-read correlations
> (auth.log SSH bursts, `~/.pm2/pm2.log` stop event, GitHub Actions run ledger). Before
> commit, re-confirm: (a) `gh run view 28289470503` still shows `attempt:2`,
> `updatedAt:2026-06-27T14:12:35Z`, `conclusion:failure`; (b) the pm2.log 12:34:50 line
> stopping **all four** processes is quoted accurately from the box's own log; (c) the
> secret-clobber lines still read as cited in `deploy-dev.yml` at current HEAD. This banner
> is removed at commit once (a)–(c) are re-confirmed fresh.

**Type:** Closing evidence note. Additive on `F-Deploy-1_PMState_AllStopped_CauseInvestigation_2026-06-30.md`
(warm investigation, narrowed-not-closed) and its parent `F-Deploy-1_Finding_PMState_AllStopped_2026-06-30.md`
(live observation). Doc-only, no box mutation, no `pm2` action, no `.env` edit, no gate advanced.
**Mints no FD.** Supersedes nothing. Box stays FROZEN; FD-31 and FD-42 remain OPEN.

This note executes the 06-30 investigation's Sec 6 read-only closure path. It resolves **cause of the
stop**. It does **not** resolve the separate id-4 off-record-standup concern (06-30 note Sec 4), which
stays open and is only *time-tightened* here (Sec 5 below).

---

## Sec 1 — What this closes

The 06-30 investigation ranked H1 (`pm2 stop all`-class event) best-fit but left its **agent
undetermined**: *"only a pre-fix workflow run, or a manual `pm2 stop all` ... fits. H1 is the
mechanism; the agent (old workflow run vs. manual stop) is undetermined."* Its Sec 6 named the
read that would decide: the deploy-dev run ledger since 06-25, and whether any run predated the
#872 / `fd402b8d` scoping fix.

**Closed: the agent is a pre-#872 `deploy-dev.yml` run on 2026-06-27.** Not a manual stop. The
full autonomous chain:

**autonomous `claude/**` doc-PRs → `Auto-merge to Dev` (App-token push, deliberately wired to
cascade) → `Deploy to Development` → SSH into the shared prod/dev box → pre-fix `pm2 stop all` →
both deploy attempts FAILED → box left all-stopped.**

## Sec 2 — Correlation ledger (three independent surfaces agree)

Local auth.log ≈ UTC. Two source PRs, both doc-only (Phase2A construction spec; AG write-quiescence
finding) — neither carried `[skip-automerge]`, so both cascaded.

| UTC | Surface | Event |
|---|---|---|
| 12:30:19 | Actions | `Auto-merge to Dev` pushes to `dev` (run A) |
| 12:31:17 | Actions | `Deploy to Development` triggered by the `dev` push (run A) |
| **12:34:32–58** | **auth.log** | **Attempt-1 SSH burst — 20.169.74.224 (aligns with the stop-all)** |
| **12:34:50** | **`~/.pm2/pm2.log`** | **Old workflow stops ALL FOUR — incl. `episode-api-prod-hotfix` (prod/3000)** |
| 12:40:02 | Actions | `Auto-merge to Dev` pushes to `dev` (run B) |
| 12:40:14 | Actions | `Deploy to Development` triggered (run B) — this is run id `28289470503` |
| **12:43:25–50** | **auth.log** | **Attempt-1 second SSH burst — 52.159.247.49 (aligns with the 12:50–13:01 restarts)** |
| 14:12:35 | Actions | run `28289470503` **attempt 2** (manual re-run of failed deploy), `conclusion:failure` |
| **14:12:07–26** | **auth.log** | **Attempt-2 SSH burst — 40.76.119.208 (executes final stops)** |
| **14:12:40–58** | **auth.log** | **Attempt-2 SSH burst — 20.127.238.81 (executes final stops)** |

The 14:12 bursts had no matching *new* run row because a re-run preserves the original `createdAt`
(`2026-06-27T12:40:14Z`) and bumps only `attempt` + `updatedAt`. Verified:
`gh run view 28289470503 --json attempt,updatedAt,createdAt,conclusion` →
`{"attempt":2,"updatedAt":"2026-06-27T14:12:35Z","createdAt":"2026-06-27T12:40:14Z","conclusion":"failure"}`.
Ledger closes: run-attempt timestamp matches the final SSH bursts and final stops exactly.

## Sec 3 — Why "touches prod" survives, and why current HEAD does NOT fit the signature

- **Naming:** committed `ecosystem.config.js` makes `episode-api` **dev** (3002) and
  `episode-api-prod-hotfix` **prod** (3000). Any prior note labeling `episode-api` "prod" is inverted.
- **"Touches prod" holds on direct evidence, not naming:** the 12:34:50 pm2.log line stops **all four**,
  `episode-api-prod-hotfix` included. **Prod was stopped on 06-27.**
- **Current-HEAD `deploy-dev.yml` would NOT reproduce this.** The cleanup was scoped by #872 /
  `fd402b8d` to `pm2 stop episode-api episode-worker` ([deploy-dev.yml:295](../../.github/workflows/deploy-dev.yml#L295)),
  which stops neither prod nor parallel, and a `restore_pm2` EXIT trap
  ([deploy-dev.yml:347-352](../../.github/workflows/deploy-dev.yml#L347-L352)) restarts the two dev
  processes on any exit. So the all-four signature fits **only the pre-#872 (06-27) workflow state** —
  which is exactly what the ledger dates it to. The 06-28 fix is current state, not incident state.

## Sec 4 — Secret-clobber finding (why this path is disqualifying for the [3] window)

`deploy-dev.yml` does more than restart — it **writes three of the nine rotation secrets into the
box `.env` from GitHub Secrets, then restarts with `--update-env`:**

- `write_env_key` for `ANTHROPIC_API_KEY`, `FAL_KEY`, `REMOVEBG_API_KEY`
  ([deploy-dev.yml:431-442](../../.github/workflows/deploy-dev.yml#L431-L442)), values from
  `secrets.*` ([deploy-dev.yml:264-266](../../.github/workflows/deploy-dev.yml#L264-L266)) —
  grep-out-old + append-new into `$APP_DIR/.env`.
- then `pm2 startOrRestart ... --update-env` re-reads that `.env`.

**Collision with the rotation:** a `claude/**` doc-PR merging mid-[3] would **overwrite the
freshly-rotated on-box `.env` values for ANTHROPIC / FAL / REMOVEBG with whatever is in GitHub
Secrets at that instant, and restart PM2 to load them** — directly clobbering Surface 2 (on-box
`.env` write) and pre-empting Surface 3 (gated restart) of the rotation. This is not merely a
"processes left down" risk; it is a **secret-clobber + uncontrolled-restart** risk against the
rotation itself. No values are recorded here (masked-handling rules); the finding is the mechanism.

## Sec 5 — Two secondary concerns surfaced

1. **`restore_pm2` EXIT trap vs. an intentionally-held freeze.** The trap restarts `episode-api` +
   `episode-worker` on *any* deploy exit, including failure. On a box we are deliberately holding
   **stopped**, a future failed deploy would bring the dev processes back **up** — the trap fights the
   freeze. The structural disable (Sec 6) covers this too: no trigger → no deploy → no trap.
2. **id-4 standup window tightened (concern stays open).** The 06-30 note Sec 4 flagged
   `episode-api-parallel` (id 4) as an off-record Rule-7 standup, dated only "between 06-25 and
   06-30." The 12:34:50 pm2.log stops **all four**, so **id 4 already existed by 06-27 12:34:50** —
   tightening the window to *before* that time. The concern is unchanged in kind: still no
   draft→confirm→execute record for the standup. The workflow cascade explains the **stop**, not the
   **standup** — these remain two separate events. Flagging, not resolving.

## Sec 6 — New abort-precondition (git-verifiable, cold-session re-derivable)

Before the [3] window opens:

> **PRECONDITION: the `deploy-dev.yml` SSH path is structurally disabled, verifiable from git.**

**Closure = Option 1 (disable the `deploy-dev` trigger), not Option 2 (pull the SSH secret)** —
chosen for cold-session verifiability. A [3] session with no inherited context must be able to
re-derive this precondition live in **one binary check** — expected result is **empty output**
(the file's only `push:` is commented), so it is pass/fail with no interpretation:

```
git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"
```
(bash equivalent, also expected-empty:
`git show origin/main:.github/workflows/deploy-dev.yml | grep -nE '^[[:space:]]*push:'`)

Option 2 (removing `EC2_SSH_KEY` / `DEV_EC2_HOST`) verifies only through GitHub *settings* state —
off-pattern, and easier for a cold session to check wrong. `[skip-automerge]` is per-commit author
discipline (exactly what the two 06-27 PRs failed to include) — **not** a structural block; it does
not satisfy this precondition.

## Sec 7 — What this note did / did not do

- **DID:** ran the 06-30 Sec-6 read-only closure (run ledger + auth.log/pm2.log correlation);
  closed the stop's cause to a pre-#872 06-27 deploy-dev cascade; surfaced the secret-clobber
  finding and the two secondary concerns; specified the new git-verifiable abort-precondition.
- **DID NOT:** restart, reload, `pm2`-mutate, edit any `.env`, run any box mutation, edit any
  workflow (the `deploy-dev.yml` disable is a *separate* PR, Rule-7 confirm-before-push), enter [3],
  or mint an FD. Box untouched; freeze stands; FD-31 and FD-42 remain OPEN.

---

## Forward pointers

- **Workflow-edit PR (next):** comment out `push: branches: [dev]` in `deploy-dev.yml` with a dated
  block comment pointing at **this** record. `[skip-automerge]` in the PR title (moot — the PR branch
  is not `claude/**`, so auto-merge does not fire regardless). Rule-7 confirm-before-push.
- **Merge order:** this record first (so the edit's comment has a committed target), then the
  workflow-edit PR. #876 rides along or after — separate decision.

---
*Closing cause-note, 2026-07-01. Additive on the 06-30 AllStopped investigation. Doc-only, no
mutation, no gate advanced. Stop cause CLOSED (pre-#872 deploy-dev cascade); id-4 off-record standup
remains OPEN and time-tightened. New abort-precondition specified, git-verifiable. [skip-automerge]*
