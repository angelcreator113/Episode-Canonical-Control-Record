/**
 * The character page to Evoni's STUDIO BY SABLE mock (2026-10-08): the
 * header from the feed profile, five tabs, and an Overview of who they
 * are (editable; Rewrite drafts it, nothing saves until Save), where they
 * show up, their voice and what is between them and Lala.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => <div data-testid="depth-panel" /> }));

import api from '../services/api';
import CharacterProfilePage from './CharacterProfilePage';

const CHARACTER = {
  id: 'c1', display_name: 'STUDIO BY SABLE', character_key: 'studio_by_sable', role_type: 'support', depth_level: 'breathing',
  feed_profile_id: 7, prose_overview: "STUDIO BY SABLE's signature studio in Echo Park.", status: 'accepted',
  voice_signature: { catchphrases: ['make it wearable'] },
};
const PROFILE = { id: 7, handle: 'studiobysable', city: 'echo_park', society_archetype: 'the_peer', feed_layer: 'lalaverse', sample_captions: ['New drop, come play.'] };
const APPEARANCES = {
  success: true, linked: true,
  events: [{ id: 'ev1', show_id: 's1', name: 'Wearable Experiments Studio Session', role: 'host', event_date: 'Nov 12', venue_name: 'Echo Park', is_paid: true, payment_amount: 439, goals: [], episode: { id: 'ep1', episode_number: 1, title: 'I Designed My Outfit' } }],
  episodes: [{ id: 'ep1', episode_number: 1, title: 'I Designed My Outfit' }],
  place: null, feed: { posts: 2, lala_relationship: 'direct' },
};

const renderIt = () => render(
  <MemoryRouter initialEntries={['/character/c1']}>
    <Routes><Route path="/character/:id" element={<CharacterProfilePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
    if (url === '/api/v1/social-profiles/7') return { data: { profile: PROFILE } };
    if (url === '/api/v1/cast/characters/c1/appearances') return { data: APPEARANCES };
    return { data: {} };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('the character page', () => {
  test('the header: handle, city, chips and how alive they are', async () => {
    renderIt();
    await waitFor(() => expect(screen.getAllByText('In Episode 1')).toHaveLength(2));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('STUDIO BY SABLE');
    expect(screen.getByText('@studiobysable · Support · Echo Park')).toBeTruthy();
    expect(screen.getByText('The peer')).toBeTruthy();
    expect(screen.getByText('Feed profile')).toBeTruthy();
    expect(screen.getByRole('button', { name: '↑ Deepen to Active' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← The cast' }).getAttribute('href')).toBe('/character-registry');
    expect(screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.className.includes('ch-tab')).map((b) => b.textContent))
      .toEqual(['Overview', 'Inner life', 'Voice & feed', 'Connections', 'In the world']);
  });

  test('Overview: where they show up, their voice, and with Lala', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByTestId('ch-shows')).toBeTruthy());
    const shows = screen.getByTestId('ch-shows');
    expect(shows.textContent).toContain('Organizes Wearable Experiments Studio Session');
    expect(shows.textContent).toContain('Friends with Lala');
    expect(shows.querySelector('a').getAttribute('href')).toBe('/shows/s1/events/ev1');
    expect(screen.getByTestId('ch-voice').textContent).toContain('New drop, come play.');
    expect(screen.getByTestId('ch-voice').textContent).toContain('make it wearable');
    expect(screen.getByTestId('ch-lala').textContent).toContain('is paying her 439 coins');
  });

  test('Edit saves who they are; Rewrite only drafts until Save', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { paragraph: 'A drafted paragraph.' } });
    renderIt();
    await waitFor(() => expect(screen.getByTestId('ch-prose')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Rewrite from profile/ }));
    await waitFor(() => expect(screen.getByLabelText('Edit who they are').value).toBe('A drafted paragraph.'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/writer-paragraph/generate');
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Edit who they are'), { target: { value: 'Edited.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { prose_overview: 'Edited.' }));
    await waitFor(() => expect(screen.getByTestId('ch-prose').textContent).toBe('Edited.'));
  });

  test('a character with no feed profile says how to give them one', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: { ...CHARACTER, feed_profile_id: null } } };
      if (url === '/api/v1/cast/characters/c1/appearances') return { data: { success: true, linked: false, events: [], episodes: [], place: null, feed: null } };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByText(/Match them to a feed person/)).toBeTruthy());
    expect(screen.queryByText('Feed profile')).toBeNull();
  });

  test('the other tabs hold the old sections', async () => {
    renderIt();
    await waitFor(() => expect(screen.getAllByText('In Episode 1')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Inner life' }));
    expect(screen.getByText('Want Architecture')).toBeTruthy();
    expect(screen.getByTestId('depth-panel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'In the world' }));
    fireEvent.change(screen.getByLabelText('World'), { target: { value: 'lalaverse' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { world: 'lalaverse' }));
    expect(screen.getByLabelText('World').value).toBe('lalaverse');
  });
});
