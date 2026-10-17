'use strict';

/**
 * Shared audiences (Evoni's idea 4, 2026-10-17; plan approved "yes to all
 * four"): which content types (Society archetypes, services/
 * societyArchetypes) share an audience and which compete for one. Creators
 * whose audiences overlap comment on each other, collaborate and compare;
 * creators whose content clashes become rivals.
 *
 * Where a type's links come from: Evoni's saved ones (page_content
 * influencer_systems / AUDIENCE_MAP, a map of type name to { shares,
 * competes }), else the defaults below for the fifteen default types, else
 * none (a type she added; Suggest proposes some). Links are read both ways:
 * A shares with B when either lists the other.
 *
 *   loadAudienceMap(db)  → Map(nameKey → { shares: Set, competes: Set, custom })
 *   affinity(map, typeA, typeB)  → { kind: 'shares'|'competes'|'same'|null, score }
 *     shares 1, competes 0.7 (rivals watch each other), the same type 0.8
 *     (the same lane), else 0.
 *   listAudience(db)  → [{ name, shares, competes, custom, has_default }]
 *   saveAudience(db, name, links)  Evoni's own (null: back to the default)
 *   suggestAudience(db, name)  one Sonnet call; nothing is saved
 *   audienceScores(db, profileId, otherIds)  Map(other profile → affinity
 *     score) from their content types; Lala is never scored (her
 *     relationships are the story's: decision c).
 *
 * Fail-soft: a read that fails logs and scores nothing.
 */

const { PAGE, loadSocietyArchetypes, matchSocietyArchetype } = require('./societyArchetypes');

const KEY = 'AUDIENCE_MAP';
const MODELS = ['claude-sonnet-4-6'];
const SCORES = Object.freeze({ shares: 1, same: 0.8, competes: 0.7 });
const MAX_LINKS = 6;

class AudienceError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const link = (shares, competes) => Object.freeze({ shares, competes });

// The fifteen default types (Evoni edits any on the Society tab).
const DEFAULT_AUDIENCE = Object.freeze({
  'The Main Character': link(['The Relatable Friend', 'The Drama Magnet', 'The Wellness Guide'], ['The Luxury Icon']),
  'The Trendsetter': link(['The Beauty Oracle', 'The Luxury Icon'], ['The Archivist', 'The Rebel']),
  'The Beauty Oracle': link(['The Trendsetter', 'The Wellness Guide', 'The Educator'], []),
  'The Hustle Mogul': link(['The Educator', 'The Luxury Icon', 'The Connector'], ['The Wellness Guide']),
  'The Entertainer': link(['The Commentator', 'The Drama Magnet'], ['The Viral Wildcard']),
  'The Drama Magnet': link(['The Commentator', 'The Main Character', 'The Entertainer'], ['The Rebel']),
  'The Relatable Friend': link(['The Main Character', 'The Wellness Guide', 'The Entertainer'], ['The Luxury Icon']),
  'The Luxury Icon': link(['The Trendsetter', 'The Hustle Mogul'], ['The Relatable Friend', 'The Rebel']),
  'The Educator': link(['The Beauty Oracle', 'The Hustle Mogul', 'The Archivist'], ['The Commentator']),
  'The Commentator': link(['The Drama Magnet', 'The Entertainer', 'The Rebel'], ['The Educator']),
  'The Connector': link(['The Hustle Mogul', 'The Main Character', 'The Luxury Icon'], []),
  'The Archivist': link(['The Educator', 'The Commentator'], ['The Trendsetter']),
  'The Rebel': link(['The Commentator', 'The Viral Wildcard', 'The Archivist'], ['The Luxury Icon', 'The Trendsetter']),
  'The Wellness Guide': link(['The Relatable Friend', 'The Beauty Oracle', 'The Main Character'], ['The Hustle Mogul']),
  'The Viral Wildcard': link(['The Entertainer', 'The Rebel', 'The Drama Magnet'], []),
});

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const nameKey = (v) => text(v, 200).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Links as { shares: [name], competes: [name] }: names on the list only, not itself, at most MAX_LINKS each. */
function normalizeLinks(links, list, self) {
  const pick = (names) => {
    const seen = new Set([nameKey(self)]);
    const out = [];
    for (const n of Array.isArray(names) ? names : []) {
      const found = matchSocietyArchetype(list, n);
      if (!found || seen.has(nameKey(found.name))) continue;
      seen.add(nameKey(found.name));
      out.push(found.name);
      if (out.length === MAX_LINKS) break;
    }
    return out;
  };
  return { shares: pick(links?.shares), competes: pick(links?.competes) };
}

async function savedMap(db) {
  if (!db?.PageContent) return {};
  try {
    const row = await db.PageContent.findOne({ where: { page_name: PAGE, constant_key: KEY }, attributes: ['data'] });
    return row?.data && typeof row.data === 'object' && !Array.isArray(row.data) ? row.data : {};
  } catch (err) {
    console.error('[audienceMap] the saved audience map could not be read; using the defaults:', err.message);
    return {};
  }
}

/** Map(nameKey → { shares: Set(nameKey), competes: Set(nameKey), custom }): Evoni's saved links over the defaults. */
async function loadAudienceMap(db) {
  const map = new Map();
  const set = (name, links, custom) => map.set(nameKey(name), {
    shares: new Set((links.shares || []).map(nameKey)), competes: new Set((links.competes || []).map(nameKey)), custom,
  });
  for (const [name, links] of Object.entries(DEFAULT_AUDIENCE)) set(name, links, false);
  for (const [name, links] of Object.entries(await savedMap(db))) if (links && typeof links === 'object') set(name, links, true);
  return map;
}

