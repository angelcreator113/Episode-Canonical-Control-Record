'use strict';

/**
 * Why a character's posts are or aren't on The Pulse (Evoni, 2026-10-18:
 * "when a character has a voice and even makes post they are not showing up
 * on the pulse"). The Pulse shows a show's live posts at the present story
 * moment (GET /feed-posts?status=live&at=present), so a post is missing when
 *   it is still a draft     waiting in Review (character-page posts always
 *                           are), scheduled for a release time, or held
 *   it is on another show   their show is their registry's (characterFacts)
 * Whether Lala has met them does not matter (Evoni, 2026-10-18: "it shouldnt
 * matter if lala has met them they should still be building themselves on
 * the pulse").
 *   they cannot post        no Feed profile, or no Voice Profile
 *
 *   visibilityFor(db, { characterId })  →
 *     { profile, show_id, live_count, draft_count, scheduled: [{ id, release_at }],
 *       held_count, other_shows, no_voice, reasons }
 *     reasons: plain sentences, one per thing that keeps posts off The Pulse.
 *     A VisibilityError (404) when the character does not exist.
 */

class VisibilityError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function visibilityFor(db, { characterId }) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new VisibilityError(404, 'Character not found');
  const name = character.selected_name || character.display_name;
  const out = {
    profile: null, show_id: null, live_count: 0, draft_count: 0, scheduled: [], held_count: 0,
    other_shows: [], no_voice: false, reasons: [],
  };

  if (!character.feed_profile_id) {
    out.no_voice = true;
    out.reasons.push(`${name} has no Pulse profile, so they have no account on The Pulse to post from.`);
    return out;
  }
  const [[profile]] = await db.sequelize.query(
    'SELECT id, handle, display_name FROM social_profiles WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: character.feed_profile_id } });
  if (!profile) {
    out.no_voice = true;
    out.reasons.push(`${name}'s Pulse profile is gone, so they have no account on The Pulse.`);
    return out;
  }
  out.profile = { id: profile.id, handle: profile.handle, display_name: profile.display_name };

  const [[voice]] = await db.sequelize.query(
    'SELECT id FROM pulse_voices WHERE registry_character_id = :id AND deleted_at IS NULL LIMIT 1',
    { replacements: { id: character.id } });
  out.no_voice = !voice;
  if (!voice) out.reasons.push(`${name} has no Voice Profile yet, so nothing drafts posts for them automatically.`);

  out.show_id = await require('./characterFacts').showIdFor(db, character, profile);

  const [rows] = await db.sequelize.query(
    `SELECT show_id, status, release_state, COUNT(*)::int AS n
       FROM feed_posts WHERE social_profile_id = :pid AND deleted_at IS NULL
      GROUP BY show_id, status, release_state`,
    { replacements: { pid: profile.id } });
  const others = new Set();
  for (const r of rows) {
    if (out.show_id && r.show_id !== out.show_id) { others.add(r.show_id); continue; }
    if (r.status === 'live') out.live_count += r.n;
    else if (r.release_state === 'held') out.held_count += r.n;
    else if (r.release_state !== 'scheduled') out.draft_count += r.n;
  }
  out.other_shows = [...others].filter(Boolean);
  const [scheduled] = await db.sequelize.query(
    `SELECT id, release_at FROM feed_posts
      WHERE social_profile_id = :pid AND deleted_at IS NULL AND status = 'draft' AND release_state = 'scheduled'
        ${out.show_id ? 'AND show_id = :show' : ''}
      ORDER BY release_at ASC NULLS LAST LIMIT 10`,
    { replacements: { pid: profile.id, show: out.show_id } });
  out.scheduled = scheduled.map((s) => ({ id: s.id, release_at: s.release_at }));

  if (!out.show_id) {
    out.reasons.push(`${name}'s registry belongs to no show, so The Pulse does not know which feed their posts go on.`);
    return out;
  }

  if (out.draft_count) out.reasons.push(`${out.draft_count} ${out.draft_count === 1 ? 'post is' : 'posts are'} waiting in Review; a draft shows on The Pulse once you approve it.`);
  if (out.scheduled.length) out.reasons.push(`${out.scheduled.length} ${out.scheduled.length === 1 ? 'post is' : 'posts are'} scheduled and will appear at the release time.`);
  if (out.held_count) out.reasons.push(`${out.held_count} ${out.held_count === 1 ? 'post is' : 'posts are'} held until you release ${out.held_count === 1 ? 'it' : 'them'}.`);
  if (out.other_shows.length) out.reasons.push(`Some of their posts are on another show's feed, not the one The Pulse shows for ${name}.`);
  return out;
}

module.exports = { visibilityFor, VisibilityError };
