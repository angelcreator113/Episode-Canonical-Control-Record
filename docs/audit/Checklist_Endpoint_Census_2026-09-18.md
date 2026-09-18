# Episode Production Checklist Endpoint Census

**Basis:** `origin/main` at `ab1ac90b794b91b412e82b47be70cf74377cd7b8` (2026-09-18).
**Source:** `frontend/src/components/Episodes/EpisodeProductionChecklist.jsx`.
**Scope:** static route, model/raw-SQL, table, and canon-capture census. No app run, database connection, host contact, or production action.

## `CHECKLIST_SECTIONS` verbatim

```js
const CHECKLIST_SECTIONS = [
  {
    id: 'brief',
    icon: '📋',
    label: 'Episode Brief',
    items: [
      { id: 'arc_position',      label: 'Arc position set',           required: true  },
      { id: 'archetype',         label: 'Episode archetype chosen',   required: true  },
      { id: 'designed_intent',   label: 'Designed intent set',        required: true  },
      { id: 'narrative_purpose', label: 'Narrative purpose written',  required: false },
      { id: 'forward_hook',      label: 'Forward hook written',       required: false },
    ],
  },
  {
    id: 'world',
    icon: '🌍',
    label: 'Event & Venue',
    items: [
      { id: 'event_linked',      label: 'Event linked to episode',    required: true  },
      { id: 'venue_set',         label: 'Venue assigned',             required: false },
      { id: 'venue_image',       label: 'Venue image generated',      required: false },
      { id: 'invitation_exists', label: 'Invitation generated',       required: false },
    ],
  },
  {
    id: 'scene',
    icon: '🎬',
    label: 'Scene Plan',
    items: [
      { id: 'scene_sets',        label: 'Scene sets assigned',        required: true  },
      { id: 'scene_plan',        label: 'Scene plan generated (14 beats)', required: true  },
      { id: 'scene_plan_locked', label: 'Scene plan locked',          required: false },
    ],
  },
  {
    id: 'wardrobe',
    icon: '👗',
    label: 'Wardrobe & Outfit',
    items: [
      { id: 'wardrobe_ready',    label: 'Wardrobe pieces uploaded',   required: true  },
      { id: 'outfit_picked',     label: 'Outfit picked for event',    required: false },
    ],
  },
  {
    id: 'overlays',
    icon: '📱',
    label: "Lala's Phone",
    items: [
      { id: 'overlays_generated', label: 'Phone screens generated',   required: false },
    ],
  },
  {
    id: 'social',
    icon: '📱',
    label: 'Social & Content',
    items: [
      { id: 'social_checklist',  label: 'Social media checklist',     required: false },
      { id: 'title_generated',   label: 'Episode title (AI-generated)', required: false },
    ],
  },
  {
    id: 'intelligence',
    icon: '🧠',
    label: 'Intelligence',
    items: [
      { id: 'character_state',   label: 'Character state loaded',     required: true  },
      { id: 'show_brain',        label: 'Show Brain accessible',      required: false },
    ],
  },
];
```

## Endpoint census

The checklist has 19 items and 10 API calls. `route file:line` is the route declaration, not the frontend call line. `in canon` is measured only against `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`.

