'use strict';

/**
 * A beat points at a post (the Feed project, step 3, 2026-10-04;
 * docs/FEED_POSTS.md). feed_moments.feed_post_id names the post a phone
 * moment shows; the screens draw that post live, so the beat and the feed
 * can never disagree.
 *
 * Rules: the post belongs to the moment's show; a draft post belongs to
 * the moment's episode (it goes live with it), a live post may be any of
 * the show's. Unlinking (null) always works.
 */

class LinkError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** The attributes a screen needs from a linked post. */
const POST_ATTRIBUTES = ['id', 'status', 'poster_handle', 'poster_display_name', 'poster_platform',
  'post_type', 'content_text', 'image_url', 'image_description', 'likes', 'comments_count',
  'shares', 'sample_comments', 'posted_at', 'episode_id', 'narrative_function'];

async function linkMomentToPost(models, { showId, momentId, feedPostId }) {
  const { FeedMoment, FeedPost } = models;
  if (!FeedMoment || !FeedPost) throw new LinkError(500, 'Feed models not available');
  const moment = await FeedMoment.findOne({ where: { id: momentId, show_id: showId } });
  if (!moment) throw new LinkError(404, 'Moment not found');

  if (feedPostId === null || feedPostId === undefined || feedPostId === '') {
    await moment.update({ feed_post_id: null });
    return { moment, post: null };
  }

  const post = await FeedPost.findOne({ where: { id: feedPostId }, attributes: POST_ATTRIBUTES });
  if (!post) throw new LinkError(404, 'Post not found');
  const postShow = await FeedPost.findOne({ where: { id: feedPostId }, attributes: ['show_id'] });
  if (String(postShow.show_id) !== String(showId)) throw new LinkError(400, 'The post belongs to another show');
  if (post.status === 'draft' && String(post.episode_id) !== String(moment.episode_id)) {
    throw new LinkError(400, 'A draft post can only be shown by a beat of its own episode');
  }

  await moment.update({ feed_post_id: post.id });
  return { moment, post };
}

/**
 * Put a post at a beat (2026-10-04, picked from the Social Media wall):
 * creates the episode's phone moment at that beat, pointing at the post.
 * The episode must be the show's; the beat 1-14; the post follows the
 * link rules above (the show's; a draft only in its own episode).
 */
async function createMomentForPost(models, { showId, episodeId, beatNumber, feedPostId }) {
  const { FeedMoment, FeedPost, Episode } = models;
  if (!FeedMoment || !FeedPost || !Episode) throw new LinkError(500, 'Feed models not available');
  const beat = Number(beatNumber);
  if (!Number.isInteger(beat) || beat < 1 || beat > 14) throw new LinkError(400, 'beat_number must be 1-14');
  if (!feedPostId) throw new LinkError(400, 'feed_post_id is required');
  const episode = await Episode.findOne({ where: { id: episodeId, show_id: showId }, attributes: ['id'] });
  if (!episode) throw new LinkError(404, 'Episode not found in this show');
  const post = await FeedPost.findOne({ where: { id: feedPostId }, attributes: [...POST_ATTRIBUTES, 'show_id'] });
  if (!post) throw new LinkError(404, 'Post not found');
  if (String(post.show_id) !== String(showId)) throw new LinkError(400, 'The post belongs to another show');
  if (post.status === 'draft' && String(post.episode_id) !== String(episodeId)) {
    throw new LinkError(400, 'A draft post can only be shown by a beat of its own episode');
  }
  const existing = await FeedMoment.findOne({ where: { episode_id: episodeId, beat_number: beat, feed_post_id: post.id } });
  if (existing) return { moment: existing, post, created: false };
  const sortOrder = await FeedMoment.count({ where: { episode_id: episodeId, beat_number: beat } });
  const moment = await FeedMoment.create({
    show_id: showId, episode_id: episodeId, beat_number: beat,
    phone_screen_type: 'post', trigger_handle: post.poster_handle || null,
    feed_post_id: post.id, sort_order: sortOrder,
  });
  return { moment, post, created: true };
}

module.exports = { linkMomentToPost, createMomentForPost, LinkError, POST_ATTRIBUTES };