/** How two content types relate through their audiences, read both ways. */
function affinity(map, typeA, typeB) {
  const a = nameKey(typeA);
  const b = nameKey(typeB);
  if (!a || !b) return { kind: null, score: 0 };
  if (a === b) return { kind: 'same', score: SCORES.same };
  const la = map.get(a);
  const lb = map.get(b);
  if (la?.competes.has(b) || lb?.competes.has(a)) return { kind: 'competes', score: SCORES.competes };
  if (la?.shares.has(b) || lb?.shares.has(a)) return { kind: 'shares', score: SCORES.shares };
  return { kind: null, score: 0 };
}

async function listAudience(db) {
  const [list, saved] = await Promise.all([loadSocietyArchetypes(db), savedMap(db)]);
  const savedByKey = new Map(Object.entries(saved).map(([n, l]) => [nameKey(n), l]));
  const defaultByKey = new Map(Object.entries(DEFAULT_AUDIENCE).map(([n, l]) => [nameKey(n), l]));
  return list.map((a) => {
    const key = nameKey(a.name);
    const custom = savedByKey.has(key);
    const links = normalizeLinks(custom ? savedByKey.get(key) : defaultByKey.get(key), list, a.name);
    return { name: a.name, ...links, custom, has_default: defaultByKey.has(key) };
  });
}

async function saveAudience(db, name, links) {
  const list = await loadSocietyArchetypes(db);
  const archetype = matchSocietyArchetype(list, name);
  if (!archetype) throw new AudienceError(400, `"${text(name, 100)}" is not on the Society tab's list of content types.`);
  const saved = { ...(await savedMap(db)) };
  for (const k of Object.keys(saved)) if (nameKey(k) === nameKey(archetype.name)) delete saved[k];
  if (links !== null) saved[archetype.name] = normalizeLinks(links, list, archetype.name);
  const [row] = await db.PageContent.findOrCreate({ where: { page_name: PAGE, constant_key: KEY }, defaults: { data: saved } });
  await row.update({ data: saved });
  return (await listAudience(db)).find((t) => nameKey(t.name) === nameKey(archetype.name));
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function suggestAudience(db, name) {
  const list = await loadSocietyArchetypes(db);
  const archetype = matchSocietyArchetype(list, name);
  if (!archetype) throw new AudienceError(400, `"${text(name, 100)}" is not on the Society tab's list of content types.`);
  const others = list.filter((a) => nameKey(a.name) !== nameKey(archetype.name));
  const prompt = `In the LalaVerse, every creator on The Pulse is known for a content type. For one type, say which other types SHARE its audience (the same people follow both; they comment on each other and collaborate) and which COMPETE with it (they fight over the same attention, or their content clashes; rivals watch each other). Two to four of each at most; none is fine.

Content type: ${archetype.name}
${archetype.content ? `What they post: ${archetype.content}\n` : ''}${archetype.audience ? `Their effect on the audience: ${archetype.audience}\n` : ''}
The other types:
${others.map((a) => `- ${a.name}${a.content ? `: ${a.content}` : ''}`).join('\n')}

Answer with JSON only, names exactly as written above:
{"shares": ["..."], "competes": ["..."], "why": "one sentence"}`;
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[audienceMap] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[audienceMap] the suggestion could not be read:', err.message);
    throw new AudienceError(502, 'The suggestion came back in a form that could not be read. Try again.');
  }
  return { name: archetype.name, ...normalizeLinks(parsed, list, archetype.name), why: text(parsed.why, 300) || null };
}

/**
 * Map(other profile id → affinity score to `profileId`) from their content
 * types. Lala (as either side) scores nothing: her ties are the story's.
 */
async function audienceScores(db, profileId, otherIds) {
  const scores = new Map();
  const ids = [...new Set((otherIds || []).map(Number).filter(Number.isFinite))];
  if (!profileId || !ids.length || !db?.sequelize) return scores;
  try {
    const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
    if (lalaId != null && Number(lalaId) === Number(profileId)) return scores;
    const [rows] = await db.sequelize.query(
      'SELECT id, society_archetype FROM social_profiles WHERE id IN (:ids)', { replacements: { ids: [Number(profileId), ...ids] } });
    const typeOf = new Map(rows.map((r) => [Number(r.id), r.society_archetype]));
    const mine = typeOf.get(Number(profileId));
    if (!mine) return scores;
    const map = await loadAudienceMap(db);
    for (const id of ids) {
      if (lalaId != null && Number(lalaId) === id) continue;
      const theirs = typeOf.get(id);
      if (!theirs) continue;
      const { score } = affinity(map, mine, theirs);
      if (score > 0) scores.set(id, score);
    }
  } catch (err) {
    console.error('[audienceMap] audience scores could not be read; scoring without them:', err.message);
  }
  return scores;
}

module.exports = {
  KEY,
  DEFAULT_AUDIENCE,
  SCORES,
  AudienceError,
  normalizeLinks,
  loadAudienceMap,
  affinity,
  listAudience,
  saveAudience,
  suggestAudience,
  audienceScores,
};
