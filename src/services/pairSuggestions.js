'use strict';

/**
 * Suggested pairs (Evoni's idea 4, PR 2; plan approved 2026-10-17: "yes to
 * all four", "yes start the suggested pairs"): creators who should know each
 * other on The Pulse, for Evoni to keep or dismiss. Nothing becomes a
 * relationship until she keeps it.
 *
 * Where suggestions come from:
 *   - Suggest pairs: every LalaVerse pair with no relationship yet, scored
 *     by audience overlap (services/audienceMap pairAffinity: niche first,
 *     content type second, the city a nudge), the strongest few; one Sonnet
 *     call proposes each pair's kind of relationship and why, in one line;
 *   - the Feed scheduler's auto-discover, which used to write relationships
 *     with no review (decision b): its matches now land here too.
 * Lala is never in a suggested pair (decision c).
 *
 * Kept in page_content feed_relationships / PAIR_SUGGESTIONS, no migration:
 *   { pending: [{ key, a, b, type, why, drama_level, score, source, created_at }],
 *     dismissed: [key] }   key: "lowerId-higherId"
 *
 *   listPending(db)  pending pairs with both creators, minus any that became
 *     a relationship or lost a profile since
 *   suggestPairs(db, { limit, onlyIds })  new AI suggestions, added to
 *     pending (onlyIds: among these profiles only; not offered by the route)
 *   addRulePairs(db, pairs)  auto-discover's matches, added to pending
 *   keepPair(db, key, { type, why, drama_level })  the relationship, made
 *   dismissPair(db, key)  gone, and never suggested again
 */

const { Op } = require('sequelize');
const { RELATIONSHIP_KINDS } = require('../utils/relationshipKinds');

const PAGE = 'feed_relationships';
const KEY = 'PAIR_SUGGESTIONS';
const MODELS = ['claude-sonnet-4-6'];
const LIVE = ['generated', 'finalized', 'crossed'];
const MIN_SCORE = 0.5;
const SUGGEST_MAX = 8;
const PENDING_MAX = 60;
// The kinds a stranger pair can plausibly start as (no couple, family, ex…).
const START_KINDS = Object.freeze(['collab', 'rival', 'feud', 'mentor', 'bestie', 'shade', 'copycat', 'orbit']);

class PairError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const pairKey = (a, b) => {
  const [x, y] = [Number(a), Number(b)].sort((m, n) => m - n);
  return `${x}-${y}`;
};
const clampDrama = (v, fallback = 3) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : fallback;
};

async function readStore(db) {
  try {
    const row = await db.PageContent.findOne({ where: { page_name: PAGE, constant_key: KEY }, attributes: ['data'] });
    const data = row?.data && typeof row.data === 'object' ? row.data : {};
    return { pending: Array.isArray(data.pending) ? data.pending : [], dismissed: Array.isArray(data.dismissed) ? data.dismissed : [] };
  } catch (err) {
    console.error('[pairSuggestions] the suggested pairs could not be read:', err.message);
    return { pending: [], dismissed: [] };
  }
}

async function writeStore(db, store) {
  const data = { pending: store.pending.slice(-PENDING_MAX), dismissed: store.dismissed };
  const [row] = await db.PageContent.findOrCreate({ where: { page_name: PAGE, constant_key: KEY }, defaults: { data } });
  await row.update({ data });
}

/** Every pair key that already has a relationship. */
async function relatedKeys(db) {
  const rows = await db.SocialProfileRelationship.findAll({ attributes: ['source_profile_id', 'target_profile_id'], raw: true });
  return new Set(rows.map((r) => pairKey(r.source_profile_id, r.target_profile_id)));
}

const kindFromOverlap = (o) => (o.kind === 'competes' ? 'rival' : 'collab');

/** A plain reason from the overlap itself, when the AI gives none. */
function overlapWhy(a, b, o) {
  const niche = o.niche && a.content_category ? `both post about ${a.content_category}` : null;
  const types = a.society_archetype && b.society_archetype ? `${a.society_archetype} and ${b.society_archetype}` : null;
  const how = o.kind === 'competes' ? 'compete for the same audience' : 'share an audience';
  return [niche, types && `${types} ${how}`, o.city && 'the same city'].filter(Boolean).join('; ') || `They ${how}.`;
}

