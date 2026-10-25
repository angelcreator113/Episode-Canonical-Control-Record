/**
 * Producer Mode -> Events: the card and the deal-type filter (Task #2361,
 * Evoni's Events page redesign of 2026-09-30, PR B).
 *
 * Since Evoni's Producer Mode redesign (2026-10-05) a card shows its status
 * and category; its name; the place; a Deal tile and an Organizer tile; the
 * gate items still needed, as chips; and one primary button (plus View
 * Event Package on a used event). The five queue states are count cards.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EventLibrary from './EventLibrary';
import { computeEventPackageReadiness, describeMissing } from '../../utils/eventReadinessSections';

const pad = (n) => String(n).padStart(2, '0');

const BRAND_EVENT = {
  id: 'ev-brand', show_id: 'show-1', name: 'Atelier Launch', status: 'draft',
  host_brand: 'Maison Belle', event_date: '2026-10-12', deal_type: 'paid_appearance',
  category: 'launch', format: 'party', prestige: 6,
  canon_consequences: { automation: {} },
};
const BARE_EVENT = {
  id: 'ev-bare', show_id: 'show-1', name: 'Bare Idea', status: 'draft', prestige: 3,
  canon_consequences: { automation: {} },
};
const USED_EVENT = {
  id: 'ev-used', show_id: 'show-1', name: 'Aria Awards Night', status: 'used',
  used_in_episode_id: 'ep-7', deal_type: 'gifted', prestige: 6,
  canon_consequences: { automation: {} },
};
// Twelve more gifted events, so the gifted filter spans two pages.
const GIFTED = Array.from({ length: 12 }, (_, i) => ({
  id: `ev-g${pad(i + 1)}`, show_id: 'show-1', name: `Gifted ${pad(i + 1)}`, status: 'draft',
  deal_type: 'gifted', prestige: 4, canon_consequences: { automation: {} },
}));
const EVENTS = [BRAND_EVENT, BARE_EVENT, USED_EVENT, ...GIFTED];

function Probe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}{loc.search}</div>;
}

function renderQueue(search = '?tab=events') {
  return render(
    <MemoryRouter initialEntries={[`/shows/show-1/season${search}`]}>
      <Routes>
        <Route path="/shows/:showId/season" element={<><EventLibrary showId="show-1" /><Probe /></>} />
        <Route path="/shows/:showId/events/:eventId" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
}

const cardIds = () => screen.queryAllByTestId(/^event-card-ev-[\w-]+$/).map((el) => el.dataset.testid.replace('event-card-', ''));

describe('EventLibrary queue — cards and the deal-type filter (Task #2361)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) {
        return { data: { episodes: [{ id: 'ep-7', episode_number: 7, title: 'Velour', status: 'draft' }] } };
      }
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
  });

  test('a card, to the redesign: status and category, name, place, deal and organizer tiles, what is still needed, one button', async () => {
    renderQueue();
    const card = await screen.findByTestId('event-card-ev-brand');

    expect(within(card).getByRole('heading', { name: 'Atelier Launch' })).toBeTruthy();
    expect(within(card).queryAllByTestId(/^event-card-status-/)).toHaveLength(1);
    expect(card.querySelector('.wa-ev-category').textContent).toBe('launch');
    expect(within(card).getByTestId('event-card-place-ev-brand').textContent).toBe('Mon, Oct 12');
    const deal = within(card).getByTestId('event-card-deal-ev-brand');
    expect(deal.textContent).toContain('Paid appearance');
    expect(deal.textContent).toContain('Unpaid');
    // The deal and the organizer are one line (Evoni, 2026-10-22 layout list).
    expect(within(card).getByTestId('event-card-organizer-ev-brand').textContent).toBe('Organizer: Maison Belle');
    expect(card.querySelector('.wa-ev-facts').textContent).toMatch(/^Paid appearance · Unpaid · Organizer: Maison Belle$/);

    const { blocking } = computeEventPackageReadiness(BRAND_EVENT);
    const needed = within(card).getByTestId('event-card-needed-ev-brand');
    expect(needed.textContent).toBe(`Still needed: ${describeMissing(blocking).join(', ')}`);
    // One primary button besides the card's "More actions" menu.
    const buttons = within(card).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'More actions');
    expect(buttons).toHaveLength(1);
    expect(within(card).queryByTestId('event-card-view-package-ev-brand')).toBeNull();
  });

  test('a card with no organizer, place or deal type says so', async () => {
    renderQueue();
    const card = await screen.findByTestId('event-card-ev-bare');
    expect(within(card).getByTestId('event-card-organizer-ev-bare').textContent).toBe('No organizer');
    // No "No category", and the organizer its button asks for is not listed again.
    expect(card.querySelector('.wa-ev-category')).toBeNull();
    expect(within(card).getByTestId('event-card-primary-ev-bare').textContent).toContain('Choose Organizer');
    expect(within(card).getByTestId('event-card-needed-ev-bare').textContent).not.toMatch(/Organizer/);
    expect(within(card).getByTestId('event-card-place-ev-bare').textContent).toBe('Venue and date not set');
    expect(within(card).getByTestId('event-card-deal-ev-bare').textContent).toContain('No deal type');
  });

  test('the state cards count and filter; the chosen card again shows all', async () => {
    renderQueue();
    await screen.findByTestId('event-card-ev-brand');
    const used = screen.getByTestId('events-filter-used');
    expect(used.textContent).toBe('Used1');
    fireEvent.click(used);
    await waitFor(() => expect(cardIds()).toEqual(['ev-used']));
    expect(used.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(used);
    await waitFor(() => expect(cardIds().length).toBeGreaterThan(1));
    expect(screen.queryByTestId('events-filter-all')).toBeNull();
  });

  test('a used card has View Event Package and Open Episode', async () => {
    renderQueue();
    const card = await screen.findByTestId('event-card-ev-used');
    const buttons = within(card).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'More actions');
    expect(buttons.map((b) => b.textContent.trim())).toEqual(['View Event Package', 'Open Episode']);

    expect(within(card).queryByTestId('event-card-needed-ev-used')).toBeNull();
    fireEvent.click(within(card).getByTestId('event-card-view-package-ev-used'));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/shows/show-1/events/ev-used'));
  });

  test('the deal-type filter sits with the status filters, filters before paging and resets to page 1', async () => {
    renderQueue();
    await waitFor(() => expect(cardIds()).toHaveLength(9));
    const select = screen.getByTestId('events-deal-filter');
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options[0]).toBe('All deal types (15)');
    expect(options).toContain('Gifted (13)');
    expect(options).toContain('Paid appearance (1)');
    expect(options[options.length - 1]).toBe('Deal type not set (1)');

    fireEvent.click(screen.getByTestId('events-page-2'));
    await waitFor(() => expect(screen.getByTestId('events-page-status').textContent).toBe('Page 2 of 2'));

    fireEvent.change(select, { target: { value: 'paid_appearance' } });
    await waitFor(() => expect(cardIds()).toEqual(['ev-brand']));
    expect(screen.getByTestId('loc').textContent).not.toContain('evpage');

    fireEvent.change(select, { target: { value: 'gifted' } });
    await waitFor(() => expect(screen.getByTestId('events-page-status').textContent).toBe('Page 1 of 2'));
    expect(cardIds()).toHaveLength(9);

    fireEvent.change(select, { target: { value: 'not_set' } });
    await waitFor(() => expect(cardIds()).toEqual(['ev-bare']));
  });

  // Evoni, 2026-10-22 (Events layout list): state chips, one toolbar, Cards | List.
  test('the states are chips with counts; a zero is marked', async () => {
    renderQueue();
    await screen.findByTestId('event-card-ev-brand');
    expect(screen.getByTestId('events-filter-archived').hasAttribute('data-zero')).toBe(true);
    expect(screen.getByTestId('events-filter-used').hasAttribute('data-zero')).toBe(false);
  });

  test('one toolbar: search, deal type, sort, layout, Ideas, ⋯ and New event; Auto-Fill and the draft-script switch are in ⋯', async () => {
    renderQueue();
    await screen.findByTestId('event-card-ev-brand');
    const bar = screen.getByLabelText('Search events').closest('.wa-ev-head-actions');
    expect(within(bar).getByTestId('events-deal-filter')).toBeTruthy();
    expect(within(bar).getByRole('group', { name: 'Layout' })).toBeTruthy();
    expect(within(bar).getByTestId('events-ideas-button')).toBeTruthy();
    expect(within(bar).getByText('New event')).toBeTruthy();
    expect(screen.queryByText(/Auto-Fill This Month/)).toBeNull();
    expect(screen.queryByTestId('events-draft-script')).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: 'More actions' }));
    expect(screen.getByText(/Auto-Fill This Month/)).toBeTruthy();
    const draft = screen.getByTestId('events-draft-script').querySelector('input');
    expect(draft.checked).toBe(false);
    fireEvent.click(draft);
    expect(draft.checked).toBe(true);
  });

  test('Cards | List switches the grid to one row per event', async () => {
    renderQueue();
    await screen.findByTestId('event-card-ev-brand');
    const grid = screen.getByTestId('events-grid');
    expect(grid.className).toBe('wa-ev-grid');
    const layout = screen.getByRole('group', { name: 'Layout' });
    fireEvent.click(within(layout).getByRole('button', { name: 'List' }));
    expect(grid.className).toBe('wa-ev-grid is-list');
    expect(within(layout).getByRole('button', { name: 'List' }).getAttribute('aria-pressed')).toBe('true');
    expect(cardIds().length).toBeGreaterThan(1);
  });
});
