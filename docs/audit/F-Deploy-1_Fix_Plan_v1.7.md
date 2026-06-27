# F-Deploy-1 Fix Plan v1.7

**Registers FD-35 / F-Deploy-G1-AI from the 2026-05-30 prod auto-deploy incident; records the auto-deploy path containment; no gate moves**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.6 (FD-31-FD-34, Sec 4.2 re-blocked on split-brain, merged via PR #724) |
| **Incident reference** | `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (repo root, merged via PR #729) |
| **Hazard record reference** | `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root, Sec 7 incident note, merged via PR #730) |
| **Author start date** | 2026-05-30 |
| **Author session** | Single session, post-incident-containment |
| **Status** | DRAFT v1.7 |
| **Gate transition** | None. v1.7 registers one new finding (F-Deploy-G1-AI = FD-35) surfaced by the 2026-05-30 incident, and records the containment. No gate closes; none moves. The prod box remains frozen; Sec 4.2 remains BLOCKED on FD-31. |

## Sec 1 Purpose

v1.7 records into the decision register the finding surfaced by the 2026-05-30 prod auto-deploy incident, and notes the containment already applied. Specifically:

1. **FD-35 / F-Deploy-G1-AI registered.** The automated deploy path (Auto-merge to Dev -> Deploy to Development) reaches the FROZEN prod box via shared-compute wiring and reloaded the prod process on 2026-05-30. Named as a candidate in the incident doc and hazard doc Sec 7; formally assigned here. Detail in Sec 4.

2. **Containment recorded.** Both `Deploy to Development` and `Auto-merge to Dev` workflows were disabled (`gh workflow disable`) on 2026-05-30. No PR can now trigger a deploy to the prod box. Detail in Sec 3 / Sec 4.

3. **Registry-drift note extended.** v11 Sec 3.10 flagged that the audit doc (`F-Deploy-1_G1_Audit.md`) tails at finding AA while live findings run further. AI extends that drift; the v12 registry-reconciliation owed list grows by AI. Detail in Sec 5.

What v1.7 does NOT do:
- **Does not advance or close any gate.** Sec 4.2 remains BLOCKED on FD-31. Phase B G2 close remains far off.
- **Does not touch, restart, reboot, deploy to, or edit `.env` on the prod box.** The freeze (hazard doc, do-not list, now including the automated-deploy trigger at Sec 3 item 9) is inherited and reaffirmed.
- **Does not re-enable the disabled workflows.** Re-enabling is a reconciliation-gated decision (hazard doc Sec 3 item 9).
- **Does not "fix" the prod box's post-incident degraded state** (port 3002, route-loading bug, overwritten `pm2 save`). Any fix is another process reload -- deferred to gated reconciliation.
- **Does not originate FD-35.** Per the established convention, v1.7 records a finding surfaced during execution and cites the incident doc (PR #729) as its source, rather than claiming to originate it.

## Sec 2 Reference documents

| Document | Section reference | Role in v1.7 |
|---|---|---|
| `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (repo root, PR #729) | Full doc; Sec 8 (follow-ups) | Source of FD-35 / F-Deploy-G1-AI. v1.7 formalizes its candidate finding into the register; does not restate the incident detail. |
| `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root, PR #730) | Sec 3 item 9 (do-not re-enable workflows); Sec 7 (incident note) | The freeze, now covering the automated-deploy trigger. v1.7 inherits and cites it. |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.6.md` (main, PR #724) | Sec 6 (FD-31-FD-34); Sec 9 (AG assignment, AH off-by-one) | Immediate predecessor. v1.7 inherits the register through FD-34 and the AG/AH lineage. |
| `docs/audit/Prime_Studios_Audit_Handoff_v11.md` (main, PR #726) | Sec 3.10 (G1 registry drift); Sec 8 (F-Deploy-G1-AG) | v11 assigned AG and flagged the registry drift. v1.7 extends the drift note with AI. |

## Sec 3 What shipped between v1.6 and v1.7

The 2026-05-30 prod auto-deploy incident (full record: incident doc, PR #729). In brief: an untagged `claude/**` PR (#728) triggered Auto-merge to Dev, whose push to the dev branch triggered Deploy to Development, which reached the prod box `episode-backend` (`54.163.229.144`) via shared-compute wiring and reloaded the frozen process (`pm2 delete all` + `pm2 start --env development` + `pm2 save` + a migration step that found nothing to run). No data lost -- the reload picked up `DB_HOST` from the deploy's `DEV_DB_HOST` secret (= the live `episode-control-dev` instance), not the on-disk `.env` (= empty `-prod`); raw count post-incident confirmed 72 episodes / 10 shows intact. The good outcome was luck (correct secret), not the freeze holding.

Contained the same session: both `Deploy to Development` and `Auto-merge to Dev` workflows disabled via `gh workflow disable`, confirmed via `gh workflow list`. Hazard doc updated (PR #730) to add the automated-deploy trigger to the freeze (Sec 3 item 9) and record the breach (Sec 7). Incident doc committed (PR #729).

## Sec 4 Decisions log -- addition FD-35

v1.6 ended at FD-34. v1.7 adds FD-35.

- **Decision FD-35: The automated dev-deploy path is a prod-reload trigger and is disabled until reconciliation; the `[skip-automerge]` commit tag is not a sufficient guard. Sub-finding F-Deploy-G1-AI (P0).** The Auto-merge to Dev -> Deploy to Development workflow chain reaches the prod box `episode-backend` via shared-compute wiring (the same single-EC2 coupling as F-Deploy-G1-G), and runs automatically on any untagged `claude/**` PR. On 2026-05-30 an untagged PR (#728) triggered it, reloading the frozen prod process (no data loss -- see Sec 3 and the incident doc). The freeze documentation prior to this incident guarded only against MANUAL restart/reboot/deploy/.env-edit; the automated path was unanticipated. The `[skip-automerge]` tag, relied on across PRs #723-#727 to prevent the dev round-trip, is a fragile guard (depends on remembering to tag every commit; #728 demonstrated the failure). The durable fix is structural: both workflows DISABLED (`gh workflow disable "Deploy to Development"`, `gh workflow disable "Auto-merge to Dev"`), confirmed via `gh workflow list`. Re-enabling them, and gating them so they cannot reach the prod box, is a reconciliation-gated decision. NOTE: `Deploy to Production` remains active -- a third potential path to the prod box, not in the 2026-05-30 fire path; freeze hardening should assess it. (Incident doc PR #729; hazard doc Sec 7 PR #730.)

## Sec 5 Registry-drift note (extends v11 Sec 3.10)

v11 Sec 3.10 recorded that the canonical audit doc `F-Deploy-1_G1_Audit.md` tails at finding F-Deploy-G1-AA, while live sub-findings run further (AB-AF in the Fix Plans / G2 contract, AG assigned in v11). AI now extends the drift: live G1 sub-findings run AB-AG plus AI (AH is a documented off-by-one slip from v1.6 Sec 9, never a real finding -- it is "burned," not assignable). The audit doc reflects none of AB-AI.

The v12 registry-reconciliation owed list (v11 Sec 9 checklist) therefore grows: reconcile the audit doc to the actual committed finding set AB-AG + AI, and record AH as a void/slip so a future author does not try to assign it.

## Sec 6 State of play at v1.7 close

| Tier | Item | Status |
|---|---|---|
| Phase A | Overall | CLOSED (inherited) |
| Phase B G1 | Gate close | CLOSED (inherited) |
| Phase B G2 | Sec 4.2 memory profile (hard gate) | BLOCKED on FD-31 (inherited from v1.6; unchanged) |
| Phase B G2 | alpha implementation overall | BLOCKED behind FD-31 reconciliation |
| Reconciliation | Schema-fork resolution | PLANNED, gated, unauthorized -- own session, backup-first |
| Prod box | `episode-backend` | FROZEN + DEGRADED (reloaded by 2026-05-30 incident: port 3002, route bug; see incident doc). Cleanup folds into reconciliation. |
| Deploy workflows | Deploy to Development / Auto-merge to Dev | DISABLED 2026-05-30 (FD-35). Re-enabling reconciliation-gated. |
| Deploy workflows | Deploy to Production | ACTIVE -- third potential prod path; assess at freeze hardening. |
| Register | FD entries | FD-1 through FD-35 (v1.7 adds FD-35) |
| G1 sub-findings | live set | AB-AG + AI live; AH = void slip; audit doc still tails at AA (v12 reconcile) |

**Path A discipline note:** FD-35 adds no scope to the fix cycle. It is a finding surfaced during execution (the incident), recorded with the recording-not-originating discipline v1.5/v1.6 applied to prior findings. F-Deploy-G1-AI is the live, demonstrated form of the shared-compute coupling already named in F-Deploy-G1-G. No new keystone, no redesign.

## Sec 7 Ship plan

1. **v1.7 PR** on branch `claude/f-deploy-1-fix-plan-v1-7`, new file `docs/audit/F-Deploy-1_Fix_Plan_v1.7.md` alongside v1.0-v1.6 per versioned-retention, commit tagged `[skip-automerge]`, FD-21-checked message. (Note: the deploy workflows are disabled, so the tag is belt-and-suspenders, but the discipline is restored.)
2. Required checks green (Cost Exposure Audit, Tests, Route Validation; Auto-merge to Dev no longer runs, being disabled) -> confirm -> squash-merge.

---
*Fix Plan revision v1.7. Registers FD-35 / F-Deploy-G1-AI from the 2026-05-30 prod auto-deploy incident; records the workflow containment; extends the v11 registry-drift note. Advances no gate, authorizes no prod-box action. The freeze stands; the deploy workflows stay disabled until reconciliation.*