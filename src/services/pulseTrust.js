'use strict';

/**
 * Trust per character (automation step 5; Evoni, 2026-10-18: "yes start
 * trust per character after the brand profiles"). How much of a Feed
 * profile's everyday posting waits for her, stored on
 * social_profiles.pulse_trust (characters through their feed profile; brand
 * accounts directly):
 *
 *   review_all  Review everything: every post waits, even one that passed.
 *   trusted     Today's rules (null means this): passing posts go out,
 *               flagged ones wait in Review.
 *   full        Fully trusted: an everyday post flagged only for how it
 *               reads (voice match, off what they are known for, an
 *               AI-sounding phrase) goes out too, marked
 *               gate_json.released_on_trust, listed in the daily update
 *               with Undo.
 *
 * Always hers, at any level (never waived): Lala's own posts and posts about
 * Lala (lala, about_lala), story reveals (reveals_story), deal announcements
 * (brand_deal), any reason a caller always sends to Review, and any gate flag
 * that is canon rather than craft — a Living State secret quoted
 * (private_state), a character or event still hidden (unrevealed_character,
 * unrevealed_event), a future event (future_event), something the poster
 * could not know (doesnt_know). New canon facts never come from a post: the
 * gate flags them, and those flags are kept.
 *
 *   applyTrust(review, level, gate) → { review, waived }
 *   trustedReview(db, post, review, gate) → { review, released_on_trust }
 *                       the one call every router makes after reviewReasons
 *   trustOfProfile(db, profileId) → level
 *   setTrust(db, profileId, level)
 *   undoTrust(db, postId) → the post, back in Review with what was waived
 */

const LEVELS = Object.freeze(['review_all', 'trusted', 'full']);
const DEFAULT_LEVEL = 'trusted';
// Gate flags about how a post reads, not about canon: the only ones full trust waives.
const WAIVABLE_FLAGS = Object.freeze(['voice', 'off_lane', 'banned_phrase']);
// Review reasons trust never waives (the gate's own reason is decided by its flags).
const ALWAYS_REVIEW = Object.freeze(['lala', 'about_lala', 'reveals_story', 'brand_deal']);

class TrustError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const levelOf = (raw) => (LEVELS.includes(raw) ? raw : DEFAULT_LEVEL);

/** The review reasons after their trust: { review, waived } (waived: the reasons let go). */
function applyTrust(review, level, gate) {
  const reasons = Array.isArray(review) ? [...review] : [];
  const trust = levelOf(level);
  if (trust === 'review_all') {
    if (!reasons.includes('trust_review_all')) reasons.push('trust_review_all');
    return { review: reasons, waived: [] };
  }
  if (trust !== 'full' || !reasons.includes('gate')) return { review: reasons, waived: [] };
  const codes = (gate?.flags || []).map((f) => f.code);
  if (!codes.length || !codes.every((c) => WAIVABLE_FLAGS.includes(c))) return { review: reasons, waived: [] };
  return { review: reasons.filter((r) => r !== 'gate'), waived: ['gate'] };
}

/** What gate_json records when a post goes out on trust it would otherwise have waited for. */
function releasedOnTrust(level, waived, gate, now = new Date()) {
  return { level: levelOf(level), waived, flags: (gate?.flags || []).map((f) => f.code), at: now.toISOString() };
}

async function trustOfProfile(db, profileId) {
  if (!profileId || !db.SocialProfile) return DEFAULT_LEVEL;
  const profile = await db.SocialProfile.findByPk(profileId, { attributes: ['id', 'pulse_trust'] });
  return levelOf(profile?.pulse_trust);
}

async function setTrust(db, profileId, level) {
  if (!LEVELS.includes(level)) throw new TrustError(400, `level must be one of ${LEVELS.join(', ')}.`);
  const profile = await db.SocialProfile.findByPk(profileId);
  if (!profile) throw new TrustError(404, 'Feed profile not found.');
  await profile.update({ pulse_trust: level === DEFAULT_LEVEL ? null : level });
  return { profile_id: profile.id, level };
}

/**
 * The one call a router makes after reviewReasons (and any always-review
 * reasons): the poster's trust applied. { review, released_on_trust } —
 * released_on_trust is set only when trust let go of a reason and nothing
 * else holds the post, for the caller to keep on gate_json.
 */
async function trustedReview(db, post, review, gate) {
  const level = await trustOfProfile(db, post.social_profile_id);
  const out = applyTrust(review, level, gate);
  return {
    review: out.review,
    released_on_trust: out.waived.length && !out.review.length ? releasedOnTrust(level, out.waived, gate) : null,
  };
}

/**
 * Undo a post that went out on trust: it goes back to a draft waiting in
 * Review with the reasons that were waived (a live post leaves The Pulse; a
 * scheduled one loses its time). A post that did not go out on trust, or was
 * already undone, is a 409.
 */
/**
 * Undo a comment that went out on trust: it goes back to a draft, off its
 * post, and the post's comment count is recounted. 409 as for posts.
 */
async function undoCommentTrust(db, commentId) {
  const comment = await db.FeedComment.findByPk(commentId);
  if (!comment) throw new TrustError(404, 'Comment not found.');
  const onTrust = comment.released_on_trust;
  if (!onTrust) throw new TrustError(409, 'That comment did not go out on trust.');
  if (onTrust.undone_at) throw new TrustError(409, 'That comment is already back in Review.');
  await comment.update({ status: 'draft', posted_at: null, released_on_trust: { ...onTrust, undone_at: new Date().toISOString() } });
  await require('./feedCommentDrafter').recountComments(db, comment.feed_post_id);
  return comment;
}

async function undoTrust(db, postId) {
  const post = await db.FeedPost.findByPk(postId);
  if (!post) throw new TrustError(404, 'Post not found.');
  const gate = post.gate_json || {};
  const onTrust = gate.released_on_trust;
  if (!onTrust) throw new TrustError(409, 'That post did not go out on trust.');
  if (onTrust.undone_at) throw new TrustError(409, 'That post is already back in Review.');
  const review = [...new Set([...(gate.review || []), ...(onTrust.waived || [])])];
  await post.update({
    status: 'draft', release_state: null, release_at: null,
    gate_json: { ...gate, review, released_on_trust: { ...onTrust, undone_at: new Date().toISOString() } },
  });
  return post;
}

module.exports = {
  LEVELS, DEFAULT_LEVEL, WAIVABLE_FLAGS, ALWAYS_REVIEW, TrustError,
  levelOf, applyTrust, releasedOnTrust, trustedReview, trustOfProfile, setTrust, undoTrust, undoCommentTrust,
};
