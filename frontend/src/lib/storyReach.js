/**
 * Where the inner life goes (Evoni, 2026-10-17, step 4: the Story Behaviour
 * Preview, "built from the character file, showing what the Feed, events and
 * episodes actually receive"). Each writer that turns a character into
 * content picks its own fields; this is that map, per writer, so the Inner
 * life can show what each one actually reads and what reaches no writer.
 *
 * It is a map of the code, not the code itself: storyReach.test.js reads
 * each writer's `sources` and fails when a field listed here is not in them.
 * Mapped 2026-10-17 from the backend (services/characterPosts, pulseDrafter,
 * pulseVoices, episodeScriptWriterService, storyGenerationService,
 * routes/storyEvaluationRoutes, routes/memories, textureLayerService,
 * characterFile + characterPressure, characterFollowService).
 *
 * A writer's fields come in three kinds:
 *   shows     what they show the world; their public voice comes from it
 *   private   sent marked private: it shapes the writing and is never said
 *   unmarked  sent with no instruction to keep it private
 *
 *   WRITERS                  the writers, each { key, label, where, sources, shows, private, unmarked, note? }
 *   reachOf(character, isAuthor)   each writer with its fields' labels and values
 *   unreached(character, isAuthor) the inner life no writer reads, written first
 */
import { SECTIONS } from './innerLifeSections';

const CORE = ['core_wound', 'core_desire', 'core_fear'];

// A writer may read a field by its Depth Engine twin name (services/characterDepthFields
// reads it from its home): change_capacity as de_change_capacity, and so on.
export const READ_AS = {
  change_capacity: ['de_change_capacity', 'de_change_capacity_score', 'de_change_condition', 'de_change_witness', 'de_arc_function'],
  time_orientation: ['de_time_orientation'],
  blind_spot: ['de_blind_spot'],
};

export const WRITERS = [
  {
    key: 'posts', label: 'The Pulse: posts you generate', where: 'Generate posts, on their Voice & feed tab',
    sources: ['src/services/characterPosts.js', 'src/services/pulseDrafter.js'],
    shows: ['the_mask', 'mask_persona', 'self_narrative'],
    private: ['wound', ...CORE, 'hidden_want', 'want_architecture', 'living_state'],
    unmarked: [],
  },
  {
    key: 'pulse', label: 'The Pulse: automatic posts, comments and DMs', where: 'Everyday posts, event posts and comments, storylines and DMs',
    sources: ['src/services/pulseDrafter.js', 'src/services/pulseVoices.js', 'src/services/characterFile.js'],
    shows: ['the_mask', 'mask_persona', 'self_narrative'],
    private: ['living_state'],
    unmarked: [],
    note: 'Their voice is built once from what they show; each post then reads only their living state.',
  },
  {
    key: 'events', label: 'Events', where: 'Making events, invitations and who comes',
    sources: [], shows: [], private: [], unmarked: [],
    note: 'No event writer reads the inner life. Posts and comments about an event are written by the Pulse’s automatic posts.',
  },
  {
    key: 'episodes', label: 'Episode scripts and stories', where: 'An event’s episode script, and the episode story',
    sources: ['src/services/episodeScriptWriterService.js', 'src/services/storyGenerationService.js'],
    shows: ['mask_persona'], private: [], unmarked: [...CORE, 'truth_persona'],
  },
  {
    key: 'scenes', label: 'Scenes from the storyteller', where: 'Three-voice scene writing',
    sources: ['src/routes/storyEvaluationRoutes.js'],
    shows: ['mask_persona', 'self_narrative'],
    private: ['blind_spot'],
    unmarked: [...CORE, 'hidden_want', 'truth_persona', 'deep_profile', 'time_orientation', 'change_capacity', 'operative_cosmology',
      'de_operative_cosmology', 'de_cosmology_conflict', 'de_body_relationship', 'de_body_history', 'de_money_behavior', 'de_time_wound',
      'de_circumstance_advantages', 'de_circumstance_disadvantages', 'de_world_belief', 'de_joy_trigger'],
    note: 'The blind spot goes in as dramatic irony: the reader should sense it, the character never names it.',
  },
  {
    key: 'writemode', label: 'WriteMode and the Story Engine', where: 'Voice to story, continue, deepen, planning and Generate story',
    sources: ['src/routes/memories/helpers.js', 'src/routes/memories/engine.js'],
    shows: ['mask_persona'], private: [], unmarked: [...CORE, 'truth_persona'],
  },
  {
    key: 'texture', label: 'The texture layer', where: 'Texture added to a written scene',
    sources: ['src/services/textureLayerService.js'],
    shows: ['mask_persona'], private: [], unmarked: [...CORE, 'truth_persona', 'de_body_relationship', 'de_body_currency'],
  },
  {
    key: 'evaluation', label: 'Story evaluation', where: 'The judge that scores written stories (it writes nothing)',
    sources: ['src/routes/storyEvaluationRoutes.js'],
    shows: [], private: ['blind_spot', 'de_blind_spot_category', 'de_actual_narrative_gap', 'foreclosed_possibility', 'de_foreclosure_origins'], unmarked: [],
  },
  {
    key: 'pressure', label: 'The pressure test', where: 'The hard questions, on their Overview',
    sources: ['src/services/characterFile.js', 'src/services/characterPressure.js'],
    shows: ['the_mask', 'mask_persona', 'self_narrative'],
    private: ['want_architecture', 'wound', ...CORE, 'hidden_want', 'living_state', 'truth_persona', 'typology'],
    unmarked: [],
  },
  {
    key: 'follow', label: 'Who they follow', where: 'Follow suggestions on the Feed',
    sources: ['src/services/characterFollowService.js'],
    shows: ['mask_persona', 'self_narrative'], private: [],
    unmarked: [...CORE, 'hidden_want', 'truth_persona', 'change_capacity', 'operative_cosmology', 'de_operative_cosmology',
      'de_forbidden_joy', 'de_money_origin_class', 'de_money_current_class', 'de_self_narrative_origin'],
  },
];

