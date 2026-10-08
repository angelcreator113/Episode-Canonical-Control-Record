/**
 * Show Bible Knowledge sections (2026-10-04).
 *
 * Every active Brain entry lands in exactly one section, so the section
 * counts always add up to the active count and nothing disappears. The
 * API returns `content` as text, so an entry carries its section one of
 * three ways, checked in this order:
 *
 *  1. Its content is a JSON object with a `section` key (the Show Brain
 *     seeder, src/seeders/20260312800000-show-brain-franchise-laws.js).
 *  2. Its source_document names the LalaVerse page it came from (the other
 *     nine seeders and the Brain Update manifests, docs/BRAIN_OWNERSHIP.md).
 *  3. Otherwise it is Uncategorized: written here, ingested from a document,
 *     left by Amber, a scene set or an episode completion.
 *
 * The old grouping read `content.section` on an object the API never
 * sends and then applies_to[0] (`show_brain`, `story_engine`, …), which
 * matched no section, so the tab showed ten empty sections next to an
 * active count of a hundred.
 */

export const UNCATEGORIZED = 'uncategorized';

export const SECTIONS = [
  { key: 'identity', label: 'Identity', icon: '🎯', desc: 'Show name, logline, design tokens' },
  { key: 'character_bible', label: 'Characters', icon: '👤', desc: 'Character definitions and bible' },
  { key: 'personality', label: 'Personality', icon: '💎', desc: 'Personality traits and voice' },
  { key: 'stats', label: 'Stats', icon: '📊', desc: 'The six-stat system' },
  { key: 'world_rules', label: 'World Rules', icon: '🌍', desc: 'Mechanical and narrative rules' },
  { key: 'economy', label: 'Economy', icon: '🪙', desc: 'Currency, reputation, access systems' },
  { key: 'episode_beats', label: 'Episode Beats', icon: '🎬', desc: '14-beat structure, arc patterns' },
  { key: 'five_brains', label: 'Five Brains', icon: '🧠', desc: 'Writer, director, editor, producer, interaction' },
  { key: 'screen_states', label: 'Screen States', icon: '📱', desc: 'What each screen shows' },
  { key: 'visual_language', label: 'Visual Language', icon: '🎨', desc: 'Design language, color palette' },
  { key: 'scene_rules', label: 'Scene Rules', icon: '📍', desc: 'Scene generation constraints' },
  { key: 'multi_platform', label: 'Multi-Platform', icon: '📡', desc: 'Platform expansion rules' },
  { key: 'canon_rules', label: 'Canon Rules', icon: '📜', desc: 'What cannot be changed' },
  { key: 'season_1', label: 'Season 1', icon: '📺', desc: 'Season-specific rules' },
  { key: 'cultural_system', label: 'Culture & Events', icon: '🎭', desc: 'Cultural calendar, trends, legends' },
  { key: 'influencer_systems', label: 'Social Systems', icon: '⭐', desc: 'Archetypes, tiers, rules of the Feed' },
  { key: 'world_infrastructure', label: 'World Foundation', icon: '🏙️', desc: 'DREAM cities, universities, corporations' },
  { key: 'social_timeline', label: 'Social Timeline', icon: '🕒', desc: 'How the Feed shows and spreads' },
  { key: 'social_personality', label: 'Social Personality', icon: '🗣️', desc: 'How characters behave online' },
  { key: 'character_life_simulation', label: 'Character Life', icon: '🏠', desc: 'Careers, relationships, milestones' },
  { key: 'cultural_memory', label: 'Cultural Memory', icon: '🏛️', desc: 'What the world remembers' },
  { key: 'character_depth_engine', label: 'Character Depth', icon: '🫀', desc: 'Body, class, blockers, what lasts' },
  { key: 'embodied_life_rules', label: 'Embodied Life', icon: '🌱', desc: 'Bodies, desire, health, ageing' },
  { key: UNCATEGORIZED, label: 'Uncategorized', icon: '🗂️', desc: 'No section yet: written here, ingested, Amber, scene sets, episode completion' },
];

const SECTION_KEYS = new Set(SECTIONS.map((s) => s.key));

/** source_document prefix (before the -vN.N) → section key. */
export const SOURCE_SECTIONS = {
  'cultural-system': 'cultural_system',
  'influencer-systems': 'influencer_systems',
  'world-infrastructure': 'world_infrastructure',
  'social-timeline': 'social_timeline',
  'social-personality': 'social_personality',
  'character-life-simulation': 'character_life_simulation',
  'cultural-memory': 'cultural_memory',
  'character-depth-engine': 'character_depth_engine',
  'embodied-life-rules': 'embodied_life_rules',
};

/** The entry's content as an object when it is stored as JSON, else null. */
export function parseContent(entry) {
  const c = entry?.content;
  if (c && typeof c === 'object') return c;
  if (typeof c !== 'string' || c[0] !== '{') return null;
  try {
    const parsed = JSON.parse(c);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function sectionOf(entry) {
  const section = parseContent(entry)?.section;
  if (typeof section === 'string' && SECTION_KEYS.has(section)) return section;
  const doc = typeof entry?.source_document === 'string' ? entry.source_document : '';
  const bySource = SOURCE_SECTIONS[doc.replace(/-v[\d.]+$/, '')];
  return bySource || UNCATEGORIZED;
}

/** A short readable summary for the list rows. */
export function summaryOf(entry) {
  const parsed = parseContent(entry);
  if (parsed) {
    if (typeof parsed.summary === 'string') return parsed.summary;
    return JSON.stringify(parsed).slice(0, 300);
  }
  if (typeof entry?.content === 'string') return entry.content.slice(0, 300);
  return '';
}
