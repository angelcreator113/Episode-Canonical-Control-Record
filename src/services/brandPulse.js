'use strict';

/**
 * Brands on The Pulse (automation step 3; Evoni, 2026-10-18: "start the
 * brands on the pulse"). The six LalaVerse brands post, reply and announce
 * deals on The Pulse in their own voice, from the personalities she approved
 * (lalaverse_brands.personality, constants/brandPersonalities).
 *
 *   Accounts   ensureAccounts(db): each brand gets one Pulse account (a
 *              social_profiles row, a brand and not a person), made only
 *              when it has none; full_profile.lalaverse_brand_id ties it to
 *              the brand. Nothing else about existing profiles changes.
 *   Who posts  the brand account. A representative (Vivienne, Nia, Adrian,
 *              Celeste, Jordan, Zora) posts from it too, signed with her
 *              name and title: the reps are draft characters with no feed
 *              profile or Voice Profile of their own.
 *   Voice      brandVoiceBlock keeps the Brand Canon Protection Rule's
 *              layers apart: the established canon (never added to), what
 *              the BRAND believes, and, for a rep, what she believes
 *              herself (not an official position). A post expresses
 *              beliefs and tone; it never states a new historical fact
 *              about a brand, and never names money or terms.
 *   Gates      an everyday post goes through the gate every everyday post
 *              goes through (services/pulseGate check + reviewReasons): one
 *              that passes goes out (a single draft now; a week's drafts at
 *              their suggested times, postRelease), the rest wait in Review.
 *              A reply is always a draft (never sent here). A deal
 *              announcement always waits in Review, is drafted only for a
 *              booked deal, and only by the brand account or a rep whose
 *              authority finalizes (canAnnounce). Nothing here spends,
 *              negotiates or signs: posts only.
 *
 * One drafting call is one manual Pulse request (services/pulseRequests);
 * every call also passes aiCostTracker's daily budget.
 */

const {
  BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES, FINALIZE_LEVELS, BINDING_RULE,
} = require('../constants/brandPersonalities');

const MODELS = ['claude-sonnet-4-6'];
const FINAL_DEAL_STATUSES = Object.freeze(['booked', 'preparing', 'active', 'completed', 'paid']);
const WEEK_PER_BRAND = 3;
const REPLY_LIMIT = 20;

class BrandPulseError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'BrandPulseError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const repByKey = (key) => REPRESENTATIVES.find((r) => r.key === key) || null;
const repsOf = (slug) => REPRESENTATIVES.filter((r) => r.brand === slug);
const firstName = (rep) => String(rep.name).split(' ')[0];
const signature = (rep) => `— ${firstName(rep)}, ${rep.title}`;

/** The brand's approved personality: the saved one, else the constant. */
function personalityOf(brand) {
  const saved = brand?.personality;
  if (saved && typeof saved === 'object' && Object.keys(saved).length) return saved;
  return BRAND_PERSONALITIES[brand?.slug] || {};
}

