# F-Deploy-1 — Cause Investigation: All PM2 Stopped on Prod Box (2026-06-30)

> **STATUS: UNCOMMITTED — PRE-COMMIT REVIEW REQUIRED. Do not cite as settled.**
> Authored by a warm session. The **signature reasoning** (Sec 1: daemon-intact = stop-not-death;
> 0-restarts = clean-stop-not-crash) reads off the live `pm2 list` and is sound on its face. The
> **cause ranking** (Sec 3) and the **off-record-standup** claim (Sec 4) are warm synthesis from
> prior-session records and were NOT independently verified by the publishing instance. Before
> commit, re-read fresh and confirm against the actual files: (a) #872 / `fd402b8d` did scope the
> deploy-dev cleanup to `episode-api episode-worker`; (b) no session outcome/handoff records the
> Step-4 / P1–P6 parallel standup; (c) the 06-25→06-30 window for id 4's appearance. Consider
> whether Sec 4 (Rule-7 mutation on frozen prod, no record) warrants promotion to its own finding
> rather than a section here. This banner is removed at commit once (a)–(c) are re-confirmed.

**Type:** Warm investigation note. Additive on `F-Deploy-1_Finding_PMState_AllStopped_2026-06-30.md`
(the live observation). Doc-only, no box mutation, no restart, no `pm2` action. Mints no FD,
supersedes nothing, advances no gate. Box stays FROZEN; FD-31 and FD-42 remain OPEN.

This note executes Sec 4 step 1 of the finding ("investigate cause — warm context appropriate").
It does **not** execute step 2 ("update finding with expected/unexpected root cause") — cause is
**not established** from records alone, so neither label is honestly available. It narrows the
hypothesis set, ranks by the on-box signature already observed, surfaces one separate concern, and
specifies the read-only live reads that would close cause. Gate 2.5 re-attempt is NOT performed
(precondition unmet — see Sec 5).

---

## Sec 1 — The signature we already have (from the finding's live `pm2 list`)

| id | name | mode | restarts | status |
|---|---|---|---|---|
| 0 | `episode-api` (dev/3002) | cluster | 2 | stopped |
| 1 | `episode-worker` | fork | 4 | stopped |
| 3 | `episode-api-prod-hotfix` (prod/3000) | fork | 0 | stopped |
| 4 | `episode-api-parallel` | fork | 0 | stopped |

Three facts read straight off this table, no inference:

1. **Daemon is intact, all four entries present-but-stopped.** The PM2 daemon is alive and still
   holds all four process definitions (names, modes, restart counts). This is the signature of a
   `stop`, **not** of a daemon death, a bare reboot without resurrect (which empties the list), or
   a missing-startup-unit (same — empty list).
