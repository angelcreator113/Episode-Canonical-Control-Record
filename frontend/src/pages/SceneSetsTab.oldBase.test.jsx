/**
 * Scene Sets fourth audit (2026-10-15): after a new base, the views made
 * from the old one still showed as done, with nothing to say so.
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

const angle = (id, madeFrom, extra = {}) => ({
  id, angle_label: id.toUpperCase(), angle_name: id, generation_status: 'complete', still_image_url: `https://x/${id}.jpg`,
  quality_review: { ...(madeFrom ? { made_from_base: madeFrom } : {}), ...extra },
});
const sets = () => [{
  id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/new-base.jpg',
  angles: [angle('old', 'https://x/old-base.jpg'), angle('fresh', 'https://x/new-base.jpg'), angle('unknown', null), angle('edited', 'https://x/new-base.jpg', { stale: { reason: 'edited', fields: ['angle_description'] } })],
}];

describe('SceneSetsTab: views made from an older base', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => (url.includes('/scene-sets')
      ? { data: { success: true, data: sets() } } : { data: { success: true, data: [] } }));
  });

  test('only the view made from a replaced base is marked', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('scene-set-open-set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    expect(screen.getByTestId('angle-old-base-old').textContent).toMatch(/Made from an older base/);
    expect(screen.queryByTestId('angle-old-base-fresh')).toBeNull();
    expect(screen.queryByTestId('angle-old-base-unknown')).toBeNull();
  });

  test('a view edited since its picture is marked; the others are not', async () => {
    render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('scene-set-open-set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    expect(screen.getByTestId('angle-edited-stale-edited').textContent).toMatch(/Edited since this picture/);
    expect(screen.queryByTestId('angle-edited-stale-fresh')).toBeNull();
    expect(screen.queryByTestId('angle-edited-stale-old')).toBeNull();
  });
});
