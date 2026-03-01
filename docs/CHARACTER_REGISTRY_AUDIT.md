# Character Registry — Feature Audit Report

> **Date:** June 2025  
> **Scope:** Frontend page, CSS, backend routes, data model, RelationshipWeb integration  
> **Files reviewed:**  
> - `frontend/src/pages/CharacterRegistryPage.jsx` (2,927 lines)  
> - `frontend/src/pages/CharacterRegistryPage.css` (4,797 lines)  
> - `src/routes/characterRegistry.js` (672 lines)  
> - `src/models/RegistryCharacter.js` (229 lines)  
> - `frontend/src/pages/RelationshipWeb.jsx` (561 lines)

---

## 1. Views & Modes

The Character Registry has **three top-level views** and several sub-modes:

### 1a. Browse View (default)
- **Grid mode** — Editorial cast board. Auto-fill cards with portrait/icon + name, subtitle, role badge, status indicator. Hover overlay shows core belief + "→ Open Dossier".
- **List mode** — Archive table. Columns: icon, name, role, appearance mode, status, era. Sortable by name/role/status. Click row → opens dossier.
- **Registry tab pills** — Switch between registries (e.g., "Book 1 Registry"). Includes "+" to create new registry. Active registry shows edit icon.
- **Registry context bar** — Below pills: shows title, description, core rule, edit/delete buttons.
- **Search bar** — Real-time client-side filtering by `display_name`, `character_key`, `subtitle`, `description`.
- **Multi-filter bar** — Canon Tier, Role Type, Era, Status. Each is a pill with dropdown. "All" option clears that filter. Combined "Clear filters" button.
- **Stats strip** — Total characters, accepted, finalized, draft, average wound depth.

### 1b. Dossier View (single character)
Opened by clicking a card/row or via `?charId=xxx` deep link.

**Left panel (30% width):**
- Portrait (upload/remove) or icon/initial fallback
- Display name, subtitle, role badge, appearance mode
- Canon tier, first appearance, era
- Core belief quote
- Status badge (draft/accepted/declined/finalized)
- Quick relationship preview (first 3 from `relationships_map`)
- Action buttons: Accept, Decline, Finalize, + status-dependent actions
- Mobile: collapsible with summary strip toggle

**Right panel (70% width) — 12 tabs:**

| # | Tab | Data Source | Editable? |
|---|-----|------------|-----------|
| 1 | Overview | Core fields | ✅ Yes — name, subtitle, role_type, role_label, appearance_mode, description, core_belief, pressure_type |
| 2 | ✦ Living State | localStorage (`wv_living_states`) + AI generation | ✅ Via generate/confirm/regenerate workflow |
| 3 | Arc Timeline | `story_presence.arc_summary` + AI-generated chapter beats | ❌ Display only — auto-generated |
| 4 | Plot Threads | Backend endpoint (stub) | ❌ Empty — Phase 2 stub |
| 5 | Psychology | Essence profile fields | ✅ Yes — core_desire, core_fear, core_wound, mask_persona, truth_persona, character_archetype, signature_trait, emotional_baseline |
| 6 | Aesthetic DNA | `aesthetic_dna` (JSONB) | ✅ Yes — color_palette, textures, visual_motifs, signature_look, lighting_mood, symbolic_objects |
| 7 | Career | `career_status` (JSONB) | ✅ Yes — current_role, dream_role, workplace, career_conflict, professional_mask, money_relationship |
| 8 | Relationships | `relationships_map` (JSONB) | ✅ Yes — Array of {name, type, dynamic, quote}. Add/remove relationship cards |
| 9 | Story Presence | `story_presence` (JSONB) + `evolution_tracking` display | ✅ Partial — first_scene, last_scene, total_appearances, most_active_chapters, narrative_function. Evolution tracking is READ-ONLY |
| 10 | Voice | `voice_signature` (JSONB) | ✅ Yes — speech_pattern, vocabulary_level, verbal_tics, inner_voice_style, silence_meaning, lie_tell |
| 11 | Dilemma | CharacterDilemmaEngine component | Delegated to sub-component |
| 12 | ✦ AI Writer | 5 AI modes via `/api/v1/character-ai` | Generate-only (results not saved to character) |

