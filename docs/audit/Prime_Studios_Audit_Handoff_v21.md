# Prime Studios Audit Handoff v21

| | |
|---|---|
| **Predecessor** | v15 (`bc721809`, #761) — the last **general-state** handoff. |
| **Basis** | `4b743941`. |
| **Author date** | 2026-08-09 |
| **Type** | **POINTER-FIRST GENERAL-STATE.** This document names the current authorities and rules on the handoff series. It restates no keystone detail and derives no keystone status beyond what the named authorities say on their own faces. |
| **Gate effect** | None. Orientation only. Changes no gate, no unit disposition, no PR state, no sequence. |

## Sec 0 — Why v21 exists, and why it is thin

**The defect:** there has been no general-state handoff since v15 (2026-06-04). Sixty-six days.

Per-keystone governance never lapsed — F-Deploy-1 ran to Fix Plan v1.48, F-Stats-1 to v1.31, and a cross-keystone register opened on 2026-08-09. What lapsed is the layer *above* them: the map that says which registers are live, what each one currently asserts, and what is queued behind them. Every keystone had a home. The thing spanning the keystones did not.

**Why v21 does not restate:** v15 was comprehensive and accurate on the day it merged, and it rotted at the speed of the terrain it described. A general-state document that restates keystone detail inherits that failure mode by construction. v21 therefore **points**. Where this document and a named authority disagree, **the authority wins** — and that is a permanent rule, not a disclaimer.

**Live state beats docs beats memory.** v21 included.

## Sec 1 — Current authorities

Derive from these. Do not derive from this document, and do not derive from memory.

| Layer | Authority on main | Asserts |
|---|---|---|
| F-Deploy-1 | `F-Deploy-1_Fix_Plan_v1.48.md` | **KEYSTONE CLOSED** (G2, Phase B, items 7/8 all closed at v1.48) |
| F-Stats-1 | `F-Stats-1_Fix_Plan_v1.31.md` | Phase B live; plan-of-record |
| Cross-keystone | `Cross_Keystone_Register.md` | XK-1 owned; fix unevaluated |
| XK-1 evidence | `Paranoid_Exposure_Inventory_2026-08-07.md` | 48 exposed tables; measurement of record |
| F-AUTH-1 | Fix Plan v2.37 + `#715` pre-flight deliverable | Artifact on main; live plan on main; implementation state should be read from the plan rather than inferred here |
| Production-environment items | `Session_PE_Roster.md` | Running PE list |

Numbered registers are additive-supersede: later revisions build on earlier ones, which remain on main as historical record. Merged documents are never edited in place; corrections prepend a banner and preserve the body.

## Sec 2 — Ruling on the handoff series

**v16 through v20, and the `Audit_Handoff_Delta_*` documents dated 2026-07-03 through 2026-07-05, are `[3]`-window session-state. They are not general-state handoffs, and they do not supersede v15 as general state.**

Evidence on their own faces: v17 is labelled "prerequisites-only"; v20 carries four sections, all scoped to the `[3]` window (Branch B, credential refutation, `inet_server_addr`, runbook corrections) and none of v15's Sec 8 registry, Sec 9 checklist, or Sec 10 housekeeping. The July deltas cover id-4 quarantine, `dump.pm2` verification, dev realign, and Rule 7 deviations.

**Consequence for the two documents that call themselves "addendum to v15."** The 07-03 and 07-04 deltas cite v15 as parent while v16–v20 had already landed (v20 on 2026-06-13). That citation is **correct as to general state** — v15 was and remained the last general-state handoff — and the appearance of a fork comes from the two series sharing one numbering line with no scope marker. No fork exists. Nothing is withdrawn.

**Convention going forward:** general-state handoffs take the `Prime_Studios_Audit_Handoff_vN` name. Session-state documents take a scope-bearing name (`Audit_Handoff_Delta_<date>_<scope>`, or `<Keystone>_<Window>_Handoff`). The two series must not share a numbering line again.

## Sec 3 — Keystone standing

Status per the authorities in Sec 1, on their own faces. No status is derived here.

| Keystone | Standing |
|---|---|
| F-AUTH-1 | Artifact on main (v2.37; §5.1 pre-flight deliverable `#715`, 2026-05-26). Live plan on main; this handoff does not claim start/closure status beyond the plan's own wording. See Sec 4. |
| F-Deploy-1 | **CLOSED** (Fix Plan v1.48). |
| F-App-1 | SHIPPED 2026-05-14, incident-driven, out of sequence. Non-gating. §12.11 residue unowned; tracked at PE #62. |
| F-Stats-1 | Phase B live. Item 6 CLOSED with carve-out; items 23 and 36 open. |
| F-Ward-1 | Queued. **No `F-Ward-*` artifact exists in `docs/audit/`** as of `4b743941`. Inherits XK-1 exposure on `episode_wardrobe`, `episode_wardrobe_defaults`. |
| F-Reg-2 | Queued. |
| F-Ward-3 | Queued. Inherits XK-1 exposure on `outfit_sets`, `outfit_set_items`. |
| F-Franchise-1 | Queued. Director Brain is this keystone's resolution, not a separate build. |
| F-Sec-3 | Queued. Last in sequence. |

## Sec 4 — Open sequencing question (SURFACED, NOT DECIDED)

The locked sequence is: **F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 → F-Sec-3.**

Three facts, each independently supported:

1. F-Deploy-1 is CLOSED (Fix Plan v1.48).
2. The latest committed F-AUTH-1 audit artifact on main is v2.37, and the latest touched commit for the relevant F-AUTH-1 audit files is `19ddeb98`; this handoff does not infer a start/closure state beyond that.
3. F-Stats-1 Phase B proceeded and remains live through v1.31 (2026-08-09).

Prior handoffs recorded F-AUTH-1 as the intended lead of the post-F-Deploy execution sequence. Whether that ordering was deliberately revised during the F-Deploy-1 v1.2x–v1.48 run is **not established by this document**, and no revision reviewed for v21 states it.

**v21 does not decide this.** Sequence is a Fix Plan's ruling, not a handoff's. What v21 records is that the question is live, that it has been live since F-Deploy-1 closed, and that it needs an explicit decision on the record rather than resolution by default.

## Sec 5 — Live hazards

Carried from the named authorities. Do not treat as complete; the authorities govern.

- **Boot-path inline DDL — PE #62 / F-Stats-1 §31.** `src/server.js:146–164` executes untransacted DDL against `shows` on every non-test boot. `npm start` and `npm run dev` are unsafe pending resolution. Containment recorded at F-Stats-1 v1.29 was an **environment change on one workstation** with no repository file changed; the hazard is unremedied for every other environment. Admitted to the cross-keystone register's criteria; **not yet an entry** — it requires its own ratifying revision.
- **XK-1 — `paranoid` exposure.** 48 model tables. Owned, fix unevaluated. Any remedy touches a FROZEN prod and requires its own gated window.
- **Prod.** Treat as FROZEN. Confirm freeze status live before any prod-touching action. Prod schema was **not** enumerated by the XK-1 probe; prod exposure is unverified and must not be assumed either way.
- **RDS identity.** Never trust instance names. Confirm identity live via `current_database()` / `inet_server_addr()` / VPC before any DB-touching action.

## Sec 6 — Naming collisions in `docs/audit/`

Live as of `4b743941`. First reference in any document must carry the origin label in full.

- **`F-Deploy-1_Fix_Plan_v1.31.md` and `F-Stats-1_Fix_Plan_v1.31.md` both exist.** Bare "v1.31" is ambiguous. Both keystones' registers are numbered `v1.n` and now overlap across most of the range.
- **Open item 40 (F-Stats-1)** — the XK-1 origin — is unrelated to **FD-40 (F-Deploy-1)**, subject of `F-Deploy-1_Register_Integrity_Tripwire_FD40_Orphan_DRAFT.md`.
- **`Prime_Studios_Audit_Handoff_v20.md`** and **`Prime_Studios_Session_Handoff_v20_2026-06-15_FD40.md`** are different documents in different series.
- **`F-Deploy-1_Fix_Plan_v1.19_NOTES.md`** sits inside the numbered series without being a revision.

**Numeric sort is required on all `v1.n` filenames.** String sort places v1.10–v1.48 before v1.2. Use a `[version]` cast.

## Sec 7 — Checklist for the v22 author

- [ ] `git fetch origin` / `git log --oneline -1 origin/main` / `gh pr list`. Any remembered hash is stale by design.
- [ ] Re-derive the current revision of every register in Sec 1. **Numeric sort.** Do not assume v1.48 / v1.31 are still current.
- [ ] Has the Sec 4 sequencing question been decided on the record? If yes, by which revision?
- [ ] Has F-AUTH-1 moved past the 2026-05-26 pre-flight deliverable? Check current main revisions and any later implementation commits.
- [ ] Has PE #62 / XK-2 been ratified into the cross-keystone register?
- [ ] Does any `F-Ward-*` artifact now exist? If so, it must reference the paranoid inventory and XK-1 — that reciprocal obligation is recorded at XK-1 and discharged only by that reference.
- [ ] F-Stats-1 items 23 and 36 — disposition.
- [ ] Confirm SAL Episode 1 status. "The Honey Table" is deprecated; replacement was TBD at last record.
- [ ] Confirm prod freeze status live. Do not infer it from this document.

## Sec 8 — Housekeeping carried

- **`deploy-dev.yml` push-trigger re-enablement remains a GATED decision.** Verify live: `git show origin/main:.github/workflows/deploy-dev.yml | Select-String -Pattern "^\s*push:"` — empty means disabled.
- **Parked-files note from v15 — SUPERSEDED ON THIS POINT.** v15 Sec 3.16 recorded
	`src/pages/` and `src/styles/LandingPage.css` as removed while untracked and
	unrecoverable by git. Working-tree check at 2026-08-09: `src/pages` absent;
	`src/styles/LandingPage.css` absent. A file exists at
	`frontend/src/styles/LandingPage.css` — **a different path**, whose relationship
	to the file v15 named is unestablished. Both remain untracked-file questions and
	cannot be resolved against any commit. v15's claim is not a current authority;
	this note does not establish a replacement.
- **PE roster** — `Session_PE_Roster.md` governs production-environment items. PE #62 is the standing unowned entry.
- **Cost audit warnings** surfaced by the pre-commit hook: high Claude API call density in `characterGenerationService.js`, `feedScheduler.js`, `promptCacheHelper.js`. Not filed anywhere as of `4b743941`.

## Sec 9 — What this document does not do

- Does not derive or restate keystone status beyond the faces of the Sec 1 authorities.
- Does not decide the Sec 4 sequencing question.
- Does not supersede, amend, or withdraw v15, v16–v20, or any delta. Sec 2 classifies; it does not retract.
- Does not change any gate, unit disposition, or PR state.
- Does not mint FD, PE, or XK numbers.
- Does not enumerate prod.
- **No live database contact.** Derived entirely from `git` against `origin/main` at `4b743941`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `4b743941`. Predecessor: v15 (last general-state).*
*Type: pointer-first general-state. Mints nothing. Decides nothing. Changes no gate.*
