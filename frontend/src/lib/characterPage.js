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

const filled = (v) => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(filled);
  return !!v;
};

/**
 * How alive the character is, from what they have: the saved level, or what
 * their fields reach, whichever is further (the server's calculateDepthLevel
 * rules). Most feed people never had a level saved, so they read "Sparked"
 * with a feed profile and a voice.
 */
export function depthLevelOf(character) {
  const c = { ...(character || {}) };
  c.prose_overview = c.prose_overview || c.description;
  const alive = ['want_architecture', 'wound', 'the_mask', 'triggers', 'blind_spot', 'dilemma', 'deep_profile', 'prose_overview'];
  let reached = 'sparked';
  if (alive.every((f) => filled(c[f]))) reached = 'alive';
  else if (filled(c.feed_profile_id) || filled(c.living_state)) reached = 'active';
  else if (filled(c.deep_profile) || filled(c.wound) || filled(c.want_architecture)) reached = 'breathing';
  const at = (k) => DEPTH_STEPS.findIndex((s) => s.key === k);
  return at(c.depth_level) > at(reached) ? c.depth_level : reached;
}

const CITY_LABELS = {
  dazzle_district: 'Dazzle District', radiance_row: 'Radiance Row', echo_park: 'Echo Park',
  ascent_tower: 'Ascent Tower', maverick_harbor: 'Maverick Harbor',
};
export const cityLabel = (city) => CITY_LABELS[city] || (city ? String(city).replace(/_/g, ' ') : null);

/**
 * Their city, one answer (Evoni, 2026-10-16: one meaning per field). The
 * feed profile's city and the character's current_city are two columns that
 * are never synced; the page showed only the feed's. Now it shows the feed's
 * city, else the character's, and `differs` names both when they disagree.
 * 'outside_lalaverse' (registryDemographics) is not a city.
 */
export function cityOf(character, feedProfile) {
  const feed = cityLabel(feedProfile?.city);
  const own = character?.current_city && character.current_city !== 'outside_lalaverse' ? cityLabel(character.current_city) : null;
  const differs = feed && own && feed.toLowerCase() !== own.toLowerCase() ? { feed, own } : null;
  return { label: feed || own || null, differs };
}

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

const clip = (text, n) => {
  const t = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** What an event is for, in one line: its description, theme and dress code. */
export function eventPurpose(ev) {
  const parts = [
    clip(ev?.description, 160),
    ev?.theme && `Theme: ${clip(ev.theme, 60)}`,
    ev?.dress_code && `Dress code: ${clip(ev.dress_code, 60)}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * "Where they show up": one row per event, place, episode, goal and the
 * feed, each with where it opens. Events come first, as in the mock.
 */
export function showUpRows(appearances, feedProfile) {
  if (!appearances?.linked) return [];
  const rows = [];
  for (const ev of appearances.events || []) {
    rows.push({
      kind: 'event', label: ev.role === 'host' ? 'Hosting' : 'Event',
      title: `${ev.role === 'host' ? 'Organizes' : 'Guest at'} ${ev.name}`,
      sub: [ev.event_date, ev.venue_name].filter(Boolean).join(' · ') || null,
      // What the event is for, and how to come dressed.
      detail: eventPurpose(ev),
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
      // Its profile where Feed profiles are made, World Studio's Feed tab (Task #2761).
      to: feedProfile?.id ? `/world-studio?tab=feed&layer=${feedProfile.feed_layer === 'real_world' ? 'real_world' : 'lalaverse'}&profile=${feedProfile.id}` : '/pulse',
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

/**
 * "Their voice": a sample post, the habit, a phrase, how they sound inside,
 * and what they never say outright. "Never says" is the deep profile's
 * speech dimension; internal_monologue_style is how they think, so it is
 * the inner voice (it used to be shown as "never says").
 */
export function voiceOf(character, feedProfile) {
  const vs = parse(character?.voice_signature) || {};
  const dp = character?.deep_profile || {};
  const speech = dp.speech_and_silence || dp.speech_silence;
  const voice = {
    sample: text(feedProfile?.sample_captions) || text(feedProfile?.pinned_post) || null,
    habit: feedProfile?.posting_voice || vs.speech_pattern || null,
    phrase: text(vs.catchphrases) || vs.vocabulary_tone || null,
    innerVoice: vs.internal_monologue_style || null,
    // The older deep profile has a "never say directly" note; the v2 one
    // (inner-life generation) is one text for the whole speech dimension.
    neverSays: (speech && typeof speech === 'object' ? speech.what_they_never_say_directly : text(speech)) || null,
  };
  return Object.values(voice).some(Boolean) ? voice : null;
}
