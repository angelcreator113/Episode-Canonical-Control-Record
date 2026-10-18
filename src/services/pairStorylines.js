'use strict';

/**
 * A storyline from a pair (Evoni's idea 4, PR 3; plan approved 2026-10-17:
 * "yes to all four", "yes start the storyline seeds"). On a relationship she
 * has kept (a rivalry, a collab, any kind), "Suggest a storyline" proposes a
 * title and a premise for a Pulse storyline between the two. Nothing is
 * saved: she edits it and starts it as a storyline (POST /pulse-storylines),
 * and the existing beat suggester (pulseStorylines.suggestBeats) plans its
 * beats from that premise.
 *
 *   seedStoryline(db, relationshipId, { showId })
 *     one Sonnet call, under the show's manual request cap. Lala is never in
 *     a seeded pair (decision c: her relationships are story-controlled).
 *     Returns { title, premise, pair, can_post, note }: can_post is which of
 *     the two can post in this show today (Alive, met by Lala, a Voice
 *     Profile; the beat suggester's own rule), and note says what is missing
 *     when one or both cannot.
 */

const MODELS = ['claude-sonnet-4-6'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE_ATTRS = ['id', 'handle', 'display_name', 'society_archetype', 'content_category', 'city', 'follower_tier', 'content_persona'];

class SeedError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'SeedError'; }
}

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const bare = (h) => String(h || '').replace(/^@+/, '');

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const who = (p) => [
  `@${bare(p.handle)}${p.display_name ? ` (${p.display_name})` : ''}`,
  p.society_archetype && `known on The Pulse as ${p.society_archetype}`,
  p.content_category && `posts about ${p.content_category}`,
  p.city && `lives in ${String(p.city).replace(/_/g, ' ')}`,
  p.follower_tier && `${p.follower_tier} following`,
  p.content_persona && `persona: ${text(p.content_persona, 200)}`,
].filter(Boolean).join('; ');

/** The pair's handles that can post in this show today, by the beat suggester's rule. */
async function postersOf(db, showId, ids) {
  const people = await require('./pulseVoices').eligible(db, showId, { stage: 'alive', met: true });
  const can = new Set(people.filter((c) => c.voice).map((c) => Number(c.profile.id)));
  return ids.filter((id) => can.has(Number(id)));
}

async function seedStoryline(db, relationshipId, { showId } = {}) {
  if (!UUID_RE.test(String(showId || ''))) throw new SeedError(400, 'show_id must be a show id (UUID).');
  const id = Number(relationshipId);
  if (!Number.isInteger(id) || id <= 0) throw new SeedError(404, 'Relationship not found');
  const rel = await db.SocialProfileRelationship.findByPk(id);
  if (!rel) throw new SeedError(404, 'Relationship not found');
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const ids = [Number(rel.source_profile_id), Number(rel.target_profile_id)];
  if (lalaId != null && ids.includes(Number(lalaId))) {
    throw new SeedError(400, 'Lala\'s relationships follow the show\'s story, so they are not seeded here.');
  }
  const profiles = await db.SocialProfile.findAll({ where: { id: ids }, attributes: PROFILE_ATTRS, raw: true });
  const byId = new Map(profiles.map((p) => [Number(p.id), p]));
  const [a, b] = ids.map((pid) => byId.get(pid));
  if (!a || !b) throw new SeedError(404, 'One of these two no longer has a profile.');

  const [lines] = await db.sequelize.query(
    `SELECT title FROM pulse_storylines WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('planned', 'running')
      ORDER BY created_at DESC LIMIT 12`, { replacements: { showId } });
  const kind = String(rel.relationship_type).replace(/_/g, ' ');
  const prompt = `You seed a storyline on The Pulse, LalaVerse's social network: a thread told in posts by its characters, planted early and paid off later.

The two creators:
- ${who(a)}
- ${who(b)}
What they are to each other: ${kind}${rel.description ? `. ${text(rel.description, 400)}` : ''}
Drama level: ${Number(rel.drama_level) || 0} out of 10.
${lines.length ? `Storylines already running on The Pulse (do not repeat them): ${lines.map((l) => l.title).join('; ')}\n` : ''}
Propose one storyline between these two that grows out of what they are to each other and what they post about: something that starts small, builds in public, and pays off.
Rules: stay in the world (nothing about a show, episodes or a studio); name both by handle in the premise; say what each wants and what is in the way; never state a character's private feelings as fact, only what their posts could show.
Answer with JSON only: {"title": "a short title, under 8 words", "premise": "two to four sentences"}`;

  await require('./pulseRequests').take(db, { showId, lane: 'manual', kind: 'suggestions' });
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[pairStorylines] seeding with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (parseErr) {
    console.error('[pairStorylines] could not read the seed:', parseErr.message);
    throw new SeedError(502, 'The storyline came back in a form that could not be read.');
  }
  const title = text(parsed.title, 200);
  const premise = text(parsed.premise, 4000);
  if (!title || !premise) throw new SeedError(502, 'The storyline came back without a title or a premise.');

  const posting = await postersOf(db, showId, ids);
  const handles = (pids) => pids.map((pid) => `@${bare(byId.get(pid).handle)}`);
  const missing = ids.filter((pid) => !posting.includes(pid));
  const note = missing.length
    ? `${handles(missing).join(' and ')} cannot post in this show yet (it needs to be Alive, met by Lala, and have a Voice Profile), so the beat suggester will give ${missing.length === 2 ? 'their' : 'that'} beats to others.`
    : null;
  return {
    title, premise,
    pair: { relationship_id: id, type: rel.relationship_type, a: { id: ids[0], handle: bare(a.handle) }, b: { id: ids[1], handle: bare(b.handle) } },
    can_post: handles(posting),
    note,
  };
}

module.exports = { MODELS, SeedError, seedStoryline };
