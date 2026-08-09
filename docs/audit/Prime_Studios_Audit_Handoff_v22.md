# Prime Studios Audit Handoff v22

| | |
|---|---|
| **Predecessor** | v21 (`baa2f10d`, #998) — the last general-state handoff. |
| **Basis** | `fc59d277`. |
| **Author date** | 2026-08-09 |
| **Type** | **POINTER-FIRST GENERAL-STATE.** This document names the current authorities and records one ruling made since v21. It restates no keystone detail and derives no keystone status beyond what the named authorities say on their own faces. |
| **Gate effect** | None. Orientation only. Changes no gate, no unit disposition, no PR state, no sequence. |

## Sec 0 — Why v22 exists

v21 merged on 2026-08-09 and surfaced one open question it correctly declined to answer: the §4 sequencing question. **That question has since been ruled** by `F-AUTH-1_Fix_Plan_v2.38.md`. v22 records the ruling, corrects one factual reading in v21 §3, and carries forward what remains.

v22 is thin for v21's reason: a general-state document that restates keystone detail rots at the speed of the terrain it describes. Where this document and a named authority disagree, **the authority wins** — a permanent rule, not a disclaimer.

**Live state beats docs beats memory.** v22 included.

## Sec 1 — Current authorities

Derive from these. Do not derive from this document, and do not derive from memory.

| Layer | Authority on main | Asserts |
|---|---|---|
| F-AUTH-1 | `F-AUTH-1_Fix_Plan_v2.38.md` | Backend CLOSED at CP12; Tracks G3–G6 open; rules v21 §4 |
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.48.md` | **KEYSTONE CLOSED** (G2, Phase B, items 7/8 all closed at v1.48) |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.31.md` | Phase B live; plan-of-record |
| F-App-1 | `F-App-1_Fix_Plan_v1.1.md` | SHIPPED 2026-05-14; non-gating |
| Cross-keystone | `Cross_Keystone_Register.md` | XK-1 owned; fix unevaluated |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | 48 exposed tables; measurement of record |
| Production-environment items | `Session_PE_Roster.md` | Running PE list |

Numbered registers are additive-supersede: later revisions build on earlier ones, which remain on main as historical record. Merged documents are never edited in place; corrections prepend a banner and preserve the body.

## Sec 2 — v21 §4 sequencing question: RULED

**Ruling instrument: `F-AUTH-1_Fix_Plan_v2.38.md` §1.3. Option A — parallel execution ratified.**

The locked sequence is not revised; it is clarified. F-AUTH-1's Tier 0 precedence is a rule about shipping mutation-route changes onto an unauthenticated surface. That surface closed at CP12, so the precedence rule was satisfied — not suspended. F-Deploy-1 and F-Stats-1 Phase B do not contend with auth-middleware disposition; their proceeding was correct and is ratified.

Forward, per v2.38 §1.3: keystones whose work does not ship mutation routes onto an unauthenticated surface may proceed in parallel with F-AUTH-1's open deployment tracks. Keystones that do must verify against the CP12-G1 condition first. Adjudication is per keystone, on the record, in that keystone's own register.

**v21 §4 is closed. It does not carry forward.**

## Sec 3 — Keystone standing

Status per the Sec 1 authorities, on their own faces. No status is derived here.

| Keystone | Standing |
|---|---|
| F-AUTH-1 | **Backend CLOSED** at CP12 (v2.38 §1.4). Deployment OPEN: Track G3 → Track G4 → Track G5 → Track G6. Track G5 structurally gated on prod freeze. |
| F-Deploy-1 | **CLOSED** (Fix Plan v1.48). |
| F-App-1 | SHIPPED 2026-05-14, incident-driven, out of sequence. Non-gating. §12.11 residue unowned; tracked at PE #62. |
| F-Stats-1 | Phase B live. Item 6 CLOSED with carve-out; items 23 and 36 open. |
| F-Ward-1 | Queued. **No `F-Ward-*` artifact exists in `docs/audit/`** as of `fc59d277`. Inherits XK-1 exposure on `episode_wardrobe`, `episode_wardrobe_defaults`. |
| F-Reg-2 | Queued. |
| F-Ward-3 | Queued. Inherits XK-1 exposure on `outfit_sets`, `outfit_set_items`. |
| F-Franchise-1 | Queued. Director Brain is this keystone's resolution, not a separate build. |
| F-Sec-3 | Queued. Last in sequence. |

**Correction to v21 §3.** v21 recorded F-AUTH-1 as "Artifact on main (v2.37; §5.1 pre-flight deliverable #715, 2026-05-26)" and declined to claim start/closure status. That reading is superseded by v2.38 §1.2: the 2026-05-26 pre-flight is F-AUTH-1's starting line, not its latest state. v21 stands otherwise; nothing else is withdrawn.

## Sec 4 — Live hazards

Carried from the named authorities. Do not treat as complete; the authorities govern.

- **Boot-path inline DDL — PE #62 / F-Stats-1 §31.** `src/server.js:146–164` executes untransacted DDL against `shows` on every non-test boot. `npm start` and `npm run dev` are unsafe pending resolution. Containment recorded at F-Stats-1 v1.29 was an **environment change on one workstation** with no repository file changed; the hazard is unremedied for every other environment. Admitted to the cross-keystone register's criteria; **not yet an entry** — it requires its own ratifying revision.
- **XK-1 — `paranoid` exposure.** 48 model tables. Owned, fix unevaluated. Any remedy touches a FROZEN prod and requires its own gated window.
- **PE #14 — `origin/main..origin/dev` divergence.** 81 commits divergent as of `baa2f10d`. Content divergence on the swept route files is **not established** by hash comparison. Per v2.38 §1.2, per-file inspection against `origin/dev` is owed at Track G4. PE #14 owns the gap.
- **Prod.** Treat as FROZEN. Confirm freeze status live before any prod-touching action. Prod schema was **not** enumerated by the XK-1 probe; prod exposure is unverified and must not be assumed either way.
- **RDS identity.** Never trust instance names. Confirm identity live via `current_database()` / `inet_server_addr()` / VPC before any DB-touching action.
- **Working-tree register zeroing — cause unknown, UNEXPLAINED.** On 2026-08-09, `docs/audit/Cross_Keystone_Register.md` was found zeroed (0 bytes) in the local working tree. The session that found it had made no write to that path. Restored via `git checkout origin/main --`; `git status --short` clean afterward, no other file affected. **The repository was never affected** — `origin/main` always held the intact 6,580-byte file, and nothing was committed. The mechanism is not established. **Check this file's byte length on wake before relying on it.**

## Sec 5 — Naming collisions in `docs/audit/`

Live as of `fc59d277`. First reference in any document must carry the origin label in full.

- **`F-Deploy-1_Fix_Plan_v1.31.md` and `F-Stats-1_Fix_Plan_v1.31.md` both exist.** Bare "v1.31" is ambiguous. Both keystones' registers are numbered `v1.n` and overlap across most of the range.
- **Open item 40 (F-Stats-1)** — the XK-1 origin — is unrelated to **FD-40 (F-Deploy-1)**, subject of `F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md`.
- **`Prime_Studios_Audit_Handoff_v20.md`** and **`Prime_Studios_Session_Handoff_v20_2026-06-15_FD40.md`** are different documents in different series.
- **`F-Deploy-1_Fix_Plan_v1.19_NOTES.md`** sits inside the numbered series without being a revision.
- **NEW — Track 6 / Step 3 CP-namespace collision (F-AUTH-1).** Per v2.38 §2.3: `CP10` denotes both Track 6 StoryEvaluationEngine and a Step 3 CP; `CP11` denotes both Track 6 PressPublisher and a Step 3 CP. Both tracks are closed (Track 6 at CP2–CP15, Step 3 at CP12); no forward collision is possible and no renaming is warranted. First reference must carry the track label in full — "Track 6 CP11", "Step 3 CP12".
- **NEW — G-namespace (F-AUTH-1).** Per v2.38 §2.2, bare `G<n>` is ambiguous and must not be used in any F-AUTH-1 document. Forward: **`CP12-G1`…`CP12-G6`** = CP12's program-wide verification greps (retrospective, closed); **`Track G3`…`Track G6`** = deployment stages (forward, open).

**Numeric sort is required on all `v1.n` / `v2.n` filenames.** String sort places v1.10–v1.48 before v1.2. Use a `[version]` cast.

## Sec 6 — Checklist for the v23 author

- [ ] `git fetch origin` / `git log --oneline -1 origin/main` / `gh pr list`. Any remembered hash is stale by design.
- [ ] Re-derive the current revision of every register in Sec 1. **Numeric sort.** Do not assume v2.38 / v1.48 / v1.31 are still current.
- [ ] Check `Cross_Keystone_Register.md` byte length (expect ~6,580, not 0) per Sec 4.
- [ ] Has F-AUTH-1 advanced past Track G3? Track G5 requires a gated prod window.
- [ ] PE #14 — has per-file `origin/main..origin/dev` inspection happened at Track G4?
- [ ] Has PE #62 / XK-2 been ratified into the cross-keystone register?
- [ ] Does any `F-Ward-*` artifact now exist? If so, it must reference the paranoid inventory and XK-1 — that reciprocal obligation is recorded at XK-1 and discharged only by that reference.
- [ ] F-Stats-1 items 23 and 36 — disposition.
- [ ] Confirm SAL Episode 1 status. "The Honey Table" is deprecated; replacement was TBD at last record.
- [ ] Confirm prod freeze status live. Do not infer it from this document.

## Sec 7 — Housekeeping carried

- **`deploy-dev.yml` push-trigger re-enablement remains a GATED decision.** Verify live: `git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"` — empty means disabled.
- **Parked-files note.** v21 Sec 8 superseded v15 Sec 3.16 on this point and established no replacement. Unchanged at `fc59d277`: both remain untracked-file questions, unresolvable against any commit.
- **PE roster** — `Session_PE_Roster.md` governs production-environment items. PE #62 is the standing unowned entry; PE #14 owns the dev→main propagation gap.
- **Cost audit warnings** surfaced by the pre-commit and pre-push hooks: high Claude API call density in `characterGenerationService.js`, `feedScheduler.js`, `promptCacheHelper.js`. Not filed anywhere as of `fc59d277`. Pre-push also surfaces 10 route files with async handlers possibly missing try/catch — likewise unfiled.

## Sec 8 — What this document does not do

- Does not derive or restate keystone status beyond the faces of the Sec 1 authorities.
- Does not rule on anything. Sec 2 records v2.38's ruling; it does not make one.
- Does not supersede or withdraw v21. Sec 3 corrects one reading; v21 stands otherwise.
- Does not change any gate, unit disposition, or PR state.
- Does not mint FD, PE, or XK numbers.
- Does not enumerate prod.
- **No live database contact.** Derived entirely from `git` against `origin/main` at `fc59d277`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `fc59d277`. Predecessor: v21.*
*Type: pointer-first general-state. Mints nothing. Decides nothing. Changes no gate.*
