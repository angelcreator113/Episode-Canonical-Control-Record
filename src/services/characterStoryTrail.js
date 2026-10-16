'use strict';

/**
 * A character's story trail (Evoni, 2026-10-16): what they posted on The
 * Pulse, and the short stories and book chapters they are in.
 *
 *   storyTrailOf(sequelize, character)
 *     → { posts, post_counts, stories, chapters }
 *     posts      their Feed profile's latest posts (live and drafts, marked)
 *     stories    episode stories of an episode they host or attend
 *                (services/characterEvents), told from their point of view
 *                (pov_character = their key), or naming them
 *     chapters   book chapters tied to such an episode
 *                (storyteller_chapters.episode_id), or naming them
 *
 * "Naming them" is a whole-word, case-insensitive match of their display or
 * real name (at least 3 letters) in the text. episode_id on chapters arrives
 * with migration 20261015200000; before it runs, chapters are found by name
 * only.
 */

const LIMIT = { posts: 8, stories: 10, chapters: 12 };

/** A Postgres word-boundary regex for their names, or null when none is usable. */
function nameRegex(character) {
  const names = [character?.display_name, character?.selected_name]
    .filter((n) => typeof n === 'string')
    .map((n) => n.replace(/^@/, '').trim())
    .filter((n) => n.length >= 3);
  const unique = [...new Set(names.map((n) => n.toLowerCase()))];
  if (unique.length === 0) return null;
  const escaped = unique.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `\\m(${escaped.join('|')})\\M`;
}

async function hasColumn(sequelize, table, column) {
  const [rows] = await sequelize.query(
    'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column',
    { replacements: { table, column } });
  return rows.length > 0;
}

async function storyTrailOf(sequelize, character) {
  const profileId = character?.feed_profile_id ?? null;
  const nameRe = nameRegex(character);
  const key = character?.character_key || null;

  let posts = [];
  let postCounts = { live: 0, draft: 0 };
  let episodeIds = [];
  if (profileId != null) {
    const [rows] = await sequelize.query(`
      SELECT fp.id, fp.content_text, fp.status, fp.posted_at, fp.created_at, e.episode_number
        FROM feed_posts fp
        LEFT JOIN episodes e ON e.id = fp.episode_id AND e.deleted_at IS NULL
       WHERE fp.social_profile_id = :pid AND fp.deleted_at IS NULL
       ORDER BY COALESCE(fp.posted_at, fp.created_at) DESC
       LIMIT ${LIMIT.posts}`, { replacements: { pid: profileId } });
    posts = rows.map((r) => ({
      id: r.id, text: r.content_text || '', status: r.status, at: r.posted_at || r.created_at, episode_number: r.episode_number ?? null,
    }));
    const [counts] = await sequelize.query(
      `SELECT status, COUNT(*)::int AS n FROM feed_posts
        WHERE social_profile_id = :pid AND deleted_at IS NULL GROUP BY status`, { replacements: { pid: profileId } });
    for (const c of counts) {
      if (c.status === 'draft') postCounts.draft += c.n;
      else postCounts.live += c.n;
    }
    const events = await require('./characterEvents').eventsForProfile(sequelize, profileId);
    episodeIds = [...new Set(events.map((ev) => ev.episode_id).filter(Boolean))];
  }

  const storyWhere = [];
  const storyRep = {};
  if (episodeIds.length) { storyWhere.push('s.episode_id IN (:episodeIds)'); storyRep.episodeIds = episodeIds; }
  if (key) { storyWhere.push('LOWER(s.pov_character) = LOWER(:key)'); storyRep.key = key; }
  if (nameRe) { storyWhere.push('s.content ~* :nameRe'); storyRep.nameRe = nameRe; }
  let stories = [];
  if (storyWhere.length) {
    const [rows] = await sequelize.query(`
      SELECT s.id, s.title, s.format, s.status, s.word_count, s.show_id, e.episode_number
        FROM stories s
        LEFT JOIN episodes e ON e.id = s.episode_id AND e.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND (${storyWhere.join(' OR ')})
       ORDER BY e.episode_number NULLS LAST, s.created_at
       LIMIT ${LIMIT.stories}`, { replacements: storyRep });
    stories = rows.map((r) => ({
      id: r.id, title: r.title, format: r.format, status: r.status, word_count: r.word_count || 0,
      show_id: r.show_id, episode_number: r.episode_number ?? null,
    }));
  }

  const chapterWhere = [];
  const chapterRep = {};
  if (episodeIds.length && await hasColumn(sequelize, 'storyteller_chapters', 'episode_id')) {
    chapterWhere.push('c.episode_id IN (:episodeIds)'); chapterRep.episodeIds = episodeIds;
  }
  if (nameRe) { chapterWhere.push('c.draft_prose ~* :nameRe'); chapterRep.nameRe = nameRe; }
  let chapters = [];
  if (chapterWhere.length) {
    const [rows] = await sequelize.query(`
      SELECT c.id, c.book_id, c.title, c.chapter_number, b.title AS book_title,
             (COALESCE(BTRIM(c.draft_prose), '') <> '') AS written
        FROM storyteller_chapters c
        JOIN storyteller_books b ON b.id = c.book_id AND b.deleted_at IS NULL
       WHERE c.deleted_at IS NULL AND (${chapterWhere.join(' OR ')})
       ORDER BY b.title, COALESCE(c.sort_order, c.chapter_number, 0)
       LIMIT ${LIMIT.chapters}`, { replacements: chapterRep });
    chapters = rows.map((r) => ({
      id: r.id, book_id: r.book_id, title: r.title, chapter_number: r.chapter_number, book_title: r.book_title, written: Boolean(r.written),
    }));
  }

  return { posts, post_counts: postCounts, stories, chapters };
}

module.exports = { storyTrailOf, nameRegex };
