# F-Sec-3 / F-Stats-1 Phase B — character_state Surface Inventory — 2026-07-03

Warm-session Path A inventory. Mints no FD; decides nothing; executes nothing.
Grounded entirely from git grep origin/main at 0515f565, on screen this session.
Serves both F-Stats-1 Phase B (raw-SQL -> ORM migration) and F-Sec-3 (key sweep):
same crack, per the 2026-07-02 decision note (#886). Canonical key = 'lala'
(decision note); this inventory maps the surfaces, it does not re-argue the decision.

## 1. character_state — direct SQL surfaces

| # | Surface | Key | R/W | Mechanism | Class |
|---|---|---|---|---|---|
| 1 | careerGoals.js:387 | lala | R | raw SQL | user-facing (goals) |
| 2 | careerGoals.js:530 | lala | R | raw SQL | user-facing |
| 3 | careerGoals.js:610 | lala | R | raw SQL | user-facing |
| 4 | episodes.js:942 | lala | R | raw SQL | user-facing |
| 5 | wardrobe.js:1236 + 1251 | lala | R+W | raw SQL, coin deduct | user-facing (purchase) |
| 6 | wardrobe.js:1342 + 1366 | lala | R+W | raw SQL, coin set | user-facing (Edit Stats class) |
| 7 | worldEvents.js:777 | lala | R | raw SQL | user-facing |
| 8 | wardrobeIntelligenceService.js:995 | lala | R | raw SQL | backend |
| 9 | careerPipelineService.js:340 | justawoman | R | raw SQL | backend (tier access) |
| 10 | episodeCompletionService.js:176 + 186-187 (INSERT seeds 500 coins) + 405 (UPDATE deltas) | justawoman | R+W | raw SQL | backend (episode-complete deltas) |
| 11 | episodeGeneratorService.js:378 | justawoman | R | raw SQL | backend |
| 12 | episodeScriptWriterService.js:289-290 | justawoman | R | raw SQL | backend |
| 13 | worldEvents.js:3838-3839 | justawoman | R | raw SQL | backend (:3833 comment admits inconsistency) |
| 14 | evaluation.js:47-49 (R by :characterKey), :66 (INSERT), :159 (bulk reset UPDATE), :644 (UPDATE) | DYNAMIC — :227/:244 req.params.key; :262 write-path default 'lala' | R+W | raw SQL | API surface, caller-controlled |
| 15 | socialProfileRoutes.js:1010 | lala | R | ORM where-clause — model target needs classification (likely NOT character_state table) | backend |

Raw-SQL writer count for Phase B: surfaces 5, 6, 10, 14 (4 writer surfaces,
7+ write statements). Reconciles the "9+ remembered vs 7 planned" drift:
the true count is grounded here, supersedes both.

## 2. character_state_history — the ledger is split-keyed too

| Surface | Key | Op |
|---|---|---|
| wardrobe.js:1394-1395 | lala | INSERT (wardrobe_purchase) |
| wardrobe.js:1408-1409 | lala | INSERT (manual) |
| evaluation.js:653-654 | dynamic | INSERT |
| episodeCompletionService.js:416-418 | justawoman | INSERT (computed) |
| financialTransactionService.js:515-517 | justawoman | INSERT (computed) |
| financialPressureService.js:208 | n/a | **UPDATE — mutates the append-only ledger** |

FINDING (for F-Sec-3 planning, not minted here): the history table inherits the
key split — consolidation must migrate BOTH tables or the ledger misattributes
deltas. financialPressureService.js:208 UPDATE violates the ledger's append-only
design premise (migration 20260218100000 header) — separate finding class.

## 3. Landmines and contradictions

- **evaluation.js:622 comment claims "'justawoman' is the canonical key writers
  actually use"** — directly contradicts the canonical decision AND
  worldEvents.js:3833-3834. Delete/correct in the migration; until then it
  actively misleads.
- **Unique constraint uncertainty:** migration :75 attempts
  idx_character_state_unique (show_id, season_id, character_key) with a catch
  fallback (:81) to a NON-unique lookup index. Whether canon actually carries
  the unique index is a LIVE-DB question — cold-gated, cannot be answered warm.
  Both branches change the consolidation migration's shape (dup rows possible
  if fallback fired).
- **episodeCompletionService.js:186-187 INSERT seeds a fresh 'justawoman' row
  (500 coins)** if none exists — the war-chest double-ledger bug's spawn point.
- **evaluation.js callers control the key** — frontend call-site audit owed
  (frontend IA audit scope, flagged 2026-05-22, not chased here).

## 4. Explicitly OUT of scope (fence — do not grep these into the migration)

- JSONB `character_states` (plural): tierFeatures, worldStudio.js:3372+,
  WorldStateSnapshot, migration 20260309000000 — the JSONB-where-join-tables-
  belong pattern; different remediation.
- `justawomaninherprime` / justawomanAsset: compositions, CompositionService,
  ThumbnailGeneratorService, AssetService — thumbnail/promo asset plumbing.
- Registry seed keys 'just-a-woman': characterRegistry.js:856,
  update-character-profiles.js:61 — book-protagonist records, correct as-is
  per decision note.
- `is_justawoman_record` (SocialProfile flag), memories/engine.js seed-alias
  maps ('justawoman' <-> 'just-a-woman'), script-line labels (justawoman_line/
  _action), POV/prompt strings, wardrobe.js:948 req.body variable named
  character_state.

## 5. Open items carried (all cold or out-of-scope-here)

1. Live-DB: does idx_character_state_unique exist in canon? Row counts per key?
2. socialProfileRoutes.js:1010 model classification.
3. evaluation.js frontend call-site key audit.
4. history-table consolidation strategy (both tables, one migration).
5. financialPressureService ledger-mutation finding — raise at F-Sec-3 planning.

Entry state: origin/main 0515f565, no open PRs. Cold sessions re-derive live.