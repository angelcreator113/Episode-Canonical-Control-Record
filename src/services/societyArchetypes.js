'use strict';

/**
 * The Society tab's archetypes in the Feed (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 26; Evoni's
 * ruling, 2026-10-08: "Feed also uses your 15").
 *
 * The Society tab's fifteen archetypes say what a creator is known for; the
 * Feed's own ten (social_profiles.archetype) say how they behave online.
 * Each new LalaVerse Feed profile now also gets one of the fifteen, by name,
 * in social_profiles.society_archetype; profiles made before have none. The
 * list is Evoni's: the one she saved on the Society tab (page_content
 * influencer_systems / ARCHETYPES, read as usePageData reads it), else the
 * page's defaults (frontend/src/data/influencerData.js ARCHETYPES, copied
 * below; tests/unit/services/societyArchetypes.test.js keeps the copy the
 * same).
 *
 * Where a new profile's archetype comes from:
 *   - the Feed scheduler gives each spark of a batch the least used one and
 *     has the AI build the spark and the profile around it;
 *   - a profile generated from Evoni's own spark (generate, bulk generate,
 *     regenerate) gets the one the AI says fits it best, from the list;
 *   - a profile made without the AI (a registry character's, a confirmed
 *     proposal), or one the AI named nothing on the list for, gets the
 *     least used;
 *   - regenerate keeps one the profile already has.
 *
 * Fail-soft: an archetype never blocks a profile. A read that fails logs and
 * falls back (the defaults, or no counts).
 */

const PAGE = 'influencer_systems';
const KEY = 'ARCHETYPES';

const DEFAULT_ARCHETYPES = Object.freeze([
  { name: 'The Main Character', content: 'Relationship stories, glow-ups, emotional monologues, life updates as episodes', audience: 'Followers feel like they\'re watching someone\'s life unfold in real time', narrative: 'The character the audience is emotionally invested in. Their choices matter.' },
  { name: 'The Trendsetter', content: 'Outfit reveals, experimental looks, aesthetic shifts before they\'re mainstream', audience: 'Starts fashion waves — the audience finds out they were early after the fact', narrative: 'First adopter. Signals what\'s coming. Gets credit or gets copied.' },
  { name: 'The Beauty Oracle', content: 'Skincare routines, makeup trends, beauty reviews, technique breakdowns', audience: 'Influences product sales and redefines beauty standards', narrative: 'Authority figure. When she says something is over, it\'s over.' },
  { name: 'The Hustle Mogul', content: 'Business advice, income transparency, motivational content, launch documentation', audience: 'Promotes entrepreneurship culture — followers build things', narrative: 'The proof it\'s possible. Also: the cautionary tale when the hustle isn\'t real.' },
  { name: 'The Entertainer', content: 'Comedy, skits, memes, reaction content, viral formats', audience: 'Drives platform engagement — the reason people open the app', narrative: 'Releases tension. The comic relief that\'s sometimes the most honest voice.' },
  { name: 'The Drama Magnet', content: 'Arguments, callouts, response videos, receipts', audience: 'Creates viral gossip cycles — the audience arrives for the drama', narrative: 'Catalyst. Things happen around them. Often not by accident.' },
  { name: 'The Relatable Friend', content: 'Daily life, parenting struggles, honest confessions, low-production realness', audience: 'Builds deep audience trust — feels like someone the audience actually knows', narrative: 'The emotional anchor. When she says something matters, the audience believes her.' },
  { name: 'The Luxury Icon', content: 'Designer fashion, exotic travel, exclusive parties, aspirational lifestyle', audience: 'Creates aspiration and envy simultaneously', narrative: 'Represents what some characters want to become and others want to destroy.' },
  { name: 'The Educator', content: 'Tutorials, explainers, knowledge threads, skill breakdowns', audience: 'Builds authority and credibility — the audience learns from them', narrative: 'The expert. Influence comes from competence, not charisma.' },
  { name: 'The Commentator', content: 'Reaction videos, social commentary, cultural analysis', audience: 'Shapes public opinion — gives the audience language for what they\'re feeling', narrative: 'Names things. Once she names something, everyone uses her language.' },
  { name: 'The Connector', content: 'Collaborations, group events, social gatherings, network content', audience: 'Creates network clusters — audiences overlap and merge', narrative: 'The bridge. Makes things happen between people who wouldn\'t otherwise meet.' },
  { name: 'The Archivist', content: 'Fashion archives, nostalgia posts, cultural memory content', audience: 'Defines legacy — decides what gets remembered', narrative: 'The historian. Controls the narrative of what mattered.' },
  { name: 'The Rebel', content: 'Controversial opinions, experimental art, anti-trend content', audience: 'Creates counterculture movements — the alternative to the mainstream', narrative: 'The one who says what everyone else is afraid to. Sometimes right. Sometimes destructive.' },
  { name: 'The Wellness Guide', content: 'Routines, therapy talk, mindfulness, rest content, boundary content', audience: 'Influences self-care culture — permission structure for slowing down', narrative: 'The counter-narrative. Makes the platform feel less like a race for a moment.' },
  { name: 'The Viral Wildcard', content: 'Random viral moments, chaotic posts, unpredictable formats', audience: 'Creates unexpected trends — the audience never knows what\'s coming', narrative: 'The chaos agent. Breaks patterns. Impossible to predict or copy.' },
].map((a) => Object.freeze(a)));

