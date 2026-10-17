'use strict';

/**
 * The Character Story Brief (Evoni, 2026-10-17, stage A of the storytelling
 * plan): one short, structured account of a character's inner life for a
 * writer, in place of each writer picking its own fields. "A writer knowing
 * something about a character does not mean the character knows it, or
 * that the audience should hear it."
 *
 * Three parts:
 *   WHAT THEY SHOW     the mask: their public face and voice
 *   PRIVATE AUTHOR TRUTH  wants, wound, truth, dilemma, triggers, joy,
 *                      change, time, self-story, beliefs, living state:
 *                      it shapes behaviour, tension and choices and is
 *                      never stated, at the depth the layer allows
 *   CLEARED TO REVEAL  nothing yet (the revelation budget is stage B)
 *
 * The layers are the levels of access to one story (Evoni): the episode
 * shows what happens, the short story what was happening beneath it, the
 * chapter book what it all means.
 *
 *   LAYERS                     episode | short_story | chapter | scene
 *   storyBrief(character, { layer })  { lines, text }
 *     character  a registry character (plain or a model instance)
 *   BRIEF_COLUMNS              the registry_characters columns it reads,
 *                              for writers that select columns themselves;
 *                              never blind_spot, so a writer that saves its
 *                              context never carries it
 *
 * The blind spot is not in a brief: a storyteller scene adds it as dramatic
 * irony only when the scene asks for it (routes/storyEvaluationRoutes).
 *
 * The blind spot's evidence and the narrative gap stay with the story
 * evaluator (author knowledge).
 */

const { changeCapacityOf, normalizeTimeOrientation } = require('./characterDepthFields');

const LAYERS = {
  episode: 'The audience sees only behaviour. Let it shape their choices, avoidances, tension and timing. Never state it, explain it, or have anyone name it.',
  short_story: 'It may surface beneath the scene: private reactions, the body, half-thoughts, what they almost say. Hint; never name the wound or the secret outright.',
  chapter: 'It can be explored in depth as subtext, history and consequence. Nothing in it is stated outright unless it is cleared to reveal below.',
  scene: 'It may surface beneath the scene: private reactions, the body, half-thoughts, what they almost say. Hint; never name the wound or the secret outright.',
};

const BRIEF_COLUMNS = [
  'mask_persona', 'the_mask', 'want_architecture', 'hidden_want', 'core_desire', 'core_fear', 'core_wound', 'wound',
  'truth_persona', 'dilemma', 'triggers', 'experience_of_joy', 'de_joy_trigger', 'de_forbidden_joy', 'change_capacity',
  'time_orientation', 'self_narrative', 'operative_cosmology', 'de_operative_cosmology', 'foreclosed_possibility',
  'living_state', 'extra_fields',
];

const CLIP = 240;
const text = (v) => {
  if (v === null || v === undefined) return '';
  const s = (typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).filter(Boolean).join('; ') : '').replace(/\s+/g, ' ').trim();
  return s.length > CLIP ? `${s.slice(0, CLIP - 1).trimEnd()}…` : s;
};
const objectOf = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try { return JSON.parse(v); } catch (err) { console.error('[characterStoryBrief] unreadable JSON field:', err.message); }
  }
  return typeof v === 'string' && v.trim() ? { description: v } : {};
};
const words = (v) => (v ? String(v).replace(/_/g, ' ') : '');

function storyBrief(character, { layer = 'episode' } = {}) {
  const c = character && typeof character.get === 'function' ? character.get({ plain: true }) : (character || {});
  const rule = LAYERS[layer] || LAYERS.episode;

  const show = [];
  const add = (list, label, v) => { const t = text(v); if (t) list.push(`- ${label}: ${t}`); };
  add(show, 'Public self', c.mask_persona);
  add(show, 'The mask', objectOf(c.the_mask).description);

  const truth = [];
  const want = objectOf(c.want_architecture);
  add(truth, 'Says they want', want.surface_want);
  add(truth, 'Actually needs', want.real_want);
  add(truth, 'Will not admit wanting', want.forbidden_want || c.hidden_want);
  add(truth, 'Desire', c.core_desire);
  add(truth, 'Fear', c.core_fear);
  const wound = objectOf(c.wound);
  add(truth, 'Wound', wound.description || c.core_wound);
  add(truth, 'What the wound does now', wound.downstream_effects);
  add(truth, 'Who they are underneath', c.truth_persona);
  // The column, or the older dilemma in extra_fields.
  const dilemma = Object.keys(objectOf(c.dilemma)).length ? objectOf(c.dilemma) : objectOf(c.extra_fields?.dilemma);
  add(truth, 'Central dilemma', dilemma.central_tension || dilemma.central_dilemma);
  if (dilemma.option_a && dilemma.option_b) add(truth, 'Torn between', `${text(dilemma.option_a)} / ${text(dilemma.option_b)}`);
  add(truth, 'What gets to them', Array.isArray(c.triggers) ? c.triggers.map((t) => (typeof t === 'string' ? t : t?.label || t?.name)) : c.triggers);
  add(truth, 'Joy', c.experience_of_joy || c.de_joy_trigger);
  add(truth, 'The joy they deny themselves', c.de_forbidden_joy);
  const change = changeCapacityOf(c.change_capacity);
  const changeLine = [words(change.mobility), change.conditions_for_change && `would change if ${text(change.conditions_for_change)}`, change.blocker && `blocked by ${text(change.blocker)}`]
    .filter(Boolean).join('; ');
  add(truth, 'How far they can change', changeLine);
  add(truth, 'How they live in time', words(normalizeTimeOrientation(c.time_orientation) || c.time_orientation));
  add(truth, 'The story they tell about themselves', c.self_narrative);
  add(truth, 'What they believe runs the world', c.operative_cosmology || words(c.de_operative_cosmology));
  add(truth, 'What they have given up on', c.foreclosed_possibility);
  const living = objectOf(c.living_state);
  add(truth, 'Right now', [living.current_situation, living.active_tension].filter(Boolean).join('; '));

  const lines = [];
  if (show.length) lines.push('WHAT THEY SHOW (their public face; their voice in public comes from here):', ...show);
  if (truth.length) lines.push(`PRIVATE AUTHOR TRUTH (you know this; they may not, and the audience is not told it). ${rule}`, ...truth);
  if (truth.length) lines.push('CLEARED TO REVEAL: nothing yet. Keep every private truth as subtext.');
  return { lines, text: lines.join('\n') };
}

module.exports = { storyBrief, LAYERS, BRIEF_COLUMNS };
