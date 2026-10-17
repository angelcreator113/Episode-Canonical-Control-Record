'use strict';

/**
 * The content mix (Evoni's idea 3, 2026-10-17: "yes start the content mix"):
 * each content type (a Society archetype, services/societyArchetypes) has a
 * few content pillars, each with its share of their posts and an example. A
 * Beauty Oracle's week is mostly tutorials, some reviews, one "this is over"
 * call; a week of posts should look like that creator, not ten of one kind.
 *
 * Where a type's pillars come from: Evoni's saved ones (page_content
 * influencer_systems / CONTENT_PILLARS, a map of type name to pillars), else
 * the defaults below for the fifteen default types, else none (a type she
 * added; Suggest proposes some).
 *
 *   loadPillarMap(db)  → Map(nameKey → { pillars, custom })
 *   pillarsFor(db, name)  → the type's pillars, [] when none
 *   listPillars(db)  → [{ name, pillars, custom, has_default }] for the
 *     Society tab's list, in its order
 *   savePillars(db, name, pillars)  Evoni's own (null: back to the default).
 *     A PillarsError 400 for a type off the list or pillars that do not read.
 *   suggestPillars(db, name)  one Sonnet call; nothing is saved.
 *   recentPillarCounts(db, profileId)  how many of their last posts used
 *     each pillar (feed_posts.gate_json.pillar, written by Generate Posts)
 *   planPillars(pillars, recent, n)  the next n posts' pillars: each the one
 *     furthest below its share, counting the plan so far
 *   pillarsLine(pillars)  the prompt line
 *
 * Fail-soft: a read that fails logs and gives no pillars; a post is never
 * blocked for want of a mix.
 */

const { PAGE, loadSocietyArchetypes, matchSocietyArchetype } = require('./societyArchetypes');

const KEY = 'CONTENT_PILLARS';
const MODELS = ['claude-sonnet-4-6'];
const MAX_PILLARS = 6;
const RECENT = 10;

class PillarsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const p = (name, share, example) => Object.freeze({ name, share, example });

// The fifteen default types' mixes (Evoni edits any on the Society tab).
const DEFAULT_PILLARS = Object.freeze({
  'The Main Character': [p('Life update as an episode', 40, 'A "so this happened" post that reads like the next chapter'), p('Glow-up or turning point', 25, 'Before-and-after of a hard season'), p('Emotional monologue', 20, 'A late-night caption about what they are really feeling'), p('Relationship moment', 15, 'A soft-launch or a pointed absence')],
  'The Trendsetter': [p('Outfit reveal', 45, 'A look nobody is wearing yet'), p('Early call', 25, 'Naming the next thing before it lands'), p('Aesthetic shift', 20, 'Retiring last season\'s look on purpose'), p('Behind the look', 10, 'Where the idea came from')],
  'The Beauty Oracle': [p('Tutorial or technique', 45, 'A step-by-step for a look everyone will copy'), p('Product verdict', 30, 'Honest review: worth it or not'), p('"This is over" call', 15, 'Declaring a trend finished'), p('Routine', 10, 'The morning or night routine')],
  'The Hustle Mogul': [p('Launch or build log', 35, 'Day 12 of building the brand'), p('Income transparency', 25, 'What last month actually made'), p('Business advice', 25, 'The one lesson that cost the most'), p('Motivation', 15, 'A 5am post for the people still building')],
  'The Entertainer': [p('Skit', 45, 'A short bit everyone will tag a friend in'), p('Reaction', 25, 'Reacting to the thing everyone is talking about'), p('Meme or format', 20, 'Their spin on the format of the week'), p('Bloopers', 10, 'The takes that did not make it')],
  'The Drama Magnet': [p('Callout or response', 40, 'Answering what someone said about them'), p('Receipts', 25, 'Screenshots, dates, proof'), p('Vague post', 20, 'A pointed caption naming nobody'), p('Making peace (or not)', 15, 'A public olive branch with an edge')],
  'The Relatable Friend': [p('Daily life', 40, 'The unglamorous middle of a Tuesday'), p('Honest confession', 25, 'Something everyone does and nobody says'), p('Low-production realness', 20, 'No filter, bad lighting, real'), p('Asking the audience', 15, 'What would you do?')],
  'The Luxury Icon': [p('Designer look', 35, 'The piece, the label, the room it was worn in'), p('Travel', 25, 'Somewhere most people only save to a board'), p('Exclusive event', 25, 'A door most people never see behind'), p('Lifestyle detail', 15, 'The small expensive habit')],
  'The Educator': [p('Tutorial', 40, 'How to do the thing, step by step'), p('Explainer thread', 30, 'Why the thing works the way it does'), p('Myth-busting', 20, 'What everyone gets wrong'), p('Q&A', 10, 'Answering the audience\'s questions')],
  'The Commentator': [p('Cultural analysis', 40, 'What this moment says about everyone'), p('Reaction take', 30, 'Their read on the week\'s news'), p('Naming the thing', 20, 'A phrase that sticks'), p('Audience debate', 10, 'Putting a question to the comments')],
  'The Connector': [p('Collab', 35, 'Something made with another creator'), p('Event or gathering', 30, 'Who was there and who met whom'), p('Shout-out', 20, 'Pointing their audience at someone new'), p('Group content', 15, 'Everyone in one frame')],
  'The Archivist': [p('Archive piece', 40, 'A look or object from years ago, explained'), p('Nostalgia', 25, 'What it felt like back then'), p('This day in fashion', 20, 'An anniversary of a moment'), p('Correcting the record', 15, 'Who really did it first')],
  'The Rebel': [p('Hot take', 40, 'The opinion nobody else will post'), p('Anti-trend look', 25, 'Wearing what everyone said was over'), p('Experimental piece', 20, 'Art that half the audience will hate'), p('Calling out the mainstream', 15, 'Why the popular thing is empty')],
  'The Wellness Guide': [p('Routine', 35, 'The slow morning, step by step'), p('Rest permission', 25, 'A post saying it is fine to stop'), p('Boundaries', 20, 'What they said no to this week'), p('Mindfulness or therapy talk', 20, 'What their therapist said that stuck')],
  'The Viral Wildcard': [p('Random viral moment', 40, 'Something nobody expected, posted at 3am'), p('Chaotic format', 30, 'A format that should not work and does'), p('Unhinged update', 20, 'Life news delivered sideways'), p('Trend hijack', 10, 'Taking a trend somewhere it was never meant to go')],
});

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const nameKey = (v) => text(v, 200).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Pillars as [{ name, share, example }]: named, at most MAX_PILLARS, the
 * first of a name kept, shares whole percents summing to 100 (scaled from
 * what was given; equal when none were). [] when nothing reads.
 */
