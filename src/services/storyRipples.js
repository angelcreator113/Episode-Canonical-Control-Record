'use strict';

/**
 * Story ripples: relationship changes reach the Pulse (Evoni, 2026-10-23:
 * "relationship changes reach the Pulse"). When the "What changed" card's
 * Save writes a relationship change (services/episodeStoryRecord
 * approveRecord: a love interest, a new stage like flirting, a falling-out),
 * the Pulse SUGGESTS a few posts or comments about it: a rumour from someone
 * who saw it, a friend's "who was that at the rail??", Lala's own soft
 * launch. Every one is a draft waiting in Admin › The Pulse › Review; nothing
 * posts on its own.
 *
 *   planCount(changes)   how many suggestions a Save's changes make (0-3),
 *                        decided without the AI, so the Save can say it at once
 *   proposeLater(sequelize, { episode, changes, people })
 *                        the hook approveRecord calls after its transaction
 *                        commits: returns planCount at once and drafts in the
 *                        background; never throws, a failure is logged
 *   propose(db, { episode, changes, people })
 *                        one AI call (one manual Pulse request, budget-gated
 *                        by aiCostTracker) for all of a Save's changes;
 *                        writes feed_posts drafts (status 'draft', tied to the
 *                        episode, so they wait under "Posts from episodes")
 *                        and feed_comments drafts on them ("Comments waiting").
 *                        Returns { posts, comments, dropped }.
 *
 * Each post keeps why it exists in gate_json.story: { source: 'story',
 * relationship_id, relationship_event_id, episode_id, episode_number, line,
 * secrecy, mode }, and gate_json.review always holds 'story_change', a
 * reason trust never waives (services/pulseTrust). A comment keeps the same
 * line in voice_note (that column keeps why a comment was drafted).
 *
 * Secrecy (who is allowed to know what; services/pulseKnowledge): a pair's
 * secrecy is the most secret of
 *   - character_relationships.public_state (secret | rumoured | known), when
 *     that column exists (branch "relationship knowers"; read, never needed)
 *   - their Feed profiles' social_profile_relationships: hidden or a
 *     secret_link is secret, rumored is rumoured
 *   - a hidden character secret of either one that names the other.
 * Public: anyone around them may post, gossip accounts too, and Lala may say
 * it outright. Secret or rumoured: only those who plausibly know (the two of
 * them, the event's guests who were there, their close ties, and known_by),
 * only hints and rumours, and a draft that names both of them (or one of
 * them naming the other) is a reveal and is dropped, never saved.
 */

const MODELS = ['claude-sonnet-4-6'];
const MAX_SUGGESTIONS = 3;
const MAX_POOL = 10;
const MAX_TOKENS = 1200;
const ROMANTIC_STAGES = ['flirting', 'lovers', 'partners'];
const FALLING_OUT = ['exes', 'enemies'];
const CLOSER = ['friends', 'close_friends'];
const MODES = {
  public: ['rumour', 'hint', 'soft_launch', 'reaction', 'announcement'],
  rumoured: ['rumour', 'hint', 'soft_launch'],
  secret: ['rumour', 'hint', 'soft_launch'],
};
const RANK = { public: 0, rumoured: 1, secret: 2 };
// Feed profiles that read as gossip accounts (public changes only).
const GOSSIP_ARCHETYPES = ['the_watcher', 'chaos_creator'];

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const words = (s) => String(s || '').replace(/_/g, ' ');

/** What kind of change it is for the Pulse: romance, falling_out, closer, or null (not worth a post). */
function kindOf(c) {
  if (!c) return null;
  const moved = c.stage_after && c.stage_after !== c.stage_before;
  if (FALLING_OUT.includes(c.stage_after) && moved) return 'falling_out';
  if (c.is_romantic || ROMANTIC_STAGES.includes(c.stage_after)) return (moved || !c.stage_before) ? 'romance' : null;
  if (CLOSER.includes(c.stage_after) && moved) return 'closer';
  return null;
}
const WEIGHT = { romance: 3, falling_out: 2, closer: 1 };
const ORDER = ['romance', 'falling_out', 'closer'];