### 1c. World Mode (LalaVerse)
Accessed via "World" registry pill or `?view=world` parameter.

- Aggregates ALL characters across ALL registries + special "Press" characters (filtered to `role_type !== 'special'` or manually included)
- Role type filter buttons: All, Protagonist, Pressure, Mirror, Support, Shadow
- Expandable world cards showing:
  - Character identity (name, role type, appearance mode, status badges)
  - Living State (knows / wants / unresolved / momentum) — stored in localStorage
  - Top relationships from `relationships_map`
  - "Generate State" / "Confirm" / "Regenerate" buttons per character
  - "Generate All States" banner for bulk AI generation
  - "Open Dossier →" link per card
- Living state generation hits `/api/v1/memories/generate-living-state`

---

## 2. Character Data Model — All Fields

### Core Identity
| Field | Type | In Model | Displayed | Editable |
|-------|------|----------|-----------|----------|
| `id` | UUID | ✅ | ❌ | ❌ |
| `registry_id` | UUID/FK | ✅ | ❌ | ❌ |
| `character_key` | STRING | ✅ | ✅ (browse) | ❌ (auto from name) |
| `icon` | STRING | ✅ | ✅ (card portrait fallback) | ❌ |
| `display_name` | STRING | ✅ | ✅ | ✅ |
| `subtitle` | STRING | ✅ | ✅ | ✅ |
| `role_type` | ENUM | ✅ | ✅ | ✅ |
| `role_label` | STRING | ✅ | ✅ (as refinement) | ✅ |
| `appearance_mode` | ENUM | ✅ | ✅ | ✅ |
| `status` | ENUM | ✅ | ✅ | ✅ (via Accept/Decline/Finalize) |
| `sort_order` | INTEGER | ✅ | ❌ | ❌ |
| `portrait_url` | TEXT | ✅ | ✅ | ✅ (upload/remove) |
| `canon_tier` | STRING | ✅ | ✅ (dossier left) | ❌ |
| `first_appearance` | STRING | ✅ | ✅ (dossier left) | ❌ |
| `era_introduced` | STRING | ✅ | ✅ (dossier left) | ❌ |
| `creator` | STRING | ✅ | ❌ | ❌ |

### Narrative Fields
| Field | Type | In Model | Displayed | Editable |
|-------|------|----------|-----------|----------|
| `core_belief` | TEXT | ✅ | ✅ | ✅ |
| `pressure_type` | TEXT | ✅ | ✅ | ✅ |
| `pressure_quote` | TEXT | ✅ | ✅ (browse card) | ❌ |
| `personality` | TEXT | ✅ | ❌ | ❌ |
| `job_options` | TEXT | ✅ | ❌ | ❌ |
| `description` | TEXT | ✅ | ✅ | ✅ |
| `selected_name` | STRING | ✅ | ❌ | ❌ |

### Essence Profile (Psychology Tab)
| Field | Type | In Model | Displayed | Editable |
|-------|------|----------|-----------|----------|
| `core_desire` | TEXT | ✅ | ✅ (triad) | ✅ |
| `core_fear` | TEXT | ✅ | ✅ (triad) | ✅ |
| `core_wound` | TEXT | ✅ | ✅ (triad) | ✅ |
| `mask_persona` | TEXT | ✅ | ✅ (duality) | ✅ |
| `truth_persona` | TEXT | ✅ | ✅ (duality) | ✅ |
| `character_archetype` | TEXT | ✅ | ✅ | ✅ |
| `signature_trait` | TEXT | ✅ | ✅ | ✅ |
| `emotional_baseline` | TEXT | ✅ | ✅ | ✅ |

