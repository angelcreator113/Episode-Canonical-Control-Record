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
 *       what they are known for on The Pulse (their content type), next
 *         to their job: the two can differ;
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
 *   postIdeas(db, characterId)
 *     what to post about, read from their own story with no AI call (Evoni,
 *     2026-10-17: "now im just sitting here wondering what to say"): the
 *     events they host or are a guest at, their account status, their work,
 *     and their want and wound (as a hint, never stated), plus an ordinary
 *     day; and what they are known for on The Pulse (their content type,
 *     services/characterContentType), with an idea where their job and
 *     their content meet. Each idea is { key, label, about }: `about` goes in "What is
 *     happening". Also says whether they can post yet ({ ready, blocker,
 *     next }): next is 'choose_show', 'make_active' or 'build_voice' when
 *     the page itself can take that step, else null. For choose_show it
 *     also gives the registry ({ id, title, characters }) and the shows to
 *     choose from ([{ id, name }]): a registry with no show leaves their
 *     voice and posts nowhere to go (Evoni, 2026-10-17: Build their voice
 *     refused with a 409).
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

function buildPrompt({ character, profile, voice, facts, mask, wound, known, hosting, recent, label, about, count, contentType = null }) {
  const { BANNED_PHRASES } = require('./pulseVoices');
  const examples = (voice.examples_json || []).slice(0, 8).map((e) => `- ${e.text}`).join('\n') || '(none yet)';
  const name = profile.display_name || character.display_name;
  return `You write ${count} separate posts on The Pulse, LalaVerse's social network, all by ${name} (@${String(profile.handle).replace(/^@+/, '')}).

Write exactly in this voice:
${JSON.stringify(voice.habits_json || {}, null, 2)}
${require('./characterTypology').voiceDial(character.typology)}
Posts they really wrote (match these):
${examples}
Their latest posts (do not repeat them; vary the subject, length and opening):
${recent.length ? recent.map((t) => `- ${clip(t, 200)}`).join('\n') : '(none yet)'}

How they present themselves (their posts come from this face, true or not):
${mask}
${contentType ? `\n${require('./characterContentType').contentTypeBlock(contentType, facts.occupation && !(facts.undecided || []).includes('occupation') ? facts.occupation : null)}\n` : ''}
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

  const { current: contentType } = await require('./characterContentType').contentTypeOf(db, { feedProfile });
  const prompt = buildPrompt({
    character, profile: feedProfile, voice, facts, mask: maskLines(character, feedProfile), wound: woundOf(character),
    known, hosting, recent: recentRows.map((r) => r.content_text), label: clock.label(at), about: what, count: n, contentType,
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

const STATUS_IDEAS = {
  gone_dark: (n) => ['Breaking the silence', `${n}'s first post after going dark. The silence is broken; how ${n} explains it, or doesn't, is the story.`],
  cancelled: (n) => ['Answering the backlash', `${n} posts while the audience is still angry: a reply, a deflection or a pointed silence about it.`],
  controversial: (n) => ['In the middle of the controversy', `People are arguing about ${n}. ${n} posts as if unbothered, or not.`],
  reinventing: (n) => ['Showing the new direction', `${n} shows the new direction of the account and quietly leaves the old one behind.`],
  plateauing: (n) => ['Trying to get noticed again', `Growth has stalled. ${n} tries something new to get noticed, a little too hard.`],
  rising: (n) => ['Riding the momentum', `${n}'s account is growing fast. A post that enjoys it, or pretends not to.`],
  peaking: (n) => ['At the top', `${n} is at the peak. A post that shows it off without seeming to.`],
};

