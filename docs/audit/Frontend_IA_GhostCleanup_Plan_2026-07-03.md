# Ghost-Import Cleanup Plan — Frontend IA — 2026-07-03

**Type:** Plan document. Authorizes NO deletions. Execution is a separate, gated code PR.
**Sources (on main):** IA Part 1 F-1 (five ghost lazy imports); Part 2 Q2 / F-2-2 (ghost imports with active tests); Part 3 Sec 3 (per-ghost call-site classification + two tripwires), Sec 4 (SocialImport keep-live).
**Reconcile live before execution:** reachability can change; re-verify every "no live importer" claim at execution session start, same discipline that voided the §7 RelationshipEngine plan.

---

## Scope

**IN:** the five Q2 ghost imports (imported in App.jsx, route redirects away, file exists) and their dependents.

**OUT — do NOT touch:**
- **RelationshipEngine** — NOT a ghost. Two live hosts (App route :427, WorldStudio tab :1165). Feature-retirement decision, see §7 correction (PR #893, `f5e3931b`). Part 3 ledger OI-2 ("7-artifact plan stands") is STALE — superseded by #893.
- **SocialImport.jsx** — LIVE, load-bearing (F-3-7). Routed wrapper delegates to it. DO NOT delete.
- **NovelAssembler.jsx** — live, distinct social-import surface.

---

## Per-file disposition

| # | Ghost | Class | Action | Dependents / notes |
|---|-------|-------|--------|--------------------|
| 1 | FranchiseBrainPage | DELETE-CLEAN | Delete component file; remove unused lazy import in App.jsx (keep redirect route). | No refs outside App.jsx + own files. F-Franchise-1 fossil. No test file. |
| 2 | ShowBrain | DELETE-CLEAN | Same as #1. | Same — fully unreferenced fossil. No test file. |
| 3 | StorytellerPage | DELETE-ABSORBED | Delete component; remove lazy import (keep redirect). | Decomposed into WriteMode.jsx + 8+ components (lineage comments, not imports). **GATE:** confirm zero live `import ... from './StorytellerPage'` before delete. F-11 ScenesPanel is lineage, not an importer — verify. |
| 4 | StoryEngine | DELETE-WITH-CASCADE | Delete component + `StoryEngine.test.jsx`; remove lazy import (keep redirect). THEN delete now-dead `hooks/useStoryEngine.js` + `hooks/useStoryEngine.test.js`. | **TRIPWIRE 1:** `StoryHealthDashboard.jsx:10` imports `'./StoryEngine.css'` — CSS is NOT family-deletable (see Decision below). **TRIPWIRE 2 / F-3-6:** `useStoryEngine.js` is second-order dead ONLY once `StoryEngine.jsx` is gone — order matters. |
| 5 | CharacterGenerator | DELETE-WITH-COMMENTFIX | Delete component + `CharacterGenerator.test.jsx`; remove lazy import (keep redirect). | Live files reference it in COMMENTS ONLY — do NOT delete them, FIX the comments: `constants/characterConstants.js` header ("Both CharacterGenerator.jsx and CharacterRegistryPage.jsx import…") and `hooks/useRegistries.js`. `CharacterRegistryPage.jsx` is the real live consumer. |

---

## Keep-live (enumerated so nothing is deleted by association)

`StoryEngine.css`, `StoryHealthDashboard.jsx`, `constants/characterConstants.js`, `hooks/useRegistries.js`, `SocialImport.jsx`, `NovelAssembler.jsx`.

---

## Decision: StoryEngine.css disposition

`StoryHealthDashboard.jsx:10` imports `StoryEngine.css`. The CSS file is live-consumed despite belonging to a deleted component family.

**Option A — Retain as-is:** keep `StoryEngine.css` under its current name. Zero-risk; leaves a misleadingly-named live file. Naming debt only.
**Option B — Relocate:** extract the needed rules into `StoryHealthDashboard`'s own stylesheet, then delete `StoryEngine.css`. Cleaner end state; requires CSS extraction and visual verification pass.

**Lean: A for the execution PR.** Smaller change scope, fully reversible, does not introduce CSS extraction risk into a removal PR already touching five components and three second-order artifacts. B as a named follow-up if naming clarity is wanted. This plan does not decide; the execution PR author makes the final call.

---

## INVESTIGATE before execution

**`storyEngineConstants.js`** — Part 2 §9 lists it as an orphan constant; Part 3 Sec 3 does NOT classify its consumer. **GATE:** `git grep -n "storyEngineConstants"` — if consumed only by `StoryEngine.jsx` and its test, it cascades with ghost #4; if consumed by a live surface, KEEP. Do not delete on assumption.

---

## Execution ordering (for the future code PR)

1. Remove the five unused lazy-import declarations from App.jsx. Keep ALL redirect routes — the redirects are live behavior; the imports are the ghosts.
2. Delete component files: `StorytellerPage.jsx`, `StoryEngine.jsx`, `FranchiseBrainPage.jsx`, `ShowBrain.jsx`, `CharacterGenerator.jsx`.
3. Delete now-dead test files: `StoryEngine.test.jsx`, `CharacterGenerator.test.jsx`.
4. Delete second-order dead (valid only after step 2 removes `StoryEngine.jsx`): `hooks/useStoryEngine.js` + `hooks/useStoryEngine.test.js`.
5. Comment-fix `constants/characterConstants.js` + `hooks/useRegistries.js` — do NOT delete these files.
6. `StoryEngine.css`: hold per Decision A/B above.
7. `storyEngineConstants.js`: per INVESTIGATE result.

---

## Pipeline (execution PR — not this plan doc)

This is a **code PR** — full hardened pipeline, not doc-only. `deploy-dev` auto-trigger stays disabled; gated PR route.

- **Test-suite impact:** `StoryEngine.test.jsx`, `CharacterGenerator.test.jsx`, and `hooks/useStoryEngine.test.js` are deleted. Test suite must stay green after removal — no regressions on surviving tests.
- **Route Validation** must pass with all five redirect routes intact and the five ghost lazy imports gone.
- Re-run the reachability greps for all five ghosts at execution session start. Do not trust this plan's classifications blind.

---

## What this plan does NOT do

Deletes nothing. Chooses neither CSS option. Does not resolve `storyEngineConstants.js`. Does not touch `RelationshipEngine`, `SocialImport.jsx`, or `NovelAssembler.jsx`.
