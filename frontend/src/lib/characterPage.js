/**
 * The character page (Evoni's STUDIO BY SABLE mock, 2026-10-08). Pure:
 * pages/CharacterProfilePage renders.
 *
 * A registry character shows up in the show through its feed profile
 * (registry_characters.feed_profile_id): the events it hosts or is a
 * guest of, their episodes and Lala's goals, its home place, and its posts.
 * GET /api/v1/cast/characters/:id/appearances (routes/castRoutes.js)
 * returns those; this turns them into the page's rows and sentences.
 */

export const DEPTH_STEPS = [
  { key: 'sparked', label: 'Sparked' },
  { key: 'breathing', label: 'Breathing' },
  { key: 'active', label: 'Active' },
  { key: 'alive', label: 'Alive' },
];

/** How far along the four depth levels a character is (index), and the next one. */
export function depthOf(level) {
  const i = Math.max(0, DEPTH_STEPS.findIndex((s) => s.key === level));
  return { index: i, step: DEPTH_STEPS[i], next: DEPTH_STEPS[i + 1] || null };
}

const CITY_LABELS = {
  dazzle_district: 'Dazzle District', radiance_row: 'Radiance Row', echo_park: 'Echo Park',
  ascent_tower: 'Ascent Tower', maverick_harbor: 'Maverick Harbor',
};
export const cityLabel = (city) => CITY_LABELS[city] || (city ? String(city).replace(/_/g, ' ') : null);

const words = (s) => {
  const t = String(s || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
};
export const archetypeOf = (profile) => words(profile?.society_archetype || profile?.archetype);

const LALA_TIES = {
  direct: 'Friends with Lala',
  aware: 'Knows of Lala',
  one_sided: 'Follows Lala',
  mutual_unaware: "In Lala's circles",
  competitive: "Lala's rival",
  justawoman: 'JustAWoman',
};
export const lalaTie = (rel) => LALA_TIES[rel] || null;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "Where they show up": one row per event, place, episode, goal and the
 * feed, each with where it opens. Events come first, as in the mock.
 */
export function showUpRows(appearances, feedProfile) {
  if (!appearances?.linked) return [];
  const rows = [];
  for (const ev of appearances.events || []) {
    rows.push({
      kind: 'event', label: 'Event',
      title: `${ev.role === 'host' ? 'Organizes' : 'Guest at'} ${ev.name}`,
      sub: [ev.event_date, ev.venue_name].filter(Boolean).join(' · ') || null,
      to: ev.show_id ? `/shows/${ev.show_id}/events/${ev.id}` : null,
    });
  }
  const place = appearances.place;
  if (place) {
    rows.push({
      kind: 'place', label: 'Place', title: `Lives at ${place.name}`,
      sub: [plural(place.residents || 0, 'resident'), plural(place.scene_sets || 0, 'scene set')].join(' · '),
      to: '/universe?tab=world&sub=locations',
    });
  }
  for (const ep of appearances.episodes || []) {
    rows.push({
      kind: 'episode', label: 'Episode', title: `In Episode ${ep.episode_number ?? '?'}`,
      sub: ep.title || null, to: `/episodes/${ep.id}`,
    });
  }
  for (const ev of appearances.events || []) {
    for (const g of ev.goals || []) {
      rows.push({
        kind: 'goal', label: "Lala's goal", title: g.label, sub: 'From the event deal',
        to: ev.episode ? `/episodes/${ev.episode.id}` : (ev.show_id ? `/shows/${ev.show_id}/events/${ev.id}` : null),
      });
    }
  }
  const feed = appearances.feed;
  if (feed) {
    rows.push({
      kind: 'feed', label: 'Feed', title: lalaTie(feed.lala_relationship) || 'On the feed',
      sub: plural(feed.posts || 0, 'post'),
      to: feedProfile?.id ? `/feed?profile=${feedProfile.id}&layer=${feedProfile.feed_layer || 'lalaverse'}` : '/feed',
    });
  }
  return rows;
}

/** "With Lala": what is between them, from the first event they share, else the feed tie. */
export function withLala(appearances) {
  const events = appearances?.events || [];
  const hosted = events.find((e) => e.role === 'host');
  const ev = hosted || events[0];
  if (ev) {
    let line = ev.role === 'host' ? `Invited Lala to ${ev.name}` : `At ${ev.name} with Lala`;
    if (ev.role === 'host' && ev.is_paid && ev.payment_amount > 0) line += ` and is paying her ${ev.payment_amount} coins`;
    line += '.';
    const goal = (ev.goals || [])[0];
    return goal ? `${line} Lala wants to ${goal.label.charAt(0).toLowerCase()}${goal.label.slice(1)}.` : line;
  }
  const tie = lalaTie(appearances?.feed?.lala_relationship);
  return tie ? `${tie}.` : null;
}

const parse = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (err) { console.error('[characterPage] voice_signature is not JSON:', err); return null; }
};
const first = (v) => (Array.isArray(v) ? v[0] : v);
const text = (v) => {
  const x = first(v);
  if (!x) return null;
  if (typeof x === 'string') return x.trim() || null;
  return x.text || x.caption || x.content || null;
};

/** "Their voice": a sample post, the habit, a phrase, and what they never say outright. */
export function voiceOf(character, feedProfile) {
  const vs = parse(character?.voice_signature) || {};
  const voice = {
    sample: text(feedProfile?.sample_captions) || text(feedProfile?.pinned_post) || null,
    habit: feedProfile?.posting_voice || vs.speech_pattern || null,
    phrase: text(vs.catchphrases) || vs.vocabulary_tone || null,
    neverSays: vs.internal_monologue_style || null,
  };
  return Object.values(voice).some(Boolean) ? voice : null;
}
