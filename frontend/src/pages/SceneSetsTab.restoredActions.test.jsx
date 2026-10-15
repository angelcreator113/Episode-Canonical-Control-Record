/**
 * Scene Sets audit (2026-10-15): actions the page had but nobody could
 * reach. Regenerate and Regenerate base + angles had no button (their only
 * caller was never called); Wardrobe Match sat in a hidden tab and set
 * state of another component; and an angle whose spec check could not run
 * showed a passing score.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const ANGLE = {
  id: 'ang-1', angle_label: 'WIDE', angle_name: 'Wide', generation_status: 'complete', still_image_url: 'https://x/wide.jpg',
  quality_review: { spec_validation: { checked: false, score: null, pass: null, reason: 'No Anthropic key' } },
};
const SETS = [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [ANGLE], generation_status: 'complete', base_still_url: 'https://x/atelier.jpg', base_approved: false, canonical_description: 'A sunlit atelier.' },
  { id: 'set-2', name: 'The Glasshouse', scene_type: 'EVENT_LOCATION', angles: [], generation_status: 'complete', base_still_url: 'https://x/glass.jpg', base_approved: true },
];
const renderTab = () => render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);

describe('SceneSetsTab: the actions the audit found unreachable', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.includes('/wardrobe-match')) {
        return { data: { success: true, event: { name: 'Velour Launch', dress_code: 'Black tie', keywords: ['velvet'] }, matches: [{ id: 'w1', name: 'Velvet gown' }] } };
      }
      return url.includes('/scene-sets') ? { data: { success: true, data: SETS } } : { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: {} } });
  });

  test('a base that is not approved can be regenerated, alone or with its angles; an approved one cannot', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    expect(screen.getByTestId('scene-set-regenerate-base-set-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('scene-set-cascade-set-1'));
    // The brief is shown first (S2): nothing is generated yet.
    await waitFor(() => expect(screen.getByText(/the base, then every angle/)).toBeTruthy());
    expect(vi.mocked(apiClient.post).mock.calls.map(([u]) => u).filter((u) => /cascade-regenerate|generate-base/.test(u))).toEqual([]);
  });

  test('an approved base offers neither', async () => {
    renderTab();
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-2'));
    expect(document.querySelector('[data-testid="scene-set-regenerate-base-set-2"]')).toBeNull();
    expect(document.querySelector('[data-testid="scene-set-cascade-set-2"]')).toBeNull();
  });

  test('Wardrobe Match, on Details & Usage, shows the event\'s matches', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    fireEvent.click(screen.getByRole('button', { name: /Details & Usage/ }));
    fireEvent.click(screen.getByRole('button', { name: /Wardrobe Match/ }));
    await waitFor(() => expect(screen.getByText('Velvet gown')).toBeTruthy());
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/wardrobe-match');
    expect(screen.getByText('Black tie')).toBeTruthy();
  });

  test('a spec check that could not run shows as not checked, with no score', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    const badge = await screen.findByTestId('spec-unchecked-ang-1');
    expect(badge.getAttribute('title')).toBe('Spec not checked: No Anthropic key');
    expect(badge.textContent).not.toMatch(/\d/);
  });
});
