/**
 * The show page's Studio tab counts the wardrobe by its list's total (the
 * list stops at 200), and a count it could not load shows "—", not 0.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import StudioTab from './StudioTab';

const SHOW = { id: 'show-1', name: 'Styling Adventures' };
const renderIt = () => render(<MemoryRouter><StudioTab show={SHOW} episodes={[]} /></MemoryRouter>);

describe('StudioTab counts', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('the wardrobe by its total; events by the list', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') return { data: { events: [{ id: 'e1' }, { id: 'e2' }] } };
      if (url.startsWith('/api/v1/wardrobe')) return { data: { data: [{ id: 'w1' }], pagination: { total: 412 } } };
      return { data: { balance: 900 } };
    });
    renderIt();
    await waitFor(() => expect(screen.getByTestId('studio-stat-wardrobe').textContent).toBe('412'));
    expect(screen.getByTestId('studio-stat-events').textContent).toBe('2');
  });

  test('a count that could not load is "—", not 0', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events') throw new Error('boom');
      if (url.startsWith('/api/v1/wardrobe')) return { data: { data: [], pagination: { total: 0 } } };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByTestId('studio-stat-events').textContent).toBe('—'));
    expect(screen.getByTestId('studio-stat-events').getAttribute('title')).toBe("Couldn't load events");
    expect(screen.getByTestId('studio-stat-wardrobe').textContent).toBe('0');
  });
});