// The fields the map names that the Inner life does not edit.
const OTHER_LABELS = {
  core_wound: 'Core wound', core_desire: 'Core desire', core_fear: 'Core fear', hidden_want: 'Hidden want',
  mask_persona: 'Mask persona', truth_persona: 'Truth persona', living_state: 'Living state', typology: 'Typology', deep_profile: 'Deep profile',
};

// Every Inner life column, its label (the subject's, for a record) and whether it is the author's.
const INNER = (() => {
  const out = {};
  for (const section of SECTIONS) {
    for (const subject of section.subjects) {
      for (const fd of subject.fields) {
        const col = fd.path[0];
        if (out[col]) continue;
        const nested = fd.path.length > 1 || fd.type === 'foreclosed';
        out[col] = { label: nested ? subject.label : fd.label, authorOnly: !!(subject.authorOnly || fd.authorOnly), path: [col] };
      }
    }
  }
  // The foreclosed doors' notes are columns of their own.
  for (const col of ['de_foreclosure_origins', 'de_foreclosure_visibility', 'de_crack_conditions']) {
    out[col] = { label: `Foreclosed doors: ${col === 'de_crack_conditions' ? 'what could open them' : col.replace('de_foreclosure_', '')}`, authorOnly: false, path: [col] };
  }
  out.deep_profile = { label: 'Deep profile', authorOnly: false, path: ['deep_profile'] };
  return out;
})();
export const INNER_LIFE_FIELDS = Object.keys(INNER);

const filled = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(filled);
  return true;
};

const CLIP = 180;
// A chosen value (future_oriented) in words; other text as written.
const wordsOf = (x) => (typeof x === 'string' ? (/^[a-z]+(_[a-z]+)+$/.test(x) ? x.replace(/_/g, ' ') : x) : JSON.stringify(x));

/** A value as one short line. */
export function shortText(v) {
  if (!filled(v)) return null;
  let s;
  if (Array.isArray(v)) s = v.map(wordsOf).join(' · ');
  else if (v && typeof v === 'object') s = Object.entries(v).filter(([, x]) => filled(x)).map(([k, x]) => `${k.replace(/_/g, ' ')}: ${wordsOf(x)}`).join(' · ');
  else s = typeof v === 'string' ? wordsOf(v) : String(v);
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > CLIP ? `${s.slice(0, CLIP - 1).trimEnd()}…` : s;
}

const AUTHOR_ONLY = new Set(['blind_spot', 'de_blind_spot_evidence', 'de_blind_spot_crack_condition', 'de_actual_narrative_gap']);
const itemOf = (character, field) => {
  // The older dilemma lives in extra_fields.
  const v = field === 'dilemma' ? (character?.dilemma || character?.extra_fields?.dilemma) : character?.[field];
  return { field, label: INNER[field]?.label || OTHER_LABELS[field] || field.replace(/^de_/, '').replace(/_/g, ' '), text: shortText(v) };
};

/** Each writer, its fields as { field, label, text } (text null when empty); the author's fields for the author only. */
export function reachOf(character, isAuthor = true) {
  const visible = (f) => isAuthor || !AUTHOR_ONLY.has(f);
  return WRITERS.map((w) => ({
    ...w,
    shows: w.shows.filter(visible).map((f) => itemOf(character, f)),
    private: w.private.filter(visible).map((f) => itemOf(character, f)),
    unmarked: w.unmarked.filter(visible).map((f) => itemOf(character, f)),
  }));
}

/** The Inner life fields no writer reads, written ones first. */
export function unreached(character, isAuthor = true) {
  const read = new Set(WRITERS.flatMap((w) => [...w.shows, ...w.private, ...w.unmarked]));
  return INNER_LIFE_FIELDS
    .filter((f) => !read.has(f) && (isAuthor || !INNER[f].authorOnly))
    .map((f) => itemOf(character, f))
    .sort((a, b) => (b.text ? 1 : 0) - (a.text ? 1 : 0));
}
