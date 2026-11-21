'use strict';

/**
 * A feed post and a comment as anyone who is not an ADMIN may read them
 * (Evoni's approval of 2026-11-15, scope B). The feed's reads are open
 * (optionalAuth) and a post's row holds production material beside what The
 * Pulse draws: Lala's internal thought and her reaction, the review gate's
 * flags, what the post is for in the story, why it weighs what it does, the
 * ripple it causes, Evoni's own tags, the model that wrote it, its episode,
 * its event and its story time. So what The Pulse draws is named here, field
 * by field, the nested author, place, photos and comments included, and
 * nothing else leaves the server for that reader. A field added to a post
 * later is private until it is listed.
 *
 *   PUBLIC_POST_FIELDS / PUBLIC_COMMENT_FIELDS / PUBLIC_AUTHOR_FIELDS /
 *   PUBLIC_PLACE_FIELDS / PUBLIC_PHOTO_FIELDS
 *   publicPost(post)        the post cut to them (a plain object in and out)
 *   publicComment(comment)
 *
 * Which posts a reader gets (live ones, released at the story moment, with
 * approved public pictures) is decided before this, as it was: by
 * services/feedPostStatus, services/pulseReveals and services/postMedia.
 */

const PUBLIC_POST_FIELDS = Object.freeze([
  'id', 'show_id', 'social_profile_id', 'poster_handle', 'poster_display_name', 'poster_platform',
  'content_text', 'image_url', 'image_urls', 'image_description', 'post_format', 'post_type', 'status',
  'posted_at', 'likes', 'comments_count', 'shares', 'place_city',
  'author_portrait_url', 'teaser', 'photo_teaser', 'teaser_style',
]);
const PUBLIC_COMMENT_FIELDS = Object.freeze(['id', 'handle', 'display_name', 'text', 'posted_at', 'sort_order', 'portrait_url']);
const PUBLIC_AUTHOR_FIELDS = Object.freeze(['id', 'handle', 'display_name', 'platform', 'city', 'follower_tier']);
const PUBLIC_PLACE_FIELDS = Object.freeze(['city', 'city_name', 'name']);
const PUBLIC_PHOTO_FIELDS = Object.freeze(['url', 'alt']);

const plain = (row) => (row && typeof row.toJSON === 'function' ? row.toJSON() : row);

/** An object cut to the listed keys it has; null for anything that is not an object. */
function pick(source, fields) {
  const from = plain(source);
  if (!from || typeof from !== 'object' || Array.isArray(from)) return null;
  const out = {};
  for (const field of fields) if (field in from && from[field] !== undefined) out[field] = from[field];
  return out;
}

function publicComment(comment) {
  return pick(comment, PUBLIC_COMMENT_FIELDS);
}

function publicPost(post) {
  const from = plain(post);
  const out = pick(from, PUBLIC_POST_FIELDS);
  if (!out) return out;
  if (Array.isArray(out.image_urls)) out.image_urls = out.image_urls.filter((u) => typeof u === 'string');
  if (Array.isArray(from.photos)) out.photos = from.photos.map((p) => pick(p, PUBLIC_PHOTO_FIELDS)).filter(Boolean);
  if ('place' in from) out.place = from.place ? pick(from.place, PUBLIC_PLACE_FIELDS) : null;
  if ('socialProfile' in from) out.socialProfile = from.socialProfile ? pick(from.socialProfile, PUBLIC_AUTHOR_FIELDS) : null;
  if (Array.isArray(from.comments)) out.comments = from.comments.map(publicComment).filter(Boolean);
  return out;
}

module.exports = {
  PUBLIC_POST_FIELDS, PUBLIC_COMMENT_FIELDS, PUBLIC_AUTHOR_FIELDS, PUBLIC_PLACE_FIELDS, PUBLIC_PHOTO_FIELDS,
  publicPost, publicComment,
};
