'use strict';

/**
 * Drafting in voice (Task #2969; The Pulse spec §7 "Living State vs public
 * persona … never stated in posts unless they choose to reveal them";
 * "Always to Review: Lala's posts, posts or comments about Lala, anything
 * that reveals story, anything flagged by the gate";
 * docs/reads/2026-10-12-pulse-posting-read.md §3, §7).
 *
 *   draftPost(db, { showId, characterId, moment?, context? })
 *     one Sonnet call: the character's Voice Profile and examples, their
 *     Living State as private context (never stated), the story moment,
 *     what happened (context.about), and the events they know about by
 *     then (pulseKnowledge, Task #2982). Writes a feed_posts DRAFT stamped with
 *     the moment's story order. Returns { post, revealsStory, privateState }.
 *   draftAndRoute(db, { … })
 *     drafts, runs the gate (services/pulseGate.js), keeps the result on the
 *     post (gate_json), then publishes an everyday post by another character
 *     that passed, or leaves the draft for Review. Returns
 *     { post, gate, review, published }.
 *   draftCommentAndRoute(db, { postId, characterId })   (Task #2970)
 *     a comment in voice on a post, as a feed_comments draft, through the
 *     same gate; it goes live only when it passed, is not about Lala, is
 *     not Lala's, and its post is already live.
 *   draftBatch(db, { kind: 'posts' | 'comments', … })   (Task #3032)
 *     one Sonnet call, one request, drafts up to BATCH_MAX items: several
 *     posters' posts about one moment, or several replies on one post. Each
 *     item has its own voice block, knowledge line and private context;
 *     the answer is JSON, one entry per item. Items the answer leaves out or
 *     garbles are returned as failed; the request still counts.
 *   draftPostsAndRoute / draftCommentsAndRoute
 *     draftBatch, then each draft through the gate on its own (the gate
 *     takes no request), published or left for Review as above.
 *
 * Called by the queue's handlers (#2970 events, #2971 ambient), never in a
 * request. Each call counts toward the daily draft cap through its job.
 */

const MODELS = ['claude-sonnet-4-6'];
const BATCH_MAX = 5;   // items one request drafts (Evoni, 2026-10-12: "a small batch")

