'use strict';

/**
 * Post moments in the episode script draft feed posts (Task #2885).
 *
 * A beat's `[UI:POST words]` line is Lala posting. Each one drafts one
 * FeedPost: status draft (it waits for approval under the Feed page's
 * Requests, Task #2749; services/feedPostStatus), the episode's own, by Lala (her social profile,
 * else the 'lala' handle the wall uses), its words exactly as
 * the script has them. Its story time is the beat's: a beat happens during
 * its episode, so the post carries episode_id with timeline_position
 * 'during_episode' (services/storyClock postOrder), as the episode's other
 * posts do. It is linked to the beat through a phone moment,
 * feed_moments.feed_post_id (services/feedMomentLink createMomentForPost),
 * so no new link is needed.
 *
 * Saving the script again drafts nothing twice: a Post line whose beat
 * already has a linked draft of this episode with the same words is found,
 * not drafted again. Nothing is published and no external service is called.
 */

const { splitScriptBeats } = require('../utils/scriptBeatLocks');
const { createMomentForPost, LinkError } = require('./feedMomentLink');

const POST_LINE = /^\s*\[UI:\s*POST\s+(.+?)\s*\]\s*$/i;

/** [{ beat, text }] for every Post line in the script, in order. */
function postMoments(script) {
  const out = [];
  for (const b of splitScriptBeats(script).beats) {
    for (const line of b.text.split('\n')) {
      const m = line.match(POST_LINE);
      if (m && m[1].trim()) out.push({ beat: b.number, text: m[1].trim() });
    }
  }
  return out;
}

async function loadEpisode(models, episodeId) {
  const { Episode } = models;
  const episode = await Episode.findOne({ where: { id: episodeId, deleted_at: null }, attributes: ['id', 'show_id', 'script_content'] });
  if (!episode) throw new LinkError(404, 'Episode not found');
  if (!episode.show_id) throw new LinkError(400, 'The episode has no show');
  return episode;
}

/** The episode's drafts already linked at a beat, by their words. */
async function linkedDrafts(models, episodeId) {
  const [rows] = await models.sequelize.query(
    `SELECT fm.beat_number, fp.id AS post_id, fp.content_text, fp.status
       FROM feed_moments fm
       JOIN feed_posts fp ON fp.id = fm.feed_post_id AND fp.deleted_at IS NULL
      WHERE fm.episode_id = :episodeId AND fm.deleted_at IS NULL AND fp.episode_id = :episodeId`,
    { replacements: { episodeId } });
  const byKey = new Map();
  for (const r of rows) byKey.set(`${r.beat_number}|${String(r.content_text || '').trim()}`, r);
  return byKey;
}

/** Every Post moment with its draft, if it has one; drafts nothing. */
async function getScriptPostDrafts(models, episodeId) {
  const episode = await loadEpisode(models, episodeId);
  const linked = await linkedDrafts(models, episodeId);
  return postMoments(episode.script_content).map((p) => {
    const row = linked.get(`${p.beat}|${p.text}`);
    return { ...p, post_id: row?.post_id || null, status: row?.status || null };
  });
}

// Lala's own profile: social profiles are not per show, so it is the one
// whose handle or display name is Lala; else the wall's 'lala' handle.
async function lalaProfile(sequelize) {
  try {
    const [rows] = await sequelize.query(
      `SELECT id, handle, display_name FROM social_profiles
        WHERE deleted_at IS NULL AND (LOWER(handle) = 'lala' OR LOWER(display_name) = 'lala')
        ORDER BY id LIMIT 1`);
    if (rows?.[0]) return rows[0];
  } catch (err) {
    console.error('[ScriptPostDrafts] Lala profile read failed (the wall handle is used):', err.message);
  }
  return { id: null, handle: 'lala', display_name: null };
}

/** Draft a post for every Post moment that has none yet; returns them all. */
async function draftScriptPosts(models, episodeId) {
  const { FeedPost } = models;
  const episode = await loadEpisode(models, episodeId);
  const moments = postMoments(episode.script_content);
  if (!moments.length) return [];
  const linked = await linkedDrafts(models, episodeId);
  const lala = await lalaProfile(models.sequelize);
  const out = [];
  for (const p of moments) {
    const key = `${p.beat}|${p.text}`;
    const row = linked.get(key);
    if (row) { out.push({ ...p, post_id: row.post_id, status: row.status, created: false }); continue; }
    const post = await FeedPost.create({
      show_id: episode.show_id,
      episode_id: episode.id,
      social_profile_id: lala.id || null,
      poster_handle: String(lala.handle || 'lala').replace(/^@/, ''),
      poster_display_name: lala.display_name || null,
      poster_platform: 'lalaverse',
      post_type: 'post',
      content_text: p.text,
      likes: 0, comments_count: 0, shares: 0, sample_comments: [],
      posted_at: null,
      timeline_position: 'during_episode',
      story_order: null,
      narrative_function: null,
      ai_generated: false,
      status: 'draft',
      sort_order: 0,
    });
    await createMomentForPost(models, { showId: episode.show_id, episodeId: episode.id, beatNumber: p.beat, feedPostId: post.id });
    linked.set(key, { post_id: post.id, status: 'draft' });
    out.push({ ...p, post_id: post.id, status: 'draft', created: true });
  }
  return out;
}

module.exports = { postMoments, getScriptPostDrafts, draftScriptPosts };
