/**
 * Three different decisions about a set's images:
 *   Library cover        the card's picture in the library (a small choice);
 *   Main background      the set's primary image; making a view the main
 *                        background clears the other views' images;
 *   Approved base        the original event versions are made from (S6).
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab, { promoteConfirmText, libraryCoverUrl, ApprovedBaseRow } from './SceneSetsTab';

const angle = (id, name, img, sort) => ({ id, angle_label: name.toUpperCase(), angle_name: name, generation_status: img ? 'complete' : 'pending', still_image_url: img, sort_order: sort });
const SET = (extra = {}) => ({
  id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/base.jpg',
  angles: [angle('a1', 'Vanity', 'https://x/vanity.jpg', 0), angle('a2', 'Window', 'https://x/window.jpg', 1), angle('a3', 'Door', null, 2)],
  ...extra,
});

describe('helpers', () => {
  test('the card shows the cover view, else the main background', () => {
    expect(libraryCoverUrl(SET())).toBe('https://x/base.jpg');
    expect(libraryCoverUrl(SET({ cover_angle_id: 'a2' }))).toBe('https://x/window.jpg');
    // A cover view with no image falls back to the main background.
    expect(libraryCoverUrl(SET({ cover_angle_id: 'a3' }))).toBe('https://x/base.jpg');
  });

  test('the main-background confirmation says how many views lose their images', () => {
    const s = SET();
    expect(promoteConfirmText(s, s.angles[0])).toBe('Make "Vanity" the main background?\n\nThe set\'s other 1 view will lose its image and go back to "to generate".');
    const three = SET({ angles: [...s.angles, angle('a4', 'Stage', 'https://x/s.jpg', 3)] });
    expect(promoteConfirmText(three, three.angles[0])).toContain('other 2 views will lose their images');
  });

  test('approval says what it means', () => {
    render(<ApprovedBaseRow set={{ id: 's', name: 'Hall', world_location_id: 'loc', base_still_url: 'https://x/b.jpg' }} />);
    expect(screen.getByTestId('approved-base-s').textContent).toMatch(/original that event versions at this location are made from/);
  });
});

describe('SceneSetsTab: cover, main background, approval', () => {
  let current;
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    current = SET();
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      url.includes('/scene-sets') ? { data: { success: true, data: [current] } } : { data: { success: true, data: [] } }
    ));
    vi.mocked(apiClient.patch).mockImplementation(async (url, body) => {
      current = { ...current, cover_angle_id: body.angle_id, updated_at: String(Date.now()) };
      return { data: { success: true } };
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => { vi.restoreAllMocks(); });
  const open = async () => {
    render(<MemoryRouter><SceneSetsTab /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('scene-set-open-set-1'));
  };

  test('Set as library cover changes the card picture only; it can be undone', async () => {
    await open();
    fireEvent.click(screen.getByTestId('cover-a2'));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/cover-angle', { angle_id: 'a2' }));
    await waitFor(() => expect(screen.getByTestId('cover-a2').textContent).toContain('Library cover ✓'));
    expect(screen.getByTestId('scene-set-card-image-set-1').getAttribute('src')).toContain('https://x/window.jpg');
    // The main background is unchanged, and no promote was called.
    expect(screen.getByTestId('scene-set-main-bg-set-1').querySelector('img').getAttribute('src')).toContain('https://x/base.jpg');
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('cover-a2'));
    await waitFor(() => expect(apiClient.patch).toHaveBeenLastCalledWith('/api/v1/scene-sets/set-1/cover-angle', { angle_id: null }));
  });

  test('Make main background asks first, naming what is lost; Cancel does nothing', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByTestId('promote-a1'));
    expect(ask).toHaveBeenCalledWith(expect.stringContaining('other 1 view will lose its image'));
    expect(apiClient.post).not.toHaveBeenCalled();
    ask.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('promote-a1'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/promote-to-base', { angle_id: 'a1' }));
  });

  test('an approved base offers no Make main background (S6), but the cover can still change', async () => {
    current = SET({ base_approved: true });
    await open();
    expect(screen.queryByTestId('promote-a1')).toBeNull();
    expect(screen.getByTestId('cover-a1')).toBeTruthy();
    expect(within(screen.getByTestId('scene-set-main-bg-set-1')).getByTestId('approved-base-set-1').textContent)
      .toMatch(/can't be replaced until it is un-approved/);
  });
});