### JSONB Sections
| Field | Type | Displayed | Editable |
|-------|------|-----------|----------|
| `aesthetic_dna` | JSONB | ✅ | ✅ (6 sub-fields) |
| `career_status` | JSONB | ✅ | ✅ (6 sub-fields) |
| `relationships_map` | JSONB | ✅ | ✅ (array of relationship cards) |
| `story_presence` | JSONB | ✅ | ✅ (5 sub-fields) |
| `voice_signature` | JSONB | ✅ | ✅ (6 sub-fields) |
| `evolution_tracking` | JSONB | ✅ (read-only preview) | ❌ |
| `name_options` | JSONB | ❌ | ❌ |
| `personality_matrix` | JSONB | ❌ | ❌ |
| `extra_fields` | JSONB | ❌ | ❌ |

### Sync/Writer Fields
| Field | Type | Displayed | Editable |
|-------|------|-----------|----------|
| `wound_depth` | FLOAT | ✅ (stats strip average) | ❌ |
| `belief_pressured` | BOOLEAN | ❌ | ❌ |
| `emotional_function` | STRING | ❌ | ❌ |
| `writer_notes` | TEXT | ❌ | ❌ |

---

## 3. Backend Endpoints — Status

Route prefix: `/api/v1/character-registry` (registered in `app.js` line 796)

### Registry CRUD — All Implemented ✅
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/registries` | ✅ Working | Returns all with `characterCount` |
| `POST` | `/registries` | ✅ Working | Supports `characters[]` for batch creation |
| `GET` | `/registries/default` | ✅ Working | Auto-creates first registry if none exist |
| `GET` | `/registries/:id` | ✅ Working | Includes all characters ordered by `sort_order, display_name` |
| `PUT` | `/registries/:id` | ✅ Working | Updates title, book_tag, description, core_rule, status, show_id |
| `DELETE` | `/registries/:id` | ✅ Working | Soft-delete (paranoid) |

### Character CRUD — All Implemented ✅
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/registries/:id/characters` | ✅ Working | Creates character in registry |
| `GET` | `/characters/:id` | ✅ Working | Fetch single character |
| `PUT` | `/characters/:id` | ✅ Working | Comprehensive allow-list covers all editable fields |
| `DELETE` | `/characters/:id` | ✅ Working | Soft-delete |

### Status & Promotion — Implemented ✅
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/characters/:id/select-name` | ✅ Working | Picks from `name_options` |
| `POST` | `/characters/:id/set-status` | ✅ Working | Accept/Decline/Finalize + auto LalaVerse promotion on finalize (if `on_page`) |
| `POST` | `/characters/:charId/promote-to-canon` | ✅ Working | Manual promotion to `UniverseCharacter` |

### Portrait — Implemented ✅
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/characters/:id/portrait` | ✅ Working | Multer upload, 5MB, jpeg/png/webp/gif |
| `DELETE` | `/characters/:id/portrait` | ✅ Working | Removes file + clears DB field |

