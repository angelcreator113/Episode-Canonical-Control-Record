'use strict';

/**
 * Feed post status (the Feed project, step 2, 2026-10-04; docs/FEED_POSTS.md).
 *
 *   draft — written but not on the feed. A post created inside an episode
 *           (its Feed generation, a ripple reply to one, a financial post
 *           tied to it) starts here and goes live when the episode is
 *           published. Freely editable.
 *   live  — on the feed, at its posted_at in story time. It is 2009: a
 *           live post has no edit button; it can only be deleted.
 *
 * The audience reads live posts only; the episode's own views read both.
 */

const STATUSES = ['draft', 'live'];
const LOCKED_MESSAGE = 'A live post cannot be edited, only deleted (2009 rule). Edit it while it is a draft.';

const isLive = (post) => post?.status === 'live';

/** The status filter a list route applies: live by default, 'all' for both. */
function statusWhere(requested) {
  if (requested === undefined || requested === null || requested === '') return { status: 'live' };
  if (requested === 'all') return {};
  if (!STATUSES.includes(requested)) return { error: 'status must be draft, live or all' };
  return { status: requested };
}

/**
 * The episode was published: its draft posts go live at that point in
 * story time (a draft with no posted_at gets the publish moment).
 * Returns the number of posts that went live.
 */
async function publishEpisodePosts(models, episodeId, { publishedAt = new Date() } = {}) {
  const { FeedPost } = models;
  if (!FeedPost || !episodeId) return 0;
  const where = { episode_id: episodeId, status: 'draft' };
  await FeedPost.update({ posted_at: publishedAt }, { where: { ...where, posted_at: null } });
  const [count] = await FeedPost.update({ status: 'live' }, { where });
  return count;
}

module.exports = { STATUSES, LOCKED_MESSAGE, isLive, statusWhere, publishEpisodePosts };
