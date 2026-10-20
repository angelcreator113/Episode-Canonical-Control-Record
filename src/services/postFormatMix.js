'use strict';

/**
 * Each person posts in their own mix of formats (Evoni, 2026-10-19: "yes …
 * with your recommendations": the engine picks text, quote, photo or
 * carousel to fit who they are, so the feed is believable and a picture is
 * made only where one would be posted). No AI call: read from the profile.
 *
 *   weightsFor(profile, { brand, lala })   { text, quote, post, carousel }, summing to 1
 *   pick(weights, rand = Math.random)      one format, by weight (rand injectable for tests)
 *   formatFor(profile, opts, rand)         weightsFor then pick
 *   promptLine(format)                     the drafting prompt's line for that format
 *   setRandom(fn)                          tests: the random source the drafters' picks use (null resets)
 *
 * The mixes (weights before normalising):
 *   visual       fashion, beauty, style, travel, food, fitness, home, art,
 *                photo, creators on photo/video platforms: mostly photo posts
 *                with some carousels, a little text.
 *   words        writers, commentators, critics, journalists, press, podcasters,
 *                and accounts on twitter or substack: mostly text, some quotes,
 *                the odd photo.
 *   everyday     anyone else: a mix.
 *   brand        a brand account: photo and carousel product posts, a little
 *                text, never a quote.
 *   lala         Lala: mostly photos and carousels, occasional text (her
 *                creator brand).
 * Story, video and live are never chosen here: they stay Evoni's.
 * A format already on a post is never replaced: callers set one only on a new draft.
 */

const FORMATS = Object.freeze(['text', 'quote', 'post', 'carousel']);

const MIXES = Object.freeze({
  visual: { text: 0.1, quote: 0.05, post: 0.6, carousel: 0.25 },
  words: { text: 0.6, quote: 0.25, post: 0.15, carousel: 0 },
  everyday: { text: 0.35, quote: 0.1, post: 0.45, carousel: 0.1 },
  brand: { text: 0.1, quote: 0, post: 0.6, carousel: 0.3 },
  lala: { text: 0.15, quote: 0, post: 0.55, carousel: 0.3 },
});

const VISUAL = /\b(fashion|beauty|makeup|skin ?care|style|stylist|outfit|model|travel|food|chef|bak(?:er|ing)|cook|fitness|gym|wellness|yoga|home|interior|decor|art(?:ist)?|photo(?:grapher|graphy)?|design(?:er)?|aesthetic|lifestyle|influencer|creator|vlog)/i;
const WORDS = /\b(writ(?:er|ing)|author|poet|essay|column(?:ist)?|comment(?:ary|ator)|critic|review(?:er)?|journalist|reporter|editor|press|news|gossip|podcast|opinion|thinker|blogger|newsletter|analyst)/i;
const WORD_PLATFORMS = new Set(['twitter', 'substack']);
const PICTURE_PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'pinterest']);

/** Which mix a profile posts in. */
function kindOf(profile, { brand = false, lala = false } = {}) {
  if (lala) return 'lala';
  if (brand || profile?.full_profile?.lalaverse_brand_id) return 'brand';
  const p = profile || {};
  const said = [p.content_category, p.content_persona, p.public_persona, p.society_archetype, p.vibe_sentence, p.archetype]
    .filter((v) => typeof v === 'string').join(' ');
  const words = WORDS.test(said);
  const visual = VISUAL.test(said);
  if (words && !visual) return 'words';
  if (visual && !words) return 'visual';
  // Both or neither: the platform decides.
  if (WORD_PLATFORMS.has(p.platform)) return 'words';
  if (visual || PICTURE_PLATFORMS.has(p.platform)) return 'visual';
  return 'everyday';
}

function weightsFor(profile, opts = {}) {
  const mix = MIXES[kindOf(profile, opts)];
  const total = FORMATS.reduce((s, f) => s + mix[f], 0);
  return Object.fromEntries(FORMATS.map((f) => [f, mix[f] / total]));
}

let random = Math.random;
function setRandom(fn) { random = typeof fn === 'function' ? fn : Math.random; }

function pick(weights, rand = random) {
  const r = Number(rand());
  let acc = 0;
  for (const f of FORMATS) {
    acc += weights[f] || 0;
    if (r < acc) return f;
  }
  // Rounding: the last format with any weight.
  return [...FORMATS].reverse().find((f) => (weights[f] || 0) > 0) || 'post';
}

function formatFor(profile, opts = {}, rand = random) {
  return pick(weightsFor(profile, opts), rand);
}

const LINES = Object.freeze({
  text: 'This post is words only, a thought or an update with no picture: write it as something they would type, not as a caption.',
  quote: 'This post is a quote card: one short line they would want to share (theirs or a saying in their voice), no picture, no hashtags in the line itself.',
  post: 'This post goes with one photo from their day: write it as the caption for that photo.',
  carousel: 'This post goes with a few photos from one moment: write it as the caption for that set.',
});

const promptLine = (format) => LINES[format] || '';

/**
 * A post's format read from its own words, for posts written by hand (the
 * script's [UI:POST …] lines): "photos"/"dump" is a carousel, "photo"/"selfie"
 * a photo, a line wholly in quotes a quote card, "thoughts"/"rant" words only.
 * Anything else is `fallback` (Lala's usual: a photo post).
 */
function formatFromWords(words, fallback = 'post') {
  const t = String(words || '').trim();
  if (!t) return fallback;
  if (/\b(photo dump|photos|pics|carousel|slides|swipe)\b/i.test(t)) return 'carousel';
  if (/\b(photo|pic|selfie|mirror|picture|snap|fit ?check|ootd)\b/i.test(t)) return 'post';
  if (/^["“].+["”]$/.test(t)) return 'quote';
  if (/\b(thoughts?|thread|rant|note to self|psa|hot take|confession)\b/i.test(t)) return 'text';
  return fallback;
}

module.exports = { FORMATS, MIXES, kindOf, weightsFor, pick, formatFor, promptLine, formatFromWords, setRandom };
