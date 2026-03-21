---
description: "Use when working on WriteMode or Story Engine AI writing features — voice injection, context loading, prose generation, act system, texture layers, scene planning, or any AI prompt construction for creative writing. Use for: AI writer, story generation, voice system, PNOS, prose style, narrative context, character voice, rewrite options, story continue, story edit."
---
# WriteMode & Story Engine AI Writing

## WriteMode Context System

WriteMode endpoints load rich narrative context via two shared helpers:

- `loadWriteModeContext(characterId)` — loads 15 context sources in parallel:
  storyMemories, relationships, activeThreads, locations, canonEvents, proseStyle,
  voiceCards, dramaticIrony, followInfluence, voiceFingerprints, arcContext,
  therapyProfile, growthLogs, franchiseKnowledge, recentWorldEvents

- `buildWriteModeContextBlock(ctx)` — formats into prompt-ready text with conditional sections

## Voice System

- `getCharacterVoiceContext(characterId)` → returns `{ name, voiceBlock, charRules }`
- `WRITE_MODE_ACT_VOICE[pnos_act]` → returns `{ voice, belief, tense }` for 5-act system
- `WRITE_MODE_CHARACTER_RULES` → default character rules (JustAWoman-specific)
- Voice signature JSONB fields: speech_pattern, vocabulary_tone, internal_monologue_style, emotional_reactivity, catchphrases, mask_persona, truth_persona, personality

## 5-Act Story System (PNOS)

Acts: `act_1` through `act_5` — each has voice description, belief statement, and prose tense.
The act controls the emotional register of all AI-generated prose.

## WriteMode Endpoints (all in src/routes/memories.js)

| Endpoint | Purpose |
|----------|---------|
| `/voice-to-story` | Spoken input → polished prose |
| `/story-continue` | Continue from where author stopped |
| `/story-edit` | Author edit note → revised prose |
| `/ai-writer-action` | Dialogue, interior, reaction, lala, deepen, nudge |
| `/scene-planner` | AI-generated scene suggestions for a chapter |
| `/rewrite-options` | 3 alternative rewrites (tighter/emotional/voice) |

## Story Engine Context (17 parallel loaders)

Story Engine's `generate-story` loads ALL context via `Promise.all()` at ~line 10238.
WriteMode mirrors this with `loadWriteModeContext()` (15 of 17 — excludes loadCharacterProfile and loadWorldState which need world-level params).

## Texture Layer Service (src/services/textureLayerService.js)

Generates 6 texture types: inner_thought, body_narrator, conflict_scene, private_moment, online_self_post.
Uses `buildTextureVoiceBlock()` to inject character voice into each generator.

## Prompt Construction Rules

- All context sections are conditional — `null` data contributes zero tokens
- Prose style anchors are capped at 600 chars: `anchor.slice(0, 600)`
- System prompt: character voice + rules + narrative context
- User prompt: scene specifics + recent prose + action instructions
- Temperature: 0.85 default, 1.0 for retries
