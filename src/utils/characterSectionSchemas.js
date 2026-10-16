'use strict';

/**
 * One meaning per field (Evoni, 2026-10-16: "yes do ... C"). The JSON shape
 * the AI is asked for, per character-registry section. backfill-sections,
 * backfill-all and generate-section (routes/characterRegistry.js) each had
 * their own copy, and the copies disagreed:
 *   voice_signature.catchphrases     "their tell when lying" vs "recurring
 *                                    phrases"; the page shows it as their
 *                                    phrase (lib/characterPage voiceOf), so
 *                                    it is the phrase and the tell is `tell`
 *   career_status.public_recognition "who opposes them" vs "level of public
 *                                    awareness"; it is the awareness
 *   story_presence.unresolved_threads "story types they suit" vs what is
 *                                    unresolved (characterAI build-profile)
 * The page reads these keys; change a meaning here, not in a prompt.
 */
const SECTION_SCHEMAS = Object.freeze({
  career_status: `{ "profession": "their job title", "career_goal": "what success means to them", "reputation_level": "how the world sees their career", "brand_relationships": "professional affiliations and brand ties", "financial_status": "their industry and financial reality", "public_recognition": "how widely they are known — their level of public awareness", "ongoing_arc": "their ongoing professional tension or career wound" }`,
  aesthetic_dna: `{ "era_aesthetic": "how they dress — style era and vibe", "color_palette": "their visual color world", "signature_silhouette": "how they look — specific physical details", "signature_accessories": "the object always near them", "glam_energy": "how a room changes when they enter", "visual_evolution_notes": "how their look has changed over time" }`,
  voice_signature: `{ "speech_pattern": "how they speak — rhythm, vocabulary, register", "vocabulary_tone": "a sentence that could only be theirs", "catchphrases": "a phrase they actually say, again and again, in their own words", "tell": "what they do when lying or hiding", "internal_monologue_style": "how their inner voice sounds — what they never say directly, always approached sideways", "emotional_reactivity": "how they react when emotions hit, and what silence means for them" }`,
  story_presence: `{ "appears_in_books": "which books/worlds", "appears_in_shows": "which shows", "appears_in_series": "which series", "current_story_status": "what triggers their entrance into a story", "unresolved_threads": "what is still unresolved in their story", "future_potential": "whether they can bring new characters into the story, and how" }`,
  evolution_tracking: `{ "version_history": "what just happened — the recent event that changed something", "era_changes": "where they are in their arc right now", "personality_shifts": "what they are avoiding — the thing they know they need to face" }`,
  living_context: `{ "active_pressures": "what is pressing on them right now", "support_network": "who holds them up and what it costs", "home_environment": "what daily domestic life looks like", "relationship_to_deadlines": "how they relate to time pressure", "financial_reality": "their actual financial situation — specific", "current_season": "the emotional season they are in" }`,
  relationships_map: `{ "allies": "names and nature of alliances — who has their back and why", "rivals": "names and nature of rivalries — professional or personal", "mentors": "who shaped them — living or dead, present or absent", "love_interests": "current or past — who they wanted or want", "business_partners": "professional relationships that matter", "dynamic_notes": "the most important tension or unresolved dynamic" }`,
});

module.exports = { SECTION_SCHEMAS };