/** The changes worth a post, most telling first, each with its share of the suggestions. */
function planned(changes) {
  const list = (Array.isArray(changes) ? changes : [])
    .map((c) => ({ ...c, ripple: kindOf(c) }))
    .filter((c) => c.ripple)
    .sort((x, y) => ORDER.indexOf(x.ripple) - ORDER.indexOf(y.ripple));
  let left = MAX_SUGGESTIONS;
  const out = [];
  for (const c of list) {
    if (left <= 0) break;
    const share = Math.min(WEIGHT[c.ripple], left);
    left -= share;
    out.push({ ...c, share });
  }
  return out;
}

/** How many suggestions a Save's changes make. */
const planCount = (changes) => planned(changes).reduce((n, c) => n + c.share, 0);

/** "Lala and Marcus Hale, now flirting". */
function lineOf(c, aName, bName) {
  const who = `${aName} and ${bName}`;
  if (c.stage_after) return `${who}, now ${words(c.stage_after)}`;
  return c.is_romantic ? `${who}, a new love interest` : `${who}, closer now`;
}

async function hasColumns(db, table, names) {
  const [rows] = await db.sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = :table AND column_name IN (:names)`,
    { replacements: { table, names } });
  return new Set(rows.map((r) => r.column_name));
}

/** The pair's secrecy (public | rumoured | secret) and the profiles known_by names. */
async function secrecyOf(db, c, { a, b }) {
  let level = 'public';
  const raise = (to) => { if (RANK[to] > RANK[level]) level = to; };
  const knownProfiles = new Set();
  const cols = await hasColumns(db, 'character_relationships', ['public_state', 'known_by']);
  if (cols.size && c.relationship_id) {
    const [[row]] = await db.sequelize.query(
      `SELECT ${cols.has('public_state') ? 'public_state' : 'NULL'} AS public_state, ${cols.has('known_by') ? 'known_by' : 'NULL'} AS known_by
         FROM character_relationships WHERE id = :id`, { replacements: { id: c.relationship_id } });
    if (row?.public_state === 'secret') raise('secret');
    else if (row?.public_state === 'rumoured') raise('rumoured');
    const known = Array.isArray(row?.known_by) ? row.known_by : [];
    const charIds = known.map((k) => k?.registry_character_id).filter(Boolean);
    for (const k of known) if (Number.isInteger(Number(k?.profile_id)) && k?.profile_id != null) knownProfiles.add(Number(k.profile_id));
    if (charIds.length) {
      const [rows] = await db.sequelize.query(
        'SELECT feed_profile_id FROM registry_characters WHERE id IN (:ids) AND feed_profile_id IS NOT NULL AND deleted_at IS NULL',
        { replacements: { ids: charIds } });
      for (const r of rows) knownProfiles.add(Number(r.feed_profile_id));
    }
  }
  if (a.profile_id != null && b.profile_id != null) {
    const [rows] = await db.sequelize.query(
      `SELECT public_visibility::text AS visibility, relationship_type::text AS type FROM social_profile_relationships
        WHERE (source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a)`,
      { replacements: { a: a.profile_id, b: b.profile_id } });
    for (const r of rows) {
      if (r.visibility === 'hidden' || r.type === 'secret_link') raise('secret');
      else if (r.visibility === 'rumored') raise('rumoured');
    }
  }
  const ids = [a.id, b.id].filter((id) => /^[0-9a-f-]{36}$/i.test(String(id)));
  if (ids.length === 2) {
    const { mentions } = require('./pulseGate');
    const [secrets] = await db.sequelize.query(
      `SELECT registry_character_id AS owner, text FROM character_secrets
        WHERE registry_character_id IN (:ids) AND deleted_at IS NULL AND state = 'hidden'`, { replacements: { ids } });
    for (const s of secrets) {
      const other = String(s.owner) === String(a.id) ? b : a;
      if (other.name && mentions(s.text, other.name)) raise('secret');
    }
  }
  return { level, knownProfiles };
}

/** Feed profiles with what the prompt needs, by id. */
async function profilesById(db, ids) {
  const list = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (!list.length) return new Map();
  const [rows] = await db.sequelize.query(
    `SELECT sp.id, sp.handle, sp.display_name, sp.vibe_sentence, sp.public_persona, sp.society_archetype,
            rc.id AS character_id, COALESCE(NULLIF(rc.selected_name, ''), rc.display_name) AS character_name,
            pv.habits_json, pv.examples_json
       FROM social_profiles sp
       LEFT JOIN LATERAL (SELECT id, selected_name, display_name FROM registry_characters
                           WHERE feed_profile_id = sp.id AND deleted_at IS NULL ORDER BY created_at LIMIT 1) rc ON true
       LEFT JOIN pulse_voices pv ON pv.registry_character_id = rc.id AND pv.deleted_at IS NULL
      WHERE sp.id IN (:list) AND sp.deleted_at IS NULL`, { replacements: { list } });
  return new Map(rows.map((r) => [Number(r.id), r]));
}

/** Gossip-type accounts of the show's registries (public changes only). */
async function gossipProfiles(db, showId) {
  if (!showId) return [];
  const [rows] = await db.sequelize.query(
    `SELECT DISTINCT sp.id FROM social_profiles sp
       JOIN registry_characters rc ON rc.feed_profile_id = sp.id AND rc.deleted_at IS NULL
       JOIN character_registries cr ON cr.id = rc.registry_id AND cr.show_id = :showId
      WHERE sp.deleted_at IS NULL
        AND (sp.archetype::text IN (:types) OR sp.society_archetype ILIKE '%gossip%' OR sp.content_category ILIKE '%gossip%')
      LIMIT 2`, { replacements: { showId, types: GOSSIP_ARCHETYPES } });
  return rows.map((r) => Number(r.id));
}

/**
 * Who may post about one change, each with why they know: the two of them
 * (inside), the event's guests (there), their close ties (close), known_by
 * (told), and for a public change gossip accounts (gossip). Lala is at
 * every event (pulseKnowledge).
 */
async function poolFor(db, { episode, a, b, secrecy, lalaProfileId, events, at }) {
  const knowledge = require('./pulseKnowledge');
  const why = new Map();
  const add = (id, role) => { const n = Number(id); if (Number.isInteger(n) && n > 0 && !why.has(n)) why.set(n, role); };
  add(a.profile_id, 'inside');
  add(b.profile_id, 'inside');
  const ev = events.find((e) => e.episode_number != null && Number(e.episode_number) === Number(episode.episode_number));
  if (lalaProfileId != null) add(lalaProfileId, 'there');
  for (const g of ev?.guests || []) add(g, 'there');
  for (const p of [a, b]) {
    if (p.profile_id == null) continue;
    for (const t of await knowledge.closeTies(db, p.profile_id, { showId: episode.show_id, at })) add(t, `close to ${p.name}`);
  }
  for (const k of secrecy.knownProfiles) add(k, 'told');
  if (secrecy.level === 'public') for (const g of await gossipProfiles(db, episode.show_id)) add(g, 'gossip');
  const profiles = await profilesById(db, [...why.keys()]);
  return [...why.entries()]
    .filter(([id]) => profiles.has(id))
    .slice(0, MAX_POOL)
    .map(([id, role]) => ({ ...profiles.get(id), id, role }));
}

const RULES = {
  public: 'PUBLIC: people can know. Posts may say it outright (Lala may announce or soft-launch it; friends react; gossip accounts run it).',
  rumoured: 'RUMOURED: people have heard talk; nobody has confirmed it. Only rumours, hints and soft launches. Never name both of them together, never confirm it.',
  secret: 'SECRET: only these people plausibly know. Only hints and rumours: a look, a vague "someone", a question. Never name both of them together, never confirm it; one of the two never names the other.',
};

function buildPrompt({ episode, items }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  const blocks = items.map((it, i) => {
    const posters = it.pool.map((p, j) => {
      const examples = (Array.isArray(p.examples_json) ? p.examples_json : []).slice(0, 3).map((e) => `    - ${String(e?.text || e).slice(0, 200)}`).join('\n');
      return `  [${j + 1}] ${p.display_name || p.character_name || p.handle} (@${String(p.handle).replace(/^@/, '')}), ${p.role}${p.vibe_sentence ? `: ${String(p.vibe_sentence).slice(0, 160)}` : ''}${examples ? `\n${examples}` : ''}`;
    }).join('\n');
    return `### Change ${i + 1}: ${it.line}
What happened: ${[it.c.note, it.c.quote ? `In the script: "${it.c.quote}"` : ''].filter(Boolean).join(' ') || 'the relationship moved in this episode.'}
${RULES[it.secrecy]}
Allowed kinds of post: ${MODES[it.secrecy].join(', ')}.
Suggest ${it.share} item${it.share === 1 ? '' : 's'} for this change.
Who may post or comment (only these, by number):
${posters}`;
  }).join('\n\n');
  return `You suggest posts and comments for The Pulse, LalaVerse's social network, about relationship changes in Episode ${episode.episode_number ?? ''}. Evoni approves each before anything posts.

${blocks}

Rules:
- Stay in the world: nothing about a show, episodes, filming or a studio.
- Each in that person's own voice, short, the way they really post.
- A comment goes on one of your posts here ("on": its n), never by the same person.
- Never use these phrases: ${BANNED_PHRASES.join(', ')}.

Answer with JSON only:
{"items": [{"n": 1, "change": 1, "kind": "post" or "comment", "poster": 1, "on": null or the n of a post, "mode": "one of the allowed kinds", "text": "the words"}]}`;
}

/** A reveal of a secret or rumoured pair: both named, or one of them naming the other. */
function isReveal(text, { a, b, posterRole, posterId }) {
  const { mentions } = require('./pulseGate');
  const named = (p) => [p.name, p.handle, String(p.name || '').split(/\s+/)[0]].some((n) => n && String(n).length >= 3 && mentions(text, n));
  const namesA = named(a);
  const namesB = named(b);
  if (namesA && namesB) return true;
  if (posterRole === 'inside') {
    const other = Number(posterId) === Number(a.profile_id) ? namesB : namesA;
    return other;
  }
  return false;
}

async function ask(prompt) {
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[storyRipples] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  return (message?.content?.[0]?.text || '').trim();
}

/** The deterministic gate checks for a draft (no AI); [] when they cannot run (logged). */
async function canonFlagsOf(db, post, lalaProfileId) {
  try {
    return await require('./pulseGate').canonFlags(db, post, { lalaProfileId });
  } catch (err) {
    console.error('[storyRipples] the gate checks could not run on a suggestion:', err.message);
    return [];
  }
}

async function propose(db, { episode, changes, people } = {}) {
  const out = { posts: [], comments: [], dropped: [] };
  const plan = planned(changes);
  if (!plan.length || !episode?.show_id) return out;
  const clock = require('./storyClock');
  const at = clock.orderOf(episode.episode_number, 'after_episode');
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const events = await require('./pulseKnowledge').showEvents(db, episode.show_id);
  const items = [];
  for (const c of plan) {
    // Copies: the Save's cast is not changed.
    const a = people.get(c.a) ? { ...people.get(c.a) } : null;
    const b = people.get(c.b) ? { ...people.get(c.b) } : null;
    if (!a || !b) continue;
    // Lala's Feed profile, when her character has none of its own.
    for (const p of [a, b]) if (p.is_lala && p.profile_id == null) p.profile_id = lalaProfileId;
    const profiles = await profilesById(db, [a.profile_id, b.profile_id].map(Number));
    for (const p of [a, b]) p.handle = profiles.get(Number(p.profile_id))?.handle || null;
    const secrecy = await secrecyOf(db, c, { a, b });
    const pool = await poolFor(db, { episode, a, b, secrecy, lalaProfileId, events, at });
    if (!pool.length) { out.dropped.push({ line: lineOf(c, a.name, b.name), reason: 'nobody_to_post' }); continue; }
    items.push({ c, a, b, share: c.share, secrecy: secrecy.level, pool, line: lineOf(c, a.name, b.name) });
  }
  if (!items.length) return out;

  await require('./pulseRequests').take(db, { showId: episode.show_id, lane: 'manual', kind: 'story' });
  const raw = await ask(buildPrompt({ episode, items }));
  const answer = require('./pulseDrafter').parseBatch(raw, MAX_SUGGESTIONS * 2);
  const used = new Map(items.map((_, i) => [i, 0]));
  const postsByN = new Map();
  const entries = [...answer.entries()].sort(([x], [y]) => x - y);
  // Posts first, so a comment's post is there.
  for (const pass of ['post', 'comment']) {
    for (const [n, e] of entries) {
      if ((e.kind === 'comment' ? 'comment' : 'post') !== pass) continue;
      const which = Number(e.change) - 1;
      const it = items[which];
      const poster = it?.pool[Number(e.poster) - 1];
      const drop = (reason) => out.dropped.push({ n, reason });
      if (!it || !poster) { drop('unknown_poster'); continue; }
      if (used.get(which) >= it.share) { drop('over_share'); continue; }
      if (!MODES[it.secrecy].includes(e.mode)) { drop('mode_not_allowed'); continue; }
      const text = String(e.text).trim().slice(0, pass === 'post' ? 2000 : 1000);
      if (it.secrecy !== 'public' && isReveal(text, { a: it.a, b: it.b, posterRole: poster.role, posterId: poster.id })) { drop('reveal'); continue; }
      const story = {
        source: 'story', relationship_id: it.c.relationship_id || null, relationship_event_id: it.c.event_id || null,
        episode_id: episode.id, episode_number: episode.episode_number ?? null, line: it.line, secrecy: it.secrecy, mode: e.mode,
      };
      const handle = String(poster.handle).replace(/^@/, '');
      const name = poster.display_name || poster.character_name || handle;
      if (pass === 'post') {
        const draft = { show_id: episode.show_id, social_profile_id: poster.id, poster_handle: handle, content_text: text, trending_topic: null, story_order: at };
        const flags = await canonFlagsOf(db, draft, lalaProfileId);
        const review = ['story_change', ...(Number(poster.id) === Number(lalaProfileId) ? ['lala'] : []), ...(flags.length ? ['gate'] : [])];
        const post = await db.FeedPost.create({
          ...draft, episode_id: episode.id, poster_display_name: name, poster_platform: 'lalaverse', post_type: 'post',
          likes: 0, comments_count: 0, shares: 0, sample_comments: [], ai_generated: true, generation_model: MODELS[0],
          status: 'draft', sort_order: 0,
          gate_json: { pass: flags.length === 0, flags, review, story, checked_at: new Date().toISOString() },
        });
        postsByN.set(n, { post, poster });
        out.posts.push(post);
      } else {
        const on = postsByN.get(Number(e.on));
        if (!on) { drop('no_post_to_comment_on'); continue; }
        if (Number(on.poster.id) === Number(poster.id)) { drop('own_post'); continue; }
        const comment = await db.FeedComment.create({
          feed_post_id: on.post.id, show_id: episode.show_id, social_profile_id: poster.id, handle, display_name: name,
          text, status: 'draft', sort_order: await db.FeedComment.count({ where: { feed_post_id: on.post.id } }),
          ai_generated: true, generation_model: MODELS[0], story_order: at,
          voice_note: `From Episode ${episode.episode_number ?? ''}: ${it.line}`,
        });
        out.comments.push(comment);
      }
      used.set(which, used.get(which) + 1);
    }
  }
  return out;
}

/**
 * The Save's hook: the count at once, the drafting in the background. It
 * never throws and never waits; a failure is logged and the Save stands.
 */
function proposeLater(_sequelize, { episode, changes, people } = {}) {
  let n = 0;
  try {
    n = planCount(changes);
    if (!n || !episode?.show_id) return 0;
    // The models (FeedPost, FeedComment, PulseRequest) on the app's one connection.
    const db = require('../models');
    Promise.resolve()
      .then(() => module.exports.propose(db, { episode, changes, people }))
      .then((r) => console.log(`[storyRipples] Episode ${episode.episode_number ?? '?'}: ${r.posts.length} post and ${r.comments.length} comment suggestions waiting in Review${r.dropped.length ? `, ${r.dropped.length} dropped` : ''}.`))
      .catch((err) => console.error('[storyRipples] the Pulse suggestions could not be drafted (the Save stands):', err.message));
  } catch (err) {
    console.error('[storyRipples] the Pulse suggestions could not be started (the Save stands):', err.message);
    return 0;
  }
  return n;
}

module.exports = { MODELS, MAX_SUGGESTIONS, MODES, kindOf, planned, planCount, lineOf, secrecyOf, poolFor, buildPrompt, isReveal, propose, proposeLater };
