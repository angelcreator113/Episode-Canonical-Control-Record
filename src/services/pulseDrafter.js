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
 *
 * Called by the queue's handlers (#2970 events, #2971 ambient), never in a
 * request. Each call counts toward the daily draft cap through its job.
 */

const MODELS = ['claude-sonnet-4-6'];

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
  const { post, revealsStory, privateState, voice } = await draftPost(db, args);
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const gate = await require('./pulseGate').check(db, post, { voice, privateState, lalaProfileId });
  const review = require('./pulseGate').reviewReasons(post, gate, { lalaProfileId, revealsStory });
  // A caller may always send a draft to Review (a storyline's payoff, Task #2989).
  for (const reason of Array.isArray(args.alwaysReview) ? args.alwaysReview : []) if (!review.includes(reason)) review.push(reason);
  await post.update({ gate_json: { ...gate, review, checked_at: new Date().toISOString() } });
  if (review.length === 0) await release(post);
  return { post, gate, review, published: review.length === 0 };
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

module.exports = { MODELS, knowsLine, draftPost, draftAndRoute, draftComment, draftCommentAndRoute, release, DraftError };