/** The strongest unrelated, unsuggested, undismissed LalaVerse pairs by audience overlap. */
async function candidates(db, { limit = SUGGEST_MAX, store, onlyIds = null } = {}) {
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const profiles = await db.SocialProfile.findAll({
    where: {
      feed_layer: 'lalaverse', status: { [Op.in]: LIVE },
      [Op.and]: [
        ...(lalaId != null ? [{ id: { [Op.ne]: lalaId } }] : []),
        ...(Array.isArray(onlyIds) ? [{ id: { [Op.in]: onlyIds } }] : []),
      ],
    },
    attributes: ['id', 'handle', 'display_name', 'society_archetype', 'content_category', 'city', 'follower_tier', 'content_persona'],
    raw: true,
  });
  const taken = await relatedKeys(db);
  for (const p of store.pending) taken.add(p.key);
  for (const k of store.dismissed) taken.add(k);
  const { loadAudienceMap, pairAffinity } = require('./audienceMap');
  const map = await loadAudienceMap(db);
  const scored = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      const key = pairKey(a.id, b.id);
      if (taken.has(key)) continue;
      const o = pairAffinity(map, { type: a.society_archetype, niche: a.content_category, city: a.city },
        { type: b.society_archetype, niche: b.content_category, city: b.city });
      if (o.score < MIN_SCORE) continue;
      // Creators at the same size notice each other first.
      const score = o.score + (a.follower_tier && a.follower_tier === b.follower_tier ? 0.05 : 0);
      scored.push({ key, a, b, overlap: o, score: Math.round(score * 100) / 100 });
    }
  }
  return scored.sort((x, y) => y.score - x.score || x.key.localeCompare(y.key)).slice(0, limit);
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const who = (p) => [
  `@${String(p.handle).replace(/^@+/, '')}${p.display_name ? ` (${p.display_name})` : ''}`,
  p.society_archetype && `known as ${p.society_archetype}`,
  p.content_category && `niche: ${p.content_category}`,
  p.city && `city: ${String(p.city).replace(/_/g, ' ')}`,
  p.follower_tier && `${p.follower_tier} following`,
  p.content_persona && `persona: ${text(p.content_persona, 160)}`,
].filter(Boolean).join('; ');

async function suggestPairs(db, { limit = SUGGEST_MAX, onlyIds = null } = {}) {
  const n = Math.max(1, Math.min(SUGGEST_MAX, Number(limit) || SUGGEST_MAX));
  const store = await readStore(db);
  const found = await candidates(db, { limit: n, store, onlyIds });
  if (!found.length) return { added: [], note: 'No new pairs: every creator who overlaps already has a relationship, a suggestion waiting, or was dismissed.' };

  const prompt = `In the LalaVerse, everyone posts on The Pulse. These pairs of creators share an audience, or compete for one, but have no relationship yet. For each pair, say what they most plausibly are to each other right now, and why, in one line a reader would find interesting (what they have in common, what they want from each other, what is in the way).

Kinds to choose from: ${START_KINDS.join(', ')}.
${found.map((c, i) => `${i + 1}. ${who(c.a)}\n   and ${who(c.b)}\n   (${c.overlap.kind === 'competes' ? 'they compete for an audience' : 'they share an audience'}${c.overlap.niche ? ', same niche' : ''}${c.overlap.city ? ', same city' : ''})`).join('\n')}

Answer with JSON only, one entry per pair, numbered as above:
{"items": [{"n": 1, "type": "one of the kinds", "why": "one line", "drama_level": 0 to 10}]}`;

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 200 * found.length + 200, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[pairSuggestions] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let items = [];
  try {
    items = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]).items || [];
  } catch (err) {
    console.error('[pairSuggestions] the suggestions could not be read; using the overlap alone:', err.message);
  }
  const byN = new Map((Array.isArray(items) ? items : []).filter((it) => Number.isInteger(it?.n)).map((it) => [it.n, it]));
  const now = new Date().toISOString();
  const added = found.map((c, i) => {
    const got = byN.get(i + 1) || {};
    const type = START_KINDS.includes(got.type) ? got.type : kindFromOverlap(c.overlap);
    return {
      key: c.key, a: Number(c.a.id), b: Number(c.b.id), type,
      why: text(got.why, 300) || overlapWhy(c.a, c.b, c.overlap),
      drama_level: clampDrama(got.drama_level, type === 'rival' || type === 'feud' ? 5 : 2),
      score: c.score, source: 'suggest', created_at: now,
    };
  });
  await writeStore(db, { ...store, pending: [...store.pending, ...added] });
  return { added };
}