2. **Prod (id 3) and parallel (id 4) stopped cleanly — 0 restarts.** id 3 carried 0 restarts while
   online for ~weeks (per #776 / 06-11 and the 06-25 handoff); it went online → stopped with no
   restart bump. id 4 likewise 0. A **clean stop** does not increment the restart counter; a crash
   or crash-loop does. **Prod did not crash-loop.** It was stopped.
3. **Dev (id 0, id 1) carry restart churn.** id 1 `episode-worker` went 0 (06-25) → 4 (06-30);
   id 0 went 1 → 2. The churn is confined to the two **dev** processes. Whatever incremented these
   did not touch prod's or parallel's counters.

## Sec 2 — Topology delta since the last clean record

| date | source | processes online |
|---|---|---|
| 06-11 | #776 Gate2.5 re-verify | id 0, id 1, id 3 (no id 4) |
| 06-25 | Step 3 handoff | id 0, id 1, id 3 — "all pm2 processes untouched" (no id 4) |
| 06-27 | ParallelTree construction spec | spec only — directory + Step-4 standup *planned*, not executed |
| 06-30 | AllStopped finding | id 0, id 1, id 3, **id 4 `episode-api-parallel`** — all stopped |

**id 4 appeared between 06-25 and 06-30.** Its name (`episode-api-parallel`) and the 06-27
construction spec's target (`/home/ubuntu/episode-metadata-parallel/`, Step 4 = "stand up the
parallel process") are the obvious match: id 4 is almost certainly the Step-4 process.

## Sec 3 — Ranked cause hypotheses (warm; none closeable from docs)

**H1 — A `pm2 stop all`-class event (best fit).** The observed signature (daemon intact, every
entry stopped, prod+parallel at 0 restarts = clean stop) is exactly what `pm2 stop all` produces.
A concrete known vector for this exact string exists in the record: the deploy-dev cleanup block
*as originally written* used `pm2 stop all` (`F-Deploy-1_Finding_TrapScope_PM2Discipline_2026-06-28`
Sec 2), which would stop prod + parallel + dev together. **Caveat that weakens the workflow path
specifically:** that bug was fixed and merged to `origin/main` (#872 / `fd402b8d`) — the canonical
`deploy-dev.yml` cleanup is now scoped to `pm2 stop episode-api episode-worker` (line 295), which
would **not** stop prod or parallel. So a *current-HEAD* deploy run does not fit the all-stopped
signature; only a *pre-fix* workflow run, or a *manual* `pm2 stop all` (e.g. during parallel-standup
or cutover staging), does. H1 is the mechanism; the agent (old workflow run vs. manual stop) is
undetermined.

**H2 — Deliberate operator stop / staging stop.** id 4 was stood up off-record (Sec 4). Whoever
stood it up may also have stopped the set as a staging step (e.g. quiescing before a planned
cutover, or backing out a parallel-standup test). Consistent with the clean-stop signature; cannot
be distinguished from H1 without the actor's own record or PM2 logs.

**H3 — Reboot.** A reboot *with* a configured pm2 startup unit + `pm2 save` taken while stopped
would resurrect the set as stopped. A reboot *without* resurrect would instead leave an **empty**
`pm2 list` — which is **not** what we see — so plain-reboot-without-resurrect is largely excluded by
the daemon-intact signature. Reboot remains possible only in the save-while-stopped variant; low
prior, but cheap to rule out with `uptime`.

**Excluded by the signature:** prod crash-loop (id 3 = 0 restarts), daemon death / missing startup
unit (list would be empty, not stopped).

The dev-only restart churn (Sec 1 fact 3) is a secondary signal compatible with H1's pre-fix
workflow variant (the trap's `startOrRestart` retries touch only the two dev processes by name) but
does not by itself decide between H1/H2/H3.

## Sec 4 — Separate concern surfaced (higher priority than the stop itself)

**id 4 `episode-api-parallel` is on the box with no execution record.** Searched `docs/` for any
session OUTCOME/handoff recording that the 06-27 construction spec's P1–P6 + Runbook Sec 7A Step 4
were executed: only the *spec/runbook/master* planning docs match — **no execution record exists.**
`episode-api-parallel` is mentioned in exactly one doc: the 06-30 finding that observed it.

Standing up a parallel process is a **Rule 7 box mutation** (construction spec is explicit: "Every
box-touching line is a discrete Rule 7 gate"). A Rule-7 mutation occurred on a FROZEN box with no
draft→confirm→execute record. This is independently worth operator triage regardless of why the
processes are now stopped: either the construction window executed off-record (a freeze-discipline
gap to reconcile), or id 4 arrived by some other path that needs explaining. Flagging, not
resolving — same posture as the finding.

## Sec 5 — Gate 2.5 re-attempt: NOT performed (precondition unmet)

The user's task was "gate 2.5 re-attempt **once there's a live process to reference**." That
precondition is **not met** and this session does not create it:

- Gate 2.5 reads **3a** = `pm2 env 3 | grep -i db_password` — the in-memory canon credential of the
  **running** id 3. With id 3 stopped, 3a does not exist. The 3a==3b comparison cannot be made with
  the required semantic guarantee (finding Sec 2). Gate 2.5 is **BLOCKED, not failed** — unchanged.
- **Bringing a process back online is not a warm-session action.** A `pm2 start`/`startOrRestart`
  is a Rule-7 mutation on a FROZEN box, and for id 3 specifically it is adjacent to the single
  irreversible cutover action (Step 3 handoff: "the single irreversible action of F-Deploy-1").
  This warm investigation does **not** start, restart, or `pm2`-mutate anything.

Gate 2.5 re-attempt therefore stays deferred to whenever the operator — in a properly gated window,
not this one — brings id 3 back online. At that point 3a is available again and the re-attempt is a
read-only 3a==3b confirm per #750.

## Sec 6 — To close cause: read-only live reads (operator, on box)

Cause is genuinely not closeable from records (the canonical stale-but-coherent posture: records
narrow, live decides). The following are all **read-only**, no mutation, and would close it:

- `uptime` and `who -b` — rule H3 in or out (recent boot vs. multi-week uptime).
- `pm2 jlist` / `pm2 describe 3` — `pm_uptime`, `created_at`, and `axm_actions`/exit metadata for
  id 3 and id 4; gives id 4's actual creation time (corroborates the off-record standup window).
- `pm2 logs --lines 200` (or `~/.pm2/logs/*`) and `pm2 prettylist` — look for the stop event and
  whether it was `stop all` vs. scoped, and any error preceding the dev churn.
- GitHub Actions run history for `deploy-dev.yml` since 06-25 — confirm whether any workflow run
  fired (push to `dev` or manual dispatch) and, if so, whether it predated the #872 scoping fix.
- `curl -sS -o /dev/null -w '%{http_code}' https://primepisodes.com/health` — answers the finding's
  open "is the site serving?" (nginx may serve independently of PM2 state).

None of these is gate 2.5 and none requires touching id 3's process state.

---

## Sec 7 — What this note did / did not do

- DID: read warm records (conclusion-bearing handoffs, specs, prior gate records) and the live
  `pm2 list` already captured in the finding; narrowed cause to H1/H2 (clean-stop family), largely
  excluded crash-loop and plain-reboot; surfaced the off-record id-4 standup.
- DID NOT: restart, reload, `pm2`-mutate, edit any `.env`, run any live box read, perform gate 2.5,
  enter [3], or mint an FD. Box untouched; freeze stands; FD-31 and FD-42 remain OPEN.

---
*Warm cause-investigation, 2026-06-30. Additive on the AllStopped finding. Doc-only, no mutation,
no gate advanced. Cause narrowed, not closed — live reads in Sec 6 decide. Gate 2.5 stays BLOCKED:
no live process to reference, and this session does not create one. [skip-automerge]*