const text = (v) => (typeof v === 'string' ? v.trim() : '');
// One spelling for comparing names: case, a leading "The", punctuation.
const nameKey = (v) => text(v).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const sentence = (s) => `${s.replace(/[.\s]+$/, '')}.`;

/** A list as [{ name, content, audience, narrative }]: named items only, the first of a name kept. */
function normalizeArchetypes(items) {
  const seen = new Set();
  const out = [];
  for (const a of Array.isArray(items) ? items : []) {
    const name = text(a?.name);
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, content: text(a.content), audience: text(a.audience), narrative: text(a.narrative) });
  }
  return out;
}

/** The list the Society tab shows: Evoni's saved one, else the defaults. */
async function loadSocietyArchetypes(db) {
  if (db?.PageContent) {
    try {
      const row = await db.PageContent.findOne({ where: { page_name: PAGE, constant_key: KEY }, attributes: ['data'] });
      // The page shows a saved list in place of the defaults, even an empty one.
      if (row && Array.isArray(row.data)) return normalizeArchetypes(row.data);
    } catch (err) {
      console.error('[societyArchetypes] the saved archetypes could not be read; using the defaults:', err.message);
    }
  }
  return normalizeArchetypes(DEFAULT_ARCHETYPES);
}

/** LalaVerse Feed profiles per archetype name, { name: count }; profiles with none are left out. */
async function societyArchetypeCounts(db) {
  if (!db?.SocialProfile || !db.sequelize) return {};
  try {
    const rows = await db.SocialProfile.findAll({
      where: { feed_layer: 'lalaverse' },
      attributes: ['society_archetype', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['society_archetype'],
      raw: true,
    });
    const counts = {};
    for (const r of rows || []) if (r.society_archetype) counts[r.society_archetype] = Number(r.count) || 0;
    return counts;
  } catch (err) {
    console.error('[societyArchetypes] the Feed\'s archetype counts could not be read; picking without them:', err.message);
    return {};
  }
}

/**
 * n archetypes for n new profiles, each the least used so far (the counts,
 * then the picks before it), a tie broken at random.
 */
function pickSocietyArchetypes(list, counts = {}, n = 1, random = Math.random) {
  const used = new Map();
  for (const [name, count] of Object.entries(counts || {})) {
    const key = nameKey(name);
    if (key) used.set(key, (used.get(key) || 0) + (Number(count) || 0));
  }
  const tally = (list || []).map((a) => ({ a, n: used.get(nameKey(a.name)) || 0 }));
  const picks = [];
  for (let i = 0; i < n && tally.length; i++) {
    const least = Math.min(...tally.map((t) => t.n));
    const tied = tally.filter((t) => t.n === least);
    const pick = tied[Math.min(tied.length - 1, Math.floor(random() * tied.length))];
    pick.n += 1;
    picks.push(pick.a);
  }
  return picks;
}

/** The list's archetype a value names (the AI's answer, a stored name), else null. */
function matchSocietyArchetype(list, value) {
  const key = nameKey(value);
  if (!key) return null;
  return (list || []).find((a) => nameKey(a.name) === key) || null;
}

/** The least used archetype, for a profile with no other: null when the list is empty. */
async function assignSocietyArchetype(db, list = null) {
  const archetypes = list || await loadSocietyArchetypes(db);
  if (!archetypes.length) return null;
  const [pick] = pickSocietyArchetypes(archetypes, await societyArchetypeCounts(db), 1);
  return pick || null;
}

const NOT_THE_TEN = 'what the LalaVerse knows this creator for (not the "archetype" field, which is how they behave online)';
const details = (a) => [
  a.content && `What they post: ${sentence(a.content)}`,
  a.audience && `Their effect on the audience: ${sentence(a.audience)}`,
  a.narrative && `What they do in the story: ${sentence(a.narrative)}`,
].filter(Boolean).join(' ');
const menuLine = (a) => `${a.name}${a.content ? `: ${a.content}` : ''}`;

/** The prompt line for a profile's own archetype. */
function societyArchetypeLine(a) {
  if (!a?.name) return '';
  const more = details(a);
  return `\n\nSOCIETY ARCHETYPE: ${a.name}, ${NOT_THE_TEN}. Write the creator as this archetype.${more ? ` ${more}` : ''}`;
}

/** The list for the AI to choose from, for a profile from Evoni's own spark. */
function societyArchetypeMenu(list) {
  if (!list?.length) return '';
  return `\n\nSOCIETY ARCHETYPE: ${NOT_THE_TEN}. Choose the one below that fits this creator best, write the creator as it, and add "society_archetype" to the JSON with its name exactly as written here:\n${list.map((a) => `- ${menuLine(a)}`).join('\n')}`;
}

/** The scheduler's sparks, one archetype each, in order. */
function societySparkBlock(picks) {
  if (!picks?.length) return '';
  return `\n\nSOCIETY ARCHETYPES: what the LalaVerse knows each creator for (not "archetype", which is how they behave online). Build spark 1 around the first, spark 2 around the second, and so on, and give each spark "society_archetype" with its name exactly as written here:\n${picks.map((a, i) => `${i + 1}. ${menuLine(a)}`).join('\n')}`;
}

module.exports = {
  PAGE,
  KEY,
  DEFAULT_ARCHETYPES,
  normalizeArchetypes,
  loadSocietyArchetypes,
  societyArchetypeCounts,
  pickSocietyArchetypes,
  matchSocietyArchetype,
  assignSocietyArchetype,
  societyArchetypeLine,
  societyArchetypeMenu,
  societySparkBlock,
};