/** Post ideas from their own story; no AI call, nothing saved. */
async function postIdeas(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new PostsError(404, 'Character not found.');
  const name = character.display_name || 'They';
  const feedProfile = character.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(character.feed_profile_id) : null;
  let blocker = null;
  let next = null;
  let extra = {};
  if (!feedProfile) blocker = `${name} is not on the feed yet: match them to a feed person first.`;
  else if (feedProfile.current_state === 'posthumous') blocker = `${name} has died: their account does not post.`;
  else if (!(await require('./characterFacts').showIdFor(db, character, feedProfile))) {
    const [[registry]] = await db.sequelize.query(
      `SELECT cr.id, cr.title, (SELECT COUNT(*)::int FROM registry_characters rc WHERE rc.registry_id = cr.id AND rc.deleted_at IS NULL) AS characters
         FROM character_registries cr WHERE cr.id = :id`, { replacements: { id: character.registry_id } });
    const shows = await db.Show.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
    next = 'choose_show';
    blocker = `${name}'s registry${registry?.title ? ` ("${registry.title}")` : ''} belongs to no show, so their voice and posts have nowhere to go. Choose its show.`;
    extra = { registry: registry || null, shows: shows.map((sh) => ({ id: sh.id, name: sh.name })) };
  } else if (!(await db.PulseVoice.findOne({ where: { registry_character_id: character.id } }))) {
    const { POSTING_STAGES } = require('./pulseVoices');
    if (POSTING_STAGES.includes(character.depth_level)) {
      next = 'build_voice';
      blocker = `${name} has no Voice Profile yet: their posts are written in it. Build it here.`;
    } else {
      next = 'make_active';
      blocker = `${name} has no Voice Profile yet, and one is built only from the Active stage. Make them Active, then build it.`;
    }
  }

  const ideas = [];
  const add = (key, label, about) => ideas.push({ key, label, about: about.slice(0, ABOUT_MAX) });
  if (feedProfile) {
    const { eventsForProfile } = require('./characterEvents');
    let events = [];
    try {
      events = await eventsForProfile(db.sequelize, feedProfile.id);
    } catch (err) {
      console.error('[CharacterPosts] could not read their events for ideas:', err.message);
    }
    events.sort((a, b) => (a.role === 'host' ? 0 : 1) - (b.role === 'host' ? 0 : 1));
    for (const ev of events.slice(0, 3)) {
      const when = ev.event_date ? ` (${String(ev.event_date).slice(0, 10)})` : '';
      add(`event:${ev.id}`, `Before ${ev.name}`, ev.role === 'host'
        ? `The days before ${ev.name}${when}, which ${name} is hosting. Build up to it: getting ready, teasing it. Nothing about what happens there.`
        : `The days before ${ev.name}${when}, where ${name} is a guest. Looking forward to it, or what to wear. Nothing about what happens there.`);
    }
  }
  const { factsOf } = require('./characterFacts');
  let facts = null;
  try {
    facts = await factsOf(db, { character, feedProfile });
  } catch (err) {
    console.error('[CharacterPosts] could not read their facts for ideas:', err.message);
  }
  const undecided = new Set(facts?.undecided || []);
  if (facts?.account_status && !undecided.has('account_status') && STATUS_IDEAS[facts.account_status]) {
    const [label, about] = STATUS_IDEAS[facts.account_status](name);
    add('status', label, about);
  }
  if (feedProfile?.society_archetype) {
    const { loadSocietyArchetypes, matchSocietyArchetype } = require('./societyArchetypes');
    const known = matchSocietyArchetype(await loadSocietyArchetypes(db), feedProfile.society_archetype);
    add('known_for', `What they're known for`, `A post in ${name}'s usual lane as ${feedProfile.society_archetype}${known?.content ? `: ${known.content.charAt(0).toLowerCase()}${known.content.slice(1)}` : ''}. The kind of post their audience follows them for.`);
  }
  if (facts?.occupation && !undecided.has('occupation')) {
    add('work', 'A day at work', `${name} at work as ${facts.occupation}: a small moment from the day.`);
  }
  if (feedProfile?.society_archetype && facts?.occupation && !undecided.has('occupation')) {
    add('job_meets_content', 'When work and content collide', `${name}'s job (${facts.occupation}) shows up in a post made the way ${feedProfile.society_archetype} posts. The gap between the two is the interesting part.`);
  }
  if (['hidden_want', 'core_desire', 'want_architecture'].some((k) => character[k])) {
    add('want', 'What they really want shows', `A post where what ${name} secretly wants shows through, without ${name} ever saying it.`);
  }
  if (character.core_wound || character.wound) {
    add('mask', 'The mask slips a little', `A post that looks fine on the surface, where for one line the old hurt shows through. ${name} would never call it that.`);
  }
  add('ordinary', 'An ordinary day', '');
  return { ready: !blocker, blocker, next, ...extra, ideas };
}

module.exports = { postIdeas, generatePosts, buildPrompt, factsLines, maskLines, woundOf, PostsError, DraftError, DEFAULT_COUNT, STATUS_LINES };