/** A handle from the brand's name: "Velour Atelier" → velouratelier. */
const baseHandle = (brand) => String(brand.name || brand.slug || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Each brand's Pulse account (social_profiles.id), keyed by brand id. */
async function accountsByBrand(db) {
  const [rows] = await db.sequelize.query(
    `SELECT id, handle, display_name, full_profile->>'lalaverse_brand_id' AS brand_id
       FROM social_profiles
      WHERE deleted_at IS NULL AND full_profile->>'lalaverse_brand_id' IS NOT NULL`);
  return new Map(rows.map((r) => [r.brand_id, { id: r.id, handle: r.handle, display_name: r.display_name }]));
}

/** A brand account's suggested posting schedule, from what the brand is (services/postingSchedule). */
function brandSchedule(brand) {
  return require('./postingSchedule').suggestSchedule({ content_category: [brand.category, 'fashion'].filter(Boolean).join(' ') }).schedule;
}

/** "Give the brands their Pulse accounts": makes the missing ones, and gives each one a posting schedule. */
async function ensureAccounts(db) {
  const brands = await db.LalaverseBrand.findAll({ where: { kind: 'brand' }, order: [['name', 'ASC']] });
  const have = await accountsByBrand(db);
  const created = [];
  const existing = [];
  for (const brand of brands) {
    if (have.has(brand.id)) {
      const account = have.get(brand.id);
      // An account made before posting schedules gets its suggested one; a
      // schedule already there (suggested or hers) is never changed.
      await db.sequelize.query('UPDATE social_profiles SET posting_schedule = CAST(:s AS JSONB), updated_at = NOW() WHERE id = :id AND posting_schedule IS NULL',
        { replacements: { id: account.id, s: JSON.stringify(brandSchedule(brand)) } });
      existing.push({ brand: brand.name, handle: account.handle });
      continue;
    }
    const p = personalityOf(brand);
    const base = baseHandle(brand);
    let handle = base;
    for (const candidate of [base, `${base}official`, `${base}house`]) {
      const [[taken]] = await db.sequelize.query('SELECT 1 AS x FROM social_profiles WHERE LOWER(handle) = :h AND deleted_at IS NULL LIMIT 1', { replacements: { h: candidate } });
      if (!taken) { handle = candidate; break; }
      handle = null;
    }
    if (!handle) { existing.push({ brand: brand.name, handle: null, note: `@${base} and its variants are taken; name its account by hand.` }); continue; }
    const profile = await db.SocialProfile.create({
      handle,
      display_name: brand.name,
      platform: 'pulse',
      feed_layer: 'lalaverse',
      vibe_sentence: p.defining_principle ? `${brand.name}: ${p.defining_principle}.` : `${brand.name}, on The Pulse.`,
      content_category: brand.category || null,
      content_persona: p.direction || null,
      posting_voice: p.direction || null,
      // Public houses: Lala knows of them, so their posts are not hidden as unmet.
      lala_knows_of: true,
      lalaverse_cap_exempt: true,
      // Evoni, 2026-10-18: brand posts land in the brand's own posting
      // schedule (postRelease follows it); suggested until she saves hers.
      posting_schedule: brandSchedule(brand),
      status: 'finalized',
      full_profile: { lalaverse_brand_id: brand.id, lalaverse_brand_slug: brand.slug, account: 'brand' },
    });
    created.push({ brand: brand.name, handle: profile.handle, id: profile.id });
  }
  return { created, existing };
}

/**
 * The prompt block for a brand post (or a rep's), its layers kept apart
 * (Evoni's Brand Canon Protection Rule).
 */
function brandVoiceBlock(brand, rep = null) {
  const p = personalityOf(brand);
  const canon = [
    brand.category && `Category: ${brand.category}`,
    brand.description && `What it is: ${brand.description}`,
    brand.aesthetic && `Aesthetic: ${brand.aesthetic}`,
    brand.niche && `Niche: ${brand.niche}`,
    brand.founder && `Founder: ${brand.founder}`,
  ].filter(Boolean).join('\n');
  const believes = [
    p.direction && `Direction: ${p.direction}`,
    p.defining_principle && `Defining principle: ${p.defining_principle}`,
    p.beliefs && `Beliefs: ${p.beliefs}`,
    p.preferred_content?.length && `What it likes to show: ${p.preferred_content.join(', ')}`,
    p.damages_trust?.length && `What it never does: ${p.damages_trust.join(', ')}`,
  ].filter(Boolean).join('\n');
  const ties = BRAND_RELATIONSHIPS.filter((r) => r.brands.includes(brand.slug))
    .map((r) => `- ${r.kind}: ${r.note}`).join('\n');
  const repBlock = rep ? `

${rep.name.toUpperCase()}, ${rep.title}, writes this post from the ${brand.name} account and signs it.
HER OWN VIEWS (hers, not an official ${brand.name} position; she may say them as hers):
Belief: ${rep.core_belief}
Personality: ${rep.personality}
How she speaks: ${rep.voice?.speech_pattern || ''} ${rep.voice?.vocabulary_tone || ''}
A line she would say: ${rep.sample_line}` : '';
  return `ESTABLISHED CANON about ${brand.name} (true; never add to it, never contradict it):
${canon || '(only its name)'}

WHAT ${brand.name.toUpperCase()} BELIEVES (its official voice):
${believes || '(no approved personality yet)'}
${ties ? `\nHOW IT SEES THE OTHER HOUSES:\n${ties}\n` : ''}${repBlock}

RULES:
- Express beliefs and tone only. Never state a new fact about ${brand.name}'s history: no founding story, past campaign, collaboration, award, sale or number that is not in the canon above. A campaign discussed is not a campaign that happened.
- Never name money, a budget, compensation, contract terms or that anything is being negotiated.
- The Pulse is the only app. Never name a real-world app or website.
- Stay in the world: nothing about a show, episodes, filming or a studio set.`;
}

/** A Voice-Profile-shaped object for the gate's voice score. */
function voiceFor(brand, rep = null) {
  const p = personalityOf(brand);
  return {
    habits_json: {
      account: `${brand.name} (a brand)`,
      direction: p.direction || null,
      principle: p.defining_principle || null,
      ...(rep ? { signed_by: `${rep.name}, ${rep.title}`, speech: rep.voice?.speech_pattern, tone: rep.voice?.vocabulary_tone } : {}),
    },
    examples_json: rep ? [{ text: rep.sample_line }] : [],
  };
}

/**
 * Who may announce a deal (Evoni's authority rulings): only a booked deal,
 * and only the brand account or a rep whose authority finalizes. A rep who
 * cannot finalize a binding agreement does not say it is signed.
 */
function canAnnounce({ deal, brand, rep = null }) {
  if (!deal) return { ok: false, reason: 'No deal.' };
  if (!FINAL_DEAL_STATUSES.includes(deal.status)) {
    return { ok: false, reason: `The deal is ${deal.status}: only a booked deal is announced. ${BINDING_RULE}` };
  }
  if (rep) {
    if (brand && rep.brand !== brand.slug) return { ok: false, reason: `${rep.name} speaks for another house.` };
    if (rep.authority?.finalize !== 'founder') {
      return { ok: false, reason: `${rep.name} cannot finalize a binding agreement (${FINALIZE_LEVELS.none.toLowerCase()}), so she does not announce one. The ${brand ? brand.name : 'brand'} account does.` };
    }
  }
  return { ok: true, reason: null };
}

/** One call, the two-attempt loop; the answer's JSON. */
async function ask(prompt, maxTokens) {
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[BrandPulse] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch (parseErr) {
    console.error('[BrandPulse] could not read the draft:', parseErr.message);
    throw new BrandPulseError(502, 'The draft came back in a form that could not be read.');
  }
}

/** The brand row and its account, or a BrandPulseError. */
async function brandAndAccount(db, brandId) {
  const brand = await db.LalaverseBrand.findByPk(brandId);
  if (!brand) throw new BrandPulseError(404, 'Brand not found.');
  const account = (await accountsByBrand(db)).get(brand.id);
  if (!account) throw new BrandPulseError(409, `${brand.name} has no Pulse account yet. Give the brands their Pulse accounts first.`);
  return { brand, account };
}

function repFor(brand, repKey) {
  if (!repKey) return null;
  const rep = repByKey(repKey);
  if (!rep) throw new BrandPulseError(400, 'Unknown representative.');
  if (rep.brand !== brand.slug) throw new BrandPulseError(400, `${rep.name} speaks for another house.`);
  return rep;
}

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanTag = (v) => (typeof v === 'string' && v.trim() && v !== 'null' ? v.trim().slice(0, 100) : null);

/**
 * Saves one drafted brand post (a draft until routed). Its format is the one
 * the prompt was written for, else a brand's mix: photo and carousel product
 * posts, a little text, never a quote (services/postFormatMix).
 */
async function saveDraft(db, { showId, account, brand, rep, text, tag, at, kind, extra = {}, format = null }) {
  const body = rep ? `${text}\n${signature(rep)}` : text;
  return db.FeedPost.create({
    show_id: showId,
    episode_id: extra.episode_id || null,
    event_id: extra.event_id || null,
    social_profile_id: account.id,
    poster_handle: String(account.handle).replace(/^@/, ''),
    poster_display_name: account.display_name || brand.name,
    poster_platform: 'lalaverse',
    post_type: 'post',
    post_format: format || require('./postFormatMix').formatFor(account, { brand: true }),
    content_text: body,
    trending_topic: tag,
    likes: 0, comments_count: 0, shares: 0, sample_comments: [],
    story_order: at,
    ai_generated: true,
    generation_model: MODELS[0],
    status: 'draft',
    sort_order: 0,
    gate_json: { brand: { brand_id: brand.id, rep: rep?.key || null, kind } },
  });
}

/**
 * The gate every everyday post goes through. Passing: `release` 'now'
 * publishes it (as an everyday post by another character does), 'schedule'
 * puts it at its suggested time. Otherwise it waits in Review.
 */
async function routeEveryday(db, post, { brand, rep, release = 'now', alwaysReview = [] }) {
  const gateApi = require('./pulseGate');
  const lalaProfileId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const gate = await gateApi.check(db, post, { voice: voiceFor(brand, rep), privateState: null, lalaProfileId });
  const reasons = gateApi.reviewReasons(post, gate, { lalaProfileId });
  for (const r of alwaysReview) if (!reasons.includes(r)) reasons.push(r);
  // The brand account's trust (services/pulseTrust), as for characters' posts.
  const { review, released_on_trust: onTrust } = await require('./pulseTrust').trustedReview(db, post, reasons, gate);
  await post.update({ gate_json: { ...(post.gate_json || {}), ...gate, review, ...(onTrust ? { released_on_trust: onTrust } : {}), checked_at: new Date().toISOString() } });
  if (review.length) return { post, review, published: false, scheduled_at: null };
  if (release === 'schedule') {
    const postRelease = require('./postRelease');
    try {
      const { at } = await postRelease.suggestReleaseTime(db, post);
      await postRelease.setReleaseTime(post, { mode: 'schedule', at });
      return { post, review, published: false, scheduled_at: new Date(at).toISOString() };
    } catch (err) {
      console.error(`[BrandPulse] no release time for ${post.id}; it waits in Review:`, err.message);
      await post.update({ gate_json: { ...post.gate_json, review: ['schedule'] } });
      return { post, review: ['schedule'], published: false, scheduled_at: null };
    }
  }
  await require('./pulseDrafter').release(post, db);
  return { post, review, published: true, scheduled_at: null };
}

const EVERYDAY_KINDS = 'a drop, a look behind the scenes, or one of its beliefs';

/**
 * "Draft a post": one everyday post by the brand (or a rep), through the
 * gate. Evoni, 2026-10-18: one that passes is scheduled at its suggested
 * time, like the week's posts, so brand posts don't all land the moment
 * she clicks.
 */
async function draftBrandPost(db, { showId, brandId, repKey = null, about = null }) {
  if (!showId) throw new BrandPulseError(400, 'show_id is required.');
  const { brand, account } = await brandAndAccount(db, brandId);
  const rep = repFor(brand, repKey);
  const clock = require('./storyClock');
  const at = await clock.presentOrder(db, showId);
  await require('./pulseRequests').take(db, { showId, lane: 'manual', kind: 'brand_post' });
  const mixApi = require('./postFormatMix');
  const format = mixApi.formatFor(account, { brand: true });
  const parsed = await ask(`You write one post on The Pulse, LalaVerse's social network, from the ${brand.name} account (@${account.handle}).

${brandVoiceBlock(brand, rep)}

When: ${clock.label(at)}.
What to post: ${cleanText(about, 500) || EVERYDAY_KINDS}.
${mixApi.promptLine(format)}
${rep ? `Do not add a signature: ${firstName(rep)}'s name is added after the post.\n` : ''}
Answer with JSON only: {"text": "the post", "hashtag": "#OneTag or null"}`, 600);
  const text = cleanText(parsed.text, 2000);
  if (!text) throw new BrandPulseError(502, 'The draft came back empty.');
  const post = await saveDraft(db, { showId, account, brand, rep, text, tag: cleanTag(parsed.hashtag), at, kind: 'everyday', format });
  return routeEveryday(db, post, { brand, rep, release: 'schedule' });
}

/**
 * "Draft this week for every brand": one call drafts WEEK_PER_BRAND posts
 * for each brand with an account; each goes through the gate, and the ones
 * that pass are scheduled at their suggested times.
 */
async function draftWeek(db, { showId, perBrand = WEEK_PER_BRAND }) {
  if (!showId) throw new BrandPulseError(400, 'show_id is required.');
  const accounts = await accountsByBrand(db);
  const brands = (await db.LalaverseBrand.findAll({ where: { kind: 'brand' }, order: [['name', 'ASC']] })).filter((b) => accounts.has(b.id));
  if (!brands.length) throw new BrandPulseError(409, 'No brand has a Pulse account yet. Give the brands their Pulse accounts first.');
  const n = Math.max(1, Math.min(5, Number(perBrand) || WEEK_PER_BRAND));
  const clock = require('./storyClock');
  const at = await clock.presentOrder(db, showId);
  const blocks = brands.map((b) => {
    const reps = repsOf(b.slug).map((r) => `${r.key} (${r.name}, ${r.title})`).join(', ') || 'none';
    return `=== ${b.slug} (@${accounts.get(b.id).handle}) ===\n${brandVoiceBlock(b)}\nRepresentatives who may post from it: ${reps}`;
  }).join('\n\n');
  await require('./pulseRequests').take(db, { showId, lane: 'manual', kind: 'brand_week' });
  const parsed = await ask(`You plan one week of posts on The Pulse, LalaVerse's social network, for these brand accounts. Each brand gets ${n} posts: ${EVERYDAY_KINDS}. A representative may write one of them as herself (give her key), keeping her own views apart from the brand's.

${blocks}

When: ${clock.label(at)}.
Do not add signatures: a representative's name is added after her post.
Answer with JSON only: {"posts": [{"brand": "the brand's key", "rep": "a representative's key or null", "text": "the post", "hashtag": "#OneTag or null"}]}`, 4000);
  const items = Array.isArray(parsed.posts) ? parsed.posts : [];
  const bySlug = new Map(brands.map((b) => [b.slug, b]));
  const routed = [];
  const failed = [];
  const counts = new Map();
  for (const item of items) {
    const brand = bySlug.get(item?.brand);
    const text = cleanText(item?.text, 2000);
    if (!brand || !text) { failed.push({ brand: item?.brand || null, reason: 'unreadable' }); continue; }
    if ((counts.get(brand.slug) || 0) >= n) continue;
    counts.set(brand.slug, (counts.get(brand.slug) || 0) + 1);
    const rep = item.rep && repByKey(item.rep)?.brand === brand.slug ? repByKey(item.rep) : null;
    try {
      const post = await saveDraft(db, { showId, account: accounts.get(brand.id), brand, rep, text, tag: cleanTag(item.hashtag), at, kind: 'everyday' });
      const r = await routeEveryday(db, post, { brand, rep, release: 'schedule' });
      routed.push({ brand: brand.name, rep: rep?.name || null, post_id: post.id, review: r.review, scheduled_at: r.scheduled_at });
    } catch (err) {
      console.error(`[BrandPulse] a week's post for ${brand.name} could not be saved:`, err.message);
      failed.push({ brand: brand.name, reason: err.message });
    }
  }
  return { routed, failed };
}

