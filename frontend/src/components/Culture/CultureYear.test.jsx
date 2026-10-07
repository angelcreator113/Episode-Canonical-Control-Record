/** The Culture year (the mock, 2026-10-06): months, the month's list with real actions, the memory. */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CultureYear from './CultureYear';

const CAL = [{ id: 'c1', title: 'Velvet Season', start_datetime: '2026-11-12T00:00:00Z', location_name: 'Dazzle District' }];
const AWARDS = [{ name: 'Starlight Awards', month: 'November' }];
const renderIt = (props = {}) => render(<MemoryRouter><CultureYear calendar={CAL} awards={AWARDS} showId="show-b" onCreateEvent={vi.fn()} onOpen={vi.fn()} {...props} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-b/events') return { data: { events: [{ id: 'e1', name: 'Studio Session', event_date: '2026-11-01' }, { id: 'e2', name: 'Undated' }] } };
    if (url.startsWith('/api/v1/franchise-brain/entries')) return { data: { data: [{ id: 9, status: 'active', category: 'narrative', source_document: 'episode-completion', title: 'Episode 1: Pilot — SLAY Result', content: 'a\nEvent: Gala.', created_at: '2026-10-01T00:00:00Z' }] } };
    return { data: {} };
  });
});

describe('CultureYear', () => {
  test('a month lists what happens in it; each kind has its own action', async () => {
    const onCreateEvent = vi.fn();
    const onOpen = vi.fn();
    renderIt({ onCreateEvent, onOpen });
    await waitFor(() => expect(screen.getByTestId('cy-summary').textContent).toBe('2 events in the library · 1 placed on the calendar · 1 cultural moment'));
    fireEvent.click(screen.getByRole('button', { name: /^November: 3 things/ }));
    const items = screen.getByTestId('cy-month-items');
    expect(items.textContent).toContain('Studio Session');
    expect(items.textContent).toContain('Velvet Season');
    expect(items.textContent).toContain('Starlight Awards');
    expect(screen.getByRole('link', { name: 'Open the event →' }).getAttribute('href')).toBe('/shows/show-b/events/e1');
    fireEvent.click(screen.getByRole('button', { name: 'Make it an event →' }));
    expect(onCreateEvent).toHaveBeenCalledWith(CAL[0]);
    fireEvent.click(screen.getByRole('button', { name: 'See the award →' }));
    expect(onOpen).toHaveBeenCalledWith('awards');
    // The show's own memory, not every show's.
    expect(api.get).toHaveBeenCalledWith('/api/v1/franchise-brain/entries?category=narrative&status=active&show_id=show-b');
    expect((await screen.findByTestId('cy-memory')).textContent).toContain('Episode 1: Pilot — SLAY Result');
  });

  test('with no show, the memory is read unscoped', async () => {
    renderIt({ showId: undefined });
    expect((await screen.findByTestId('cy-memory')).textContent).toContain('Episode 1: Pilot — SLAY Result');
    expect(api.get).toHaveBeenCalledWith('/api/v1/franchise-brain/entries?category=narrative&status=active');
  });

  test('an empty month and an empty memory say so', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/events') ? { data: { events: [] } } : { data: { data: [] } }));
    renderIt({ calendar: [], awards: [] });
    fireEvent.click(screen.getByRole('button', { name: /^February/ }));
    expect(screen.getByTestId('cy-month-empty').textContent).toContain('Nothing on the calendar in February yet');
    expect((await screen.findByTestId('cy-memory-empty')).textContent).toContain('fills in as episodes are completed');
  });
});