/** Auto-discover's matches ({ a, b, type, why }), added unless related, waiting or dismissed. */
async function addRulePairs(db, pairs) {
  const store = await readStore(db);
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const taken = await relatedKeys(db);
  for (const p of store.pending) taken.add(p.key);
  for (const k of store.dismissed) taken.add(k);
  const now = new Date().toISOString();
  const added = [];
  for (const p of pairs || []) {
    const key = pairKey(p.a, p.b);
    if (taken.has(key) || Number(p.a) === Number(p.b)) continue;
    if (lalaId != null && (Number(p.a) === Number(lalaId) || Number(p.b) === Number(lalaId))) continue;
    taken.add(key);
    added.push({
      key, a: Number(p.a), b: Number(p.b), type: START_KINDS.includes(p.type) ? p.type : 'collab',
      why: text(p.why, 300) || null, drama_level: clampDrama(p.drama_level, 0), score: null, source: 'auto', created_at: now,
    });
  }
  if (added.length) await writeStore(db, { ...store, pending: [...store.pending, ...added] });
  return added;
}

async function listPending(db) {
  const store = await readStore(db);
  const taken = await relatedKeys(db);
  const live = store.pending.filter((p) => !taken.has(p.key));
  const ids = [...new Set(live.flatMap((p) => [p.a, p.b]))];
  const profiles = ids.length
    ? await db.SocialProfile.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'handle', 'display_name', 'society_archetype', 'content_category', 'city'], raw: true })
    : [];
  const byId = new Map(profiles.map((p) => [Number(p.id), p]));
  return live.filter((p) => byId.has(p.a) && byId.has(p.b)).map((p) => ({ ...p, profile_a: byId.get(p.a), profile_b: byId.get(p.b) }));
}

async function keepPair(db, key, { type, why, drama_level: drama } = {}) {
  const store = await readStore(db);
  const pending = store.pending.find((p) => p.key === key);
  if (!pending) throw new PairError(404, 'That suggestion is no longer waiting.');
  const kind = type || pending.type;
  if (!RELATIONSHIP_KINDS.includes(kind)) throw new PairError(400, `"${text(kind, 40)}" is not a kind of relationship.`);
  if ((await relatedKeys(db)).has(key)) {
    await writeStore(db, { ...store, pending: store.pending.filter((p) => p.key !== key) });
    throw new PairError(409, 'These two already have a relationship.');
  }
  const rel = await db.SocialProfileRelationship.create({
    source_profile_id: pending.a, target_profile_id: pending.b, relationship_type: kind,
    description: text(why, 1000) || pending.why || null, drama_level: clampDrama(drama ?? pending.drama_level, 0),
    direction: 'mutual', public_visibility: 'public', auto_generated: false,
  });
  await writeStore(db, { ...store, pending: store.pending.filter((p) => p.key !== key) });
  return rel;
}

async function dismissPair(db, key) {
  const store = await readStore(db);
  if (!store.pending.some((p) => p.key === key)) throw new PairError(404, 'That suggestion is no longer waiting.');
  await writeStore(db, {
    pending: store.pending.filter((p) => p.key !== key),
    dismissed: store.dismissed.includes(key) ? store.dismissed : [...store.dismissed, key],
  });
}

module.exports = {
  PAGE, KEY, START_KINDS, MIN_SCORE, PairError,
  pairKey, candidates, suggestPairs, addRulePairs, listPending, keepPair, dismissPair,
};
