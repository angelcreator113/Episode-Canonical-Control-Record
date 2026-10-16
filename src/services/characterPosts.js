'use strict';

/**
 * Generate Posts: a character's own Pulse posts, drafted on request from
 * their page (Character Consistency Engine, step 4; the spec's Piece 5;
 * Evoni, 2026-10-16: "yes start step 4").
 *
 *   generatePosts(db, { characterId, count?, about? })
 *     one Sonnet call (the manual lane: services/pulseRequests) drafts
 *     `count` posts (1..BATCH_MAX, default 3) in the character's Voice
 *     Profile. It reads:
 *       their facts (services/characterFacts): a post that states a fact
 *         states it exactly; a fact not decided yet is never stated;
 *       their mask (how they present themselves): what their posts come
 *         from, true or not;
 *       their wound and want, as PRIVATE context (never stated);
 *       the events they host and the events they know about by now
 *         (pulseDrafter's hosting and knowledge lines);
 *       their last posts, so the new ones vary (the spec's #11).
 *     Each draft is tagged load_bearing (the story reacts to it; it must
 *     exist before its beat locks) or ambient (flavor; any beat), with
 *     why, for load-bearing. Each runs through the quality gate and is kept
 *     as a DRAFT for Review: nothing is released, whatever the gate says
 *     ('on_request' is always among its review reasons).
 *     Returns { show_id, drafted: [{ post, weight, why, review }], failed }.
 *
 * The facts are not checked against the posts: a post is the mask, and the
 * mask may lie (the spec's Piece 4).
 */

const { MODELS, BATCH_MAX, DraftError, PRIVATE_RULE, knowsLine, hostingLine, privateOf, parseBatch, askBatch, hostedEventLines } = require('./pulseDrafter');

const DEFAULT_COUNT = 3;
const ABOUT_MAX = 500;
const WEIGHTS = ['load_bearing', 'ambient'];
const MASK_KEYS = ['the_mask', 'mask_persona', 'self_narrative'];
const PROFILE_MASK_KEYS = ['public_persona', 'content_persona', 'lifestyle_claim'];
const PRIVATE_KEYS = ['core_wound', 'wound', 'hidden_want', 'core_desire', 'core_fear', 'want_architecture'];
const STATUS_LINES = {
  rising: 'Their account is rising.',
  peaking: 'Their account is at its peak.',
  plateauing: 'Their account has plateaued.',
  controversial: 'Their account is controversial right now.',
  cancelled: 'They have been cancelled: their audience has turned on them.',
  reinventing: 'They are reinventing their account.',
  gone_dark: 'Their account has gone dark: they stopped posting. A post now breaks that silence, so it is load-bearing.',
};

class PostsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const clip = (v, max) => {
  if (v === null || v === undefined || v === '') return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

/** The facts as prompt lines: what is true, and what is not decided yet. */
function factsLines(facts) {
  const lines = [];
  const undecided = new Set(facts.undecided || []);
  if (facts.handle) lines.push(`- handle: ${facts.handle}`);
  if (facts.followers && !undecided.has('followers')) lines.push(`- followers: ${facts.followers.label}`);
  if (facts.account_status && !undecided.has('account_status')) lines.push(`- account: ${STATUS_LINES[facts.account_status] || facts.account_status}`);
  if (facts.occupation && !undecided.has('occupation')) lines.push(`- what they do: ${facts.occupation}`);
  if (facts.income?.amount != null && !undecided.has('income')) {
    lines.push(`- income: ${facts.income.amount} ${facts.income.cadence === 'per_month' ? 'a month' : 'a year'}${facts.income.source ? ` from ${facts.income.source}` : ''}`);
  }
  if (facts.major_possessions?.length && !undecided.has('major_possessions')) lines.push(`- what they own: ${facts.major_possessions.join('; ')}`);
  if (facts.affordability && !undecided.has('income')) lines.push(`- what they can afford: ${facts.affordability.label}. Nothing they own or buy in a post goes beyond that.`);
  const notYet = [...undecided].map((k) => k.replace(/_/g, ' '));
  return `Facts (true in the world; a post that states one states it exactly; never invent a number, status, income or thing they own):
${lines.join('\n') || '- (none set yet)'}
${notYet.length ? `Not decided yet: ${notYet.join(', ')}. A post never states or hints at these.` : ''}`;
}

/** How they present themselves: the mask their posts come from. */
function maskLines(character, feedProfile) {
  const parts = [
    ...MASK_KEYS.map((k) => (character[k] ? `${k.replace(/_/g, ' ')}: ${clip(character[k], 400)}` : '')),
    ...PROFILE_MASK_KEYS.map((k) => (feedProfile?.[k] ? `${k.replace(/_/g, ' ')}: ${clip(feedProfile[k], 300)}` : '')),
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : '(not written yet: take it from their voice)';
}

/** The wound and want, for the PRIVATE block next to the Living State. */
function woundOf(character) {
  const out = {};
  for (const k of PRIVATE_KEYS) if (character[k]) out[k] = clip(character[k], 400);
  return out;
}

function buildPrompt({ character, profile, voice, facts, mask, wound, known, hosting, recent, label, about, count }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  const examples = (voice.examples_json || []).slice(0, 8).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  const name = profile.display_name || character.display_name;
  return `You write ${count} separate posts on The Pulse, LalaVerse's social network, all by ${name} (@${String(profile.handle).replace(/^@+/, '')}).

Write exactly in this voice:
${JSON.stringify(voice.habits_json || {}, null, 2)}
Posts they really wrote (match these):
${examples}
Their latest posts (do not repeat them; vary the subject, length and opening):
${recent.length ? recent.map((t) => `- ${clip(t, 200)}`).join('\n') : '(none yet)'}

How they present themselves (their posts come from this face, true or not):
${mask}

${factsLines(facts)}

When: ${label || 'now'}.
What is happening: ${about || 'an ordinary stretch; they post about whatever they would.'}
${knowsLine(known)}
${hostingLine(hosting)}
${PRIVATE_RULE}
${JSON.stringify({ ...privateOf(character), ...wound })}

Weight each post:
- "load_bearing": the story reacts to it (it builds to or answers an event they host or know about, or what is happening above). Say why in one line.
- "ambient": flavor; it could sit at any moment.
Mix them; with no event and nothing happening, all are ambient.

Rules:
- Stay in the world: nothing about a show, episodes, filming or a studio.
- Nothing that happens after this moment.
- Never use these phrases: ${BANNED_PHRASES.join(', ')}.
- The length and style this person really posts.

Answer with JSON only, one entry per post, numbered 1 to ${count}:
{"items": [{"n": 1, "text": "the post", "hashtag": "#OneTag or null", "weight": "load_bearing or ambient", "why": "for load_bearing: what in the story reacts to it", "reveals_story": true or false}]}`;
}

/** The character, their feed profile and Voice Profile, or a PostsError. */
async function loadCharacter(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new PostsError(404, 'Character not found.');
  const feedProfile = character.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(character.feed_profile_id) : null;
  if (!feedProfile) throw new PostsError(409, `${character.display_name} is not on the feed yet: match them to a feed person first.`);
  if (feedProfile.current_state === 'posthumous') throw new PostsError(409, `${character.display_name} has died: their account does not post.`);
  const voice = await db.PulseVoice.findOne({ where: { registry_character_id: character.id } });
  if (!voice) throw new PostsError(409, `${character.display_name} has no Voice Profile yet. Build it in Admin › The Pulse › Voices.`);
  return { character, feedProfile, voice };
}

async function generatePosts(db, { characterId, count = DEFAULT_COUNT, about = null } = {}) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > BATCH_MAX) throw new PostsError(400, `Draft between 1 and ${BATCH_MAX} posts.`);
  const what = typeof about === 'string' && about.trim() ? about.trim().slice(0, ABOUT_MAX) : null;
  const { character, feedProfile, voice } = await loadCharacter(db, characterId);
  const { factsOf, showIdFor } = require('./characterFacts');
  const showId = await showIdFor(db, character, feedProfile);
  if (!showId) throw new PostsError(409, `${character.display_name}'s registry belongs to no show, so their posts have no feed to go on.`);
  const facts = await factsOf(db, { character, feedProfile, showId });