/** Posts a brand could answer: live posts naming it, or about an event where its pieces were worn. */
async function replyCandidates(db, { showId, brandId }) {
  const { brand, account } = await brandAndAccount(db, brandId);
  const { notConfidentialSql } = require('../utils/confidentialCharacters');
  const [rows] = await db.sequelize.query(
    `SELECT fp.id, fp.poster_handle, fp.poster_display_name, fp.content_text, fp.posted_at
       FROM feed_posts fp
      WHERE fp.show_id = :showId AND fp.status = 'live' AND fp.deleted_at IS NULL
        AND (fp.social_profile_id IS NULL OR fp.social_profile_id <> :accountId)
        AND (fp.content_text ILIKE :name OR fp.content_text ILIKE :handle
             OR fp.event_id IN (SELECT we.id FROM world_events we
                                 JOIN wardrobe_brand_tags t ON t.event_name = we.name AND t.brand_id = :brandId AND t.deleted_at IS NULL
                                WHERE we.show_id = :showId AND we.deleted_at IS NULL))
        AND NOT EXISTS (SELECT 1 FROM feed_comments fc WHERE fc.feed_post_id = fp.id AND fc.social_profile_id = :accountId AND fc.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM registry_characters rc WHERE rc.feed_profile_id = fp.social_profile_id AND rc.deleted_at IS NULL AND NOT ${notConfidentialSql('rc')})
      ORDER BY fp.posted_at DESC NULLS LAST
      LIMIT :limit`,
    { replacements: { showId, accountId: account.id, brandId: brand.id, name: `%${brand.name}%`, handle: `%@${account.handle}%`, limit: REPLY_LIMIT } });
  return rows;
}

