# F-Sec-3 / Phase B - Canonical character_key decision + blast radius - 2026-07-02

Warm-session finding. Decision made; execution is cold/box-gated (Phase B blocked on F-Deploy-1).

## Architecture (author-stated this session)
- JustAWoman = the book protagonist (the real person). Registry key: just-a-woman.
- Lala = the character JustAWoman plays in the show. Separate registry entity.
- The show ("Styling Adventures with Lala") belongs to Lala. All show state - coins,
  reputation, influence, wardrobe, friends - is Lala's, because JustAWoman is playing her.

## Decision
Canonical character_key for all character_state = lala.
The show character owns the state ledger. Books are derived from the show, not vice versa.

## Blast radius (grounded from git grep origin/main, on screen this session)
CORRECT already (lala) - no change:
  careerGoals.js, episodes.js, wardrobe.js, worldEvents.js:777,
  wardrobeIntelligenceService.js, evaluation.js:262, socialProfileRoutes.js

WRONG (justawoman) - migrate to lala. Exactly 5 production files:
  1. worldEvents.js:3839 (comment at :3833 confirms known inconsistency, not design)
  2. careerPipelineService.js:340
  3. episodeCompletionService.js:176
  4. episodeGeneratorService.js:378
  5. episodeScriptWriterService.js:290

LEAVE ALONE (just-a-woman) - correct, book-protagonist records, not state writers:
  characterRegistry.js:856 (seed), update-character-profiles.js:61

## Ties to Phase B
Phase B (7 character_state writers -> ORM) and this key migration are the same crack.
Data migration (consolidate justawoman rows into lala) is destructive - cold session,
gated, confirm row counts live before any write. Do NOT run warm.

## Entry state
HEAD 3c3654a6, no open PRs. Cold session: wake-up trio first, re-derive live.