/**
 * Quieter event cards (Evoni, 2026-10-25: "I want them all"): what an event
 * still needs is a small "N to set up" chip in place of the yellow Still
 * needed box. It is a button (aria-expanded, keyboard) that opens the list;
 * a card with nothing missing shows nothing; the card's next-step button
 * and its wardrobe-conflict chip stay. The same in List view.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventLibrary from './EventLibrary';
import { computeEventPackageReadiness, describeMissing } from '../../utils/eventReadinessSections';

// Every gate met (utils/eventReadinessSections.test.js full()).
const COMPLETE = {
  id: 'ev-done', show_id: 'show-1', name: 'Velvet Hour', status: 'draft', category: 'social', format: 'gala',
  event_date: '2026-11-07', event_time: '20:00', dress_code: 'black tie formal', source_profile_id: 7,
  canon_consequences: { automation: { guest_profiles: [{ profile_id: 1, featured: true }] } },
  venue_location_id: 'loc-1', venue_name: 'Club Noir', scene_set_id: 'ss-1', invitation_asset_id: 'inv-1',
  outfit_pieces: [{ id: 'p1' }], narrative_stakes: 'Her first seat at the table.',
  prestige: 5, strictness: 5, cost_coins: 300, deadline_type: 'medium', career_tier: 1, is_paid: false,
};
const BRAND = {
  id: 'ev-brand', show_id: 'show-1', name: 'Atelier Launch', status: 'draft', host_brand: 'Maison Belle',
  event_date: '2026-10-12', deal_type: 'paid_appearance', prestige: 6,
  canon_consequences: { automation: {} },
};
// A used event whose dress code the closet does not match: the wardrobe-conflict chip.
const USED = {
  id: 'ev-used', show_id: 'show-1', name: 'Velvet Gala', status: 'used', used_in_episode_id: 'ep-1', prestige: 5,
  dress_code_keywords: ['velvet', 'satin', 'gold'], canon_consequences: { automation: {} },
};
const EPISODES = [{ id: 'ep-1', episode_number: 1, title: 'Velour', status: 'draft' }];
const WARDROBE = [{ id: 'w1', show_id: 'show-1', style: 'denim', category: 'jacket', color: 'blue' }];

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>;
}

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/season?tab=events']}>
      <Routes>
        <Route path="/shows/:showId/season" element={<><EventLibrary showId="show-1" /><Probe /></>} />
        <Route path="/shows/:showId/events/:eventId" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
}

const missingOf = (ev) => describeMissing(computeEventPackageReadiness(ev).blocking);

describe('EventLibrary: the "N to set up" chip', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: [BRAND, COMPLETE, USED] } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: WARDROBE, pagination: { total: 1 } } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: EPISODES } };
      return { data: {} };
    });
  });

  test('shows the count, no yellow list; tapping opens and closes the list without opening the event', async () => {
    renderLibrary();
    const card = await screen.findByTestId('event-card-ev-brand');
    const missing = missingOf(BRAND);
    expect(missing.length).toBeGreaterThan(1);

    const chip = within(card).getByTestId('event-card-needed-chip-ev-brand');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip.textContent).toBe(`${missing.length} to set up`);
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(within(card).queryByTestId('event-card-needed-list-ev-brand')).toBeNull();
    expect(card.textContent).not.toMatch(/Still needed:/);

    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const list = within(card).getByTestId('event-card-needed-list-ev-brand');
    expect(chip.getAttribute('aria-controls')).toBe(list.id);
    expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual(missing);
    // The chip's click stays on the chip: the card did not open the event package.
    expect(screen.getByTestId('loc').textContent).toBe('/shows/show-1/season?tab=events');

    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(within(card).queryByTestId('event-card-needed-list-ev-brand')).toBeNull();
  });

  test('works from the keyboard: a focusable button that Enter and Space press', async () => {
    renderLibrary();
    const chip = await screen.findByTestId('event-card-needed-chip-ev-brand');
    chip.focus();
    expect(document.activeElement).toBe(chip);
    // A native button: the browser turns Enter and Space into a click.
    fireEvent.keyDown(chip, { key: 'Enter' });
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
  });

  test('a card with nothing missing shows no chip; the next-step button stays', async () => {
    renderLibrary();
    const card = await screen.findByTestId('event-card-ev-done');
    expect(missingOf(COMPLETE)).toEqual([]);
    expect(within(card).queryByTestId('event-card-needed-ev-done')).toBeNull();
    expect(within(card).queryByText(/to set up/)).toBeNull();
    expect(within(card).getByTestId('event-card-primary-ev-done')).toBeTruthy();
  });

  test('the next-step button stays beside the chip, and the wardrobe-conflict chip stays', async () => {
    renderLibrary();
    const card = await screen.findByTestId('event-card-ev-brand');
    expect(within(card).getByTestId('event-card-primary-ev-brand').textContent).toMatch(/Continue Setup|Choose Organizer/);
    const used = screen.getByTestId('event-card-ev-used');
    expect(within(used).getByTestId('event-card-conflict-ev-used').textContent).toContain('Wardrobe conflict');
    expect(within(used).queryByTestId('event-card-needed-ev-used')).toBeNull();
  });

  test('List view: the same chip, opening the same list', async () => {
    renderLibrary();
    await screen.findByTestId('event-card-ev-brand');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(screen.getByTestId('events-grid').className).toContain('is-list');
    const card = screen.getByTestId('event-card-ev-brand');
    const chip = within(card).getByTestId('event-card-needed-chip-ev-brand');
    expect(chip.textContent).toBe(`${missingOf(BRAND).length} to set up`);
    fireEvent.click(chip);
    expect(within(card).getByTestId('event-card-needed-list-ev-brand').querySelectorAll('li')).toHaveLength(missingOf(BRAND).length);
    expect(within(screen.getByTestId('event-card-ev-done')).queryByTestId('event-card-needed-ev-done')).toBeNull();
  });
});
