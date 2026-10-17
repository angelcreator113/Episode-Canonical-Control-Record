'use strict';

/**
 * The quality gate (Task #2969; The Pulse spec §7 "Quality gate: a second
 * check scores each draft for voice match and canon (story clock, reveals,
 * who knows what). Passing everyday posts by other characters auto-publish;
 * anything else goes to Review"; docs/reads/2026-10-12-pulse-posting-read.md
 * §3, §7).
 *
 *   check(db, post, { voice, privateState, checkLane })  →  { pass, voice, flags }
 *     voice             a 0–1 score of the draft against the Voice Profile
 *                       and its examples (one Haiku call); below
 *                       VOICE_PASS is a flag
 *     flags             deterministic canon checks:
 *       banned_phrase       an AI-sounding phrase (pulseVoices.BANNED_PHRASES)
 *       private_state       words from the character's Living State, quoted
 *       unrevealed_character  a character Lala has not met by the post's moment
 *       unrevealed_event    an event still hidden at the post's moment
 *       future_event        an event whose episode comes after the post,
 *                           unless its host posts it once it is announced
 *                           (Evoni, 2026-10-15: hosts announce their own
 *                           events; hostAnnouncing)
 *       doesnt_know         an event the poster could not know about at the
 *                           post's moment: not there, not told by a close
 *                           tie, never posted (pulseKnowledge; spec §6)
 *     off_lane            the same Haiku call reads the post against what the
 *                         poster is known for on The Pulse (their content type,
 *                         services/characterContentType) and flags a post that
 *                         reads like a different kind of creator wrote it, with
 *                         nothing in it to explain the step outside (Evoni,
 *                         2026-10-17: off-lane on purpose is fine, never by
 *                         accident; Review is where she decides)
 *   reviewReasons(post, gate, { lalaProfileId, revealsStory })  why it goes
 *                       to Review: lala, about_lala, reveals_story, gate
 *
 */

const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];
const VOICE_PASS = 0.6;
const MIN_PRIVATE = 12;   // a Living State phrase this long, quoted, is a leak

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim();

/** Every string inside a value (Living State is JSON of any shape). */
function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

/**
 * Private phrases quoted in the text (private feelings and private
 * knowledge are never stated). Each private string and each of its
 * sentences or clauses counts, so quoting part of a long "knows" text is
 * caught too (Task #3088).
 */
function privateLeaks(text, privateState) {
  const body = norm(text);
  const phrases = new Set();
  for (const s of stringsIn(privateState)) {
    const whole = norm(s);
    phrases.add(whole);
    for (const part of whole.split(/[.!?;:\n]+/)) phrases.add(part.trim());
  }
  return [...phrases].filter((s) => s.length >= MIN_PRIVATE && body.includes(s));
}

const mentions = (text, name) => {
  const n = norm(name).replace(/^@/, '');
  if (n.length < 3) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9_])@?${esc}(?![a-z0-9_])`, 'i').test(norm(text));
};

/** The deterministic canon flags for a draft at its story order. */
async function canonFlags(db, post, { privateState = null, lalaProfileId } = {}) {
  const { findBanned } = require('./pulseVoices');
  const text = `${post.content_text || ''}\n${post.trending_topic || ''}`;
  const flags = [];
  const banned = findBanned(text);
  if (banned.length) flags.push({ code: 'banned_phrase', detail: banned.join(', ') });
  const leaks = privateLeaks(text, privateState);
  // The private block holds the Living State and what they privately know
  // (Task #3088): quoting either is a disclosure Evoni approves in Review.
  if (leaks.length) flags.push({ code: 'private_state', detail: 'Quotes something private: the character\'s Living State or what they privately know.' });

  const at = Number.isInteger(post.story_order) ? post.story_order : null;
  if (at !== null) {
    const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
    const view = await require('./pulseReveals').revealsAt(db, post.show_id, at, { lalaProfileId: lalaId });
    const hidden = [...view.hiddenProfiles].filter((id) => Number(id) !== Number(post.social_profile_id));
    if (hidden.length) {
      const [profiles] = await db.sequelize.query(
        'SELECT handle, display_name FROM social_profiles WHERE id IN (:hidden)', { replacements: { hidden } });
      const named = profiles.filter((p) => mentions(text, p.handle) || mentions(text, p.display_name));
      if (named.length) flags.push({ code: 'unrevealed_character', detail: named.map((p) => `@${p.handle}`).join(', ') });
    }
    const knowledge = require('./pulseKnowledge');
    const events = await knowledge.showEvents(db, post.show_id);
    const hiddenEvents = new Set(view.hiddenIds('event').map(String));
    const { orderOf } = require('./storyClock');
    const flagged = new Set();
    for (const ev of events) {
      if (!ev.name || !mentions(text, ev.name)) continue;
      if (hiddenEvents.has(ev.id)) { flags.push({ code: 'unrevealed_event', detail: ev.name }); flagged.add(ev.id); }
      else if (ev.episode_number != null && orderOf(ev.episode_number, 'during_episode') > at && !hostAnnouncing(ev, post, at, orderOf)) { flags.push({ code: 'future_event', detail: ev.name }); flagged.add(ev.id); }
    }
    // Who knows what (Task #2982): an event the poster was not at, was not told of, and saw no post about.
    const unknown = (await knowledge.unknownMentions(db, post, { lalaProfileId: lalaId, events })).filter((ev) => !flagged.has(ev.id));
    if (unknown.length) flags.push({ code: 'doesnt_know', detail: unknown.map((ev) => ev.name).join(', ') });
  }
  return flags;
}

const LANES = ['in', 'off'];

/** The poster's content type ({ name, content }) from their feed profile, else null. */
async function laneOf(db, post) {
  if (!post?.social_profile_id || !db?.SocialProfile) return null;
  try {
    const profile = await db.SocialProfile.findByPk(post.social_profile_id, { attributes: ['id', 'society_archetype'] });
    if (!profile?.society_archetype) return null;
    const { loadSocietyArchetypes, matchSocietyArchetype } = require('./societyArchetypes');
    return matchSocietyArchetype(await loadSocietyArchetypes(db), profile.society_archetype) || { name: profile.society_archetype };
  } catch (err) {
    console.error('[PulseGate] the poster\'s content type could not be read; the lane is not checked:', err.message);
    return null;
  }
}

/**
 * The draft's voice match, 0–1, against the voice and its examples; with
 * their content type (lane), also whether the post fits it.
 */
async function voiceScore(voice, text, lane = null) {
  const examples = (voice?.examples_json || []).slice(0, 6).map((e) => `- ${e.text}`).join('\n') || '(none)';
  const laneAsk = lane?.name
    ? `\n\nThey are known on The Pulse as ${lane.name}${lane.content ? ` (what they post: ${lane.content})` : ''}. Also say whether this post fits that: "in" when it does, or when something in it explains stepping outside it (an event, news, a reply, a moment in their life); "off" only when it reads like a different kind of creator wrote it.`
    : '';
  const prompt = `Score how well this social post matches the character's voice, from 0 (nothing like them) to 1 (exactly them).
