/**
 * The Society tab after the per-tab fix (2026-10-04): each sub-tab says who
 * reads its lists (Brain Update writes them into the Show Bible, but no
 * generator reads those cards yet, wiring map §8, 2026-10-06; the Feed
 * generator keeps its own archetype list) and carries
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
    const note = screen.getByTestId('society-reads-archetypes').textContent;
    expect(note).toContain('own built-in list');
    // Card by card (fix-list item 24): a card reaches the generators when marked in the Show Bible.
    expect(note).toContain('A card reaches the generators only when you mark it “In every prompt” in the Show Bible; Brain Update keeps that mark when it updates the card.');
    // The copy never claims a generator reads the cards, and has no old "Edit them here" line.
    expect(screen.queryByText(/script writers|Edit them here/)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('brain-update-button').textContent).toBe('🧠 Brain Up to Date ✓'));
    expect(screen.queryByTestId('brain-update-button-calendar')).toBeNull();
  });

  test('Legends & Society carries the Calendar button; Trends carries both', async () => {
    window.history.pushState({}, '', '/universe?tab=society&sub=legends');
    renderAt('/universe?tab=society&sub=legends');
    // No code links a legend role to a character (wiring map §1), so the note doesn't promise one.
    expect(screen.getByTestId('society-reads-legends').textContent).toContain('nothing in the app links a role to a character yet');
    expect(screen.queryByText(/Character Registry/)).toBeNull();
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
    const note = screen.getByTestId('society-reads-rules').textContent;
    expect(note).toContain('A card reaches the generators only when you mark it “In every prompt” in the Show Bible');
    expect(note).not.toMatch(/script writers|event generator|Amber read/);
  });
});
