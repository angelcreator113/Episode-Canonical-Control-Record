'use strict';

/**
 * Feed post status (the Feed project, step 2, 2026-10-04; docs/FEED_POSTS.md).
 *
 *   draft — written but not on the feed. A post created inside an episode
 *           (its Feed generation, a ripple reply to one, a financial post
 *           tied to it) starts here and waits for approval (Requests on the Feed
 *           page; Evoni, 2026-10-11, Task #2749); publishing the episode no
 *           longer puts it live. Freely editable.
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

module.exports = { STATUSES, LOCKED_MESSAGE, isLive, statusWhere };