  const clock = require('./storyClock');
  const knowledge = require('./pulseKnowledge');
  const at = await clock.presentOrder(db, showId);
  character.pulsePrivateKnowledge = await knowledge.privateKnowledge(db, character.id);
  const known = await knowledge.knowledgeLine(db, showId, feedProfile.id, at);
  const hosting = await hostedEventLines(db, feedProfile.id);
  const [recentRows] = await db.sequelize.query(
    `SELECT content_text FROM feed_posts WHERE social_profile_id = :pid AND deleted_at IS NULL AND content_text IS NOT NULL
      ORDER BY created_at DESC LIMIT 6`, { replacements: { pid: feedProfile.id } });

  const prompt = buildPrompt({
    character, profile: feedProfile, voice, facts, mask: maskLines(character, feedProfile), wound: woundOf(character),
    known, hosting, recent: recentRows.map((r) => r.content_text), label: clock.label(at), about: what, count: n,
  });
  await require('./pulseRequests').take(db, { showId, lane: 'manual', kind: 'character_posts' });
  const parsed = parseBatch(await askBatch(prompt, 500 * n), n);

  const gateApi = require('./pulseGate');
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const privateState = { ...privateOf(character), ...woundOf(character) };
  const drafted = [];
  const failed = [];
  for (let i = 1; i <= n; i += 1) {
    const got = parsed.get(i);
    if (!got) { failed.push({ n: i, error: 'The answer had no readable post here.' }); continue; }
    const weight = WEIGHTS.includes(got.weight) ? got.weight : 'ambient';
    const why = weight === 'load_bearing' && typeof got.why === 'string' && got.why.trim() ? got.why.trim().slice(0, 500) : null;
    const tag = typeof got.hashtag === 'string' && got.hashtag.trim() && got.hashtag !== 'null' ? got.hashtag.trim().slice(0, 100) : null;
    const post = await db.FeedPost.create({
      show_id: showId, social_profile_id: feedProfile.id, poster_handle: String(feedProfile.handle).replace(/^@+/, ''),
      poster_display_name: feedProfile.display_name || character.display_name, poster_platform: 'lalaverse',
      post_type: 'post', content_text: got.text.slice(0, 2000), trending_topic: tag,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [], story_order: at,
      ai_generated: true, generation_model: MODELS[0], status: 'draft', sort_order: 0,
      post_weight: weight, post_weight_why: why,
    });
    const gate = await gateApi.check(db, post, { voice, privateState, lalaProfileId });
    const review = gateApi.reviewReasons(post, gate, { lalaProfileId, revealsStory: got.reveals_story === true });
    review.push('on_request');
    await post.update({ gate_json: { ...gate, review, checked_at: new Date().toISOString() } });
    drafted.push({ post, weight, why, review });
  }
  return { show_id: showId, drafted, failed };
}

module.exports = { generatePosts, buildPrompt, factsLines, maskLines, woundOf, PostsError, DraftError, DEFAULT_COUNT, STATUS_LINES };
