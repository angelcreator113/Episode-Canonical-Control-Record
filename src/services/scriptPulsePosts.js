'use strict';

/**
 * The Pulse posts the episode's script reads (Character Consistency Engine
 * step 7; the spec's blocking issue: "declare event as DRAFT → draft
 * triggers post generation → posts feed the script → script completes the
 * episode"). Both script writers read them through loadScriptContext
 * (services/episodeScriptWriterService) and storyContextBlocks.
 *
 *   scriptPulsePosts(db, episodeId, showId) → [{ handle, name, text,
 *     weight, why, released, story_order }]
 *     in story order, up to MAX:
 *       posts tied to the episode or to its event (utils/episodeEventSql),
 *         drafted early or live (story time, not release time: the spec's
 *         two clocks), and
 *       load-bearing posts by the event's host and guests not yet tied to
 *         any episode (drafted from their page, Generate Posts);
 *     never Lala's own (those come from the script), never an empty one,
 *     never one later in story time than the episode's After, and never
 *     one by someone still hidden from Lala at the episode's After
 *     (services/pulseReveals): people she meets at this event count.
 *   pulseScriptBlock(posts) → the prompt block, '' when none.
 */

const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');

const MAX = 15;

const clip = (text, n) => {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

async function scriptPulsePosts(db, episodeId, showId) {
  const { sequelize } = db;
  const lala = await require('./lalaFeedProfile').lalaProfileId(sequelize);
  const [[episode]] = await sequelize.query('SELECT episode_number FROM episodes WHERE id = :episodeId', { replacements: { episodeId } });
  const clock = require('./storyClock');
  const after = episode ? clock.orderOf(episode.episode_number, 'after_episode') : null;
  const [rows] = await sequelize.query(
    `WITH ev AS (
       SELECT we.* FROM world_events we WHERE we.id = ${EPISODE_EVENT_ID_SQL}
     ), people AS (
       SELECT COALESCE(ev.source_profile_id,
                CASE WHEN ev.canon_consequences->'automation'->>'host_profile_id' ~ '^[0-9]+$'
                     THEN (ev.canon_consequences->'automation'->>'host_profile_id')::int END) AS pid
         FROM ev
       UNION
       SELECT CASE WHEN COALESCE(g->>'profile_id', g->>'id') ~ '^[0-9]+$' THEN COALESCE(g->>'profile_id', g->>'id')::int END
         FROM ev, jsonb_array_elements(
           CASE WHEN jsonb_typeof(ev.canon_consequences->'automation'->'guest_profiles') = 'array'
                THEN ev.canon_consequences->'automation'->'guest_profiles' ELSE '[]'::jsonb END) g
     )
     SELECT fp.social_profile_id, fp.poster_handle, fp.poster_display_name, fp.content_text, fp.post_weight,
            fp.post_weight_why, fp.status, fp.story_order
       FROM feed_posts fp
      WHERE fp.deleted_at IS NULL AND fp.status IN ('draft', 'live') AND COALESCE(BTRIM(fp.content_text), '') <> ''
        AND (fp.show_id = :showId OR fp.show_id IS NULL)
        AND (CAST(:lala AS int) IS NULL OR fp.social_profile_id IS DISTINCT FROM CAST(:lala AS int))
        AND (CAST(:after AS int) IS NULL OR fp.story_order IS NULL OR fp.story_order <= CAST(:after AS int))
        AND (fp.episode_id = :episodeId
             OR fp.event_id = (SELECT id FROM ev)
             OR (fp.episode_id IS NULL AND fp.post_weight = 'load_bearing'
                 AND fp.social_profile_id IN (SELECT pid FROM people WHERE pid IS NOT NULL)))
      ORDER BY fp.story_order NULLS LAST, fp.created_at
      LIMIT ${MAX * 2}`,
    { replacements: { episodeId, showId, lala: lala ?? null, after } });
  if (!rows.length) return [];

  let hidden = new Set();
  try {
    const at = after ?? await clock.presentOrder(db, showId);
    ({ hiddenProfiles: hidden } = await require('./pulseReveals').revealsAt(db, showId, at, { lalaProfileId: lala }));
  } catch (err) {
    console.error('[ScriptPulse] could not read who is hidden from Lala (all kept):', err.message);
  }
  return rows
    .filter((r) => r.social_profile_id == null || !hidden.has(Number(r.social_profile_id)))
    .slice(0, MAX)
    .map((r) => ({
      handle: String(r.poster_handle || '').replace(/^@+/, ''),
      name: r.poster_display_name || null,
      text: clip(r.content_text, 400),
      weight: r.post_weight || null,
      why: r.post_weight_why ? clip(r.post_weight_why, 200) : null,
      released: r.status === 'live',
      story_order: r.story_order == null ? null : Number(r.story_order),
    }));
}

function pulseScriptBlock(posts) {
  if (!Array.isArray(posts) || !posts.length) return '';
  const lines = posts.map((p) => {
    const tags = [
      p.weight === 'load_bearing' ? `LOAD-BEARING${p.why ? `: ${p.why}` : ''}` : null,
      p.released ? null : 'not public yet',
    ].filter(Boolean);
    return `- @${p.handle}${tags.length ? ` (${tags.join('; ')})` : ''}: "${p.text}"`;
  });
  return `═══ THE PULSE AROUND THIS EPISODE ═══
What people posted, in story order. In the story these posts exist now; "not public yet" only means the real audience has not seen them.
${lines.join('\n')}
SCRIPT DIRECTIVE: The story reacts to every LOAD-BEARING post: Lala sees it on her phone, mentions it, or it changes how a guest treats her. A post may appear as a Phone or Pulse overlay at any beat. Quote a post's words exactly when it appears. Invent no other posts by these people.
`;
}

module.exports = { scriptPulsePosts, pulseScriptBlock, MAX };
