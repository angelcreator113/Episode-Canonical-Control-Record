/**
 * The Event Package's header and navigation (Evoni, 2026-10-25: "What else
 * can we improve on the event page and how it flows?" … "I want them all and
 * show me first"): its place in the season (purposes, goals with what the
 * event adds, the release day), the stage row, what is left to set up and
 * why Start Episode / the invitation can't run yet, the events before and
 * after in slot order, and the way back to where it was opened from.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
// The organizer, name, category, format and date are set; the venue and the invitation are not.
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Fabric and Form', event_type: 'invite', prestige: 6,
  category: 'arts_entertainment', format: 'gala', event_date: '2026-11-12', host_brand: 'Studio by Sable',
  is_paid: true, payment_amount: 600, updated_at: '2026-10-20T10:00:00.000Z', canon_consequences: { automation: {} },
};
const READY_EVENT = { ...EVENT, venue_location_id: 'loc-1', venue_name: 'The Glasshouse', invitation_asset_id: 'asset-1' };
const payloadOf = (event) => ({
  event, episodeLook: null, placeLocked: false, sourceProfile: null, startedFromProfile: null, sceneSet: null,
  venueLocation: event.venue_location_id ? { id: 'loc-1', name: 'The Glasshouse' } : null,
  invitationAsset: event.invitation_asset_id ? { id: 'asset-1', s3_url_processed: null } : null,
  usedInEpisode: null, termsLockedBy: null, termsReopen: null,
});
const IN_SLOT = {
  in_slot: true, via: 'pencilled', season_number: 1, label: 'S1 · E5', slot_number: 5, phase: { number: 1, title: 'Foundation' },
  story_purposes: [{ text: 'Lala bluffs her way into the showroom.', primary: true }], desired_pressure: 'High',
};
const UNPLACED = { in_slot: false, season_number: 1, next_open: { label: 'S1 · E2', phase: { number: 1, title: 'Foundation' } } };
const ROADMAP = {
  season_number: 1,
  phases: [{ phase: 1, slots: [
    { id: 's3', slot_number: 3, event: { id: 'ev-3', name: 'Gallery Night' }, episode: null },
    { id: 's4', slot_number: 4, event: null, episode: null },
    { id: 's5', slot_number: 5, event: { id: 'ev-1', name: 'Fabric and Form' }, episode: null },
    { id: 's7', slot_number: 7, event: { id: 'ev-7', name: 'Runway' }, episode: null },
  ] }],
};
const RELEASE = { state: 'active', schedule: { day: 'sun', time: '10:00' }, episodes: [], slots: { 5: { date: '2026-11-29', time: '10:00', source: 'schedule' } } };
const COVERAGE = {
  season: { arc_id: 'arc-1', season_number: 1 },
  goals: [{ id: 'g1', title: 'Earn 3,000 Prime Coins', metric_label: 'Coins', target_metric: 'coins', movers: [{ event_id: 'ev-1', gain: 600, done: false }] }],
  parts: [], slots: [],
  event: { id: 'ev-1', goals: [{ goal_id: 'g1', title: 'Earn 3,000 Prime Coins', pinned: false, via: 'fit' }], moves: [{ goal_id: 'g1', title: 'Earn 3,000 Prime Coins', pinned: false, via: 'fit' }] },
};

let state;
function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `${EVENT_URL}/package`) {
      return { data: { success: true, eventPayload: payloadOf(state.event), moneyPreview: { balance: 1000, warnings: [], lines: [] }, seasonContext: state.context,
        deliverables: { deliverables: [], locked: false }, costs: { costs: [], drafted: {}, deal: false, locked: false }, documents: null,
        termsLock: { locked: false, episode: null, reopen: null }, readiness: null } };
    }
    if (url === '/api/v1/world/show-1/season/roadmap') return { data: { success: true, roadmap: ROADMAP } };
    if (url === '/api/v1/world/show-1/release-schedule') return { data: { success: true, data: RELEASE } };
    if (url.startsWith('/api/v1/world/show-1/season/goal-coverage')) return { data: COVERAGE };
    if (url === '/api/v1/world/locations') return { data: { success: true, locations: [] } };
    return { data: { success: true } };
  });
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
        <Route path="*" element={<p>other page</p>} />
      </Routes>
    </MemoryRouter>
  );
}
const getUrls = () => vi.mocked(api.get).mock.calls.map(([url]) => url);

describe('Event Package header and navigation', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    state = { event: EVENT, context: IN_SLOT };
    mockApi();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => { delete Element.prototype.scrollIntoView; });

  test('its place in the season: the purposes, the goal with what the event adds, the release day', async () => {
    renderAt('/shows/show-1/events/ev-1');
    const place = await screen.findByTestId('season-place');
    expect(place.getAttribute('data-placed')).toBe('true');
    expect(within(place).getByTestId('season-purposes').textContent).toBe('Lala bluffs her way into the showroom.');
    expect(within(place).getByTestId('season-pressure').textContent).toBe('Desired pressure: High');
    expect((await within(place).findByTestId('egp-gain-g1')).textContent).toBe('+600 coins');
    expect(within(place).getByTestId('egp-chip-g1').textContent).toContain('Earn 3,000 Prime Coins');
    expect((await within(place).findByTestId('season-release')).textContent.trim()).toBe('Releases Sun, Nov 29');
    // The goal coverage is read once, for the panel and its chips together.
    expect(getUrls().filter((u) => u.includes('/season/goal-coverage'))).toEqual(['/api/v1/world/show-1/season/goal-coverage?event_id=ev-1']);
  });

  test('not in a slot: one line, "Place it" to Not placed yet; no roadmap or schedule read', async () => {
    state.context = UNPLACED;
    renderAt('/shows/show-1/events/ev-1');
    const line = await screen.findByTestId('season-unplaced');
    expect(line.textContent).toBe('Not placed in the season yet; the next open slot is S1 · E2 · Place it');
    expect(within(line).getByRole('link', { name: 'Place it' }).getAttribute('href')).toBe('/shows/show-1/season?tab=events&show=unplaced');
    expect(screen.queryByTestId('slot-nav')).toBeNull();
    expect(screen.queryByTestId('season-release')).toBeNull();
    expect(getUrls()).not.toContain('/api/v1/world/show-1/season/roadmap');
    expect(getUrls()).not.toContain('/api/v1/world/show-1/release-schedule');
  });

  test('the stage row lights the current stage and says what moves it on; a tap shows another stage', async () => {
    renderAt('/shows/show-1/events/ev-1');
    const tracker = await screen.findByTestId('stage-tracker');
    expect(tracker.getAttribute('data-stage')).toBe('idea');
    expect(within(tracker).getByTestId('stage-idea').getAttribute('aria-current')).toBe('step');
    expect(within(tracker).getByTestId('stage-ready').getAttribute('data-state')).toBe('todo');
    expect(within(tracker).getByTestId('stage-hint').textContent).toBe('Now: Idea. Set up once the venue is chosen.');
    fireEvent.click(within(tracker).getByTestId('stage-ready'));
    expect(within(tracker).getByTestId('stage-hint').textContent).toBe('Now: Idea. Ready once the venue is chosen and the invitation is made.');
  });

  test('the setup list: the Season card\'s entries, Start Episode\'s reason, and a jump that opens where it is set', async () => {
    renderAt('/shows/show-1/events/ev-1');
    const list = await screen.findByTestId('setup-checklist');
    expect(within(list).getByTestId('setup-count').textContent).toBe('2 to set up');
    expect(within(list).getByTestId('setup-item-place').textContent).toContain('Place: venue');
    expect(within(list).getByTestId('setup-item-invitation').textContent).toContain('Invitation');
    const reason = within(list).getByTestId('blocked-start');
    expect(reason.textContent).toContain('Start Episode needs 2 things first: venue and invitation');
    // The venue's jump opens its picker, as Continue does.
    fireEvent.click(within(list).getByTestId('setup-item-place'));
    expect(await screen.findByRole('dialog', { name: 'Choose venue' })).toBeTruthy();
  });

  test('the invitation says it waits for an organizer, and "Pick one" opens the organizer picker', async () => {
    state.event = { ...EVENT, host_brand: null };
    renderAt('/shows/show-1/events/ev-1');
    const reason = await screen.findByTestId('blocked-invitation');
    expect(reason.textContent).toContain('The invitation needs an organizer first: it names them');
    fireEvent.click(within(reason).getByTestId('blocked-invitation-action'));
    expect(await screen.findByRole('dialog', { name: 'Change Organizer' })).toBeTruthy();
  });

  test('from the Roadmap: back to its slot, and the events before and after keep the way back', async () => {
    renderAt('/shows/show-1/events/ev-1?from=roadmap:5');
    const back = await screen.findByTestId('package-back');
    expect(back.textContent.trim()).toBe('Back to E5 on the Roadmap');
    expect(back.getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap&slot=5');
    const nav = await screen.findByTestId('slot-nav');
    expect(within(nav).getByTestId('slot-nav-prev').getAttribute('href')).toBe('/shows/show-1/events/ev-3?from=roadmap:5');
    expect(within(nav).getByTestId('slot-nav-prev').getAttribute('aria-label')).toBe('Previous in the season: E3 · Gallery Night');
    expect(within(nav).getByTestId('slot-nav-current').textContent).toBe('E5');
    expect(within(nav).getByTestId('slot-nav-next').getAttribute('href')).toBe('/shows/show-1/events/ev-7?from=roadmap:5');
  });

  test('from the Events tab under a filter, set up: "Done · back to Not placed yet"', async () => {
    state.event = READY_EVENT;
    state.context = UNPLACED;
    renderAt('/shows/show-1/events/ev-1?from=events:unplaced');
    const back = await screen.findByTestId('package-back');
    // Nothing was missing on this visit, so there is no list; the way back says it is done.
    expect(back.getAttribute('href')).toBe('/shows/show-1/season?tab=events&show=unplaced');
    expect(back.textContent.trim()).toBe('Done · back to Not placed yet');
    expect(screen.queryByTestId('setup-checklist')).toBeNull();
    expect(screen.getByTestId('stage-tracker').getAttribute('data-stage')).toBe('ready');
  });

  test('from Producer Mode, and with no origin', async () => {
    const { unmount } = renderAt('/shows/show-1/events/ev-1?from=producer');
    const back = await screen.findByTestId('package-back');
    expect(back.textContent.trim()).toBe('Back to Producer Mode');
    expect(back.getAttribute('href')).toBe('/shows/show-1/world?tab=overview');
    unmount();
    renderAt('/shows/show-1/events/ev-1');
    const plain = await screen.findByTestId('package-back');
    expect(plain.textContent.trim()).toBe('Events');
    expect(plain.getAttribute('href')).toBe('/shows/show-1/season?tab=events');
  });

  test('the phone jump bar: a short name per section beside its full one', async () => {
    renderAt('/shows/show-1/events/ev-1');
    const toc = await screen.findByTestId('package-toc');
    const shorts = [...toc.querySelectorAll('.epp-toc-short')].map((n) => n.textContent);
    expect(shorts).toEqual(['Basics', 'Look', 'Deal', 'Stakes', 'Papers']);
    expect(within(toc).getByTestId('toc-identity').querySelector('.epp-toc-long').textContent).toBe('The Event');
    expect(within(toc).getByTestId('toc-identity').querySelector('.epp-toc-short').getAttribute('aria-hidden')).toBe('true');
  });
});

// The phone's jump bar lights the section under the screen's upper quarter,
// not the last lines of the one above it (2026-10-25).
describe('Event Package jump bar follows the scroll on a phone', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    state = { event: EVENT, context: IN_SLOT };
    mockApi();
  });

  test('Deal under the line is lit though Look\'s tail still crosses the band', async () => {
    let report;
    const observed = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb) { report = cb; }
      observe(el) { observed.push(el); }
      disconnect() {}
    });
    const innerHeight = window.innerHeight;
    window.innerHeight = 812;
    try {
      renderAt('/shows/show-1/events/ev-1');
      await waitFor(() => expect(observed.map((el) => el.id)).toContain('epp-sec-deal'));
      const look = observed.find((el) => el.id === 'epp-sec-look');
      const deal = observed.find((el) => el.id === 'epp-sec-deal');
      look.getBoundingClientRect = () => ({ top: -900, bottom: 200 });
      deal.getBoundingClientRect = () => ({ top: 196, bottom: 1600 });
      act(() => report([{ isIntersecting: true, target: look, boundingClientRect: { top: -900 } }, { isIntersecting: true, target: deal, boundingClientRect: { top: 196 } }]));
      expect(screen.getByTestId('toc-deal').getAttribute('aria-current')).toBe('location');
      expect(screen.getByTestId('toc-look').getAttribute('aria-current')).toBeNull();
    } finally {
      window.innerHeight = innerHeight;
      vi.unstubAllGlobals();
    }
  });
});

// Every entry shown stays, ticked, once it is filled in; the way back then reads "Done".
describe('Event Package setup list ticks off live', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    state = { event: EVENT, context: IN_SLOT };
    mockApi();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => { delete Element.prototype.scrollIntoView; });

  test('a save that sets the venue ticks its entry; setting the rest reads Done · back to …', async () => {
    vi.mocked(api.put).mockImplementation(async () => {
      state.event = { ...state.event, venue_location_id: 'loc-1', venue_name: 'The Glasshouse', updated_at: '2026-10-20T11:00:00.000Z' };
      return { data: { success: true, event: state.event } };
    });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/locations') return { data: { success: true, locations: [{ id: 'loc-1', name: 'The Glasshouse', location_type: 'venue' }] } };
      if (url === `${EVENT_URL}/package`) {
        return { data: { success: true, eventPayload: payloadOf(state.event), moneyPreview: { balance: 1000, warnings: [], lines: [] }, seasonContext: state.context,
          deliverables: { deliverables: [], locked: false }, costs: { costs: [], drafted: {}, deal: false, locked: false }, documents: null,
          termsLock: { locked: false, episode: null, reopen: null }, readiness: null } };
      }
      if (url === '/api/v1/world/show-1/season/roadmap') return { data: { success: true, roadmap: ROADMAP } };
      if (url === '/api/v1/world/show-1/release-schedule') return { data: { success: true, data: RELEASE } };
      if (url.startsWith('/api/v1/world/show-1/season/goal-coverage')) return { data: COVERAGE };
      return { data: { success: true } };
    });
    renderAt('/shows/show-1/events/ev-1?from=roadmap:5');
    const list = await screen.findByTestId('setup-checklist');
    fireEvent.click(within(list).getByTestId('setup-item-place'));
    const dialog = await screen.findByRole('dialog', { name: 'Choose venue' });
    fireEvent.click(await within(dialog).findByText('The Glasshouse'));
    await waitFor(() => expect(screen.getByTestId('setup-item-place').getAttribute('data-done')).toBe('true'));
    expect(screen.getByTestId('setup-count').textContent).toBe('1 to set up');
    expect(screen.getByTestId('setup-item-place').textContent).toContain('Place: venue');
    expect(screen.getByTestId('stage-tracker').getAttribute('data-stage')).toBe('setup');
    expect(screen.getByTestId('package-back').textContent.trim()).toBe('Back to E5 on the Roadmap');
  });
});
