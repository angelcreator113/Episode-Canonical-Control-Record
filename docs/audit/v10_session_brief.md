# Prime Studios Audit Handoff v10 — Session Brief

**Purpose:** Pickup document for the v10 handoff authoring session. Written 2026-05-16 immediately after F-Deploy-1 Fix Plan v1.0 + Session PE Roster updates merged to main. Captures state changes since v9 (authored 2026-05-15) while context is fresh.

**Read alongside:** `docs/audit/Prime_Studios_Audit_Handoff_v9.docx` (current canonical on main), `docs/audit/NEW_CHAT_ONBOARDING.md`, and the four PRs that shipped between v9 authoring and this brief.

---

## §1 State changes since v9

v9 was authored 2026-05-15 evening EDT. Between then and 2026-05-16 mid-afternoon EDT, four PRs landed on main. v10 must reflect all of them.

### PR #695 — Session PE Roster: mark PE #41 + PE #48 RESOLVED (2026-05-15 evening)

Closed two pipeline-blocking PE entries via PR #694's commit `139bbd7a`:

- **PE #41** (aiRateLimiter IPv6 keygen) reclassified P2 → P0 → RESOLVED. Fixed via `ipKeyGenerator` import with fallback wrapper.
- **PE #48** (migration `version` column drift) RESOLVED. Fixed via defensive `describeTable + addColumn-if-missing` in the migration; `addIndex` calls converted to raw SQL `CREATE INDEX IF NOT EXISTS` for idempotency.

Already incorporated into v9 (post-audit fix progress). No v10 delta from #695.

### PR #698 — F-Deploy-1 G1 audit complete (2026-05-16 early morning, ~02:45 EDT)

16-commit branch merged to main as squash. Document at `docs/audit/F-Deploy-1_G1_Audit.md`. Contents:

- §1 audit method (failure-mode-first, vs F-AUTH-1/F-Stats-1/F-App-1's per-file enumeration)
- §2 six chronologically-ordered failure events (§2.1 F-App-1 morning outage, §2.2 F-Stats-1 G2 evening outage, §2.3 PR #685 auto-merge, §2.4 PRs #688/#689 backup-branch auto-merges, §2.5 TySteamTest identity drift, §2.6 May 15 dev deploy lunch failure)
- §3 seven file-by-file analyses (§3.1 auto-merge-to-dev.yml, §3.2 auto-merge.yml, §3.3 deploy-dev.yml, §3.4 deploy-production.yml, §3.5 ecosystem.config.js, §3.6 branch protection state on main, §3.7 local tooling identity)
- §4 sub-form classification (A auto-merge, B deploy-dev safety, C branch protection, D local tooling)
- §5 recommended Fix Plan v1.0 structure (three phases, 12-14 gates)
- §6 closure criteria (content-complete; deferred-read `.github/scripts/deploy-production.sh` handed off to Fix Plan v1.0 Phase A pre-flight)
- §7 next-action notes

**Findings filed: 27 (F-Deploy-G1-A through F-Deploy-G1-AA).** 18 P0, 8 P1, 1 P2.

### PR #699 — F-Deploy-1 Fix Plan v1.0 (2026-05-16 mid-morning, ~09:21 EDT)

Document at `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md`. ~1000 lines, 13 sections:

| § | Title | Purpose |
|---|---|---|
| §1 | Purpose and scope | What this plan does/doesn't do |
| §2 | Reference documents | G1 audit, v9, v8, F-Stats-1 plan, F-AUTH-1 plan |
| §3 | Sub-form summary | A/B/C/D with crossover dependencies |
| §4 | Pre-flight inventory (Gate A-G1) | Six verification steps before Phase A G2 |
| §5 | Phase A — Containment + safety | Sub-forms A, C, D-diagnostic |
| §6 | Phase B — Deploy-dev architectural correction | Sub-form B; α vs β decision at Phase B G1 |
| §7 | Phase C — Soak + verification | F-Stats-1 Phase B G2 as canonical pilot |
| §8 | Gate sequence | 12 gates across three phases |
| §9 | Rollback plan | Per-PR rollback approach with risk callouts |
| §10 | What this unblocks | Downstream keystone sequencing |
| §11 | Decisions log | 12 locked decisions at v1.0 (FD-1 through FD-12) |
| §12 | Appendix A | All 27 findings phase-mapped |
| §13 | Closing note | Path forward |

Also added in PR #699: `scripts/morning-soak-check.ps1` (env-var path version, prod EC2 PM2 status + recent log dump utility).

**Key F-Deploy-1 Fix Plan decisions locked at v1.0:**

- **FD-1:** Three-phase structure (A containment, B architectural, C soak).
- **FD-3:** `auto-merge.yml` (main path) stays deleted permanently. No filtered restoration.
- **FD-4:** `auto-merge-to-dev.yml` stays active with three changes (opt-out label, backend build verification, `-X ours` notification).
- **FD-5:** Branch protection on main adopts minimal real gate — `required_status_checks: [Validate]`, zero required reviews, `enforce_admins: false`.
- **FD-8:** Sub-form B architectural choice (separate-EC2 vs shared-safe) deferred to Phase B G1; sub-form D diagnostic outcome is part of the decision input.
- **FD-9:** Recommendation for ecosystem.config.js port-default policy is Option H-1 (flip defaults to prod). Final commitment at Phase B G1 contingent on α/β.
- **FD-10:** Phase A G4 soak 1 week; Phase B G6 soak 2 weeks; F-Stats-1 Phase B G2 pilot is canonical Phase B G6 test.

### PR #700 — Session PE Roster updates (2026-05-16 mid-afternoon)

Two commits, single PR:

1. Amendments to PE #40 (Template Studio still firing at 2026-05-16 12:50 UTC, 48h+ unchanged) and PE #42 (CFO `dependency_audit` 7 critical/high vulnerabilities confirmed unchanged at 2026-05-16 06:46 UTC and 12:46 UTC).
2. New PE #49 — `cost_watchdog: 50% AI call error rate flagged by CFO audit`. P1, OPEN. Surfaced from same `scripts/morning-soak-check.ps1` execution as the PE #40 and #42 amendments.

PR #700 is the only one of the four where v10's PE roster section needs explicit new content (PE #49 itself).

---

## §2 Key narrowing during today's session — F-Deploy-G1-Y mechanism

G1 audit §3.7 documented F-Deploy-G1-Y as "autonomous PR-opening mechanism is unidentified but constrained." Today's session narrowed the candidate space significantly. v10 should reflect.

**Branch-list scan during PR #699 cleanup surfaced:**

- Local branch `copilot/worktree-2026-03-11T12-57-09` — Copilot Workspace artifact, confirmed-present on user's local environment.
- Multiple origin branches with `claude/**-XXXXX` random-suffix naming (RFZ6K, X8iww, EjtNv, UjNDk, h7x21, dOl4S) — Claude Code's branch naming convention.

**User confirmed:** Both Copilot Workspace and Claude Code are deliberately installed and regularly used. Neither is autonomous mystery tooling.

**Implication for sub-form D diagnostic (Fix Plan §5.3):** The diagnostic phase (Phase A G3) now has concrete candidates rather than open hypothesis space. The diagnostic question shifts from "what is the mechanism?" to "which tool's normal operation produces the F-Deploy-G1-Y behavior, and how is the user's normal invocation of that tool causing PRs to be opened without explicit user `gh pr create`?"

**Decision deferred to Phase A G3:** Whether F-Deploy-G1-Y closes as "identified — known tool's normal operation" or as "narrowed but still residual" pending diagnostic.

**v10 should add this narrowing** as either an amendment to F-Deploy-G1-Y's status or a new Decision (#100+ — next available number, v9 stopped at #99 per onboarding).

---

## §3 What v10 itself needs to do

v10's scope is broader than v9's. v9 documented post-audit fix progress (F-AUTH-1 progress + F-Stats-1 Phase A close + F-Deploy-1 G1 in progress). v10 documents post-Fix-Plan-v1.0 state.

### Structural changes v10 should reflect

**§4 fix sequence:**
- F-Deploy-1 status: G1 audit closed (PR #698), Fix Plan v1.0 closed (PR #699), Phase A pre-flight ready to begin.
- F-Stats-1 Phase B G2 still blocked but blocker is now well-scoped (waiting on F-Deploy-1 Phase A close, not waiting on F-Deploy-1 G1 audit close as v9 documented).
- All other keystones unchanged.

**§7 Decisions log:**
- Decision #97 (F-Deploy-1 as 8th keystone) — unchanged
- Decision #98 (F-Stats-1 Phase B G2 blocked on F-Deploy-1 G1 close) — **needs revision** to reference Fix Plan Phase A close, not G1 close, as the unblock gate (Decision #9 of F-Stats-1 plan v1.2 + Fix Plan v1.0 Decision FD-10).
- Decision #99 (auto-merge.yml deleted) — unchanged
- New Decision #100+ — Fix Plan v1.0's 12 locked decisions (FD-1 through FD-12) should either be referenced individually here or summarized as Decision #100 with cross-reference to Fix Plan §11.
- New Decision #101+ — F-Deploy-G1-Y narrowing (Copilot Workspace + Claude Code as confirmed-present tools, sub-form D diagnostic candidates).

**§11 findings registry:**
- §11.5 F-Deploy-G1 findings should be marked "PHASE A PRE-FLIGHT" rather than "G1 IN PROGRESS" as v9 stated.
- The 27 findings should be left in place but with phase/sub-form assignments per Fix Plan §12 Appendix A.

**§12 Session PE Roster cross-reference:**
- v9 had 14 PE entries documented (PE #27, #31, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47, #48).
- v10 should reflect 15 (add PE #49).
- PE #40 + PE #42 status notes should reflect the 2026-05-16 confirmation amendments.

### What v10 should NOT do

- Not author Phase A pre-flight execution. That's Phase A G1 work, post-handoff.
- Not commit to the sub-form B α/β architectural choice. That's deferred to Phase B G1 per Decision FD-8.
- Not pre-empt the sub-form D diagnostic outcome. Capture the narrowing; don't conclude the diagnostic.

---

## §4 Document logistics for v10 authoring

**Format:** Match v9 — `.docx` per F-AUTH-1 / handoff convention. v9 is at `docs/audit/Prime_Studios_Audit_Handoff_v9.docx` on main; v10 authors as new doc in same path.

**Branch:** Single working branch, e.g., `claude/audit-handoff-v10`. Single PR to main following PR #696 precedent.

**Length estimate:** Larger than v9 (v9 was already substantial; v10 adds Fix Plan reference + 4 PRs of state changes + F-Deploy-G1-Y narrowing). Plan for two focused sessions: drafting + revision pass.

**Session-pickup workflow:**
1. New chat session — onboarding doc + v9 + this brief loaded as primary context.
2. Confirm state — re-read main HEAD, confirm PR #700 merge state, check for new state changes since this brief was authored.
3. Read v9 §-by-§ to plan the v10 structure deltas.
4. Author v10 in one pass (matches v9 → v9 was a single-session author).
5. Self-review pass + commit + PR + merge.

---

## §5 Outstanding session-end housekeeping (post-PR-#700-merge)

Items deliberately deferred from this session to v10 session or beyond:

- **F-Deploy-1 Phase A G1 pre-flight execution.** Phase A G1 is the first gate of Fix Plan v1.0; not started.
- **F-Stats-1 Phase B G1 planning continuation.** v9 references `docs/audit/F-Stats-1_PhaseB_G1_Planning.md` as active; v10 should re-check whether that doc has advanced.
- **Update userMemories with v9 → v10 deltas.** Three updates proposed at session close (see chat history).
- **Visit `npm audit` enumeration for PE #42** — deferred to triage by EOW 2026-05-21 per PE #42 entry.
- **Visit Template Studio module-load investigation for PE #40** — deferred indefinitely per PE #40 entry.
- **Visit cost_watchdog code surface for PE #49** — deferred per PE #49 entry.

None of the above are blockers for v10 authoring. v10 is a *handoff document*, not an *execution document*.

---

## §6 Trust-the-prior-session checklist

For v10 author (whether next-Claude or future-Evoni):

- [ ] Read v9 in full before authoring v10
- [ ] Read this brief alongside v9 for the today-deltas
- [ ] Verify PR #698, #699, #700 are all squash-merged on main (`git log --oneline -10` should show them)
- [ ] Confirm `docs/audit/F-Deploy-1_G1_Audit.md` and `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` exist on main
- [ ] Spot-check Session_PE_Roster.md has PE #49 + the two amendments
- [ ] Check that no new PE-class incidents fired between this brief's date (2026-05-16) and v10 authoring date
- [ ] Re-confirm the deploy-dev path stayed clean — no F-Deploy-G1-* recurrences during the gap

If any item fails: pause v10 authoring, surface the discrepancy, decide whether v10 incorporates the new state or whether it documents the gap and a separate fix lands first.

---

*End of v10 session brief. Authored 2026-05-16 by Claude in session with Evoni. Brief lives in /mnt/user-data/outputs/ for user retention; not committed to repo by default.*