function normalizePillars(items) {
  const seen = new Set();
  const rows = [];
  for (const it of Array.isArray(items) ? items : []) {
    const name = text(it?.name, 60);
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const share = Number(it.share);
    rows.push({ name, share: Number.isFinite(share) && share > 0 ? share : 0, example: text(it.example, 200) });
    if (rows.length === MAX_PILLARS) break;
  }
  if (!rows.length) return [];
  const sum = rows.reduce((a, r) => a + r.share, 0);
  const raw = rows.map((r) => (sum > 0 ? (100 * r.share) / sum : 100 / rows.length));
  const shares = raw.map((v) => Math.max(1, Math.floor(v)));
  // Hand the rounding leftover to the largest remainders, so they sum to 100.
  let left = 100 - shares.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let k = 0; left !== 0 && k < order.length * 4; k += 1) {
    const i = order[k % order.length];
    if (left > 0) { shares[i] += 1; left -= 1; } else if (shares[i] > 1) { shares[i] -= 1; left += 1; }
  }
  return rows.map((r, i) => ({ ...r, share: shares[i] }));
}

async function savedMap(db) {
  if (!db?.PageContent) return {};
  try {
    const row = await db.PageContent.findOne({ where: { page_name: PAGE, constant_key: KEY }, attributes: ['data'] });
    return row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  } catch (err) {
    console.error('[contentPillars] the saved content mixes could not be read; using the defaults:', err.message);
    return {};
  }
}

/** Map(nameKey → { pillars, custom }): Evoni's saved mixes over the defaults. */
async function loadPillarMap(db) {
  const map = new Map();
  for (const [name, pillars] of Object.entries(DEFAULT_PILLARS)) map.set(nameKey(name), { pillars: normalizePillars(pillars), custom: false });
  for (const [name, pillars] of Object.entries(await savedMap(db))) {
    const clean = normalizePillars(pillars);
    if (clean.length) map.set(nameKey(name), { pillars: clean, custom: true });
  }
  return map;
}

async function pillarsFor(db, name, map = null) {
  if (!name) return [];
  return ((map || await loadPillarMap(db)).get(nameKey(name)) || { pillars: [] }).pillars;
}

async function listPillars(db) {
  const [list, map] = await Promise.all([loadSocietyArchetypes(db), loadPillarMap(db)]);
  const defaults = new Set(Object.keys(DEFAULT_PILLARS).map(nameKey));
  return list.map((a) => {
    const got = map.get(nameKey(a.name));
    return { name: a.name, pillars: got?.pillars || [], custom: !!got?.custom, has_default: defaults.has(nameKey(a.name)) };
  });
}

