/**
 * The event library's constants and the Season page's three views of it
 * (Evoni's Producer Mode restructure, step 2, 2026-10-25). The constants
 * moved here from WorldAdmin.jsx with the library
 * (components/Show/EventLibrary); the views are pure, over what the Season
 * page already loads (the roadmap, the show's events and episodes).
 */
import { calcEventDifficulty, eventDifficultyLabel } from '../utils/eventReadiness';
import { allSlots } from './seasonPage';

// Maps the Feed event templates grid's own label-word `category` values to
// the ten settled world_events.category values (Evoni's taxonomy ruling,
// 2026-09-22, docs/EVENT_EPISODE_FLOW.md §8(k)/(l)). Mapped by what each
// template actually is, not by generic label-matching — 'lifestyle' maps
// to 'travel_destination' because the only template using it (Virtual
// Travel Festival) is a travel concept, not a catch-all.
export const TEMPLATE_CATEGORY_MAP = {
  creator_economy: 'creator_brand',
  fashion: 'fashion',
  beauty: 'beauty_wellness',
  creative: 'arts_entertainment',
  music: 'arts_entertainment',
  lifestyle: 'travel_destination',
};
export const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
export const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];

export const EMPTY_EVENT = {
  name: '', event_type: 'invite', host: '', host_brand: '', description: '',
  prestige: 5, cost_coins: 100, strictness: 5,
  deadline_type: 'medium', deadline_minutes: null,
  dress_code: '', dress_code_keywords: [], location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
  is_paid: 'no', payment_amount: 0, career_tier: 1,
  career_milestone: '', fail_consequence: '', success_unlock: '',
  // Rewards: what Lala wins for completing this event. Stat deltas
  // (coins/reputation/brand_trust/influence) feed the future
  // episode-completion delta logic; outcomes is a free-text list
  // surfaced to the writer for narrative beats.
  rewards: { coins: 0, reputation: 0, brand_trust: 0, influence: 0, outcomes: [] },
  // Requirements (access requirements): soft gates the next-event
  // suggester reads — the GET /world/:showId/suggest-events route in
  // src/routes/careerGoals.js, its "Check requirements met" block (around
  // line 621-628). Any unmet reputation_min, brand_trust_min or coins_min
  // docks the event's suggestion score by 5 and flags it "requirements
  // not met"; the event is still suggested.
  requirements: { reputation_min: 0, brand_trust_min: 0, coins_min: 0 },
  scene_set_id: null,
  venue_name: '', venue_address: '', event_date: '', event_time: '',
  theme: '', color_palette: [], mood: '', floral_style: '', border_style: '',
  // Narrative chain — links this event to the one before it and what
  // future events it plants. Used by the next-event suggester (chain
  // continuation +30, seed-match +18) and the brief snapshot.
  parent_event_id: null, chain_position: null, chain_reason: '',
  seeds_future_events: [],
  // Production overlays — array of overlay names (or type_keys) that the
  // episode generator auto-places on the timeline. Defaults to the four
  // canonical screens; per-event customization is what this form enables.
  required_ui_overlays: ['MailPanel', 'InviteLetterOverlay', 'WardrobeList', 'CareerList'],
};

// Fields the Edit details modal's 💾 Save and Mark Ready may send — only
// when their value differs from what the modal opened with (Task #1786).
export const MODAL_SAVEABLE_FIELDS = [
  'name', 'event_type', 'host', 'host_brand', 'description', 'prestige', 'cost_coins', 'strictness',
  'deadline_type', 'dress_code', 'dress_code_keywords', 'location_hint', 'narrative_stakes',
  'career_milestone', 'career_tier', 'fail_consequence', 'success_unlock', 'is_paid', 'is_free',
  'payment_amount', 'browse_pool_bias', 'scene_set_id', 'venue_name', 'venue_address', 'event_date',
  'event_time', 'theme', 'mood', 'color_palette', 'floral_style', 'border_style',
];

// ─── DIFFICULTY SCORING ───
// calcDifficulty/difficultyLabel extracted to ../utils/eventReadiness.js
// as calcEventDifficulty/eventDifficultyLabel (shared with EventPackagePage).
export const calcDifficulty = calcEventDifficulty;
export const difficultyLabel = eventDifficultyLabel;


/**
 * The events a view shows, from the library's own list: `scope` null is
 * every event; otherwise `scope.ids`, in that order (ids the list does not
 * hold are skipped).
 */
export function scopeEvents(events, scope) {
  if (!scope) return events || [];
  const byId = new Map((events || []).map((e) => [e.id, e]));
  return (scope.ids || []).map((id) => byId.get(id)).filter(Boolean);
}

/** The Events tab's filter (`?show=`): In this season · Not placed yet · All. */
export const EVENT_SHOWS = [
  { key: 'in-season', label: 'In this season' },
  { key: 'unplaced', label: 'Not placed yet' },
  { key: 'all', label: 'All' },
];
export const EVENT_SHOW_DEFAULT = 'in-season';
export const EVENT_SHOW_STORAGE_KEY = 'szn-events-show';
export const isEventShow = (v) => EVENT_SHOWS.some((s) => s.key === v);
/** The filter from the URL, else the one remembered, else In this season. */
export const eventShowFrom = (urlValue, remembered = null) => {
  if (isEventShow(urlValue)) return urlValue;
  if (isEventShow(remembered)) return remembered;
  return EVENT_SHOW_DEFAULT;
};

/**
 * The three views. In this season: in slot order, each slot's event and
 * the event its episode is using, then the events used by this season's
 * other episodes (by season_number); each with its slot when it has one. Not placed yet: the
 * events in no slot of this season and used by no episode. All: every
 * event. `pencillable` is the roadmap's available_events (live, unused,
 * draft or ready): the ones a slot can take.
 */
export function seasonEventViews({ roadmap = null, events = [], episodes = [], seasonNumber = null } = {}) {
  const inSeason = [];
  const seen = new Set();
  const add = (id, slot) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    inSeason.push({ id, slot: slot || null });
  };
  const slots = allSlots(roadmap);
  const usedBy = new Map();
  for (const ev of events) if (ev.used_in_episode_id && !usedBy.has(ev.used_in_episode_id)) usedBy.set(ev.used_in_episode_id, ev.id);
  for (const slot of slots) {
    if (slot.event?.id) add(slot.event.id, slot);
    if (slot.episode?.id && usedBy.has(slot.episode.id)) add(usedBy.get(slot.episode.id), slot);
  }
  const slottedEpisodes = new Set(slots.map((s) => s.episode?.id).filter(Boolean));
  if (seasonNumber != null) {
    const seasonEpisodes = new Set(episodes
      .filter((ep) => Number(ep.season_number) === Number(seasonNumber) && !slottedEpisodes.has(ep.id))
      .map((ep) => ep.id));
    for (const ev of events) if (ev.used_in_episode_id && seasonEpisodes.has(ev.used_in_episode_id)) add(ev.id, null);
  }
  const unplaced = events.filter((ev) => !seen.has(ev.id) && !ev.used_in_episode_id).map((ev) => ev.id);
  const pencillable = new Set((roadmap?.available_events || []).map((e) => e.id));
  return { inSeason, unplaced, all: events.map((ev) => ev.id), pencillable };
}
