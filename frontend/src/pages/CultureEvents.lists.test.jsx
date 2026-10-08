/**
 * Culture edits its lists (wiring map fix-list item 21): "Edit lists" gives
 * each item Edit and Remove and each list "+ Add"; a save writes the list
 * to its own page (Awards & Media: cultural_calendar; History:
 * cultural_memory); a remove asks first.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import CultureEvents from './CultureEvents';
import { AWARD_SHOWS } from '../data/calendarData';
import { MEMORY_TYPES } from '../data/memoryData';

const renderAt = (url) => {
  window.history.pushState({}, '', url);
  return render(<MemoryRouter initialEntries={[url]}><CultureEvents embedded /></MemoryRouter>);
};
/** The open modal's field for a key. */
const field = (key) => {
  const modal = document.querySelector('.eim-modal');
  const label = [...modal.querySelectorAll('.eim-label')].find((l) => l.textContent === key.replace(/_/g, ' '));
  return label.parentElement.querySelector('input, textarea');
};

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/shows' ? { data: { success: true, data: [] } } : { data: { events: [] } }));
  vi.mocked(api.post).mockResolvedValue({ data: { data: { state: 'up_to_date', pending: 0, new: [], changed: [], retiring: [], unchanged: [], legacy: 0, fingerprint: 'fp' } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});
afterEach(() => vi.restoreAllMocks());

describe('Culture: the lists edit', () => {
  test('an award show edits into cultural_calendar; the controls show only while editing', async () => {
    renderAt('/universe?tab=culture&sub=awards');
    expect(screen.queryByRole('button', { name: 'Edit Starlight Awards' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Starlight Awards' }));
    expect(screen.getByRole('heading', { name: 'Edit award show' })).toBeTruthy();
    fireEvent.change(field('desc'), { target: { value: 'The night the year is decided.' } });
    fireEvent.click(within(document.querySelector('.eim-modal')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/page-content/cultural_calendar/AWARD_SHOWS', {
      data: [{ ...AWARD_SHOWS[0], desc: 'The night the year is decided.' }, ...AWARD_SHOWS.slice(1)],
    }));
  });

  test('a memory type is added to cultural_memory', async () => {
    renderAt('/universe?tab=culture&sub=history');
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add memory type' }));
    expect(screen.getByRole('heading', { name: 'Add memory type' })).toBeTruthy();
    fireEvent.change(field('type'), { target: { value: 'The Leak' } });
    fireEvent.click(within(document.querySelector('.eim-modal')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/page-content/cultural_memory/MEMORY_TYPES');
    expect(body.data).toHaveLength(MEMORY_TYPES.length + 1);
    expect(body.data.at(-1).type).toBe('The Leak');
  });

  test('a remove asks first, and a no changes nothing', async () => {
    renderAt('/universe?tab=culture&sub=awards');
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Starlight Awards' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Starlight Awards'));
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Starlight Awards' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/page-content/cultural_calendar/AWARD_SHOWS', { data: AWARD_SHOWS.slice(1) }));
  });
});