/** A reply by the brand (or a rep) to one post: a draft, never sent here. */
async function draftReply(db, { postId, brandId, repKey = null }) {
  const { brand, account } = await brandAndAccount(db, brandId);
  const rep = repFor(brand, repKey);
  const post = await db.FeedPost.findByPk(postId);
  if (!post || post.status !== 'live') throw new BrandPulseError(404, 'That post is not live.');
  if (Number(post.social_profile_id) === Number(account.id)) throw new BrandPulseError(400, 'A brand does not reply to its own post here.');
  await require('./pulseRequests').take(db, { showId: post.show_id, lane: 'manual', kind: 'brand_reply' });
  const parsed = await ask(`You write one reply on The Pulse, LalaVerse's social network, from the ${brand.name} account (@${account.handle}).

${brandVoiceBlock(brand, rep)}

The post, by @${post.poster_handle}:
${post.content_text}

One short reply. Thank, notice or ask; never promise a deal, gifting or money.
${rep ? `Do not add a signature: ${firstName(rep)}'s name is added after the reply.\n` : ''}Answer with JSON only: {"text": "the reply"}`, 300);
  const text = cleanText(parsed.text, 1000);
  if (!text) throw new BrandPulseError(502, 'The reply came back empty.');
  const existing = await db.FeedComment.count({ where: { feed_post_id: post.id } });
  const comment = await db.FeedComment.create({
    feed_post_id: post.id, show_id: post.show_id, social_profile_id: account.id,
    handle: String(account.handle).replace(/^@/, ''), display_name: account.display_name || brand.name,
    text: rep ? `${text} ${signature(rep)}` : text,
    status: 'draft', sort_order: existing, ai_generated: true, generation_model: MODELS[0],
    story_order: await require('./storyClock').commentOrder(db, post),
  });
  return { comment, sent: false };
}

/** The brand's deals in this show (matched by name), each with whether it can be announced. */
async function dealsFor(db, { showId, brandId }) {
  const { brand } = await brandAndAccount(db, brandId);
  const { Op } = require('sequelize');
  const deals = await db.Opportunity.findAll({
    // The deals linked to this company (opportunities.company_id), and ones
    // that only name it, as before.
    where: { show_id: showId, [Op.or]: [{ company_id: brand.id }, { brand_or_company: { [Op.iLike]: `%${brand.name}%` } }] },
    order: [['created_at', 'DESC']], limit: 30,
  });
  return deals.map((d) => ({
    id: d.id, name: d.name, status: d.status, opportunity_type: d.opportunity_type, publish_date: d.publish_date,
    announce: canAnnounce({ deal: d, brand }),
  }));
}

/** A deal announcement: drafted only when canAnnounce, and always left in Review. */
async function draftDealAnnouncement(db, { dealId, brandId, repKey = null }) {
  const { brand, account } = await brandAndAccount(db, brandId);
  const rep = repFor(brand, repKey);
  const deal = await db.Opportunity.findByPk(dealId);
  if (!deal || (deal.company_id !== brand.id && !String(deal.brand_or_company || '').toLowerCase().includes(brand.name.toLowerCase()))) {
    throw new BrandPulseError(404, `No ${brand.name} deal with that id.`);
  }
  const gate = canAnnounce({ deal, brand, rep });
  if (!gate.ok) throw new BrandPulseError(409, gate.reason);
  const clock = require('./storyClock');
  const at = await clock.presentOrder(db, deal.show_id);
  await require('./pulseRequests').take(db, { showId: deal.show_id, lane: 'manual', kind: 'brand_deal' });
  const parsed = await ask(`You write one post on The Pulse, LalaVerse's social network, from the ${brand.name} account (@${account.handle}), announcing a partnership that is agreed.

${brandVoiceBlock(brand, rep)}

The partnership: ${deal.name} (${deal.opportunity_type}).${deal.publish_date ? ` It goes public on ${deal.publish_date}.` : ''}
Say what the partnership is and why it fits what ${brand.name} believes. No money, no terms, nothing about how it was negotiated.
${rep ? `Do not add a signature: ${firstName(rep)}'s name is added after the post.\n` : ''}Answer with JSON only: {"text": "the post", "hashtag": "#OneTag or null"}`, 600);
  const text = cleanText(parsed.text, 2000);
  if (!text) throw new BrandPulseError(502, 'The draft came back empty.');
  const post = await saveDraft(db, {
    showId: deal.show_id, account, brand, rep, text, tag: cleanTag(parsed.hashtag), at, kind: 'deal',
    extra: { event_id: deal.event_id, episode_id: deal.episode_id },
  });
  await post.update({ gate_json: { ...post.gate_json, brand: { ...post.gate_json.brand, deal_id: deal.id }, review: ['brand_deal'] } });
  return { post, review: ['brand_deal'], published: false };
}

/** The Brands area: each brand, its account, reps, recent posts and replies waiting. */
async function overview(db, { showId }) {
  const accounts = await accountsByBrand(db);
  const brands = await db.LalaverseBrand.findAll({ where: { kind: 'brand' }, order: [['name', 'ASC']] });
  const [repRows] = await db.sequelize.query(
    `SELECT id, character_key, status FROM registry_characters
      WHERE deleted_at IS NULL AND character_key IN (:keys)`,
    { replacements: { keys: REPRESENTATIVES.map((r) => r.key) } });
  const repIds = new Map(repRows.map((r) => [r.character_key, r]));
  const out = [];
  for (const b of brands) {
    const account = accounts.get(b.id) || null;
    let posts = [];
    let replies = [];
    if (account && showId) {
      [posts] = await db.sequelize.query(
        `SELECT id, content_text, status, release_state, release_at, posted_at, gate_json->'review' AS review, gate_json->'brand' AS brand
           FROM feed_posts WHERE social_profile_id = :id AND show_id = :showId AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT 10`, { replacements: { id: account.id, showId } });
      [replies] = await db.sequelize.query(
        `SELECT fc.id, fc.text, fc.feed_post_id, fp.poster_handle
           FROM feed_comments fc JOIN feed_posts fp ON fp.id = fc.feed_post_id
          WHERE fc.social_profile_id = :id AND fc.show_id = :showId AND fc.status = 'draft' AND fc.deleted_at IS NULL
          ORDER BY fc.created_at DESC LIMIT 10`, { replacements: { id: account.id, showId } });
    }
    out.push({
      id: b.id, slug: b.slug, name: b.name, category: b.category,
      principle: personalityOf(b).defining_principle || null,
      account,
      reps: repsOf(b.slug).map((r) => ({
        key: r.key, name: r.name, title: r.title, authority: r.authority.label,
        announces_deals: r.authority.finalize === 'founder',
        character_id: repIds.get(r.key)?.id || null,
      })),
      posts, replies,
    });
  }
  return { brands: out, accounts_missing: brands.filter((b) => !accounts.has(b.id)).length };
}

module.exports = {
  MODELS, FINAL_DEAL_STATUSES, WEEK_PER_BRAND, BrandPulseError,
  personalityOf, baseHandle, accountsByBrand, ensureAccounts, brandVoiceBlock, voiceFor, canAnnounce, signature,
  draftBrandPost, draftWeek, replyCandidates, draftReply, dealsFor, draftDealAnnouncement, overview,
};
