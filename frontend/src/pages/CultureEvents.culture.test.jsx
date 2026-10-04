/**
 * The Culture tab after the per-tab fix (2026-10-04): the page-level
 * "Push to Brain" button is gone (it clicked two hidden buttons that no
 * longer existed, so it did nothing); the Awards & Media and History
 * sub-tabs each carry their own visible Brain Update button; the Events
 * sub-tab shows which show a new event goes to when there are several;
 * nothing is hidden.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import CultureEvents from './CultureEvents';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><CultureEvents embedded /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url === '/api/v1/shows' ? { data: { success: true, data: SHOWS } } : { data: { data: {}, events: [] } }
  ));
  vi.mocked(api.post).mockResolvedValue({ data: { data: { state: 'up_to_date', pending: 0, new: [], changed: [], retiring: [], unchanged: [], legacy: 0, fingerprint: 'fp' } } });
});

describe('Culture tab', () => {
  test('no dead Push to Brain, nothing hidden; Events shows where a new event goes', async () => {
    window.history.pushState({}, '', '/universe?tab=culture');
    const { container } = renderAt('/universe?tab=culture');
    expect(screen.queryByRole('button', { name: 'Push to Brain' })).toBeNull();
    expect(container.querySelector('[style*="display: none"]')).toBeNull();
    const select = await screen.findByLabelText('Show for new events');
    expect(screen.getByText('New events go to')).toBeTruthy();
    expect(select.querySelectorAll('option')).toHaveLength(3);
    expect(screen.queryByTestId(/brain-update-button/)).toBeNull();
  });

  test('Awards & Media carries the Calendar Brain Update; History the Memory one', async () => {
    window.history.pushState({}, '', '/universe?tab=culture&sub=awards');
    renderAt('/universe?tab=culture&sub=awards');
    await waitFor(() => expect(screen.getByTestId('brain-update-button-calendar').textContent).toBe('🧠 Calendar: Brain Up to Date ✓'));
    expect(screen.queryByTestId('brain-update-button-memory')).toBeNull();
    expect(screen.queryByLabelText('Show for new events')).toBeNull();
    fireEvent.click(screen.getByText('History'));
    await waitFor(() => expect(screen.getByTestId('brain-update-button-memory').textContent).toBe('🧠 Memory: Brain Up to Date ✓'));
    expect(screen.queryByTestId('brain-update-button-calendar')).toBeNull();
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/cultural_calendar/preview', expect.anything());
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/cultural_memory/preview', expect.anything());
  });
});
