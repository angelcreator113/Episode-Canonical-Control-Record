| **PRIME STUDIOS** **F-STATS-1 DECISION NOTE** *What event difficulty is computed from at this basis, where it and its inputs are read, and Evoni's decision that projected and canonical difficulty be separated. Evidence only: fixes nothing, changes no code.* |
| --- |

**Document version**

A new standalone note: not a Fix Plan revision and not an amendment.
Basis: `origin/main` at `9770a5be65cf43d99c469f627b669dea340c11a0`
(#1758), measured 2026-09-24. Every file:line below is at that basis.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

EVIDENCE NOTE, filed inside the locked sequence as F-Stats-1 evidence.

- It records one decision of Evoni's (§5) as **ATTESTED**, as she gave
  it. The issue that commissioned this note (#1759) sets that standing.
  It is not upgraded here to RULED.
- Everything else is **MEASURED**: a read of this repository that anyone
  with a clone can repeat.
- It fixes nothing, alters no formula, mints no FD, XK or PE number,
  writes no Fix Plan, and does not change the locked sequence.

## §1. The formula

**MEASURED.** There is exactly one function that computes an event
difficulty score: `calcEventDifficulty`, in
`frontend/src/utils/eventReadiness.js:106-114`.

```
export function calcEventDifficulty(event) {
  const ev = event || {};
  const p = ev.prestige || 5;
  const s = ev.strictness || 5;
  const dressComplexity = (ev.dress_code_keywords?.length || 0) * 0.5;
  const deadlineWeight = { none: 0, low: 1, medium: 2, high: 3, tonight: 4, urgent: 5 }[ev.deadline_type] || 2;
  const raw = (p * 0.35) + (s * 0.3) + (deadlineWeight * 0.2) + (dressComplexity * 0.15);
  return Math.min(10, Math.max(1, Math.round(raw * 10) / 10));
}
```

`eventDifficultyLabel` (`:116-121`) maps the score to Easy (≤3),
Medium (≤5), Hard (≤7) and Extreme (above 7). It returns text and
colours only.

The backend has no difficulty computation:

```
$ grep -rn "calcEventDifficulty\|eventDifficulty\b\|difficulty_score" src/
(no output)
$ grep -rln "calcEventDifficulty" frontend/src
frontend/src/utils/eventReadiness.js
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/EventPackagePage.jsx
```

**The inputs and where each comes from.** Column facts are from
`src/models/WorldEvent.js`, `src/migrations/20260219000003-world-events.js`
and the canon capture
`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`.

| Input | Weight | Column | Origin |
|---|---|---|---|
| `prestige` | 0.35 | INTEGER NOT NULL DEFAULT 5 (model `:135-138`, migration `:55-58`, canon `is_nullable = NO`) | Chosen on manual create and edit. Derived by rule, or random, on the automated paths (§2). The column default is 5 otherwise |
| `strictness` | 0.30 | INTEGER NOT NULL DEFAULT 5 (model `:146-149`, migration `:66-69`, canon `NO`) | Chosen on manual create and edit. Derived from prestige, sometimes plus randomness, on four paths (§2). The column default is 5 on the rest |
| `deadline_type` | 0.20 × weight | VARCHAR, nullable, DEFAULT `'medium'` (model `:152-155`, migration `:72-75`, canon `YES`) | Chosen on manual create and edit. Derived from prestige bands on four paths (§2). The column default `'medium'` on the rest |
| `dress_code_keywords` (count) | 0.5 × 0.15 = **0.075 per keyword** | JSONB, nullable, DEFAULT `[]` (model `:165-168`) | Chosen on manual create and edit. Since #1758, no creation path derives it. The model default `[]` otherwise |

## §2. How prestige, strictness and deadline type are set, per creation path

**MEASURED**, re-derived at the basis, not carried from #1758's PR body.
"Random" means `Math.random()`.

| Path | Prestige | Strictness | Deadline type |
|---|---|---|---|
| `POST /world/:showId/events` (`src/routes/worldEvents.js:393-394`) | body, default `5` | body, default `5` | body, default `'medium'` |
| bulk-seed (`worldEvents.js:1198-1201`) | `ev.prestige \|\| 5` | `ev.strictness \|\| 5` | `ev.deadline_type \|\| 'medium'` |
| from-profile (`worldEvents.js:2348`, `:2376-2377`) | follower tier: mega 8, macro 6, mid 4, else 3 | `Math.min(10, prestige + Math.floor(Math.random() * 2))`: **prestige + random 0 or 1** | `prestige >= 8 ? 'urgent' : prestige >= 5 ? 'medium' : 'low'` |
| calendar auto-spawn (`src/services/eventAutomationService.js:519`, `:524-525`) | `Math.min(10, (calendarEvent.severity_level \|\| 5) + Math.floor(Math.random() * 3))`: **severity + random 0 to 2** | **prestige + random 0 or 1** (same expression as from-profile) | same three bands |
| feed pipeline, opportunity to event (`src/services/feedEventPipelineService.js:384`, `:426-427`) | `opp.prestige \|\| config.prestige_range[0] + 2`. The opportunity's own prestige is set at `:296` as `config.prestige_range[0] + Math.floor(Math.random() * (config.prestige_range[1] - config.prestige_range[0]))`: **random within the type's range**, and never its top value | `Math.min(10, prestige + 1)` | same three bands |
| momentum chain (`feedEventPipelineService.js:620`, `:661-662`) | `chainConfig.suggested_prestige \|\| Math.min(10, (parent.prestige \|\| 5) + 1)` | `Math.min(10, prestige + 1)` | `prestige >= 8 ? 'urgent' : 'medium'`, **never `'low'`** |
| career pipeline, opportunity to event (`src/services/careerPipelineService.js:192`, INSERT `:224-226`) | `opp.prestige \|\| 5` | not written, so the column default `5` | not written, so the column default `'medium'` |
| calendar spawn-world-event (`src/routes/calendarRoutes.js:563`) | `req.body.prestige \|\| Math.min(10, (calendarEvent.severity_level \|\| 5) + 2)` | not written, so `5` | not written, so `'medium'` |
| AI generate-events (`src/routes/eventGeneratorRoute.js:103`, `:105`) | generator's value, else `3` | generator's value, else `3` | not written, so `'medium'` |

On every automated path, then, strictness and deadline type are chosen
by nobody. Two paths add randomness to strictness, one adds it to
prestige directly, and one inherits it through the opportunity's
prestige.

## §3. Defaults substituted at calculation time

**MEASURED.** `calcEventDifficulty` always returns a number, whether or
not its inputs exist:

- `prestige || 5` and `strictness || 5` replace a missing value **or a
  zero** with 5;
- an unknown or missing `deadline_type` weighs 2 (medium);
- `'none'` maps to 0, and `0 || 2` turns that into 2, so **`'none'`
  scores exactly like `'medium'`**.

The formula, run as written on the inputs below (a copy of the function
body run under `node`, not imported):

```
empty {}              -> 3.7
deadline none         -> 3.7   vs medium 3.7
all max, 0 keywords   -> 7.5
all min (1,1,low)     -> 1
black tie (2 kw)      -> 3.8
5 kw casual chic...   -> 4
40 kw                 -> 10
```

What those runs show:

- An event with no inputs at all scores 3.7, labelled Medium.
- Without keywords, the ceiling is 7.5, so Extreme is reachable only at
  the top of every input.
- The keyword term counts words, not how demanding the dress code is:
  "black tie" (two words) scores below "casual chic vibrant fun playful"
  (five words).

**Related, MEASURED.** Evaluation's deadline penalty (§4) treats
`'none'` differently from difficulty. `computeDeadlinePenalty`
(`src/utils/evaluationFormula.js:173-190`) returns 0 for a missing
deadline, 3 for `'low'`, 6 for `'medium'`/`'tomorrow'`, and 12 for
`'high'`/`'tonight'`/`'urgent'`. So `'none'` costs 0 in evaluation but
weighs as medium in difficulty.

## §4. Where difficulty, and its inputs, are read

**MEASURED.** The computed score is **never persisted and never reaches
evaluation, rewards or progression.** Every reader of it is display or
planning:

| Reader | Use |
|---|---|
| `WorldAdmin.jsx` `getSequenceWarnings`, `:787-794` ("Difficulty spike" when consecutive linked episodes differ by ≥4). The warnings can be sent to `POST /world/:showId/events/ai-fix` as prompt text | PLANNING (and AI suggestion text) |
| `WorldAdmin.jsx` "Avg Difficulty" tile (`:2292`); "Season Arc — Difficulty Curve" (`:2311-2316`); event-detail badge (`:3350-3351`, `:3579`); Compare Events row (`:4355`) | DISPLAY |
| `EventPackagePage.jsx` `:246-247` and the difficulty chip at `:921-924` | DISPLAY |

`episode_briefs.event_difficulty` is a JSONB snapshot of the raw inputs,
not a score:

- `episodeGeneratorService.js:637-643` writes `{ strictness,
  deadline_type, deadline_minutes }`, each `?? null`, with no
  substitution.
- The brief `PUT` whitelist also allows writing it.
- Its only reader is `EpisodeOverviewTab.jsx:304` and `:795-801`, which
  is DISPLAY.

**The inputs themselves are read directly** by evaluation, rewards and
progression. That is where the numbers from §2 have consequences:

| Reader | Input | Use |
|---|---|---|
| `evaluate()`, `src/utils/evaluationFormula.js:133`: `deadlinePenalty = clamp(st.deadline_penalty \|\| computeDeadlinePenalty(e), 0, 15)`, subtracted from the score | `deadline_type` | EVALUATION |
| `completeEpisode`, `src/services/episodeCompletionService.js:232-237`: `eventContext = { prestige: event.prestige \|\| 5, …, strictness: event.strictness \|\| 5, deadline: event.deadline_type }` (substitutes defaults) | all three | EVALUATION (the input) |
| `scoreOutfitForEvent`, `src/services/wardrobeIntelligenceService.js:692` `eventPrestige = event.prestige \|\| 5` to an expected tier and a tier-gap delta. It feeds `outfit_match` in completion and in `POST /episodes/:id/evaluate` | `prestige` | EVALUATION |
| `computeWardrobeBonuses`, `episodeCompletionService.js:72-110`: prestige-based expected tier, stress and reputation adjustments | `prestige` | REWARDS |
| `characterSyncService.js:125`: host relevance boost `(event.prestige \|\| 5) / 10`; `:223-226` follow-up opportunity count by prestige | `prestige` | REWARDS / PROGRESSION |
| `computeStatDeltas`, `evaluationFormula.js:288`: `deltas.coins = (tierCoinRewards[tier] \|\| 0) - (e.cost \|\| 0)` | cost (§6) | REWARDS |
| `careerPipelineService.js:69-74`: goal increments by opportunity prestige | `prestige` | PROGRESSION |
| `worldEvents.js` next-suggestions: `:4262-4263` low-strictness stress relief; `:4287-4288` prestige against reputation | `strictness`, `prestige` | PLANNING |
| `careerGoals.js:616-618`: prestige against reputation ("sweet spot difficulty") | `prestige` | PLANNING |

**Strictness has no live effect on evaluation, rewards or
progression.** Its one scoring use, `computeOutfitMatch`
(`evaluationFormula.js:200-225`), is dead code: its only import is
`computeOutfitMatch: _computeOutfitMatch` at `src/routes/evaluation.js:19`,
never called. `wardrobeIntelligenceService.js` contains no reference to
`strictness` (`grep -c strictness` returns `0`).

**Which readers would need the canonical value, and which could use the
projection** (INFERRED from the table above, per the decision in §5):

- **Would need canonical inputs:**
  - evaluation, through `deadline_type` in the penalty and prestige in
    outfit scoring;
  - completion's `eventContext`;
  - rewards, through prestige-based bonuses, relevance and cost in coins;
  - progression, through prestige-based goal increments.

  None of them read the computed score today. They read the raw inputs,
  and completion substitutes defaults for missing ones.
- **Could use the projection:**
  - every reader of the computed score: the spike warning, the tile, the
    curve, the badges, the chip and the compare row;
  - the planning readers (next-suggestions, `careerGoals`);
  - the brief snapshot display.

So separating the **score** is contained, because only display and
planning read it. The decision's rule that a canonical value never
silently substitutes a default reaches further: it touches the **inputs**
that evaluation, rewards and progression read directly, and
`completeEpisode` substitutes those defaults today.

## §5. Evoni's decision, 2026-09-23 — ATTESTED

Recorded as she gave it (issue #1759):

1. **Projected difficulty** may use suggestions and defaults, for
   planning, and is never used by evaluation.
2. **Canonical difficulty** uses only accepted canonical values. A
   missing required input means canonical difficulty is not ready; it is
   never silently substituted.
3. **The dress-code-keyword count** is to be reassessed as a difficulty
   signal, since it measures how many words a dress code has rather than
   how demanding it is.

This note does not implement, extend or interpret the decision beyond
setting it beside the measurements above.

## §6. The same problem for cost

**MEASURED.** `cost_coins` is INTEGER NOT NULL DEFAULT 100 (model
`:141-144`, migration `:61-64`, canon `is_nullable = NO`). It is still
derived from prestige (`prestige >= 8 ? 500 : prestige >= 6 ? 300 :
prestige >= 4 ? 150 : 50`) on four creation paths:

- from-profile (`worldEvents.js:2375`);
- calendar auto-spawn (`eventAutomationService.js:523`);
- the opportunity pipeline (`feedEventPipelineService.js:425`);
- the momentum chain (`feedEventPipelineService.js:660`).

It reaches rewards directly: `computeStatDeltas` subtracts it from coins
(`evaluationFormula.js:288`). Leaving it out stores 100, which is no
more chosen than the derived value, and null is not allowed. PR #1758
(`9770a5be`) removed derived time and dress code at creation, and left
cost derived for this reason. Fixing it needs a migration. Per Evoni's
note on #1758, cost is to be decided together with strictness and
deadline type.

## §7. What this note does not do

This note:

- fixes nothing, and alters neither `calcEventDifficulty`,
  `computeDeadlinePenalty`, nor any creation path;
- rules nothing beyond recording Evoni's decision (§5) as ATTESTED;
- writes no Fix Plan, mints no FD, XK or PE number, and does not change
  the locked sequence;
- does not treat the `'none'`-as-medium mapping (§3), the dead
  `computeOutfitMatch` (§4), or the random components (§2) as findings.
  They are recorded as measured behaviour only;
- does not decide how or when the split in §5 is built, or which reader
  moves first;
- amends no filed document;
- makes no host, AWS, database or Cognito contact, and records no secret.

## §8. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from `F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §12.
Nothing minted here.

## §Standing

- §1–§4 and §6 are MEASURED: repository reads at the basis, each with
  file:line or the command and its output.
- §4's split of readers into canonical and projection is marked
  INFERRED, because it applies §5's decision to the measured readers.
- §5 is ATTESTED: Evoni's decision as she gave it, standing set by the
  commissioning issue and not upgraded.
- Nothing is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1).
  Agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`).

*Type: F-Stats-1 evidence / decision note. Rules: nothing. Mints:
nothing. Discharges: nothing. Host/AWS/DB/Cognito contact by the filing
session: none. Task: #1759.*
