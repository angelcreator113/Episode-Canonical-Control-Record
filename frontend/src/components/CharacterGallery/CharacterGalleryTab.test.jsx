/**
 * Evoni, 2026-10-18: a Gallery tab with every picture already linked to the
 * character, grouped, so the Appearance tab is not crowded.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CharacterGalleryTab from './CharacterGalleryTab';

const maren = { id: 'c-1', display_name: 'Maren' };
const groups = [
  { key: 'portraits', label: 'Portraits', items: [{ id: 'portrait:0', url: 'https://img/p.png', caption: 'Their profile photo', source: 'profile_photo' }] },
  { key: 'places', label: 'Places', items: [] },
  { key: 'wardrobe', label: 'Wardrobe', items: [{ id: 'wardrobe:w1', url: 'https://img/w.png', caption: 'Silk slip dress', source: 'wardrobe' }] },
  { key: 'events', label: 'Events', items: [] },
  { key: 'posts', label: 'Posts', items: [{ id: 'post:1:0', url: 'https://img/post.png', caption: 'Draft: Studio day', source: 'draft_post' }] },
];

describe('CharacterGalleryTab', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  test('every group is shown, with its pictures or where to add them', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, linked: true, groups } });
    const openTab = vi.fn();
    render(<CharacterGalleryTab character={maren} openTab={openTab} />);
    expect(await screen.findByText(/3 pictures of Maren/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/gallery');
    expect(within(screen.getByTestId('gallery-wardrobe')).getByAltText('Silk slip dress').getAttribute('loading')).toBe('lazy');
    const places = screen.getByTestId('gallery-places');
    expect(places.textContent).toContain('Link their home, closet or work on the Places & Gallery tab');
    fireEvent.click(within(places).getByRole('button', { name: 'Open Places & Gallery' }));
    expect(openTab).toHaveBeenCalledWith('places');
  });

  test('a picture opens larger, and closes', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, linked: true, groups } });
    render(<CharacterGalleryTab character={maren} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open: Their profile photo' }));
    const viewer = screen.getByRole('dialog');
    expect(within(viewer).getByRole('link', { name: /Open image/ }).getAttribute('href')).toBe('https://img/p.png');
    fireEvent.click(within(viewer).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('with no feed profile and no pictures it says so', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, linked: false, groups: groups.map((g) => ({ ...g, items: [] })) } });
    render(<CharacterGalleryTab character={maren} />);
    const text = (await screen.findByTestId('character-gallery')).textContent;
    expect(text).toContain('No pictures of Maren yet.');
    expect(text).toContain('their events and posts are not here yet');
  });

  test('under their places, the places group is left out: the place editor above shows them', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, linked: true, groups } });
    render(<CharacterGalleryTab character={maren} hide={['places']} />);
    await screen.findByTestId('character-gallery');
    expect(screen.queryByTestId('gallery-places')).toBeNull();
    expect(screen.getByTestId('gallery-wardrobe')).toBeTruthy();
  });
});
