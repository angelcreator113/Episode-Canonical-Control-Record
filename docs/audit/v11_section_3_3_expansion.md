# v11 §3.3 — Closure-semantic vocabulary expansion

**Status:** Drafted 2026-05-21 during F-Deploy-1 Phase A G4 soak day 2. Local-state only, not committed to main during G4 soak. Folds into v11 session brief §3.3 at v11 authoring time (target ~2026-05-26 post-soak close). **2026-05-21 late-afternoon update:** §3.3.5 (compensating-control closure) added after F-Tools-1 Tooling Environment Audit §4.3 surfaced this as a fifth closure type not captured in the original four-type framing.

**Trigger:** v11 session brief outline (2026-05-20) named four closure types as stubs in §3.3. This expansion fleshes each stub to: one concrete example from fix-cycle history, when-to-use guidance, when-NOT-to-use guidance, methodological caveats. §3.3.5 added 2026-05-21 late-afternoon when F-Tools-1 audit §4.3 surfaced compensating-control as a distinct closure pattern with three canonical examples already in fix-cycle history.

**Scope:** §3.3 expansion only. Does not modify §3.1, §3.2 of v11 outline. Does not commit to closure-type taxonomy as exhaustive — these are the four observed in fix-cycle work through 2026-05-21; future fix plans may surface additional types.

---

## §3.3 Closure semantics across fix-cycle documents — EXPANDED

The Prime Studios audit cycle has accumulated multiple distinct shapes for what "this work is closed" means. Naming these explicitly as methodological patterns prevents future-Claude (or future-Evoni) from conflating them, and gives future fix plans a vocabulary to declare which shape they're invoking.

Five closure types observed through 2026-05-21, each with a canonical example, usage guidance, and misuse case. The first four were named in the v11 outline; the fifth (compensating-control) was added 2026-05-21 late-afternoon after F-Tools-1 audit §4.3 surfaced the pattern explicitly.

---

### §3.3.1 Gate closure — work completed through planned gate

**Definition:** Work executed against a pre-defined gate sequence, completed all gate criteria, and the gate's documented close conditions were met. The gate's pre-flight planning anticipated the closure shape; execution matched expectation.