| section | item | API path | route file:line | table | in canon | note |
|---|---|---|---|---|---|---|
| Episode Brief | arc_position; archetype; designed_intent; narrative_purpose; forward_hook | `GET /api/v1/episode-brief/:episodeId` | `src/routes/episodeBriefRoutes.js:18` | `episode_briefs` via `EpisodeBrief.findOne` | present (27) | Reports field presence; catch converts route failure to all false. |
| Event & Venue | event_linked; venue_set; venue_image; invitation_exists; outfit_picked | `GET /api/v1/world/:showId/events` | `src/routes/worldEvents.js:35` | `world_events` via route model/query; returned event JSON also carries linked asset/scene fields | present (62) | Reports the first event whose `used_in_episode_id` matches; not a separate venue or outfit-table check. |
| Scene Plan | scene_sets | `GET /api/v1/episodes/:episodeId/scene-sets` | `src/routes/episodes.js:1043` | `scene_set_episodes` and included `scene_sets` | present (7); `scene_sets` present (42) | Reports array non-empty. |
| Scene Plan | scene_plan; scene_plan_locked | `GET /api/v1/episode-brief/:episodeId/plan` | `src/routes/episodeBriefRoutes.js:125` | `scene_plans` via `ScenePlan.findAll` | present (21) | Reports any plan; lock status is `every(b => b.locked)`. The UI label says 14 beats but the endpoint does not enforce 14. |
| Wardrobe & Outfit | wardrobe_ready | `GET /api/v1/wardrobe?show_id=...&limit=5` | `src/routes/wardrobe.js:197` (mounted `src/app.js:749`) | `wardrobe` via `wardrobeController.listWardrobeItems` | present (68) | Reports any returned item, not episode/event-specific readiness. |
| Wardrobe & Outfit | outfit_picked | `GET /api/v1/world/:showId/events` | `src/routes/worldEvents.js:35` | `world_events` | present (62) | Derived from `linkedEvent.outfit_pieces`; JSON parsing errors fall into the enclosing catch and set only `event_linked` false. |
| Lala's Phone | overlays_generated | `GET /api/v1/ui-overlays/:showId` | `src/routes/uiOverlayRoutes.js:14` | `assets` via raw `FROM assets` and `asset_type = 'UI_OVERLAY'` | present (48) | **ID/label mismatch:** checklist id `overlays` is labelled `Lala's Phone`, and this endpoint counts UI overlay assets, not PhoneMission rows. |
| Social & Content | social_checklist | `GET /api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=...&limit=1` | `src/routes/assets.js:76` (mounted `src/app.js:684`) | `assets` via asset route/model | present (48) | Reports one matching asset. |
| Social & Content | title_generated | no API call | none | `episodes` only, from `episode.title` and `episode.description` props | present (42) | Client-derived heuristic; no endpoint or table read in this component. |
| Intelligence | character_state | `GET /api/v1/characters/lala/state?show_id=...` | `src/routes/evaluation.js:185` (`/characters/:key/state`) | `character_state` via `getOrCreateCharacterState` | present (12) | The literal `lala` fills `:key`; catch returns false. |
| Intelligence | show_brain | `GET /api/v1/franchise-brain/entries?category=...` | `src/routes/franchiseBrainRoutes.js:31` | `franchise_knowledge` via route model | present (18) | Reports any active franchise-law entry; catch returns false. |
| script action | Write Script | `POST /api/v1/episode-brief/:episodeId/generate-script` | `src/routes/episodeBriefRoutes.js:202` | `episode_briefs`, then generated script is saved to `episodes` | `episode_briefs` present (27); `episodes` present (42) | Not a readiness item, but included because the component owns the action. AI availability/authentication can fail independently of checklist state. |

## Route, model, and raw-SQL trace

- `episodeBriefRoutes.js:18` reads `EpisodeBrief.findOne`; `src/models/EpisodeBrief.js:58` sets `tableName: 'episode_briefs'`. `episodeBriefRoutes.js:125` reads `ScenePlan.findAll`; `src/models/ScenePlan.js:42` sets `scene_plans`. The generator at `:202` calls `generateGroundedScript` and updates `Episode`.
- `worldEvents.js:35` is the event list handler. Its event records are `WorldEvent` rows (`src/models/WorldEvent.js:247`, table `world_events`); venue, invitation, scene-set, and outfit values are fields/JSON on the returned event or linked records, not separate checklist calls.
- `episodes.js:1043` loads `SceneSetEpisode.findAll` with `SceneSet`; `src/models/SceneSetEpisode.js:26` sets `scene_set_episodes`, and `src/models/SceneSet.js:112` sets `scene_sets`.
- `wardrobe.js:197` delegates to `wardrobeController.listWardrobeItems`; `src/models/Wardrobe.js:359` sets `wardrobe`.
- `uiOverlayRoutes.js:14` uses raw SQL: `SELECT ... FROM assets WHERE asset_type = 'UI_OVERLAY' ...`; `src/models/Asset.js:239` sets `assets`. The asset list at `assets.js:76` is mounted at `/api/v1/assets`.
- `evaluation.js:185` calls `getOrCreateCharacterState`; `src/models/CharacterState.js:33` sets `character_state`.
- `franchiseBrainRoutes.js:31` reads the registered `FranchiseKnowledge` model; `src/models/FranchiseKnowledge.js:49` sets `franchise_knowledge`.
- `PhoneMission` is a separate model and table: `src/models/PhoneMission.js:39` sets `phone_missions`; its routes are under `/api/v1/ui-overlays/:showId/missions` in `src/routes/phoneMissionRoutes.js:17`. The checklist does not call that route. `phone_missions` is not the table reached by the checklist's `overlays` call; whether it is in canon is checked below.

## Canon grep-count evidence

The capture presents table rows with one leading space. Exact requested count form used for each unique table:

```text
grep -c '^ episode_briefs[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
27
grep -c '^ world_events[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
62
grep -c '^ scene_set_episodes[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
7
grep -c '^ scene_plans[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
21
grep -c '^ wardrobe[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
68
grep -c '^ character_state[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
12
grep -c '^ assets[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
48
grep -c '^ franchise_knowledge[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
18
grep -c '^ episodes[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
42
grep -c '^ phone_missions[ ]' docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
0
```

Result: the nine tables reached by the checklist are **present** in the 2026-09-17 canon capture. `phone_missions` is **absent**. `Canon_AbsentTable_Classification_2026-09-17.md` classifies its absent-table census and states that absent names are not themselves a ruling; `phone_missions` is not among that note's 56-table input list. Therefore this note records only the measured absence and does not classify it. The PhoneMission table is not in canon.

## Per-section verdicts

| section | verdict | basis |
|---|---|---|
| Episode Brief | reports honestly | The fields are read from `EpisodeBrief`, and a successful response is required for the checks. |
| Event & Venue | would misreport | One event-list failure sets `event_linked` false and does not independently preserve the other item results; several labels are inferred from event JSON rather than separately verified tables. |
| Scene Plan | reports honestly | Plan existence and lock state are computed from returned `ScenePlan` rows, though the “14 beats” label is not enforced. |
| Wardrobe & Outfit | would misreport | `wardrobe_ready` is show-level and any-item based; `outfit_picked` comes from the event payload, not a separate outfit check. |
| Lala's Phone | reports honestly | It reports UI overlay asset count for the endpoint it actually calls, but the section name does not identify the separate PhoneMission system. |
| Social & Content | social_checklist reports honestly; title_generated is not table-backed | Social checklist presence is table-backed, but title generation is a client heuristic from props and has no API/table census. |
| Intelligence | reports honestly | Both successful calls expose the values tested, subject to the generic false-on-error catches. |

## The `overlays` / Lala's Phone mismatch

The section id `overlays` is labelled `Lala's Phone`, but `GET /api/v1/ui-overlays/:showId` reaches `uiOverlayRoutes.js:14`, whose raw query reads `assets` rows with `asset_type = 'UI_OVERLAY'`. It does not reach `phone_missions`. PhoneMission's table is `phone_missions` (`src/models/PhoneMission.js:39`), and the canon count above is zero, so PhoneMission's table is absent from the 2026-09-17 canon capture. The endpoint therefore measures generated phone-screen image assets, not phone missions or playthrough state.

## What this note does not do

- It recommends no fix.
- It changes no code.
- It rules nothing.
- The FD, XK, and PE tails remain unminted.
- It does not contact the host, AWS, Cognito, or a database, and it does not run the app.
- It is to be filed with `/audit-file`.

## Raw route grep evidence

```text
git grep -n -E "api\.(get|post)\(" -- frontend/src/components/Episodes/EpisodeProductionChecklist.jsx
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:140:        const { data } = await api.get(`/api/v1/episode-brief/${episode.id}`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:154:          const { data } = await api.get(`/api/v1/world/${showId}/events`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:173:        const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:182:        const { data } = await api.get(`/api/v1/episode-brief/${episode.id}/plan`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:192:        const { data } = await api.get(`/api/v1/wardrobe?show_id=${showId}&limit=5`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:201:        const { data } = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:210:        const { data } = await api.get(`/api/v1/ui-overlays/${showId}`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:221:        const { data } = await api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`);
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:232:        const { data } = await api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1');
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:249:      const res = await api.post(`/api/v1/episode-brief/${episode.id}/generate-script`, { showId });
```
