// Sample answers for the Episode page's request baseline (not a test file itself).
import { normalizeUrl } from '../test/requestLedger';

// Two episodes: one fully linked (an event with a venue set, a brief that
// names its source event, a parent event and the profile it started from),
// and one bare (no event, a brief with no links).

export const SHOW_ID = 'show-1';
export const EP_FULL = '11111111-1111-4111-8111-111111111111';
export const EP_BARE = '22222222-2222-4222-8222-222222222222';
export const EVENT_ID = '33333333-3333-4333-8333-333333333333';
export const PARENT_EVENT_ID = '44444444-4444-4444-8444-444444444444';
export const SET_ID = '55555555-5555-4555-8555-555555555555';
export const PROFILE_ID = 42;

export const ADMIN = { name: 'Evoni', email: 'e@x.dev', groups: ['admin'] };
export const EDITOR = { name: 'Editor', email: 'ed@x.dev', groups: ['editor'] };

const SHOW = { id: SHOW_ID, name: 'Styling Adventures with Lala' };

const episode = (id, number, title) => ({
  id,
  title,
  show_id: SHOW_ID,
  show: SHOW,
  status: 'draft',
  episode_number: number,
  season_number: 1,
  script_content: '(Beat 1) Lala reads the invitation.',
  script_locked_beats: [],
  season_context: { label: `S1 · E${number}` },
  evaluation_status: null,
});

const EVENT = {
  id: EVENT_ID,
  show_id: SHOW_ID,
  name: 'The Honey Table',
  status: 'used',
  prestige: 6,
  venue_name: 'Maison Miel',
  scene_set_id: SET_ID,
  invitation_asset_id: 'asset-invite',
  used_in_episode_id: EP_FULL,
  canon_consequences: { automation: {} },
  link: { anchor: true },
};
const PARENT_EVENT = { id: PARENT_EVENT_ID, show_id: SHOW_ID, name: 'Old Gala', status: 'used' };

const BRIEF_FULL = {
  id: 'brief-1',
  episode_id: EP_FULL,
  event_id: EVENT_ID,
  episode_archetype: 'Trial',
  designed_intent: 'slay',
  allowed_outcomes: ['slay', 'pass'],
  arc_number: 1,
  position_in_arc: 1,
  narrative_purpose: 'Lala proves she belongs.',
  forward_hook: 'A brand wants her.',
  narrative_chain: { parent_event_id: PARENT_EVENT_ID, seeds_future_events: [] },
  canon_consequences: { automation: { started_from_profile_id: PROFILE_ID } },
};
const BRIEF_BARE = { id: 'brief-2', episode_id: EP_BARE, event_id: null, narrative_chain: {}, canon_consequences: {} };

/**
 * Answers the mocked client by URL for one episode. The keys below are
 * normalized URLs (the path, then the query sorted by key), as the ledger
 * spells them. An address with no
 * answer here is noted in `unanswered` and answered with an empty body, so
 * the page carries on and the test can say which read was new.
 */
export function episodeAnswers(episodeId) {
  const full = episodeId === EP_FULL;
  const ep = full ? episode(EP_FULL, 1, 'Dressed for the Opportunity') : episode(EP_BARE, 2, 'A Quiet Week');
  const base = `/api/v1/episodes/${episodeId}`;
  const unanswered = [];

  const exact = {
    [base]: { data: ep },
    [`${base}/events`]: full
      ? { anchor_event_id: EVENT_ID, anchor_source: 'brief', brief_event_id: EVENT_ID, events: [EVENT] }
      : { anchor_event_id: null, events: [] },
    [`${base}/overlays`]: { data: [] },
    [`${base}/lookbook`]: { data: { images: {}, palette: [], mood_words: [] } },
    [`${base}/style-sheet`]: { data: null },
    [`${base}/scene-sets`]: { data: full ? [{ id: SET_ID, name: 'Maison Miel' }] : [] },
    [`${base}/scripts?includeAllVersions=false`]: { data: [] },
    [`${base}/todo/social`]: { data: null },
    [`${base}/timeline/placements`]: { data: [] },
    [`/api/v1/episode-brief/${episodeId}`]: { data: full ? BRIEF_FULL : BRIEF_BARE },
    [`/api/v1/episode-brief/${episodeId}/plan`]: { data: [], coverage: null, readiness: null },
    [`/api/v1/world/${SHOW_ID}/events`]: { events: full ? [EVENT, PARENT_EVENT] : [] },
    [`/api/v1/world/${SHOW_ID}/events/${EVENT_ID}`]: { event: EVENT },
    [`/api/v1/world/${SHOW_ID}/episodes/${episodeId}/money`]: { data: null },
    [`/api/v1/world/${SHOW_ID}/financial-ledger?episode_id=${episodeId}&limit=50`]: { data: { transactions: [] } },
    [`/api/v1/world/${SHOW_ID}/balance`]: { data: { balance: 1250 } },
    [`/api/v1/episodes?limit=100&page=1&show_id=${SHOW_ID}&sort=episode_number:ASC`]: { data: [episode(EP_FULL, 1, 'Dressed for the Opportunity'), episode(EP_BARE, 2, 'A Quiet Week')], pagination: { total: 2 } },
    [`/api/v1/wardrobe/slot-coverage?show_id=${SHOW_ID}`]: { data: { slots: [] } },
    [`/api/v1/wardrobe/outfit/${episodeId}`]: { items: [] },
    [`/api/v1/characters/lala/state?show_id=${SHOW_ID}`]: { state: { coins: 1250, reputation: 6, brand_trust: 4 } },
    [`/api/v1/ui-overlays/${SHOW_ID}`]: { data: [] },
    [`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episodeId}&limit=1`]: { data: [] },
    ['/api/v1/franchise-brain/entries?category=franchise_law&limit=1&status=active']: { data: [] },
    [`/api/v1/scene-sets/${SET_ID}`]: { data: { id: SET_ID, base_still_url: 'https://img/set.jpg' } },
    [`/api/v1/social-profiles/${PROFILE_ID}`]: { profile: { id: PROFILE_ID, handle: 'honeytable', display_name: 'The Honey Table' } },
    ['/api/v1/voice-studio/status']: { data: { on: true } },
  };

  const answer = async (url) => {
    const key = normalizeUrl(url);
    if (key in exact) return { data: exact[key] };
    unanswered.push(key);
    return { data: {} };
  };
  return { answer, unanswered };
}
