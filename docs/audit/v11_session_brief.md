# Prime Studios Audit Handoff v11 — Session Brief (Outline)

**Status:** Outline drafted 2026-05-20 during F-Deploy-1 Phase A G4 soak (day 1 of 7). Full v11 authoring targeted at ~2026-05-26 post-soak-close.

**Audience:** 60/40 future-Claude / Evoni-future-self, matching v10 §1.

**Scope:** Additive on v10. v10 remains canonical for any content v11 does not supersede.

**Format target:** `.docx` to match v9/v10 convention; outline in `.md` for working revisions.

**Length estimate:** ~15-20KB at full authoring (smaller than v10's ~32KB, given additive scope).

**Authoring convention introduced by v11:** Status-quo items get explicit "still deferred / unchanged" sections (§11, §12, §13). Future handoffs should maintain this — anything not named status-quo can be trusted as in-flux. v11 §0 should flag this convention so future authors know to carry it forward.

---

## §0 — Front matter

- Title block + date
- "What changed v10 → v11" callout (mirrors v10's "v9 → v10" callout)
- Quick-reference: this doc supersedes v10 on Sections [list]; v10 remains canonical elsewhere
- Authoring date, post-soak-close timestamp
- Status-quo-explicit convention flag (per outline header above)

---

## §1 — How To Use This Document

**Status:** Mostly carry-forward from v10 §1. Two small amendments.

- §1.1 wake-up sequence: update "Phase A pre-flight is the next executable gate" → "Phase A is CLOSED; F-AUTH-1 execution is the next gate" (assuming clean soak close)
- §1.2 use-cases: update "F-AUTH-1 still leads" → "F-AUTH-1 execution is now next-up after Phase A close"

---

## §2 — Keystone status (SUPERSEDES v10 §2.1 lines 74-92)

**Status:** Full keystone status rewrite. Most drift lives here.

For each keystone, update status from v10 framing to current state:

- **F-AUTH-1** — v10: "queued, unchanged from v9. F-AUTH-1 still leads Tier 0." → v11: "Artifact on main (v2.37 KEYSTONE CLOSURE merged 2026-05-09 via PR #664, rollback tag `rollback-main-f8744ecd-20260509`). Execution queued behind F-Deploy-1 Phase A close. Phase A closed [date]; F-AUTH-1 execution is the next gate. v2.37 §5.1 pre-flight grep deliverable should fold in the post-v8 surface drift captured in PE #51, #52."

- **F-App-1** — v10: "queued, unchanged. Decision #47 holds." → v11: "Shipped via incident-driven deployment 2026-05-14 (Path A per v1.1 §12.15). Code at commit 6bfd99e on prod backend EC2. v1.1 §12.15 documents the deviation. G6 soak ran from 2026-05-14T07:00 UTC; G6 formally closes when [criterion TBD — confirm before authoring]. §12.15.5 follow-up items: agent identification still open, DEV_DB_PASSWORD rotation [status TBD], stop-hook adjustment [status TBD], audit report postscript [status TBD]."

- **F-Stats-1** — v10: "Phase A CLOSED. Phase B blocked on F-Deploy-1 Fix Plan Phase A close per Decision #98." → v11: "Phase A CLOSED, Phase A G2 SHIPPED via PR #684 (commit 30f10fe7). Phase B G2 [unblocked / still-blocked per soak outcome]. Decision #98 still canonical."

- **F-Reg-2, F-Ward-1, F-Ward-3, F-Franchise-1, F-Sec-3** — likely all carry-forward from v10, but verify before authoring

- **F-Deploy-1** — v10: "G1 CLOSED. Fix Plan v1.0 CLOSED. Phase A pre-flight next." → v11: "G1 CLOSED, Fix Plan v1.0/v1.1/v1.2/v1.3 on main, **Phase A CLOSED at [G4 soak close timestamp]**. Phase B G1 architectural decision (separate-EC2 α vs shared-safe β) is the next executable gate. FD-1 through FD-25 captured across v1.0-v1.3."

---

## §3 — What v10 got wrong, what v10 missed (NEW SECTION)

**Status:** New section. Captures state-correction work from 2026-05-20 morning.

### §3.1 — F-App-1 status drift in v10

Per PE #53. v10 (authored 2026-05-16) describes F-App-1 as "queued, unchanged from v9." F-App-1 v1.1 (authored 2026-05-14) documents shipment via incident-driven deployment. v10 didn't fold in §12.15. Not a v10 defect at v10's evidence state — v1.1 may not have been merged when v10 was authored, or the v10 session didn't read it. v11 captures the correction.

### §3.2 — Commit-message vocabulary mismatch with handoff language

The phrase "KEYSTONE CLOSURE" appears in commit messages (e.g., 49e08e04 F-AUTH-1 Step 3 CP12, 1265d8c3 F-AUTH-1 v2.37) and means "this checkpoint closed; the work is on main as an artifact." It does NOT mean "the keystone has executed against production." v10's "queued" language for F-AUTH-1 is correct under this vocabulary distinction. Future-Claude reading git log without this context could easily misread. v11 flags this explicitly as a vocabulary glossary item.

### §3.3 — "Closure" semantics across fix-cycle documents

Five closure types observed through 2026-05-21, all valid:

- **Gate closure** (e.g., G1 audit, G2 sub-form ships): work completed through planned gate
- **Supersession** (e.g., G3 superseded by §4.3 of v1.3): work happened inline before the gate could execute
- **Incident-driven** (e.g., F-App-1 v1.1 §12.15.4 Path A): work arrived via incident, Path A accepts in place
- **Removal-sufficient** (e.g., F-Deploy-G1-Y per FD-22): symptom halted by removal without proving causation
- **Compensating-control** (e.g., `enforce_admins=false` per FD-5, identity drift per PE #58): defect capability remains; path to consequence intercepted by separate mechanism. Distinct fragility profile — needs future-revisit conditions documented at closure. Surfaced 2026-05-21 via F-Tools-1 §4.3; full definition in `v11_section_3_3_expansion.md` §3.3.5.

v11 treats these as named methodological patterns, reusable for future fix plans. Full vocabulary expansion (canonical examples, when-to-use / when-NOT-to-use, methodological caveats per type) lives in `docs/audit/v11_section_3_3_expansion.md` — folds into v11 §3.3.1 through §3.3.5 at v11 authoring time.

### §3.4 — F-Stats-1 v1.2 Decision #9 vs v10 Decision #98 revised: gate-strictness drift

Per PE #56. F-Stats-1 v1.2 Decision #9 (2026-05-15) named Phase B G2 as paused until F-Deploy-1 *keystone* lands; v10 Decision #98 revised (2026-05-16) relaxed the gate to F-Deploy-1 *Fix Plan Phase A close*. v10's relaxation is authoritative for current planning; v11 should explicitly call out the gate change so future-Claude reading Decision #9 cold doesn't apply the stricter framing. Resolution: documentation-only.

### §3.5 — `enforce_admins=false` vs Decision #9 admin-enforcement requirement

Per PE #57 (severity reclassified P1→P2 on 2026-05-21 afternoon after `enforce_admins` decision-archaeology). The shipped state matches F-Deploy-1 FD-5 exactly — `enforce_admins: false` is a deliberate design choice extensively documented in Fix Plan v1.0 §5.2.1 lines 387/394/918, reaffirmed in v1.1 line 304, and verified at ship in v1.3 §6.2. The drift PE #57 originally flagged is between F-Stats-1 v1.2 Decision #9's generic phrasing ("with admin enforcement") and FD-5's specific scope (solo-dev emergency-bypass rationale, no human-reviewer gate). v11 should reconcile Decision #9's phrasing to match FD-5's actual scope, or explicitly note that Decision #9's "with admin enforcement" generic framing was superseded by FD-5's deliberate choice. The `required_approving_review_count=0` sibling finding has the same framing — deliberate FD-5 choice (zero required reviews, solo-dev pattern), not a drift. No change to shipped state.

### §3.6 — Local-tooling identity drift status unknown

Per PE #58. F-Stats-1 v1.2 Decision #9 (2026-05-15) named "strategy for the local-tooling identity drift" as required F-Deploy-1 scope; no F-Deploy-1 Fix Plan revision (v1.0–v1.3) carries the requirement forward. Either self-resolved via per-commit `--author` workaround, latent under the workaround, or forgotten. v11 should call out the verification-owed status; a one-command `git log` check resolves it.

### §3.7 — Methodological pattern: filings against decisions need to read the decision's source

Twice during 2026-05-21 session work, findings were filed against prior decisions without first reading the decision's source document in full. Both produced filings that were substantively wrong and required verification + correction within the same session.

**Case 1 — PE #51 / PE #52 (morning):** Filed against F-AUTH-1 plan v2.37 §4.3 with inventory counts built from a partial grep, not a full-coverage grep. The F-AUTH-1 §5.1 pre-flight grep script surfaced both errors. Path A.1 rework took ~90 minutes and produced corrected verification amendments.

**Case 2 — PE #57 (afternoon):** Filed against F-Stats-1 v1.2 Decision #9 without reading F-Deploy-1 Fix Plan v1.0 §5.2.1 / FD-5. The Fix Plan extensively documented `enforce_admins=false` as a deliberate solo-dev design choice. `enforce_admins` decision-archaeology pass surfaced the documentation. Severity reclassified P1→P2 and framing rewritten.

**Pattern:** filing P0/P1 findings against decisions or fix plans without reading the source document produces filings that survive only until verification. The verification step *is* what catches them, not the filing process. The fix isn't "be more careful when filing" (filings always involve incomplete context) but "always run verification before treating a finding as authoritative."

**Implication for v11 §3.3 closure-semantic vocabulary:** Pre-closure discipline matters as much as closure discipline. The morning rework was filed under the **evidence-state-revision** pattern (§3.3.4 in the vocabulary expansion). The afternoon rework is the same pattern: original PE #57 framing was correct at its evidence state (had read Decision #9 but not FD-5); new evidence (FD-5's extensive documentation) shows the original evidence was incomplete; the entry is amended with the corrected framing while preserving the original for evidence-state continuity.

**Implication for v11 itself:** v11 authoring should run verification against any decision-referencing claims *before* lockdown. Both PE #51/#52 and PE #57 framings would have been caught at v11 lockdown if the same archaeology / grep discipline had been applied at v11 authoring time. The closure-semantic vocabulary in §3.3 already names this as "evidence-state-revision" methodologically; §3.7 promotes the pattern from incidental observation to operational discipline.

**Methodological cross-references:** v11 §3.3.4 (evidence-state-revision closure type), v11 §5 (methodological patterns, optional section).

---

## §4 — Fix sequence — current state (SUPERSEDES v10 §4)

**Status:** Rewrite §4.1-§4.4 with corrected sequence.

v10 §4 framed the sequence as linear:

> F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 → F-Sec-3

Actual current state is non-linear:

- F-AUTH-1 artifact shipped 2026-05-09, execution queued behind F-Deploy-1 Phase A close
- F-Deploy-1 Phase A closed [date at soak close]
- F-App-1 shipped via incident-driven path 2026-05-14 (out of sequence)
- F-Stats-1 Phase A shipped, Phase B unblocked at Phase A close

v11 §4 should:

- Document the actual ship order, including the F-App-1 incident-driven path
- Restate the *intended* downstream sequence (F-AUTH-1 → F-Stats-1 Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 → F-Sec-3) as the post-Phase-A-close order
- Note that the F-App-1 out-of-order ship doesn't break the broader sequence because F-App-1's structural change (schema-as-JS removal) doesn't depend on F-AUTH-1, F-Stats-1, or any downstream keystone

---

## §5 — Methodological patterns (NEW SECTION, optional)

**Status:** New section. Captures reusable patterns surfaced during v10 → v11 fix-cycle work. Optional — include only if v11 authoring has bandwidth.

Candidate patterns:

- **Evidence-state-relative decision tracking** (FD-22 superseding FD-19, both correct at their evidence states) — useful template for any future "we made the right call with the info we had, more info arrived" situation
- **Removal-sufficient closure** (FD-22) — useful when causation is expensive to establish but operational sufficiency is achievable
- **Incident-driven Path A** (F-App-1 v1.1 §12.15.4) — useful when off-path arrival of work is safer to accept than to revert
- **Backtick fencing test** (#708 reopen comment test) — useful for verifying parser behavior on text that might trigger automation

If included, this section becomes the kind of section future-Claude reads first when wondering "how do we close things in this project?" Worth the ~500 words.

---

## §6 — Session PE Roster cross-reference (UPDATE v10 §13)

**Status:** Update to reflect PE #50, #51, #52, #53 added 2026-05-20 + any other PE entries added during soak.

v10 reflected 15 PE entries (PE #27 through PE #49). v11 reflects [actual count at soak close — at minimum 19, possibly more if other PE-class items surfaced].

New content needed: PE-to-keystone pressure summary updated for v11. F-AUTH-1 pressure has grown (PE #51, #52 are pre-flight inputs); F-App-1 pressure has changed shape (most §12.15.5 items resolved or aged out).

---

## §7 — Decisions log (UPDATE v10 §7)

**Status:** Append new decisions since v10 to the log.

Items to fold in:

- **Decision #105+:** F-App-1 Path A acceptance (v1.1 §12.15.4) — predates v10 by 2 days but wasn't captured
- **FD-13 through FD-25:** F-Deploy-1 fix plan decisions across v1.1-v1.3 — currently live inside the fix plans, not surfaced into the handoff's main §7
- **Decision [new]:** F-Stats-1 Phase B G2 unblock confirmation at Phase A close [if applicable]
- **Methodological precedent decisions** (if §5 is included): naming evidence-state-relative tracking, removal-sufficient closure, etc., as canonical patterns

---

## §8 — Findings registry (CARRY-FORWARD v10 §11)

**Status:** Likely no changes to v8 audit findings. v9 added 27 F-Deploy-G1 findings; those carry forward. v10 added none. v11 likely adds none unless soak surfaces a new finding.

If soak surfaces a new finding → file as PE entry first, escalate to findings registry only if it's a v11-class architectural defect rather than an operational hygiene item.

---

## §9 — Trust-the-prior-session checklist (NEW for v11)

**Status:** New section. Modeled on v10_session_brief.md §6.

For v11 author (whether next-Claude or future-Evoni):

- [ ] Read v10 in full before authoring v11
- [ ] Read this outline alongside v10 for the v10 → v11 deltas
- [ ] Verify F-Deploy-1 Phase A closure on main (Phase A G4 soak ends 2026-05-26; confirm G4 closure timestamp)
- [ ] Spot-check the keystone status table against current main state
- [ ] Confirm PE roster entries from 2026-05-20 (PE #50-#53) and any post-soak additions are reflected
- [ ] Re-read §3 carefully — the v10 corrections section is the part most likely to drift again if soak surfaces unexpected state
- [ ] Confirm Episode 1 status before §12 authoring (see §12 below)

---

## §10 — Outstanding session-end housekeeping (NEW for v11)

**Status:** New section. Items deferred from v11 authoring to future work:

- F-AUTH-1 §5.1 pre-flight grep formal authoring (PE #51 + #52 are the inputs; the grep deliverable itself is its own document)
- F-Stats-1 Phase B G2 execution
- Phase B G1 architectural decision authoring (separate-EC2 α vs shared-safe β; the four-amendment Phase B G1 planning artifact drafted 2026-05-19/20 is the input)
- F-App-1 §12.15.5 follow-up items still open at v11 authoring time

---

## §11 — Director Brain design status (NEW SECTION, status-quo)

**Status:** Still deferred. v11 carries forward v10's framing.

Director Brain is the resolution of F-Franchise-1, the eighth keystone. v10 §2.1 line 88 names this; v10 §4 confirms Director Brain build comes "after F-AUTH-1 and the structural prerequisites land." At v11 authoring time, none of the upstream prerequisites have shipped in execution form:

- F-AUTH-1: artifact on main, execution gated behind F-Deploy-1 Phase A close (now passed at soak close, but execution itself is queued, not done)
- F-App-1: shipped via incident-driven path; doesn't gate Director Brain
- F-Stats-1 Phase B: blocked behind Phase A close; unblocking at v11 authoring time
- F-Ward-1, F-Reg-2, F-Ward-3: all queued, all upstream of Director Brain

Director Brain design content remains deferred. v11 does not introduce design material. The audit's keystone definition (F-Franchise-1 in v10 §2.1) and fix sequence (v10 §4 line 364) remain the authoritative input contract.

**Reference for future implementation:** Existing prior art for migrating JS-literal constants into DB tables is `migrations/20260725000000` (removed hardcoded `OVERLAY_TYPES`, moved to `ui_overlay_types` table). This is the pattern Director Brain build will extend to DREAM_CITIES, ARCHETYPES, SEED_GOALS, EVENT_TEMPLATES, phase titles, etc. v10 doesn't surface this in §2.1 or §4; v11 surfaces it here as the "Director Brain implementation will look like" preview, without committing to design work yet.

**Why this section is in v11 despite being status-quo:** Prevents future-Claude from misreading "v11 didn't mention Director Brain" as "Director Brain status changed." It hasn't. Status-quo explicit.

---

## §12 — Episode 1 status (NEW SECTION, conditional content)

**Status:** Conditional on v11 authoring-time confirmation.

**If Episode 1 details are confirmed by v11 authoring:**

The Honey Table is no longer Episode 1 of Styling Adventures with Lala (SAL). [New Episode 1 details captured here at authoring time.]

This is a content/canon update, not a code-state update. Affects:

- Onboarding doc (`NEW_CHAT_ONBOARDING.md` on main) — update Episode 1 reference
- userMemories — update memory entry naming Honey Table as Episode 1
- Any in-code references to "first episode" / "pilot" / "Honey Table" — sweep for staleness

**If Episode 1 details are NOT confirmed by v11 authoring:**

Episode 1 of SAL: The Honey Table is no longer Episode 1 (Evoni confirmed 2026-05-[date]; the shift to a different first episode is documented but the new Episode 1 is not yet named in canon). v11 captures the deprecation; new Episode 1 to be confirmed in v12 or via update to onboarding doc.

**Why this section is in v11 even if details are TBD:** The Honey Table → not-Episode-1 transition is a real canon-level change that affects code references and onboarding. Without v11 acknowledgment, the staleness lives only in Claude's memory (which doesn't persist reliably across sessions or audit doc readers). v11 surfaces it for the record.

---

## §13 — Character to Currency (C2C) status (NEW SECTION, status-quo)

**Status:** Still deferred. v11 carries forward.

C2C is Prime Studios' secondary product, architecturally separate from the LalaVerse / SAL flagship (own DB, own auth, own repo, own domain: charactertocurrency.com). Per Prime Studios product strategy: C2C remains fully deferred until SAL has an established following.

At v11 authoring time, SAL is not yet shipping episodes publicly — Episode 1 status itself is under canon revision (§12). No "established following" benchmark has been crossed. C2C remains deferred.

v11 does not introduce C2C content. v10 §2 (keystones list, lines 74-92) does not name a C2C keystone; v10 §4 (fix sequence, line 364) does not include C2C work. v11 maintains both omissions explicitly.

**Why this section is in v11 despite being status-quo:** Same logic as §11 and §12. Status-quo explicit prevents future-Claude from concluding "C2C wasn't mentioned, so C2C must have changed status." Also protects against scope-creep pressure — if at any future point someone (Claude or otherwise) suggests pulling C2C work into the active sequence, v11 §13 is the explicit "still deferred, here's why" reference.

---

## Outline notes for v11 author session

**Three things flagged for the v11 author session:**

1. **Verify all "TBD pending soak close" claims at authoring time.** The outline has multiple "[date]" and "[status TBD]" placeholders. Authoring at soak close means resolving these against actual state, not against expectations.

2. **§3 is the most valuable new section.** v10's drift on F-App-1 wasn't a defect — it was authoring-time freshness. v11's drift will be the same. Naming the *kinds* of drift (commit-vocabulary vs handoff-vocabulary, closure-semantic varieties) gives future-v12 author a vocabulary for catching v11's drift.

3. **§5 (methodological patterns) is optional but valuable.** If included, it becomes the kind of section future-Claude reads first when wondering "how do we close things in this project?"

**Authoring inputs available at soak close:**

- v10 handoff on main (`docs/audit/Prime_Studios_Audit_Handoff_v10.docx`)
- v10 session brief on main (`docs/audit/v10_session_brief.md`)
- F-Deploy-1 fix plans v1.0 through v1.3 on main (all in `docs/audit/`)
- F-App-1 v1.0 + v1.1 on main (incident postmortem in v1.1 §12.15)
- F-Stats-1 fix plans v1.0 through v1.2 on main
- F-AUTH-1 fix plan v2.37 on main (largest fix-plan artifact in the project)
- F-Stats-1 Phase B G1 Planning doc on main (with local revisions drafted 2026-05-19/20 — see Phase B G1 §6.5 four-amendment revision)
- Session_PE_Roster.md on main (15 entries; +4 local additions PE #50-#53 + PE #43 amendment from 2026-05-20)

**Branch:** Single working branch, e.g., `claude/audit-handoff-v11`. Single PR to main following v10 precedent (v10 shipped as PR #701, commit b0575e56, merged 2026-05-16).

**Session-pickup workflow:**

1. New chat session — v10, this outline, and the 2026-05-20 session transcript loaded as primary context
2. Confirm state — re-read main HEAD, confirm soak close timestamp, check for state changes since 2026-05-19/20
3. Read v10 §-by-§ to plan the v11 structure deltas (sections marked SUPERSEDES vs UPDATE vs CARRY-FORWARD)
4. Author v11 — could be one-pass or two-pass depending on bandwidth (v10 was one-pass)
5. Self-review pass + commit + PR + merge

---

*End of v11 session brief outline. Authored 2026-05-20 by Claude in session with Evoni during F-Deploy-1 Phase A G4 soak day 1 of 7. Outline lives at `docs/audit/v11_session_brief.md` for working revisions; full v11 handoff authoring deferred to ~2026-05-26 at soak close.*
