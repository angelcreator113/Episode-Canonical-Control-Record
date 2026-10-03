/**
 * New Episode starter (Evoni, 2026-10-03, episode creation step 4): "What
 * starts this episode?" Each way in creates the event through its existing
 * path and opens the Event Package.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('./SocialProfileGenerator', () => ({
  default: ({ chooseHost, showId }) => <div data-testid="feed-choose-host">{chooseHost ? `choose host for ${showId}` : 'feed'}</div>,
}));

import api from '../services/api';
import NewEpisodeStarter from './NewEpisodeStarter';

function Landed() {
  const loc = useLocation();
  return <div data-testid="landed">{loc.pathname}</div>;
}

const renderAt = (entry = '/shows/show-1/new-episode') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/shows/:showId/new-episode" element={<NewEpisodeStarter />} />
      <Route path="/shows/:showId/events/:eventId" element={<Landed />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/wardrobe-brands/brands') return { data: [{ id: 1, name: 'Ori Beauty', category: 'beauty' }, { id: 2, name: 'Velour' }] };
    if (url === '/api/v1/calendar/events?series_id=show-1') {
      return { data: { events: [{ id: 'ce-1', title: 'Spring Gala', cultural_category: 'fashion', start_datetime: '2026-11-07T00:00:00Z' }] } };
    }
    if (url === '/api/v1/opportunities/show-1') {
      return { data: { opportunities: [
        { id: 'op-1', name: 'Ori Campaign', status: 'offered', brand_or_company: 'Ori Beauty', event_id: null },
        { id: 'op-2', name: 'Already scheduled', status: 'booked', event_id: 'ev-old' },
        { id: 'op-3', name: 'Declined one', status: 'declined', event_id: null },
      ] } };
    }
    return { data: {} };
  });
});

describe('New Episode: what starts this episode?', () => {
  test('six starting points; Personal Story and Surprise Me are not open yet', () => {
    renderAt();
    for (const key of ['creator', 'brand', 'world', 'opportunity', 'personal', 'surprise']) {
      expect(screen.getByTestId(`start-${key}-card`)).toBeTruthy();
    }
    expect(screen.getByTestId('start-personal-card').disabled).toBe(true);
    expect(screen.getByTestId('start-personal-card').textContent).toMatch(/Needs your ruling/);
    expect(screen.getByTestId('start-surprise-card').disabled).toBe(true);
  });

  test('Creator Invitation opens Lala\'s Feed in choose-host mode, and Back returns', async () => {
    renderAt();
    fireEvent.click(screen.getByTestId('start-creator-card'));
    expect((await screen.findByTestId('feed-choose-host')).textContent).toBe('choose host for show-1');
    fireEvent.click(screen.getByTestId('start-back'));
    expect(await screen.findByTestId('starting-points')).toBeTruthy();
  });

  test('Brand Opportunity creates the event with the brand as organizer and opens its Package', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, event: { id: 'ev-9' } } });
    renderAt();
    fireEvent.click(screen.getByTestId('start-brand-card'));
    fireEvent.click(await screen.findByTestId('brand-option-Ori Beauty'));
    expect(screen.getByTestId('brand-create').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('brand-event-name'), { target: { value: '  Champagne Before Noon ' } });
    fireEvent.click(screen.getByTestId('brand-create'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events', { name: 'Champagne Before Noon', host_brand: 'Ori Beauty' }));
    expect((await screen.findByTestId('landed')).textContent).toBe('/shows/show-1/events/ev-9');
  });

  test('a brand not on the list can be typed', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, event: { id: 'ev-10' } } });
    renderAt('/shows/show-1/new-episode?start=brand');
    fireEvent.change(await screen.findByTestId('brand-search'), { target: { value: 'Maison Belle' } });
    fireEvent.change(screen.getByTestId('brand-event-name'), { target: { value: 'Belle Soirée' } });
    fireEvent.click(screen.getByTestId('brand-create'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events', { name: 'Belle Soirée', host_brand: 'Maison Belle' }));
  });

  test('World Event spawns from a calendar moment and opens the new event', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { events_created: 1, events: [{ id: 'ev-11' }] } } });
    renderAt();
    fireEvent.click(screen.getByTestId('start-world-card'));
    fireEvent.click(await screen.findByTestId('world-option-ce-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/calendar/events/ce-1/auto-spawn', { show_id: 'show-1', event_count: 1, max_guests: 6 }));
    expect((await screen.findByTestId('landed')).textContent).toBe('/shows/show-1/events/ev-11');
  });

  test('Career Opportunity lists only open, unscheduled ones and schedules the chosen one', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { event_id: 'ev-12' } } });
    renderAt();
    fireEvent.click(screen.getByTestId('start-opportunity-card'));
    expect(await screen.findByTestId('opportunity-option-op-1')).toBeTruthy();
    expect(screen.queryByTestId('opportunity-option-op-2')).toBeNull();
    expect(screen.queryByTestId('opportunity-option-op-3')).toBeNull();
    fireEvent.click(screen.getByTestId('opportunity-option-op-1'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-pipeline/show-1/schedule/op-1'));
    expect((await screen.findByTestId('landed')).textContent).toBe('/shows/show-1/events/ev-12');
  });

  test('a failed create says why and stays on the page', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'This opportunity already has an event scheduled' } } });
    renderAt('/shows/show-1/new-episode?start=opportunity');
    fireEvent.click(await screen.findByTestId('opportunity-option-op-1'));
    expect((await screen.findByRole('alert')).textContent).toBe('This opportunity already has an event scheduled');
    expect(screen.queryByTestId('landed')).toBeNull();
  });
});