### Special — Mixed
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/registries/:id/seed-book1` | ✅ Working | Seeds 7 hardcoded PNOS Book 1 characters |
| `GET` | `/characters/:id/plot-threads` | ⚠️ **STUB** | Returns `[]` — marked "Phase 2" in code |

---

## 4. Half-Built / Incomplete Features

### 4a. Plot Threads Tab — Phase 2 Stub
- **Backend**: Returns empty array `[]` at line 392 of `characterRegistry.js`
- **Frontend**: Renders gracefully with empty state ("No plot threads tracked yet")
- **CSS**: Full styling exists (`.cr-threads-tab`, `.cr-thread-entry`, dots, meta)
- **Status**: Design-ready, awaiting implementation

### 4b. Evolution Tracking — Read-Only
- Model has `evolution_tracking` JSONB field
- Frontend displays `version_history`, `era_changes`, `personality_shifts` as read-only DRow items in the Story Presence tab
- **No edit form exists** — not included in `buildFormForTab('story')` or `buildPayloadForTab('story')`
- No backend endpoint generates this data

### 4c. Unused Model Fields — Never Exposed in UI
| Field | Purpose (guessed from name) | Frontend Status |
|-------|----------------------------|----------------|
| `personality` | Free-text personality description | Not displayed anywhere |
| `job_options` | Career alternatives | Not displayed anywhere |
| `selected_name` | Chosen from name_options | Not displayed anywhere |
| `name_options` | JSONB array of name candidates | Not displayed (select-name endpoint exists) |
| `personality_matrix` | JSONB personality structure | Not displayed anywhere |
| `extra_fields` | JSONB catch-all | Not displayed anywhere |
| `creator` | Original creator attribution | Not displayed anywhere |
| `belief_pressured` | Boolean flag | Not displayed anywhere |
| `emotional_function` | String | Not displayed anywhere |
| `writer_notes` | Text field for author notes | Not displayed anywhere |

### 4d. Portrait Upload Bug 🐛
In the dossier view, portrait upload and remove handlers call `setCharacters(prev => ...)` (around lines 456–481 of the JSX), but `setCharacters` **does not exist in the component scope**. The component uses `characters` from the state returned by `fetchRegistry()`, but there's no `setCharacters` setter. This means:
- Portrait upload will succeed on the server but **crash the frontend** with a ReferenceError
- Same for portrait removal
- **Fix**: Replace `setCharacters(...)` with a call to `fetchRegistry(activeRegistryId)` after successful upload/remove, or add a proper state setter

### 4e. Arc Timeline — AI-Generated Only
- The Arc Timeline tab calls `/api/v1/memories/generate-living-state` to get chapter beat data
- Uses the same localStorage `wv_living_states` system as Living State tab
- No manual data entry or backend storage — entirely ephemeral. Regenerating living states replaces arc data.

### 4f. Living State — LocalStorage Only
- All living state data is stored in `localStorage` under key `wv_living_states`
- Not persisted to backend/database
- Cleared when user clears browser data
- Confirmed/generated states only exist client-side
- The confirm/regenerate workflow has no server-side persistence

---

## 5. UI/UX Assessment

### Strengths
- **Comprehensive responsive design**: 5 breakpoints (1024px, 768px, 480px, 360px, 340px) + touch device overrides + safe area inset support for notched phones
- **Polished aesthetic**: Consistent "Pastel Luxe" design language with gradients, serif/sans/mono font hierarchy, thoughtful hover effects
- **Mobile-first enhancements**: Collapsible dossier panel, bottom action bar (Write/Interview/Therapy/AI), sticky edit controls, iOS zoom prevention, scroll fade indicators
- **Deep linking**: Full URL state management via `?charId=`, `?view=world`, `?character=` for cross-feature navigation
- **AI integration**: 5 distinct AI generation modes (scene writing, monologue, gap analysis, profile generation, "what happens next") with proper loading/error states
- **Edit/display toggle**: Clean inline editing with form ↔ data mapping via `buildFormForTab` / `buildPayloadForTab`

### Gaps and Issues

1. **No drag-to-reorder**: `sort_order` exists in the model but no UI for reordering characters
2. **No batch operations**: Can't select multiple characters for bulk status changes or deletion
3. **No search in dossier tabs**: With 12 tabs and deep content, no way to search within a character's data
4. **Canon tier / era / first_appearance not editable**: Displayed in the dossier left panel but not included in any edit form. Would need manual DB updates.
5. **No undo on delete**: Registry and character deletion is soft-delete with no UI to restore
6. **World mode generates to localStorage only**: Living states should probably be persisted server-side for reliability
7. **No character comparison view**: Can't view two characters side-by-side
8. **AI Writer results are ephemeral**: Generated prose/beats/profiles are not saved anywhere persistent (only displayed until cleared)
9. **Filter state not persisted**: Refreshing the page resets all filters
10. **No keyboard navigation**: Tab keys don't cycle through dossier tabs, no keyboard shortcuts

---

## 6. RelationshipWeb Integration

### How It Connects
- **RelationshipWeb.jsx** (561 lines) is a standalone route, not embedded in Character Registry
- Uses D3.js v7.8.5 (CDN) for force-directed graph visualization
- Data source: `/api/v1/memories/relationship-map` (separate from character registry endpoints)

### Navigation Bridge
- **RelationshipWeb → Character Registry**: "Open Character Home →" button in the CharacterPanel resolves character name to UUID via pre-loaded map from `/api/v1/character-registry/registries`, then navigates to `/character-registry?character={charId}`
- **Character Registry → RelationshipWeb**: Not directly linked from the registry page. Users would navigate separately.
- **CharacterPanel back button**: Goes to `/character-registry?view=world`

### Data Overlap
- RelationshipWeb reads `relationships_map` from the memories API, not from `RegistryCharacter.relationships_map`
- The Character Registry's Relationships tab edits `relationships_map` on the character model
- These are **two separate data sources** — no sync mechanism. A relationship added via the dossier edit form won't appear in the RelationshipWeb graph, and vice versa.

### Integration Gap 🔴
The registry's `relationships_map` JSONB and the memories API's relationship data are **completely decoupled**. This means:
- Editing relationships in the dossier doesn't update the graph
- The graph pulls from a different data pipeline (memories/narrative analysis)
- Name resolution works for navigation but data is not unified

---

## 7. Quality & Completeness Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Data model** | 9/10 | Comprehensive schema, good use of JSONB for flexible sections. Some unused fields (personality_matrix, extra_fields) add clutter. |
| **Backend routes** | 9/10 | Full CRUD, proper validation, soft-delete, portrait upload. Only gap is plot-threads stub. |
| **Frontend — Browse** | 9/10 | Two view modes, filters, search, stats, registry management. Well polished. |
| **Frontend — Dossier** | 8/10 | 12 tabs with rich display/edit. Portrait bug needs fixing. Some fields not editable. |
| **Frontend — World Mode** | 7/10 | Good concept, working UI, but localStorage-only state is fragile. |
| **CSS / Responsive** | 10/10 | Exceptional. 4,797 lines covering every component at 5+ breakpoints with safe-area support. |
| **AI Integration** | 8/10 | 5 writer modes, living state generation. Results not persisted. |
| **Cross-feature integration** | 5/10 | RelationshipWeb navigation works but data is siloed. Voice Interview and Dilemma Engine are embedded but self-contained. |

### Overall: **8/10 — Production-quality feature with specific gaps**

The Character Registry is the most feature-complete module in the application. It has a robust data model, comprehensive CRUD operations, a polished multi-view frontend with exceptional responsive design, and deep AI integration. The primary weaknesses are:

1. **The portrait upload bug** (will crash on use)
2. **Living states stored only in localStorage** (data loss risk)
3. **Relationship data siloed** from RelationshipWeb graph
4. **Several model fields** never exposed in UI
5. **Plot threads** not yet implemented (Phase 2)

---

## Appendix: File Cross-Reference

| Concern | Primary File | Lines |
|---------|-------------|-------|
| Route mounting | `src/app.js` | 796–797 |
| Backend routes | `src/routes/characterRegistry.js` | 1–672 |
| Data model | `src/models/RegistryCharacter.js` | 1–229 |
| Main page component | `frontend/src/pages/CharacterRegistryPage.jsx` | 1–2927 |
| Page styles | `frontend/src/pages/CharacterRegistryPage.css` | 1–4797 |
| Relationship graph | `frontend/src/pages/RelationshipWeb.jsx` | 1–561 |
| Voice interview | `frontend/src/pages/CharacterVoiceInterview.jsx` | embedded via import |
| Dilemma engine | `frontend/src/components/CharacterDilemmaEngine.jsx` | embedded via import |
| Dossier field migration | `src/migrations/20260222210000-add-character-dossier-fields.js` | — |
| Sync fields migration | `src/migrations/20260226000001-add-registry-sync-fields.js` | — |
| Universe promotion target | `src/migrations/20260222200000-create-universe-characters.js` | — |