async function savePillars(db, name, pillars) {
  const archetype = matchSocietyArchetype(await loadSocietyArchetypes(db), name);
  if (!archetype) throw new PillarsError(400, `"${text(name, 100)}" is not on the Society tab's list of content types.`);
  let clean = null;
  if (pillars !== null) {
    clean = normalizePillars(pillars);
    if (!clean.length) throw new PillarsError(400, 'Give at least one pillar with a name, or reset to the default.');
  }
  const saved = { ...(await savedMap(db)) };
  for (const k of Object.keys(saved)) if (nameKey(k) === nameKey(archetype.name)) delete saved[k];
  if (clean) saved[archetype.name] = clean;
  const [row] = await db.PageContent.findOrCreate({ where: { page_name: PAGE, constant_key: KEY }, defaults: { data: saved } });
  await row.update({ data: saved });
  return pillarsFor(db, archetype.name);
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function suggestPillars(db, name) {
  const archetype = matchSocietyArchetype(await loadSocietyArchetypes(db), name);
  if (!archetype) throw new PillarsError(400, `"${text(name, 100)}" is not on the Society tab's list of content types.`);
  const prompt = `In the LalaVerse, every creator on The Pulse (its one social app) is known for a content type. Give the content mix for this one: 3 to 5 content pillars, the kinds of post a creator of this type makes, each with its share of their posts (whole percents summing to 100) and one example post idea. The biggest pillar is what they are known for; the smaller ones keep a week of posts from looking the same. Nothing about real brands or real apps.

Content type: ${archetype.name}
${archetype.content ? `What they post: ${archetype.content}\n` : ''}${archetype.audience ? `Their effect on the audience: ${archetype.audience}\n` : ''}${archetype.narrative ? `What they do in the story: ${archetype.narrative}\n` : ''}
Answer with JSON only:
{"pillars": [{"name": "a few words", "share": 40, "example": "one post idea, a short line"}]}`;
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[contentPillars] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[contentPillars] the suggestion could not be read:', err.message);
    throw new PillarsError(502, 'The suggestion came back in a form that could not be read. Try again.');
  }
  const pillars = normalizePillars(parsed.pillars);
  if (!pillars.length) throw new PillarsError(502, 'The suggestion had no pillars. Try again.');
  return { name: archetype.name, pillars };
}

/** { pillarName: count } over their last RECENT posts that recorded one. */
async function recentPillarCounts(db, profileId) {
  if (!profileId || !db?.sequelize) return {};
  try {
    const [rows] = await db.sequelize.query(
      `SELECT gate_json->>'pillar' AS pillar FROM feed_posts
        WHERE social_profile_id = :pid AND deleted_at IS NULL AND gate_json->>'pillar' IS NOT NULL
        ORDER BY created_at DESC LIMIT ${RECENT}`, { replacements: { pid: profileId } });
    const counts = {};
    for (const r of rows) counts[r.pillar] = (counts[r.pillar] || 0) + 1;
    return counts;
  } catch (err) {
    console.error('[contentPillars] their recent posts\' pillars could not be read:', err.message);
    return {};
  }
}

/**
 * The next n posts' pillars: each the one furthest below its share of the
 * posts so far (the recent ones plus the plan), a tie to the bigger share.
 */
function planPillars(pillars, recent = {}, n = 1) {
  if (!pillars?.length) return [];
  const have = new Map(pillars.map((pl) => [pl.name, 0]));
  for (const [name, count] of Object.entries(recent || {})) {
    const match = pillars.find((pl) => nameKey(pl.name) === nameKey(name));
    if (match) have.set(match.name, have.get(match.name) + (Number(count) || 0));
  }
  let total = [...have.values()].reduce((a, b) => a + b, 0);
  const plan = [];
  for (let i = 0; i < n; i += 1) {
    const next = total + 1;
    const pick = [...pillars].sort((a, b) => ((b.share / 100) * next - have.get(b.name)) - ((a.share / 100) * next - have.get(a.name)) || b.share - a.share)[0];
    plan.push(pick);
    have.set(pick.name, have.get(pick.name) + 1);
    total = next;
  }
  return plan;
}

/** The prompt line: their pillars with shares and examples. */
function pillarsLine(pillars) {
  if (!pillars?.length) return '';
  return `Their content mix (the kinds of post they make, with each one's share of their posts): ${pillars.map((pl) => `${pl.name} ${pl.share}%${pl.example ? ` (e.g. ${pl.example})` : ''}`).join('; ')}.`;
}

/** The pillar a post's answer names, from their pillars, or null. */
function matchPillar(pillars, value) {
  const key = nameKey(value);
  return key ? (pillars || []).find((pl) => nameKey(pl.name) === key) || null : null;
}

module.exports = {
  KEY,
  DEFAULT_PILLARS,
  MAX_PILLARS,
  PillarsError,
  normalizePillars,
  loadPillarMap,
  pillarsFor,
  listPillars,
  savePillars,
  suggestPillars,
  recentPillarCounts,
  planPillars,
  pillarsLine,
  matchPillar,
};
