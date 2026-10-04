/**
 * The Society tab after the per-tab fix (2026-10-04): each sub-tab says who
 * reads its lists (the generators read the Show Bible that Brain Update
 * writes into; the Feed generator keeps its own archetype list) and carries
 * the Brain Update button for the data it shows: Social Systems on
 * Archetypes and Social Rules, Calendar on Legends & Society, both on Trends.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import SocialSystems from './SocialSystems';

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><SocialSystems embedded /></MemoryRouter>);
const UP_TO_DATE = { state: 'up_to_date', pending: 0, new: [], changed: [], retiring: [], unchanged: [], legacy: 0, fingerprint: 'fp' };

beforeEach(() => {
  window.localStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { data: {} } });
  vi.mocked(api.post).mockResolvedValue({ data: { data: UP_TO_DATE } });
});

describe('Society tab', () => {
  test('Archetypes says the Feed generator does not read it, and carries the Social Systems button only', async () => {
    window.history.pushState({}, '', '/universe?tab=society');
    renderAt('/universe?tab=society');
    expect(screen.getByTestId('society-reads-archetypes').textContent).toContain('own built-in list');
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Brain Up to Date ✓'));
    expect(screen.queryByTestId('brain-update-button-calendar')).toBeNull();
  });

  test('Legends & Society carries the Calendar button; Trends carries both', async () => {
    window.history.pushState({}, '', '/universe?tab=society&sub=legends');
    renderAt('/universe?tab=society&sub=legends');
    expect(screen.getByTestId('society-reads-legends').textContent).toContain('Character Registry');
    await waitFor(() => expect(screen.getByTestId('brain-update-button-calendar').textContent).toBe('🧠 Calendar: Brain Up to Date ✓'));
    expect(screen.queryByTestId('brain-update-button')).toBeNull();
    fireEvent.click(screen.getByText('Trends'));
    expect(screen.getByTestId('society-reads-trends')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Brain Up to Date ✓'));
    expect(screen.getByTestId('brain-update-button-calendar')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/social_systems/preview', expect.anything());
    expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/sync/cultural_calendar/preview', expect.anything());
  });

  test('every sub-tab has its note', () => {
    window.history.pushState({}, '', '/universe?tab=society&sub=rules');
    renderAt('/universe?tab=society&sub=rules');
    expect(screen.getByTestId('society-reads-rules').textContent).toContain('not from this page');
  });
});
