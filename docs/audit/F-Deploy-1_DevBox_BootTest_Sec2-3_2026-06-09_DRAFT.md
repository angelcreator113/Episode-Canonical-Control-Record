# F-Deploy-1 — Reconciliation Plan Sec 2 #3 (clean origin/main boot): RESULT (DRAFT v0.1)

> **READ-ONLY ANALYSIS RESULT. AUTHORIZES NO BOX ACTION. CHOOSES NO STRATEGY.**
> This note records the outcome of the dev-box boot test that answers Reconciliation
> Plan Sec 2 **#3** ("does clean origin/main boot against the live .env/RDS, dev-tested").
> The result is GREEN. This note records the GREEN, the safety evidence, and the
> consequence for the B-vs-C fork. It does NOT select a strategy (that is Evoni's, and
> #3-GREEN does not retire C's other hazards), authorizes no prod-box action, and
> schedules no session. Prod box stays FROZEN; FD-31 legs stand; [3] not primed.

| | |
|---|---|
| **Trigger** | Reconciliation Plan Sec 2 #3, repurposed into the (empty) Plan Session 2 slot per the 2026-06-08 strategy-revisit note (Sec 5). |
| **Method** | Dev box `i-016395bb5f7a51a0b` (`ip-172-31-19-114`) only. Node-direct foreground boot (`node src/server.js`) from a clean clone at `~/boot-test/`. NOT PM2, NOT ecosystem.config.js (its `cwd`/`script` point at `~/episode-metadata`, not the test clone). No prod box touched. |
| **Target DB** | Canon (`episode-control-dev`), per Plan/FD-31 (.env is canon-only; no -prod creds on box). Credential: canon master, freshly rotated 2026-06-09, auth-proven, settled `available`. |
| **Status** | DRAFT v0.1 — analysis complete; write-up pending review. No execution. Not canon. No strategy chosen. |

---

## Sec 0 — Headline

Clean origin/main (HEAD `931526af`, verified by hash against origin/main; `git status` clean) **boots successfully** against the populated canon DB on the dev box. **Sec 2 #3 is GREEN.**

The result was obtained without any schema mutation, confirmed in-log (not merely assumed from flag absence). The boot reached ready/listen state on the expected dev port (3002) and was stopped cleanly (foreground kill; no PM2 process registered, no `dump.pm2` interaction).

---

## Sec 1 — GREEN evidence

- Clone state verified clean before boot: `On branch main`, up to date with origin/main, working tree clean, HEAD `931526af`.
- DB connection authenticated against canon (freshly-rotated credential + canon master user).
- Server reached ready state: started, bound `0.0.0.0:3002`, "ready to accept requests."
- Process stopped cleanly after classification (foreground kill). No residue.

---

## Sec 2 — No-schema-mutation safety proof (in-log, not assumed)

The standing hazard for a boot against *populated canon* was schema mutation (sync/alter/create). The log confirms it did not occur, and confirms *why*:

- `ENABLE_DB_SYNC = undefined` (flag absent, as composed)
- `DB_SYNC_FORCE = undefined` (flag absent, as composed)
- App-emitted: "Skipping model sync (database already initialized)" — the app saw the populated canon DB, recognized it as initialized, and declined to sync.

This upgrades the safety case from "flags absent → should be safe" (pre-boot reasoning) to "app explicitly declined to mutate the canon schema" (observed). The abort-on-sync watch was held throughout and never triggered.

---

## Sec 3 — Expected degradations (non-blocking; validate the minimal-.env strategy)

Three degradations appeared at boot. All were anticipated by the minimal-`.env` composition (cost/external integrations deliberately omitted), and none blocked boot:

1. **Redis unavailable** (`ECONNREFUSED 127.0.0.1:6379`) — no Redis on the dev box; queue/export degraded gracefully. Confirms boot does not hard-depend on Redis.
2. **`ANTHROPIC_API_KEY` unset** — AI features warned unavailable. Deliberately omitted; confirms AI is lazy/degraded-not-required at boot (consistent with the Cognito lazy-init pattern).
3. **Template Studio route load warning** — see Sec 4.

Collectively these validate the minimal-`.env` approach: boot does not require the external/cost-incurring integrations.

---

## Sec 4 — Template Studio warning observation (possible [3] component signature)

Boot emitted a non-fatal warning during route load: `The "url" argument must be of type string. Received undefined`, associated with Template Studio route registration.

**Observation, not conclusion:** the [3] combined restart already scopes a "Template Studio route fix" as one of its three components. This boot-time warning is plausibly the same defect's signature (a route registering with an undefined URL). It is non-fatal (boot continued to ready state). Flagged for correlation with the [3] Template Studio item — to be confirmed against that item's definition, not assumed identical.

---

## Sec 5 — Fork status update: B-vs-C now ripe, still UNSELECTED

The 2026-06-08 strategy-revisit note narrowed the live reconciliation choice to **B vs C**, blocked on #3. #3 is now answered GREEN. Per that note's own conditional ("#3 GREEN → C becomes a genuine lighter-weight contender"), the fork is now **ripe** — it has the input it was waiting on.

**#3-GREEN does NOT select C, and retires none of C's other hazards.** The strategy-revisit note named the trap explicitly, and it stands: "nothing to lose" + "trivial delta" + "now it boots" → "just reset the box" is the seductive-but-wrong inference. The landmines remain fully intact:

1. C is still a **destructive operation on a live-serving box** (prod), not the idle dev box this test ran on. A green dev-box boot says nothing about the safety of the prod-box *transition*.
2. **Untracked `.env.bak*` files** on the prod box (Plan Sec 0) sit outside both this finding and Session 1's; a `clean`/`reset` interacts with untracked credential-bearing files dangerously.
3. **AG split-brain check** (post-op `DB_HOST=canon AND counts-match`) remains mandatory.
4. **Encoding direction-of-truth defect** (Session 1 Sec 4): a naive `git reset --hard origin/main` would regress the box's cleaner encoding to canon's mojibake + BOM.

The honest output: a **blocked fork became a ripe fork.** No strategy is chosen. Selection remains Evoni's, is a separate deliberate decision, and now has its gating input.

---

## Sec 6 — What this does NOT change

- Prod box stays **FROZEN.** "Do not reboot" stands.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** The box-mutating session still requires its own deliberate, backup-first window with a fresh abort re-verify at its start.
- The split-brain hazard (AG) is untouched.
- **No reconciliation strategy is chosen.** B vs C is ripe but unresolved.
- Read-only/dev-only result. Advances **understanding**, not prod execution; **not canon** until reviewed and placed under Rule 7.

---

## Sec 7 — Recommended register / handoff updates (DRAFTS — for Rule 7 execution separately)

- **Reconciliation Plan Sec 2:** record #3 as answered GREEN (dev-box, node-direct, canon target), with the in-log no-sync proof.
- **Reconciliation Plan Sec 4 / fork:** record B-vs-C as now ripe (gating input satisfied), still unselected; C's four non-#3 hazards explicitly carried forward as intact.
- **[3] register:** note the Template Studio boot-warning observation for correlation with the existing [3] Template Studio route-fix component (correlation to confirm, not asserted).
- **No fingerprint numbers inlined.** Point to the Plan, Session 1 Results, and the strategy-revisit note as authorities.

---
*Dev-box boot test answering Reconciliation Plan Sec 2 #3. Result: GREEN — clean origin/main (HEAD 931526af) boots against canon on the dev box, with in-log proof of no schema mutation ("Skipping model sync … already initialized"; both sync flags undefined). Three expected non-blocking degradations (Redis, ANTHROPIC_API_KEY, Template Studio route warning). Consequence: the B-vs-C reconciliation fork is now ripe (gating input satisfied) but UNSELECTED — #3-GREEN retires bootability-unknown only, not C's other hazards (live-serving destructive transition, untracked .env.bak*, AG split-brain check, encoding direction-of-truth). Prod box stays FROZEN; FD-31 open; [3] not primed; no box action authorized; not canon until Rule 7.*
