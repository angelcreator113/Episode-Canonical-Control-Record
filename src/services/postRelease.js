'use strict';

/**
 * Release time: the second clock (Character Consistency Engine step 6c; the
 * spec's #17 "two-clock model for posts"; Evoni, 2026-10-16: "yes
 * publish/schedule/hold").
 *
 * A post has two independent times. Story time (feed_posts.story_order)
 * places it in LalaVerse: the beat, the script, what Lala can react to; it
 * never changes here. Release time is when the real audience sees it on The
 * Pulse. Approving a draft in Review chooses one of:
 *   publish now   PUT /feed-posts/:id { status: 'live' } (unchanged); it also
 *                 clears any schedule or hold
 *   schedule      release_state 'scheduled', release_at: the release timer
 *                 publishes it when that time comes
 *   hold          release_state 'held': it waits until Evoni releases it
 *
 *   setReleaseTime(post, { mode: 'schedule'|'hold'|'clear', at, now })
 *     a ReleaseError (400/409) when the post is not a draft or the time is
 *     not in the future
 *   releaseDue(db, now)   publishes every scheduled draft whose time has
 *     come, as a release from Review does (posted at its release time; its
 *     numbers and closeness proposed; an edited AI draft teaches the voice).
 *     Returns the ids released.
 *   startScheduler(db)    releaseDue every minute; runs whatever the posting
 *     engine's switch, since Evoni chose each time herself
 */

const TICK_MS = 60 * 1000;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

class ReleaseError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'ReleaseError'; }
}

/** Sets or clears a draft's release time; returns the post. */
async function setReleaseTime(post, { mode, at = null, now = new Date() } = {}) {
  if (!post) throw new ReleaseError('Post not found.', 404);
  if (post.status !== 'draft' || post.deleted_at) throw new ReleaseError('Only a draft has a release time: a live post is already out.', 409);
  if (mode === 'clear') return post.update({ release_state: null, release_at: null });
  if (mode === 'hold') return post.update({ release_state: 'held', release_at: null });
  if (mode === 'schedule') {
    const when = at instanceof Date ? at : new Date(at);
    if (!at || Number.isNaN(when.getTime())) throw new ReleaseError('Say when it goes live: a date and a time.');
    if (when.getTime() <= now.getTime()) throw new ReleaseError('A scheduled time is in the future. To publish it now, use Release.');
    if (when.getTime() - now.getTime() > MAX_AHEAD_MS) throw new ReleaseError('Schedule it within a year.');
    return post.update({ release_state: 'scheduled', release_at: when });
  }
  throw new ReleaseError('mode is schedule, hold or clear.');
}

/** Publishes the scheduled drafts whose time has come; returns their ids. */
async function releaseDue(db, now = new Date()) {
  const { Op } = require('sequelize');
  const due = await db.FeedPost.findAll({
    where: { status: 'draft', release_state: 'scheduled', release_at: { [Op.lte]: now } },
    order: [['release_at', 'ASC']],
    limit: 50,
  });
  const released = [];
  for (const post of due) {
    try {
      const learn = post.ai_generated && Boolean(post.edited_at);
      await post.update({ status: 'live', posted_at: post.posted_at || post.release_at, release_state: null, release_at: null });
      require('./pulseNumbers').proposeLater(post);
      require('./pulseCloseness').proposeLater(post.id);
      if (learn && post.social_profile_id) {
        await require('./pulseVoices').learnFromEdit(db, { socialProfileId: post.social_profile_id, text: post.content_text, postId: post.id, by: 'scheduled release' });
      }
      released.push(post.id);
    } catch (err) {
      console.error(`[postRelease] the scheduled post ${post.id} could not be released:`, err.message);
    }
  }
  return released;
}

let timer = null;
function startScheduler(db) {
  if (timer) return timer;
  timer = setInterval(() => {
    releaseDue(db).catch((err) => console.error('[postRelease] the release timer failed:', err.message));
  }, TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { ReleaseError, setReleaseTime, releaseDue, startScheduler, stopScheduler, TICK_MS };