class DraftError extends Error {
  constructor(message) { super(message); this.name = 'DraftError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** The poster: character, Feed profile and Voice Profile, or a DraftError. */
async function loadPoster(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new DraftError(`Character ${characterId} not found.`);
  if (!character.feed_profile_id) throw new DraftError(`${character.display_name} has no Feed profile to post from.`);
  const [[profile]] = await db.sequelize.query(
    'SELECT id, handle, display_name FROM social_profiles WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: character.feed_profile_id } });
  if (!profile) throw new DraftError(`${character.display_name}'s Feed profile is gone.`);
  const voice = await db.PulseVoice.findOne({ where: { registry_character_id: character.id } });
  if (!voice) throw new DraftError(`${character.display_name} has no Voice Profile yet. Build it in Admin › The Pulse › Voices.`);
  return { character, profile, voice };
}

function buildPrompt({ character, profile, voice, label, context, known = null }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  const examples = (voice.examples_json || []).slice(0, 8).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  return `You write one post on The Pulse, LalaVerse's social network, as ${profile.display_name || character.display_name} (@${profile.handle}).

Write exactly in this voice:
${JSON.stringify(voice.habits_json || {}, null, 2)}
Posts they really wrote (match these):
${examples}

When: ${label || 'now'}.
What happened: ${context.about || 'an ordinary day; post about whatever they would.'}
${knowsLine(known)}

PRIVATE (shapes the mood only; never state, quote or hint at it directly):
${JSON.stringify(character.living_state || {})}

Rules:
- Stay in the world: nothing about a show, episodes, filming or a studio.
- Nothing that happens after this moment.
- Never use these phrases: ${BANNED_PHRASES.join(', ')}.
- One post, the length and style this person really posts.

Answer with JSON only:
{"text": "the post", "hashtag": "#OneTag or null", "reveals_story": true or false (does it reveal a secret or a plot turn?)}`;
}

/** What the poster knows by now (Task #2982; spec §6), for the prompt. */
const knowsLine = (known) => (known
  ? `Events they know about by now: ${known}. Name no other event.`
  : 'They know of no events yet: name none.');

/** Drafts one post in voice; returns { post, revealsStory, privateState }. */
async function draftPost(db, { showId, characterId, moment, context = {}, request = {} } = {}) {
  const { character, profile, voice } = await loadPoster(db, characterId);
  const clock = require('./storyClock');
  const at = Number.isInteger(moment) ? moment : await clock.presentOrder(db, showId);
  const known = await require('./pulseKnowledge').knowledgeLine(db, showId, profile.id, at);
  // One automated request per drafting call (Task #3031); the caller names the kind and its job.
  await require('./pulseRequests').take(db, { showId, lane: 'automated', kind: request.kind || 'post', jobId: request.jobId || null });
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({
        model, max_tokens: 600,
        messages: [{ role: 'user', content: buildPrompt({ character, profile, voice, label: clock.label(at), context, known }) }],
      });
      break;
    } catch (modelErr) {
      console.warn(`[PulseDrafter] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (parseErr) {
    console.error('[PulseDrafter] could not read the draft:', parseErr.message);
    throw new DraftError('The draft came back in a form that could not be read.');
  }
  const text = typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 2000) : '';
  if (!text) throw new DraftError('The draft came back empty.');
  const tag = typeof parsed.hashtag === 'string' && parsed.hashtag.trim() && parsed.hashtag !== 'null' ? parsed.hashtag.trim().slice(0, 100) : null;
  const post = await db.FeedPost.create({
    show_id: showId,
    episode_id: context.episode_id || null,
    event_id: context.event_id || null,
    social_profile_id: profile.id,
    poster_handle: String(profile.handle).replace(/^@/, ''),
    poster_display_name: profile.display_name || character.display_name,
    poster_platform: 'lalaverse',
    post_type: 'post',
    content_text: text,
    trending_topic: tag,
    likes: 0, comments_count: 0, shares: 0, sample_comments: [],
    story_order: at,
    ai_generated: true,
    generation_model: MODELS[0],
    status: 'draft',
    sort_order: 0,
  });
  return { post, revealsStory: parsed.reveals_story === true, privateState: character.living_state || null, voice };
}

/** Releases a draft the way PUT /feed-posts/:id does: live, posted now, numbers proposed (#2953). */
async function release(post) {
  await post.update({ status: 'live', posted_at: post.posted_at || new Date() });
  require('./pulseNumbers').proposeLater(post);
  require('./pulseCloseness').proposeLater(post.id);   // Task #2983
  return post;
}

/** Drafts, gates, keeps the result on the post, then publishes or leaves it for Review. */
async function draftAndRoute(db, args) {
  const drafted = await draftPost(db, args);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  // A caller may always send a draft to Review (a storyline's payoff, Task #2989).
  return routePost(db, drafted, { lalaProfileId, alwaysReview: Array.isArray(args.alwaysReview) ? args.alwaysReview : [] });
}

/** Drafts one comment in voice on a post; returns { comment, post, voice, privateState }. */
async function draftComment(db, { postId, characterId, jobId = null }) {
  const post = await db.FeedPost.findByPk(postId);
  if (!post) throw new DraftError(`Post ${postId} not found.`);
  const { character, profile, voice } = await loadPoster(db, characterId);
  if (Number(post.social_profile_id) === Number(profile.id)) throw new DraftError('A character does not comment on their own post here.');
  const { BANNED_PHRASES } = require('./pulseVoices');
  const known = Number.isInteger(post.story_order)
    ? await require('./pulseKnowledge').knowledgeLine(db, post.show_id, profile.id, post.story_order) : null;
  const examples = (voice.examples_json || []).slice(0, 6).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  const prompt = `You write one comment on The Pulse, LalaVerse's social network, as ${profile.display_name || character.display_name} (@${profile.handle}).

Write exactly in this voice:
${JSON.stringify(voice.habits_json || {}, null, 2)}
Things they really wrote:
${examples}

The post, by @${post.poster_handle}:
${post.content_text}

PRIVATE (shapes the mood only; never state, quote or hint at it directly):
${JSON.stringify(character.living_state || {})}

${knowsLine(known)}

Rules: stay in the world (nothing about a show or a studio); one short comment; never use: ${BANNED_PHRASES.join(', ')}.
Answer with JSON only: {"text": "the comment"}`;
  await require('./pulseRequests').take(db, { showId: post.show_id, lane: 'automated', kind: 'comment', jobId });
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[PulseDrafter] drafting a comment with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let text;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    text = String(JSON.parse(match ? match[0] : raw).text || '').trim().slice(0, 1000);
  } catch (parseErr) {
    console.error('[PulseDrafter] could not read the comment:', parseErr.message);
    throw new DraftError('The comment came back in a form that could not be read.');
  }
  if (!text) throw new DraftError('The comment came back empty.');
  const existing = await db.FeedComment.count({ where: { feed_post_id: post.id } });
  const comment = await db.FeedComment.create({
    feed_post_id: post.id, show_id: post.show_id, social_profile_id: profile.id,
    handle: String(profile.handle).replace(/^@/, ''), display_name: profile.display_name || character.display_name,
    text, status: 'draft', sort_order: existing, ai_generated: true, generation_model: MODELS[0],
  });
  return { comment, post, voice, privateState: character.living_state || null };
}

/** Drafts a comment, gates it as a post at its post's story order, then publishes it or leaves it for Review. */
async function draftCommentAndRoute(db, args) {
  const { comment, post, voice, privateState } = await draftComment(db, args);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  return routeComment(db, post, { comment, voice, privateState }, { lalaProfileId });
}

/** One item's block in a batch prompt: who writes, their voice, what they know, their private mood. */
function itemBlock(n, { character, profile, voice, known, extra = '' }, exampleCount) {
  const examples = (voice.examples_json || []).slice(0, exampleCount).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  return `### ${n}. ${profile.display_name || character.display_name} (@${profile.handle})
Voice:
${JSON.stringify(voice.habits_json || {}, null, 2)}
Things they really wrote (match these):
${examples}
${extra}${knowsLine(known)}
PRIVATE (shapes their mood only; never state, quote or hint at it directly):
${JSON.stringify(character.living_state || {})}`;
}

/** The prompt for several posts about one moment, one per poster. */
function buildPostBatchPrompt(entries, { label, about }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  return `You write ${entries.length} separate posts on The Pulse, LalaVerse's social network: one by each person below, each exactly in that person's own voice. They post on their own; nobody has seen the others' posts.

When: ${label || 'now'}.
What happened: ${about || 'an ordinary day; each posts about whatever they would.'}

${entries.map((e, i) => itemBlock(i + 1, e, 8)).join('\n\n')}

Rules for every post:
- Stay in the world: nothing about a show, episodes, filming or a studio.
- Nothing that happens after this moment.
- Never use these phrases: ${BANNED_PHRASES.join(', ')}.
- The length and style this person really posts.

Answer with JSON only, one entry per person, numbered as above:
{"items": [{"n": 1, "text": "the post", "hashtag": "#OneTag or null", "reveals_story": true or false (does it reveal a secret or a plot turn?)}]}`;
}

/** The prompt for several replies on one post, one per commenter. */
function buildCommentBatchPrompt(post, entries) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  return `You write ${entries.length} separate comments on one post on The Pulse, LalaVerse's social network: one by each person below, each exactly in that person's own voice.

The post, by @${post.poster_handle}:
${post.content_text}

${entries.map((e, i) => itemBlock(i + 1, e, 6)).join('\n\n')}

Rules: stay in the world (nothing about a show or a studio); one short comment each; never use: ${BANNED_PHRASES.join(', ')}.
Answer with JSON only, one entry per person, numbered as above:
{"items": [{"n": 1, "text": "the comment"}]}`;
}

/**
 * The entries of a batch answer, by number (1..count). Reads the whole JSON
 * when it can; otherwise each {"n": …} object it can find on its own, so a
 * cut-off or garbled answer still yields the drafts it holds.
 */
function parseBatch(raw, count) {
  const byN = new Map();
  const keep = (entry, fallbackN) => {
    if (!entry || typeof entry !== 'object') return;
    const n = Number.isInteger(entry.n) ? entry.n : fallbackN;
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (Number.isInteger(n) && n >= 1 && n <= count && text && !byN.has(n)) byN.set(n, { ...entry, text });
  };
  const text = String(raw || '');
  // The whole answer, else the JSON object in it, else the JSON array in it.
  let whole = null;
  for (const candidate of [text.trim(), text.match(/\{[\s\S]*\}/)?.[0], text.match(/\[[\s\S]*\]/)?.[0]]) {
    if (!candidate) continue;
    try { whole = JSON.parse(candidate); break; } catch { /* silent-ok: tries the next shape; entry-by-entry reading below logs */ }
  }
  if (whole && typeof whole === 'object') {
    const list = Array.isArray(whole) ? whole : whole.items;
    if (Array.isArray(list)) { list.forEach((entry, i) => keep(entry, i + 1)); return byN; }
    if (count === 1 && typeof whole.text === 'string') { keep(whole, 1); return byN; }   // a batch of one answered as one draft
  }
  console.warn('[PulseDrafter] the batch answer is not whole JSON; reading the entries it holds.');
  for (const m of text.matchAll(/\{[^{}]*"n"\s*:\s*\d+[^{}]*\}/g)) {
    try { keep(JSON.parse(m[0])); } catch (entryErr) { console.warn('[PulseDrafter] skipped a garbled batch entry:', entryErr.message); }
  }
  return byN;
}

/** One model call for a batch prompt (the two-attempt loop), the raw text back. */
async function askBatch(prompt, maxTokens) {
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[PulseDrafter] drafting a batch with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  return (message?.content?.[0]?.text || '').trim();
}

/** Loads each item's poster; those that cannot write (no voice, no profile) are failed, not drafted. */
async function loadEntries(db, items) {
  const entries = [];
  const failed = [];
  for (const item of items) {
    try {
      entries.push({ item, ...(await loadPoster(db, item.characterId)) });
    } catch (err) {
      if (!(err instanceof DraftError)) throw err;
      console.error('[PulseDrafter] a batch item cannot be drafted:', err.message);
      failed.push({ characterId: item.characterId, error: err.message });
    }
  }
  return { entries, failed };
}

/**
 * Several posts about one moment in one request: items [{ characterId }]
 * (at most BATCH_MAX), with the moment and context they share. Returns
 * { drafted: [{ post, revealsStory, privateState, voice }], failed: [{ characterId, error }] }.
 */
async function draftPostBatch(db, { showId, items, moment, context = {}, request = {} }) {
  if (!Array.isArray(items) || !items.length) throw new DraftError('A batch needs at least one item.');
  if (items.length > BATCH_MAX) throw new DraftError(`A batch drafts at most ${BATCH_MAX} items.`);
  const clock = require('./storyClock');
  const at = Number.isInteger(moment) ? moment : await clock.presentOrder(db, showId);
  const knowledge = require('./pulseKnowledge');
  const { entries, failed } = await loadEntries(db, items);
  for (const e of entries) e.known = await knowledge.knowledgeLine(db, showId, e.profile.id, at);
  if (!entries.length) return { drafted: [], failed };
  await require('./pulseRequests').take(db, { showId, lane: 'automated', kind: request.kind || 'posts', jobId: request.jobId || null });
  const parsed = parseBatch(await askBatch(buildPostBatchPrompt(entries, { label: clock.label(at), about: context.about }), 500 * entries.length), entries.length);
  const drafted = [];
  for (const [i, e] of entries.entries()) {
    const got = parsed.get(i + 1);
    if (!got) { failed.push({ characterId: e.item.characterId, error: `${e.character.display_name}: the batch answer had no readable draft.` }); continue; }
    const tag = typeof got.hashtag === 'string' && got.hashtag.trim() && got.hashtag !== 'null' ? got.hashtag.trim().slice(0, 100) : null;
    const post = await db.FeedPost.create({
      show_id: showId, episode_id: context.episode_id || null, event_id: context.event_id || null,
      social_profile_id: e.profile.id, poster_handle: String(e.profile.handle).replace(/^@/, ''),
      poster_display_name: e.profile.display_name || e.character.display_name, poster_platform: 'lalaverse',
      post_type: 'post', content_text: got.text.slice(0, 2000), trending_topic: tag,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [], story_order: at,
      ai_generated: true, generation_model: MODELS[0], status: 'draft', sort_order: 0,
    });
    drafted.push({ post, revealsStory: got.reveals_story === true, privateState: e.character.living_state || null, voice: e.voice, characterId: e.item.characterId });
  }
  return { drafted, failed };
}

/**
 * Several replies on one post in one request: characterIds (at most
 * BATCH_MAX; the poster is never among them). Returns
 * { post, drafted: [{ comment, voice, privateState }], failed }.
 */
async function draftCommentBatch(db, { postId, characterIds, jobId = null }) {
  const post = await db.FeedPost.findByPk(postId);
  if (!post) throw new DraftError(`Post ${postId} not found.`);
  if (!Array.isArray(characterIds) || !characterIds.length) throw new DraftError('A batch needs at least one item.');
  if (characterIds.length > BATCH_MAX) throw new DraftError(`A batch drafts at most ${BATCH_MAX} items.`);
  const { entries: loaded, failed } = await loadEntries(db, characterIds.map((characterId) => ({ characterId })));
  const entries = [];
  for (const e of loaded) {
    if (Number(post.social_profile_id) === Number(e.profile.id)) { failed.push({ characterId: e.item.characterId, error: `${e.character.display_name} does not comment on their own post here.` }); continue; }
    e.known = Number.isInteger(post.story_order)
      ? await require('./pulseKnowledge').knowledgeLine(db, post.show_id, e.profile.id, post.story_order) : null;
    entries.push(e);
  }
  if (!entries.length) return { post, drafted: [], failed };
  await require('./pulseRequests').take(db, { showId: post.show_id, lane: 'automated', kind: 'comments', jobId });
  const parsed = parseBatch(await askBatch(buildCommentBatchPrompt(post, entries), 200 * entries.length), entries.length);
  const drafted = [];
  let order = await db.FeedComment.count({ where: { feed_post_id: post.id } });
  for (const [i, e] of entries.entries()) {
    const got = parsed.get(i + 1);
    if (!got) { failed.push({ characterId: e.item.characterId, error: `${e.character.display_name}: the batch answer had no readable comment.` }); continue; }
    const comment = await db.FeedComment.create({
      feed_post_id: post.id, show_id: post.show_id, social_profile_id: e.profile.id,
      handle: String(e.profile.handle).replace(/^@/, ''), display_name: e.profile.display_name || e.character.display_name,
      text: got.text.slice(0, 1000), status: 'draft', sort_order: order, ai_generated: true, generation_model: MODELS[0],
    });
    order += 1;
    drafted.push({ comment, voice: e.voice, privateState: e.character.living_state || null, characterId: e.item.characterId });
  }
  return { post, drafted, failed };
}

/** draftPostBatch or draftCommentBatch, by kind. */
function draftBatch(db, { kind, ...args }) {
  if (kind === 'posts') return draftPostBatch(db, args);
  if (kind === 'comments') return draftCommentBatch(db, args);
  throw new DraftError(`Unknown batch kind: ${kind}`);
}

/** Gates one drafted post and publishes it or leaves it for Review (as draftAndRoute). */
async function routePost(db, { post, revealsStory, privateState, voice }, { lalaProfileId, alwaysReview = [] }) {
  const gateApi = require('./pulseGate');
  const gate = await gateApi.check(db, post, { voice, privateState, lalaProfileId });
  const review = gateApi.reviewReasons(post, gate, { lalaProfileId, revealsStory });
  for (const reason of alwaysReview) if (!review.includes(reason)) review.push(reason);
  await post.update({ gate_json: { ...gate, review, checked_at: new Date().toISOString() } });
  if (review.length === 0) await release(post);
  return { post, gate, review, published: review.length === 0 };
}

/** Gates one drafted comment and publishes it or leaves it for Review (as draftCommentAndRoute). */
async function routeComment(db, post, { comment, voice, privateState }, { lalaProfileId }) {
  const gateApi = require('./pulseGate');
  const asPost = {
    show_id: post.show_id, social_profile_id: comment.social_profile_id, poster_handle: comment.handle,
    content_text: comment.text, trending_topic: null, story_order: post.story_order,
  };
  const gate = await gateApi.check(db, asPost, { voice, privateState, lalaProfileId });
  const review = gateApi.reviewReasons(asPost, gate, { lalaProfileId });
  if (post.status !== 'live') review.push('post_not_live');
  if (review.length === 0) {
    await comment.update({ status: 'live', posted_at: new Date() });
    await require('./feedCommentDrafter').recountComments(db, post.id);
    require('./pulseCloseness').proposeLater(post.id);   // Task #2983
  }
  return { comment, gate, review, published: review.length === 0 };
}

/** A batch of posts, each through the gate on its own. Returns { routed: [...], failed }. */
async function draftPostsAndRoute(db, args) {
  const { drafted, failed } = await draftPostBatch(db, args);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const routed = [];
  for (const d of drafted) routed.push({ ...(await routePost(db, d, { lalaProfileId, alwaysReview: args.alwaysReview || [] })), characterId: d.characterId });
  return { routed, failed };
}

/** A batch of replies on one post, each through the gate on its own. Returns { routed: [...], failed }. */
async function draftCommentsAndRoute(db, args) {
  const { post, drafted, failed } = await draftCommentBatch(db, args);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const routed = [];
  for (const d of drafted) routed.push({ ...(await routeComment(db, post, d, { lalaProfileId })), characterId: d.characterId });
  return { routed, failed };
}

module.exports = {
  MODELS, BATCH_MAX, knowsLine, draftPost, draftAndRoute, draftComment, draftCommentAndRoute, release, DraftError,
  buildPostBatchPrompt, buildCommentBatchPrompt, parseBatch, draftBatch, draftPostBatch, draftCommentBatch, draftPostsAndRoute, draftCommentsAndRoute,
};
