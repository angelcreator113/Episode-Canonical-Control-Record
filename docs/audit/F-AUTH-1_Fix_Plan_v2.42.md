| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *First fix after audit close. Tier 0 keystone.* *Six-step coordinated single-PR plan.* |
| --- |

**Document version**

v2.42 — CP12-G4 CLOSURE + G5/G6 FAILURE-PATH RULING. Mints nothing. Ships no code. Locates the CP12-G4 probe at v2.37 §5.57, re-runs it against origin/main at `1b3de5ca`, and records 0 true positives — closing the last open CP12 verification grep. Corrects v2.39 §2.1: the probe was never absent, it is mis-filed outside §21. Records a new §5.57 false-positive class. **Rules the G5/G6 failure-path gap recorded at v2.40 §7: revert-first**, adopting F-Deploy-1 §6.2 as procedural discipline. Track G3's grep clause is now fully discharged; Track G3 remains OPEN on v2.39 §1.3's unattempted clauses. No PE, FD, or XK numbers minted. Derived entirely from git against origin/main at `1b3de5ca`. No live database contact. Supplies a locked forward pointer to §5.57 for CP12-G4.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

*BACKEND STEP 3 SWEEP CLOSED at CP12 (see v2.37 §5.71 keystone closure marker). DEPLOYMENT TRACKS OPEN: Track G3 self-review (grep clause DISCHARGED per §1; §5.71's audit-pass and production-readiness clauses remain unattempted) → Track G4 dev verification + soak → Track G5 prod cutover → Track G6 post-deploy soak. Track labels per v2.38 §2.2 forward definitions. Track G5 is gated on the prod freeze — a structural gate external to this keystone. G5/G6 failure paths are ruled at §3.*

---

# §1. CP12-G4 — probe located, re-run, 0 true positives

## §1.1 Correction to v2.39 §2.1

v2.39 §2.1 recorded that CP12-G4 had no canonical probe and stated: *"No revision states the command."*

**That is incorrect and is corrected here.** v2.37 **§5.57** — "F-AUTH-4 grep false-positive discipline (NEW v2.32)" — states it:

> *F-AUTH-4 grep matches `tolerat|expir|missing token|weakened|TESTING` keywords across CP zone files*

§5.57 further supplies the full triage discipline, which is what makes the probe usable:

- **Auth-obsolescence markers** — the true-positive shape — appear as comments above route declarations, or inside auth declarations: `requireAuth({ tolerantMode: true })`, `optionalAuth({ tolerateExpiredTokens: true })`, or banner-comments above sub-form (b) handlers.
- **False-positive markers** appear inside literal string content: error messages, system prompts, AI prompt templates.
- **Per-handler-block analysis** (per §5.37) is required to disambiguate — examine the line context of each hit.
- Triage must be documented in the closing report, each hit investigated and ruled.

**The defect is filing, not absence.**

§21 enumerates canonical probes for G1, G2, and G6; G4's lives in a §5.5x amendment and is not cross-referenced from §21. A reader working from §21 — as v2.39 did — finds nothing. **This is a cross-reference defect, not an absent-probe defect**, and it is materially smaller than v2.39 §2.3 characterised.

**Locked forward definition, v2.42.** For all post-v2.42 reads, CP12-G4's operative probe is the §5.57 keyword probe (`tolerat|expir|missing token|weakened|TESTING`) together with §5.57's line-context triage discipline and the §1.3 amendment. **§21's canonical probe table is incomplete: it enumerates G1, G2, and G6 and omits G4.** A reader working from §21 alone will not find G4's probe. This pointer is the operative cross-reference until a revision amends §21 itself.

v2.39 §2.2's reasoning stands and is not withdrawn: a guessed security probe returning zero is worse than an acknowledged gap. Declining to guess was correct. The error was in the search, not the posture.

## §1.2 Re-run result

The §5.57 probe, run against `origin/main` at `1b3de5ca` over `src/routes/`, returns **18 hits**. Per §5.57's line-context rule, all 18 are false positives.

| Hits | Sites | Disposition |
|---|---|---|
| 4 | `assets.js:1201`, `auth.js:89`, `:132`, `:273` | `expiresIn` / `expiresAt` on token payloads — functional token-lifetime fields, not comments or auth declarations |
| 2 | `memories/assistant.js:249`, `:533` | "API key may be missing or expired" — **named verbatim in §5.57** as CP7's false positives |
| 1 | `opportunityRoutes.js:36` | `expired: ['archived']` — STATUS_FLOW state name; recorded in v2.37 as CP10's triaged false positive |
| 1 | `press.js:78` | "Cannot tolerate vague" — character-description string literal |
| 1 | `worldEvents.js:2358` | "raw SQL to tolerate unmigrated columns" — a comment, but concerning schema drift, not auth |
| 8 | `worldStudio.js:286`–`:310` | Preview-cache TTL logic — `expires`, "expired entries" |
| 1 | `worldStudio.js:2482` | `// PUBLIC:` rationale comment — see §1.3 |

A narrower confirmatory probe for the auth-declaration forms §5.57 names — `tolerateExpiredTokens`, `tolerantMode`, `AUTH-DISABLED`, "auth disabled" — returns **zero hits** across `src/routes/` and `src/middleware/`.

**CP12-G4: 0 true positives. HOLDS.**

## §1.3 NEW false-positive class — §5.57 amendment

`worldStudio.js:2482` reads:

> `// PUBLIC: World ecosystem preview generation with ownership-when-authenticated; degraded auth tolerated for audience growth — see Audit Handoff §4.1`

This is a **comment directly above a route declaration containing auth-weakening vocabulary** — structurally the exact place §5.57 says a true positive lives. It is not one. It is the ratified CP3 D1 Tier 3 `// PUBLIC:` rationale for `POST /world/generate-ecosystem-preview`, the sole §5.45 polymorphic-factory write site, confirmed independently at v2.38 §1.2, v2.39 §1.2, and again here.

**§5.57 did not anticipate that a legitimate `// PUBLIC:` rationale comment would use the keyword vocabulary.** Item 15 requires rationale comments on Tier 3 and Tier 4 markings, and "degraded auth tolerated" is an accurate description of the Tier 3 contract.

**Amendment, LOCKED v2.42:** a `// PUBLIC:` marker carrying an Item 15 rationale is a **fourth false-positive class**, alongside error messages, system prompts, and AI prompt templates. It is distinguished from a true positive by disposition: a `// PUBLIC:` comment documents a ratified disposition; an obsolescence marker documents auth being disabled or weakened outside one.

Recorded so a future pass does not re-triage this site.

## §1.4 Track G3 grep clause — DISCHARGED

With CP12-G4 re-run, all six CP12 verification greps have been re-verified against main post push #37 and push #38:

| Grep | Verified at |
|---|---|
| CP12-G1 | v2.39 §1.2 — 1 site, the ratified polymorphic factory |
| CP12-G2 | v2.39 §1.2 — 0 |
| CP12-G3 | v2.39 §1.2 — 211, exact match |
| CP12-G4 | **This revision — 0 true positives of 18 hits** |
| CP12-G5 | v2.39 §1.2 — 25, exact match |
| CP12-G6 | v2.39 §1.2 — 0 in scope |

**§5.71's clause "verify G1–G6 still hold post-merge-resolution + cleanup-delete" is DISCHARGED.**

---

# §2. CP1–CP12 count chain — reconciled

§5.71's audit-pass clause has a verifiable arithmetic component. It is discharged here; the qualitative component is not (§2.3).

## §2.1 The chain

v2.37 reports the `requireAuth` consumer count as a running total through CP5, then stops reporting it. CP6–CP12 report per-CP handler counts instead.

| CP | Consumer count | Delta | Stated composition |
|---|---|---|---|
| CP2 | 6 → 259 | +253 | "matches CP2 promotion scope" — no breakdown given |
| CP3 | 259 → 359 | +100 | Tier 1 promotion + 4 imports |
| CP4 | 359 → 491 | +132 | 6 imports + 126 handlers ✓ |
| CP5 | 491 → 584 | +93 | 7 imports + 86 handlers ✓ |

Handler counts, CP6–CP12: CP6 102, CP7 153, CP8 94, CP9 37, CP10 ~120 (empirical close; forecast 75, surface ~108), CP11 17, CP12 ~155–165. **Sum: 678–688.**

584 + 678–688 = **1,262–1,272**. Measured at `1b3de5ca`: **1,307 occurrences across 122 files** (v2.38 §1.2).

Residual **35–45**. CP3–CP5 each recorded 4–7 import lines alongside handlers; seven further CPs at that rate is 30–50. **The residual falls inside the expected import band. The chain reconciles.**

## §2.2 Two reporting defects

**The consumer-count instrument stops at CP5.** CP2–CP5 report a running total; CP6–CP12 report per-CP handler counts. Both are valid measurements, but they are not the same instrument, and the transition is not marked. Reconciling across it requires manual arithmetic that no revision had performed — which is why the 584 → 1,307 gap stood unexamined until this pass.

**CP2's +253 has no composition.** Every other reported delta decomposes into imports plus handlers. CP2 — the largest single jump in the program — states only "matches CP2 promotion scope." Not shown to be wrong; not checkable from the record.

Neither is a correctness defect. Both are recorded so a future audit knows where the record thins.

## §2.3 What this does not discharge

The qualitative half of §5.71's audit clause. Whether CP1–CP12's **disposition judgments** were correct — Tier 1 versus Tier 2 versus Tier 4, the 13 §5.21 mixed-tier calls, the PRESERVE decisions, the D20 `authenticateJWT` exclusions — is roughly 700 handlers of adjudication and is not reviewable by arithmetic. **Not attempted. Remains open.**

§5.71's "production-readiness assessment for G4" is likewise **not attempted.**

---

# §3. G5 and G6 failure paths — RULED

v2.40 §7 recorded that G5 and G6 have no stated failure path, and declined to supply one on the grounds that a rollback procedure for a frozen prod is a decision with its own gate rather than documentation cleanup.

**That decision is taken here.**

## §3.1 The ruling — revert-first

**On any G5 or G6 failure, the binding sequence is:**

1. **Return to known-good first.** Revert the deployment before diagnosing.
2. **Re-establish gate integrity** on the known-good state.
3. **Only then** decide fix-forward or escalate.
4. **No gate advancement while still on a suspect state.**

Fix-forward is a decision made *from* known-good. It is never a substitute for returning there.

## §3.2 Adopted precedent

The discipline is adopted from `F-Deploy-1_PhaseB_G2_Implementation_v1.3.md` §6.2, which operationalizes it for workflow-retargeting failure:

> *1. Revert the `deploy-dev.yml` change… 4. Decide: fix forward (new PR with corrected retargeting) or escalate. Either way, §4.4 does not begin until §4.3 gate is achieved on a known-good retargeting commit.*

**This is adopted as procedural discipline, not borrowed keystone authority.** F-Deploy-1's register governs F-Deploy-1. The sequence is adopted here on its merits and is ruled for F-AUTH-1 by this revision. F-Deploy-1's own dispositions, gates, and FD numbers are unaffected and are not cited as controlling anything in F-AUTH-1.

## §3.3 Why revert-first, given a FROZEN prod

Both revert and fix-forward are unplanned prod-touching actions on a frozen prod. Revert-first is the correct default regardless:

**A revert has a known target.** The pre-cutover state ran in production and its behaviour is observed. A forward fix authored under time pressure after a failure has neither property.

**Diagnosis is safer from known-good.** Fix-forward requires diagnosing correctly on the first attempt while the failure is live. Revert-first decouples restoring service from understanding the failure.

**G6 raises the stakes.** By G6 the server has been up overnight and users may have written data against the new build. A revert is still the right first move, but the data question is real: **if a G6 revert would strand or invalidate writes made during the soak, that is an escalation, not a routine rollback.** Recorded, not resolved — assessing it requires knowing what the overnight writes touched.

## §3.4 Adopted from F-Deploy-1 §6.4 — doubt at the gate

F-Deploy-1 §6.4 reasons about a point past which no planned rollback exists, and concludes: *"If there is any doubt at the §4.5 gate, extend §4.4 burn-in by another 7 days rather than ship §4.5.2 and discover a problem with no rollback."*

**Adopted for F-AUTH-1:** doubt at the G4 gate extends the G4 soak. It does not proceed to G5. G5 is the prod cutover on a frozen prod, and it is the point past which failure handling becomes incident response rather than gate mechanics.

## §3.5 v2.40 §7 — CLOSED

The gap recorded at v2.40 §7 is closed by this ruling for the failure-path question. The G6 data-strand question at §3.3 is newly recorded and open.

---

# §4. What this revision establishes

- **CP12-G4 re-verified: 0 true positives.** Track G3's grep clause is fully discharged (§1.4).
- **v2.39 §2.1 corrected**: the probe is mis-filed at §5.57, not absent (§1.1).
- **New §5.57 false-positive class**: Item 15 `// PUBLIC:` rationale comments (§1.3).
- **CP1–CP12 count chain reconciles** 6 → 1,307 within the import band (§2.1).
- **G5/G6 failure paths ruled**: revert-first (§3.1).

**Track G3 remains OPEN** on §5.71's audit-pass qualitative clause and its production-readiness assessment (§2.3). Track G4 is not entered.

---

# §5. What this revision does not do

- Does not ship code, change any unit disposition, or alter any PR state.
- Does not close Track G3. Does not enter Track G4.
- Does not re-audit CP1–CP12 disposition judgments (§2.3).
- Does not discharge §5.71's production-readiness assessment (§2.3).
- Does not resolve the G6 data-strand question (§3.3).
- Does not amend §21 itself — §1.1 supplies a locked forward pointer; amending v2.37's §21 body is not possible under additive-supersede, and a future revision may choose to restate §21 in full.
- Does not discharge §7. Every runtime 200/401 assertion remains owed at Track G4.
- Does not mint PE, FD, or XK numbers.
- Does not claim or open a prod window. Prod remains FROZEN; confirm freeze status live before any prod-touching action.
- **No live database contact.** Derived entirely from git against origin/main at `1b3de5ca`.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-09. Main at `1b3de5ca`. Predecessor: v2.41.*
*Type: CP12-G4 closure + G5/G6 failure-path ruling. Corrects v2.39 §2.1. Amends v2.37 §5.57. Closes v2.40 §7. Supplies a locked forward pointer to §5.57 for CP12-G4. Mints nothing. Ships nothing. Changes no gate.*