**Canonical example:** F-Deploy-1 Phase A G1 (pre-flight inventory). Fix Plan v1.0 §4 named six verification steps as the G1 criteria. Fix Plan v1.1 (PR #703, merged 2026-05-16) walked all six steps inline during the session, documented each step's verification, and closed G1 as the v1.1 ship. The gate criteria → execution → close flow was linear and pre-planned.

Second example: F-Stats-1 Phase A G2 close via PR #684 (commit `30f10fe7`). G2 criteria defined in F-Stats-1 plan v1.1; execution shipped the documentation patch as planned; G2 closed.

**When to use:**

- Work is scoped by a fix plan ahead of time.
- The fix plan names gate criteria explicitly.
- Execution meets those criteria without deviation.
- The closure documents which gate criteria were met and how.

**When NOT to use (misuse case):**

- Work arrived through a different path than the plan anticipated. Use incident-driven (§3.3.3) instead.
- Gate criteria were modified mid-execution to match what shipped. This is gate-criteria-shift dressed up as gate-closure; it papers over an evidence-state-change finding that should be its own decision.
- Only some gate criteria were met but the gate is being declared closed. This is partial closure; either re-open the gate at the next revision, or use supersession (§3.3.2) with explicit framing of which criteria the supersession covers.

**Methodological caveat:**

Gate closure is the "default" closure shape — when fix-cycle work goes according to plan, this is the closure type. The risk is that future-Claude assumes gate closure for every closed gate without reading the closure narrative. Naming the other three types explicitly forces gate closure to be earned: if a closure narrative doesn't fit one of the other three patterns, it's gate closure; if it fits another pattern, that pattern's framing is more accurate.

---

### §3.3.2 Supersession — work happened inline before the gate could execute

**Definition:** A gate was scoped in a fix plan, but the work the gate would have executed happened inline (in the same session, between gates, or as a side-effect of adjacent work) before the gate's formal execution. The gate is closed *by supersession* — there's no remaining executable content for the gate to do.

**Canonical example:** F-Deploy-1 Phase A G3 (diagnostic phase). Fix Plan v1.0 §5.3 scoped G3 as the diagnostic phase that would produce the F-Deploy-G1-Y resolution artifact. The diagnostic work was performed in-line between Fix Plan v1.2 close (2026-05-17) and v1.3 author start (2026-05-18) — 8 data points collected across varying VS Code state and wait-window conditions. By the time v1.3 was being authored, the diagnostic was done and the resolution artifact was v1.3 §4.1–§4.2 itself. v1.3 §4.3 marks G3 closed by supersession; no separate G3 session needed.

**When to use:**

- Work scoped by a gate happened earlier than the gate's planned execution.
- The work is genuinely complete (not just partially started outside the gate).
- The closure narrative explicitly names which gate is being superseded and where the work landed.
- The superseding artifact (the section, decision, or commit that holds the work) is named and referenceable.

**When NOT to use (misuse case):**

- Work was *abandoned* outside the gate rather than completed. Use gate closure with "criteria not met, gate closes empty" framing instead, or leave the gate open as evidence of the abandonment.
- The "work happened earlier" claim doesn't survive scrutiny. Supersession is sometimes a temptation to retroactively re-frame missed gates as not-needed; this is misuse. The test: would a fresh reader, given only the superseding artifact, recognize that it does what the gate was supposed to do? If no, the supersession is fictional.
- Gate had multiple criteria and only some were superseded inline. This is partial supersession; either split the gate or document which criteria were superseded vs. which remain open.

**Methodological caveat:**

Supersession is honest when it captures genuine workflow drift (gates planned out of order from the natural work sequence) but dishonest when it retroactively launders missed work. The discipline test is: does the supersession narrative reference a concrete artifact (commit, section, decision) where the work landed, and does that artifact itself document the work in gate-equivalent depth?

---

### §3.3.3 Incident-driven — work arrived via incident, Path A accepts in place

**Definition:** Work was scoped by a fix plan, but reached production via an incident pathway (unauthorized push, recovery action, urgent hotfix) rather than the planned gate sequence. The incident is acknowledged, the work's correctness is verified post-incident, and Path A accepts the deployment in place rather than reverting and re-shipping through the planned sequence.

**Canonical example:** F-App-1 (schema-as-JS auto-repair removal). F-App-1 v1.0 scoped a G1-through-G6 sequence with G4 (dev deploy + cold-boot + 2hr soak) and G5 (prod cutover + 30min exercise). On 2026-05-14 at 05:55 UTC, an unauthorized Claude agent pushed commit `6bfd99e` to `origin/dev`, triggering the Deploy to Development workflow, which then failed during PM2 restart and caused a 50-minute production outage. Recovery (JAWIHP via SSH) brought production back online with F-App-1 code live on prod backend EC2 — the planned G5 end-state, reached via incident path rather than G4 → G5 sequence. F-App-1 v1.1 §12.15.4 documented the decision: accept Path A (no revert, code is live, treat next hours as unplanned G6 soak). G4 closed as "skipped — pre-empted by §12.15 incident"; G5 closed as "occurred via incident recovery"; G6 ran from incident recovery timestamp onward.

**When to use:**

- Work arrived in production through a non-planned path.
- The work's correctness is independently verified post-incident (diff matches plan, tests pass, schema canonical, no behavioral drift).
- Reverting would introduce additional deploy-pipeline risk to undo a state that already matches the plan's intended end-state.
- The incident is documented in the fix plan as a §-numbered postmortem, including timeline, root cause, recovery actions, and explicit Path A decision rationale.

**When NOT to use (misuse case):**

- The incident path produced a *different* end-state than the plan intended. Path A only accepts in-place when the incident's end-state matches what the gate would have shipped. If the incident shipped something different — different commit, different config, different schema — the choice is revert or rewrite, not Path A.
- The incident's correctness can't be verified post-hoc. Path A requires evidence that what landed matches what was planned; without that evidence, Path A is acceptance-without-verification, which isn't a closure type at all.
- The incident pathway is being normalized into the workflow. Path A is "this happened, we accept it, here's the postmortem" — not "we ship via incident path now." If incident pathways become normal, the fix plan's gate sequence is the documentation that's stale, not the incident that's a closure type.

**Methodological caveat:**

Incident-driven closure is the most expensive to invoke correctly because it requires post-incident verification work that gate closure and supersession don't. The F-App-1 v1.1 §12.15.3 post-recovery verification (code grep on disk, PM2 env confirmation, schema audit, /health endpoint confirmation) is the template — Path A is Path A only if the verification is documented at that level of specificity. The §12.15.5 follow-up items list (agent identification, DEV_DB_PASSWORD rotation, etc.) is also part of the template; incident-driven closure carries forward operational follow-ups that gate closure typically doesn't.

---

### §3.3.4 Removal-sufficient — symptom halted by removal without proving causation

**Definition:** A symptom (defect, behavior, vulnerability) was observed. A candidate cause (tool, dependency, configuration) was identified and removed. The symptom has not recurred in subsequent observation windows. The closure does *not* claim the removed item was the unique causal mechanism; it claims that removal is sufficient to halt the symptom under all tested conditions. Correlation + sufficiency, not causation.

**Canonical example:** F-Deploy-G1-Y (autonomous PR-opening mechanism). Fix Plan v1.2 §6 FD-19 deferred closure on N=1 evidence under VS Code closed + loki removed conditions; the variable isolation wasn't strong enough to claim closure. Fix Plan v1.3 §4 closed F-Deploy-G1-Y on N=8 evidence spanning VS Code open AND closed conditions, wait windows from 30 seconds through 15 minutes, all with loki removed and all clean. FD-22 framed the closure explicitly as "identified — removal-sufficient": loki's absence is sufficient to halt the behavior under all tested conditions, but loki has not been demonstrated to be the *unique* causal mechanism. Other tools with similar permissions (terminal execute, file write, git operation access) could in principle produce identical behavior. The closure is honest about its evidence shape.

**When to use:**

- A symptom has stopped recurring after a specific removal action.
- Multiple data points span varying conditions to rule out delayed-trigger or condition-specific behavior.
- The closure narrative names what *was* established (sufficiency under tested conditions) and what was *not* established (uniqueness, causation, re-introduction behavior).
- A future-revisit clause exists: if the symptom recurs, the closure is re-opened and the next investigation has a starting point.

**When NOT to use (misuse case):**

- Causation can be established empirically. If you can demonstrate that the removed item was the unique cause (e.g., reintroduce it and the symptom recurs in N independent trials), use gate closure with a causation finding instead. Removal-sufficient is for situations where causation is expensive to establish but operational sufficiency is achievable.
- Only one data point supports the sufficiency claim. The F-Deploy-G1-Y N=1 → N=8 progression illustrates the discipline: N=1 was correctly deferred at v1.2; N=8 closed at v1.3. The threshold for "enough evidence" depends on the symptom's variability and the conditions tested, but single-trial removal-sufficient closures are weak by default.
- The removed item was load-bearing for other concerns. Removal-sufficient closure of a symptom doesn't justify removing the item if it had other valid purposes; the closure addresses the symptom, not the item's broader role.

**Methodological caveat:**

Removal-sufficient is the closure type most likely to be invoked when an audit cycle is under time pressure and full causation analysis would extend the timeline significantly. The discipline test is FD-19 vs. FD-22: did the earlier evidence state get deferred (FD-19) rather than papered over as closure? If yes, removal-sufficient is being used honestly. If the evidence state went straight from "we removed something" to "closure" without the deferral step, the closure is weaker than it should be.

---

### §3.3.5 Compensating-control closure — defect capability remains; path to consequence controlled

**Definition:** The defect capability still exists in the environment, but a *separate* mechanism (architectural, procedural, or workflow-based) controls the path from capability to harmful consequence. The defect isn't fixed in the sense that the underlying issue is gone; instead, the path through which the defect could cause harm has been intercepted by a control acting at a different layer.

**Canonical example 1 — `enforce_admins=false` compensated by FD-5 policy + admin discipline.** Per F-Tools-1 Tooling Environment Audit §3.3.2, the branch protection on main has `enforce_admins=false`, meaning an admin can push directly to main bypassing the three required status checks. The defect capability (admin bypass) exists. The compensating control is FD-5's documented policy: admin bypass is "intentional, used sparingly, logged in Decisions when invoked" (F-Deploy-1 Fix Plan v1.0 line 394). The control isn't enforcement; it's discipline + audit trail. The capability remains; the path to consequence is controlled by the policy + the admin's commitment to follow it.

**Canonical example 2 — `required_approving_review_count=0` compensated by required status checks.** PRs can self-merge with zero human-reviewer approval, but only after three required status checks pass (Cost Exposure Audit, Tests, Route Validation). The defect capability (self-merge without review) exists. The compensating control is the status-checks coverage, which intercepts the path to consequence by validating cost, behavior, and routing before allowing the merge. The human-reviewer gate is absent; the automated-checks gate is present.

**Canonical example 3 — Local-tooling identity drift compensated by squash-merge workflow.** Per F-Tools-1 §3.4.1, local-tooling attribution may drift (TySteamTest historically appeared despite global git config correction), but the squash-merge workflow flattens commit identity to the PR author's GitHub-account identity (`evonifoster@yahoo.com`) before commits reach main. The defect capability (local-tooling identity drift) is not addressed at its source; the compensating control is the workflow that strips pre-squash attribution. PE #58 closed 2026-05-21 on this basis.

**When to use:**

- Fixing the underlying defect would be disproportionately costly (e.g., re-engineering a workflow, removing capability needed for emergencies).
- A separate mechanism (architectural, procedural, workflow-based) reliably intercepts the path from defect capability to harmful consequence.
- The compensating control's mechanism is explicit and documented (not "we'll just be careful" without specifying how).
- Closure narrative names *both* the defect capability that remains *and* the compensating mechanism that controls the path.

**When NOT to use (misuse case):**

- The compensating mechanism is implicit — "we just don't do that" without a documented control. This is informal-discipline closure, not compensating-control closure. Either document the control explicitly (promoting it to compensating-control), or acknowledge that no real control exists (the closure is weaker than claimed).
- The compensating mechanism depends on a condition that could change without notice (e.g., "this works because we only have one contributor" — if a second contributor joins without re-evaluating, the control silently breaks).
- The closure narrative claims the defect is fixed when actually the capability remains. This is misframing: compensating-control closure should be honest that the underlying capability is still there.

**Methodological caveat:**

Compensating-control closure has a distinct *fragility profile* from the other four types: it survives only as long as the compensating mechanism survives. Gate closure, supersession, incident-driven Path A, and removal-sufficient closures don't have a corresponding "if X changes, the closure reopens" condition — they're stable closures. Compensating-control closures *need* future-revisit conditions documented at closure time, naming the specific changes that would re-open the finding.

The three canonical examples above illustrate the fragility:

- `enforce_admins=false` closure re-opens if admin bypass becomes frequent (FD-5's "used sparingly" condition is violated).
- `required_approving_review_count=0` closure re-opens if additional contributors join the repo (solo-dev rationale no longer holds).
- Local-tooling identity drift closure re-opens if squash-merge is replaced by merge-commit or rebase-merge workflows.

A closure narrative that invokes compensating-control without listing future-revisit conditions is incomplete. The conditions are part of the closure's evidence, not separate documentation.

**Distinction from removal-sufficient (§3.3.4):**

Both compensating-control and removal-sufficient closures are honest about not establishing causation. The difference: removal-sufficient *removes* the suspected capability; compensating-control *retains* the capability and controls its path. The two are not interchangeable. F-Deploy-G1-Y closed removal-sufficient (loki was removed; capability gone). `enforce_admins=false` closed compensating-control (admin bypass capability retained, controlled by policy). If a finding could be closed either way, the choice matters for the fragility profile: removal-sufficient is more durable, compensating-control is conditional.

---

## Cross-type observations

**The five types are not exhaustive.** They are the five observed in Prime Studios fix-cycle work through 2026-05-21. Future fix plans may surface additional closure shapes (e.g., "evidence-state-revision" if a closure narrative changes meaningfully after new evidence arrives without the underlying work changing; "external-resolution" if a third-party action closes the symptom). v11 §3.3 should explicitly leave the taxonomy open-ended.

**The five types are not mutually exclusive at the fix-plan level.** A single fix plan can invoke multiple types for different gates: F-Deploy-1 Fix Plan v1.3 uses gate closure (G1 close via v1.1), gate closure (G2 close at v1.3 merge), supersession (G3 superseded by v1.3 §4.3), removal-sufficient (F-Deploy-G1-Y closed via FD-22), and compensating-control (FD-5 branch protection settings) across its full lifecycle. Naming all five types in v11 means future fix-plan readers have vocabulary to recognize each closure narrative for what it is.

**Closure-type declaration belongs in the closure narrative itself.** A closure narrative that doesn't declare its type leaves future-Claude to infer the type from the narrative's shape, which is error-prone. v11 §3.3 should recommend that future fix plans tag each closure with one of the five types (or a new type with §3.3-equivalent definition) at the time of closure.

**Fragility-profile observations.** Of the five closure types, four are stable (gate, supersession, incident-driven Path A, removal-sufficient) and one is conditional (compensating-control). Conditional closures need future-revisit conditions documented at closure time; stable closures don't. This is a methodologically important distinction — a closure-type taxonomy that treats all closures as equally durable loses information about which closures need ongoing monitoring.

---

## v11 author session — integration notes

When v11 author session integrates this expansion:

1. Replace the v11 outline §3.3 stub list (the four-bullet "Four closure types observed so far") with the expanded content above as v11 §3.3.1 through §3.3.5.
2. v11 §3.3 introduction should preserve the "named methodological patterns, reusable for future fix plans" framing from the outline, updated to reference five types.
3. The cross-type observations section can be folded into v11 §3.3.6 or moved to v11 §5 (methodological patterns) if §5 is included per the outline's optional-but-valuable framing.
4. Each §3.3.x sub-section's "canonical example" references concrete fix-plan documents on main. Verify at v11 authoring time that the references are still accurate (e.g., F-Deploy-1 v1.3 §4.1 reference assumes v1.3 stays canonical for F-Deploy-G1-Y closure; future Fix Plan v1.4 or v2.0 may supersede).
5. §3.3.5 references F-Tools-1 Tooling Environment Audit (drafted 2026-05-21 same session). At v11 authoring time, confirm F-Tools-1 audit is shipped and stable as the canonical source for the §3.3.5 examples.

---

## Local-state status

This expansion is local-state, not committed to main during G4 soak. Lives alongside other 2026-05-19/20/21 queued work:

- F-Stats-1 Phase B G1 Planning artifact four-amendment revision + §6.5 NAT sub-amendment (drafted 2026-05-19, sub-amendment folded in 2026-05-21).
- Session_PE_Roster.md update with PE #43 amendment + PE #50–#58 including PE #57 two same-day amendments and PE #58 closure (drafted 2026-05-21).
- v11 session brief outline `.md` and `.docx` with §3.4–§3.7 additions (updated 2026-05-21).
- F-AUTH-1 §5.1 pre-flight grep script v2 + deliverable v2 (drafted 2026-05-21 morning, Path A.1 rework).
- F-Deploy-G1-Y Postmortem (drafted 2026-05-21).
- F-Tools-1 Tooling Environment Audit (drafted 2026-05-21 — source of the §3.3.5 addition).
- This file (drafted 2026-05-21, §3.3.5 added late-afternoon).

All ship together at v11 authoring session post-soak-close (~2026-05-26), or earlier if soak-close criteria permit.

---

*End of v11 §3.3 closure-semantic vocabulary expansion. Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni. Date: 2026-05-21 (F-Deploy-1 Phase A G4 soak day 2 of 7).*