Voice habits: ${JSON.stringify(voice?.habits_json || {})}
Posts in their voice:
${examples}${laneAsk}

Post to score:
${text}

Answer with JSON only: {"score": 0.0, "why": "one short line"${lane?.name ? ', "lane": "in" or "off", "lane_why": "one short line"' : ''}}`;
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 200, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[PulseGate] scoring with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const score = Number(parsed.score);
    const out = { score: Number.isFinite(score) ? Math.max(0, Math.min(1, Math.round(score * 100) / 100)) : 0, why: String(parsed.why || '').slice(0, 200) };
    if (lane?.name && LANES.includes(parsed.lane)) {
      out.lane = parsed.lane;
      out.lane_why = String(parsed.lane_why || '').slice(0, 200);
    }
    return out;
  } catch (parseErr) {
    console.error('[PulseGate] could not read the voice score:', parseErr.message);
    return { score: 0, why: 'The voice score could not be read.' };
  }
}

/** The gate: { pass, voice, voice_why, flags }. */

/**
 * A host may post about their own event once it is announced (its episode's
 * 'announced' moment, storyClock) and before it happens. The words are still
 * the voice and canon checks'; only the future_event flag is waived.
 */
function hostAnnouncing(ev, post, at, orderOf) {
  if (ev.host_profile_id == null || post?.social_profile_id == null) return false;
  if (Number(ev.host_profile_id) !== Number(post.social_profile_id)) return false;
  return at >= orderOf(ev.episode_number, 'announced');
}

async function check(db, post, { voice = null, privateState = null, lalaProfileId, checkLane = true } = {}) {
  const flags = await canonFlags(db, post, { privateState, lalaProfileId });
  // A DM is not content: it is never held to their lane.
  const lane = checkLane ? await laneOf(db, post) : null;
  const scored = await voiceScore(voice, post.content_text || '', lane);
  if (scored.score < VOICE_PASS) flags.push({ code: 'voice', detail: `Voice match ${scored.score} (below ${VOICE_PASS}).` });
  if (scored.lane === 'off') flags.push({ code: 'off_lane', detail: `Off what they are known for (${lane.name})${scored.lane_why ? `: ${scored.lane_why}` : '.'}` });
  return { pass: flags.length === 0, voice: scored.score, voice_why: scored.why, ...(scored.lane ? { lane: scored.lane, lane_why: scored.lane_why } : {}), flags };
}

/**
 * Why a draft goes to Review instead of publishing: Lala's own posts, posts
 * about Lala, posts that reveal story, and anything the gate flagged. [] means
 * it is an everyday post by another character that passed: it publishes.
 */
function reviewReasons(post, gate, { lalaProfileId = null, revealsStory = false } = {}) {
  const { isAboutLala } = require('./pulseNumbers');
  const reasons = [];
  const isLala = lalaProfileId && post.social_profile_id
    ? Number(post.social_profile_id) === Number(lalaProfileId)
    : String(post.poster_handle || '').replace(/^@/, '').toLowerCase() === 'lala';
  if (isLala) reasons.push('lala');
  else if (isAboutLala(post)) reasons.push('about_lala');
  if (revealsStory) reasons.push('reveals_story');
  if (!gate?.pass) reasons.push('gate');
  return reasons;
}

module.exports = {
  hostAnnouncing, VOICE_PASS, MIN_PRIVATE, mentions, privateLeaks, canonFlags, voiceScore, laneOf, check, reviewReasons };
