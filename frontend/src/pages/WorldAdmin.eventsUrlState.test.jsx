/**
 * The Styling Adventures audit's "Pagination and totals are inconsistent",
 * part 2: the Events queue's search, filters and sort live in the URL with
 * its page, the queue shows its true counts, and a page past the end is put
 * right. The audit's test: 250+ events, filter on the last page, delete the
 * last item, go back, refresh.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const pad = (n) => String(n).padStart(3, '0');
// 260 events: 120 gifted ("Gift 001"…), 140 with no deal type ("Plain 001"…).
let EVENTS;
const seed = () => {
  EVENTS = [
    ...Array.from({ length: 120 }, (_, i) => ({ id: `ev-g${pad(i + 1)}`, show_id: 'show-1', name: `Gift ${pad(i + 1)}`, status: 'draft', deal_type: 'gifted', prestige: 4, canon_consequences: { automation: {} } })),
    ...Array.from({ length: 140 }, (_, i) => ({ id: `ev-p${pad(i + 1)}`, show_id: 'show-1', name: `Plain ${pad(i + 1)}`, status: 'draft', prestige: 3, canon_consequences: { automation: {} } })),
  ];
};

let location;
function Probe() {
  location = useLocation();
  const navigate = useNavigate();
  return <button type="button" data-testid="back" onClick={() => navigate(-1)}>back</button>;
}
const renderAt = (entries, index) => render(
  <MemoryRouter initialEntries={entries} initialIndex={index ?? entries.length - 1}>
    <Routes>
      <Route path="/shows/:id/world" element={<><WorldAdmin /><Probe /></>} />
      <Route path="/shows/:showId/events/:eventId" element={<Probe />} />
    </Routes>
  </MemoryRouter>,
);
const cardIds = () => screen.queryAllByTestId(/^event-card-ev-[\w-]+$/).map((el) => el.dataset.testid.replace('event-card-', ''));
const params = () => new URLSearchParams(location.search);

describe('Events queue: filters in the URL, true counts, a page that exists', () => {
  beforeEach(() => {
    seed();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: EVENTS } };
      if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.delete).mockImplementation(async (url) => {
      const id = url.split('/').pop();
      EVENTS = EVENTS.filter((e) => e.id !== id);
      return { data: { success: true } };
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  test("the audit's test: filter, last page, delete its last event, go back, refresh", async () => {
    renderAt(['/shows/show-1/world?tab=events']);
    await waitFor(() => expect(cardIds()).toHaveLength(9));
    expect(screen.getByTestId('events-range').textContent).toBe('Showing 1–9 of 260 events');

    // Filter: gifted, searched "Gift", sorted by name; 120 match, 14 pages.
    fireEvent.change(screen.getByTestId('events-deal-filter'), { target: { value: 'gifted' } });
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'Gift' } });
    await waitFor(() => expect(params().get('evdeal')).toBe('gifted'));
    expect(params().get('evq')).toBe('Gift');
    fireEvent.click(await screen.findByTestId('events-page-14'));
    await waitFor(() => expect(params().get('evpage')).toBe('14'));
    // Both filters survived the page change (one URL update each).
    expect(params().get('evdeal')).toBe('gifted');
    expect(params().get('evq')).toBe('Gift');
    expect(cardIds()).toEqual(['ev-g118', 'ev-g119', 'ev-g120']);
    expect(screen.getByTestId('events-range').textContent).toBe('Showing 118–120 of 120 matching · 260 events');

    // Delete page 14's events: once it is empty, the queue moves to page 13 and says so in the URL.
    for (const id of ['ev-g120', 'ev-g119', 'ev-g118']) {
      const card = screen.getByTestId(`event-card-${id}`);
      fireEvent.click(within(card).getByRole('button', { name: 'More actions' }));
      fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByTestId(`event-card-${id}`)).toBeNull());
    }
    await waitFor(() => expect(params().get('evpage')).toBe('13'));
    expect(screen.getByTestId('events-page-status').textContent).toBe('Page 13 of 13');
    expect(screen.getByTestId('events-range').textContent).toBe('Showing 109–117 of 117 matching · 257 events');

    // Open an event, then go back: the queue is where it was.
    fireEvent.click(screen.getByTestId('event-card-ev-g117'));
    await waitFor(() => expect(location.pathname).toBe('/shows/show-1/events/ev-g117'));
    const queueUrl = '/shows/show-1/world?tab=events&evdeal=gifted&evq=Gift&evpage=13';
    fireEvent.click(screen.getByTestId('back'));
    await waitFor(() => expect(screen.getByTestId('events-page-status').textContent).toBe('Page 13 of 13'));
    expect(params().get('evdeal')).toBe('gifted');

    // Refresh: a fresh render of the same URL.
    const url = `${location.pathname}${location.search}`;
    cleanup();
    renderAt([url]);
    await waitFor(() => expect(screen.getByTestId('events-page-status').textContent).toBe('Page 13 of 13'));
    expect(screen.getByLabelText('Search events').value).toBe('Gift');
    expect(screen.getByTestId('events-deal-filter').value).toBe('gifted');
    expect(cardIds()).toHaveLength(9);
    expect(new URLSearchParams(url.split('?')[1]).get('evpage')).toBe(new URLSearchParams(queueUrl.split('?')[1]).get('evpage'));
  });

  test('a stale page in the URL is put right once the events load, keeping the filters', async () => {
    renderAt(['/shows/show-1/world?tab=events&evdeal=gifted&evpage=40']);
    await waitFor(() => expect(params().get('evpage')).toBe('14'));
    expect(params().get('evdeal')).toBe('gifted');
    expect(screen.getByTestId('events-page-status').textContent).toBe('Page 14 of 14');
  });

  test('changing the sort or a filter goes back to page 1; an unknown sort reads as name', async () => {
    renderAt(['/shows/show-1/world?tab=events&evpage=5&evsort=bogus']);
    await waitFor(() => expect(screen.getByTestId('events-page-status').textContent).toBe('Page 5 of 29'));
    expect(cardIds()[0]).toBe('ev-g037'); // name order: Gift 037 opens page 5
    fireEvent.change(screen.getByDisplayValue('Sort: Name'), { target: { value: 'prestige' } });
    await waitFor(() => expect(params().get('evsort')).toBe('prestige'));
    expect(params().get('evpage')).toBeNull();
  });
});
