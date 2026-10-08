/**
 * Society edits its lists into the page that owns each (wiring map fix-list
 * item 21): a celebrity tier is cultural_calendar's, an archetype
 * influencer_systems'. Its old modal would have written both into
 * influencer_systems. The fifty legendary roles are fixed in code, so they
 * have no Edit.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import SocialSystems from './SocialSystems';
import { CELEBRITY_HIERARCHY } from '../data/calendarData';
import { ARCHETYPES } from '../data/influencerData';

const renderAt = (url) => {
  window.history.pushState({}, '', url);
  return render(<MemoryRouter initialEntries={[url]}><SocialSystems embedded /></MemoryRouter>);
};
const save = () => fireEvent.click(within(document.querySelector('.eim-modal')).getByRole('button', { name: 'Save' }));

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { state: 'up_to_date', pending: 0, new: [], changed: [], retiring: [], unchanged: [], legacy: 0, fingerprint: 'fp' } } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('Society: the lists edit into their own pages', () => {
  test('a celebrity tier saves to cultural_calendar; a legendary role has no Edit', async () => {
    renderAt('/universe?tab=society&sub=legends');
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    // The roles' list has no controls (a famous character may share a role's name).
    expect(within(screen.getByTestId('ss-legend-roles')).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: `Edit ${CELEBRITY_HIERARCHY[0].name}` }));
    expect(screen.getByRole('heading', { name: 'Edit celebrity tier' })).toBeTruthy();
    save();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/page-content/cultural_calendar/CELEBRITY_HIERARCHY', { data: CELEBRITY_HIERARCHY }));
    expect(vi.mocked(api.put).mock.calls.map(([url]) => url).some((u) => u.includes('influencer_systems'))).toBe(false);
  });

  test('an archetype saves to influencer_systems', async () => {
    renderAt('/universe?tab=society&sub=archetypes');
    fireEvent.click(screen.getByRole('button', { name: 'Edit lists' }));
    fireEvent.click(screen.getByRole('button', { name: `Edit ${ARCHETYPES[0].name}` }));
    save();
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/page-content/influencer_systems/ARCHETYPES', { data: ARCHETYPES }));
  });
});
