/**
 * The character page to Evoni's STUDIO BY SABLE mock (2026-10-08): the
 * header from the feed profile, five tabs, and an Overview of who they
 * are (editable; Rewrite drafts it, nothing saves until Save), where they
 * show up, their voice and what is between them and Lala.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

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
    // The role as The cast says it (ROLE_LABELS): support is Supporting.
    expect(screen.getByText('@studiobysable · Supporting · Echo Park')).toBeTruthy();
    expect(screen.getByText('The peer')).toBeTruthy();
    expect(screen.getByText('Feed profile')).toBeTruthy();
    // Saved as Breathing, but a feed profile already makes them Active.
    expect(screen.getByText('Active', { selector: '.ch-chip' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '↑ Deepen to Alive' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← The cast' }).getAttribute('href')).toBe('/character-registry');
    expect(screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.className.includes('ch-tab')).map((b) => b.textContent))
      .toEqual(['Overview', 'Inner life', 'Appearance', 'Voice & feed', 'Connections', 'In the world', 'Places']);
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
    // The workspace's five sections (step 2), not the old always-open panels.
    for (const name of [/Core psychology/, /Emotional architecture/, /Personal history/, /Beliefs & behaviours/, /Deep profile/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByTestId('il-subject-wants')).toBeTruthy();
    expect(screen.queryByTestId('depth-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'In the world' }));
    fireEvent.change(screen.getByLabelText('World'), { target: { value: 'lalaverse' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { world: 'lalaverse' }));
    expect(screen.getByLabelText('World').value).toBe('lalaverse');
  });

  test('Inner life: Generate fills that section in', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, filled: ['wound'], character: { ...CHARACTER, wound: { description: 'The shop that closed.' } } } });
    renderIt();
    await waitFor(() => expect(screen.getAllByText('In Episode 1')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Inner life' }));
    const wound = screen.getByText('Wound not written yet.').closest('.cp-empty-state');
    fireEvent.click(wound.querySelector('button'));
    await waitFor(() => expect(screen.getByText('The shop that closed.')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/interior/generate', { fields: ['wound'] });
    expect(screen.queryByText('Wound not written yet.')).toBeNull();
  });

  test('Deepen drafts everything missing on the Inner life tab, and saves what is kept', async () => {
    const want = { surface_want: 'To be stocked', real_want: 'To be chosen', forbidden_want: 'To quit' };
    vi.mocked(api.post).mockImplementation(async (url, body) => {
      if (url.endsWith('/interior/generate')) return { data: { success: true, preview: true, proposed: { want_architecture: want, experience_of_joy: 'Fittings' } } };
      return { data: { success: true, filled: ['want_architecture'], skipped: [], character: { ...CHARACTER, want_architecture: body.values.want_architecture } } };
    });
    renderIt();
    await waitFor(() => expect(screen.getAllByText('In Episode 1')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: '↑ Deepen to Alive' }));
    await waitFor(() => expect(screen.getByTestId('il-review')).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/interior/generate', { preview: true });
    expect(screen.getByRole('button', { name: 'Inner life' }).getAttribute('aria-pressed')).toBe('true');
    // Nothing saved yet.
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /Joy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 of 2' }));
    await waitFor(() => expect(screen.getByText('Filled in: want.')).toBeTruthy());
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/character-registry/characters/c1/interior/apply', { values: { want_architecture: want } });
    expect(screen.queryByTestId('il-review')).toBeNull();
    expect(screen.getByText('To be chosen')).toBeTruthy();
  });

  test('a failed Generate says why', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Daily AI budget reached.' } } });
    renderIt();
    await waitFor(() => expect(screen.getAllByText('In Episode 1')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Inner life' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill in everything missing' }));
    await waitFor(() => expect(screen.getByText('Daily AI budget reached.')).toBeTruthy());
  });

  test('a deep profile from the older endpoints (objects, not text) opens without crashing', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: { ...CHARACTER, deep_profile: { the_body: { posture: 'Upright', stress_location: '' } } } } };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Inner life' }));
    fireEvent.click(screen.getByRole('button', { name: /Deep profile/ }));
    expect(screen.getByText('1/14 dimensions')).toBeTruthy();
    fireEvent.click(screen.getByText('The Body'));
    expect(screen.getByText('posture: Upright')).toBeTruthy();
  });

  test('a finalized character offers no Generate', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: { ...CHARACTER, status: 'finalized' } } };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Inner life' }));
    expect(screen.queryByRole('button', { name: /Generate/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fill in everything missing' })).toBeNull();
  });

  test('their names: the real one heads the page, the social one follows, and both save', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url === '/api/v1/social-profiles/7') return { data: { profile: { ...PROFILE, display_name: 'STUDIO BY SABLE', creator_name: 'Sable Okafor' } } };
      if (url === '/api/v1/cast/characters/c1/appearances') return { data: APPEARANCES };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sable Okafor'));
    expect(screen.getByTestId('ch-aka').textContent).toBe('Online as STUDIO BY SABLE');
    const names = screen.getByTestId('ch-names');
    expect(names.textContent).toContain('Sable Okafor');
    expect(names.textContent).toContain('@studiobysable');

    fireEvent.click(within(names).getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Real name'), { target: { value: 'Sable Okafor-Reid' } });
    fireEvent.click(within(names).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { selected_name: 'Sable Okafor-Reid' }));

    fireEvent.click(within(screen.getByTestId('ch-names')).getAllByRole('button', { name: 'Edit' })[1]);
    fireEvent.change(screen.getByLabelText('Social media name'), { target: { value: 'Sable Studio' } });
    fireEvent.click(within(screen.getByTestId('ch-names')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/social-profiles/7', { display_name: 'Sable Studio' }));
  });

  test('no real name yet: Suggest one asks the generator for it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, filled: ['selected_name'], character: { ...CHARACTER, selected_name: 'Maren Ellis' } } });
    renderIt();
    await waitFor(() => expect(screen.getByTestId('ch-names')).toBeTruthy());
    expect(screen.getByTestId('ch-names').textContent).toContain('Not set');
    fireEvent.click(screen.getByRole('button', { name: /Suggest one/ }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maren Ellis'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/interior/generate', { fields: ['selected_name'] });
  });

  test('Connections loads entanglements from the route that exists, with who they are', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url === '/api/v1/entanglements/characters/c1/entanglements') {
        return { data: { entanglements: [{ id: 'e1', dimension: 'ambition_identity', intensity: 'high', directionality: 'one_way', profile: { id: 9, handle: 'slowsift', display_name: 'slowsift' } }] } };
      }
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Connections' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'slowsift' }).getAttribute('href')).toBe('/pulse?profile=9'));
    expect(screen.getByText('one way')).toBeTruthy();
    expect(screen.queryByText('unresolved')).toBeNull();
  });

  test('Lala is the Protagonist on her page, as on The cast', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: { ...CHARACTER, display_name: 'Lala', character_key: 'lala', role_type: 'special', feed_profile_id: null } } };
      return { data: {} };
    });
    renderIt();
    await waitFor(() => expect(screen.getByText('Protagonist')).toBeTruthy());
    expect(screen.queryByText(/Special/)).toBeNull();
  });

  test('their places: the home with its everyday picture, shared to The Pulse as a draft', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url === '/api/v1/cast/characters/c1/places') {
        return { data: { success: true, show_id: 's1', is_lead: false, places: [
          { role: 'home', scene_set_id: 'set-1', scene_set_name: "Sable's Loft", image_url: 'https://cdn/everyday.jpg', everyday: true },
        ] } };
      }
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, post: { id: 'post-1' } } });
    renderIt();
    const places = await screen.findByTestId('ch-places');
    await waitFor(() => expect(places.textContent).toContain("Sable's Loft"));
    expect(places.textContent).toContain('Home · everyday look');
    expect(places.querySelector('img').getAttribute('src')).toBe('https://cdn/everyday.jpg');
    fireEvent.click(within(places).getByRole('button', { name: 'Share to The Pulse' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/places/share', { scene_set_id: 'set-1' }));
    expect(await within(places).findByRole('link', { name: 'Open Review' })).toBeTruthy();
  });

  test('no home yet: choose one of the show\'s scene sets', async () => {
    vi.mocked(api.get).mockImplementation(async (url, opts) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url === '/api/v1/cast/characters/c1/places') return { data: { success: true, show_id: 's1', places: [] } };
      if (url === '/api/v1/scene-sets' && opts?.params?.show_id === 's1') return { data: { success: true, data: [{ id: 'set-9', name: 'Echo Park Studio' }] } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    renderIt();
    const places = await screen.findByTestId('ch-places');
    fireEvent.click(await within(places).findByRole('button', { name: 'Choose their home' }));
    fireEvent.change(await within(places).findByLabelText('Their home set'), { target: { value: 'set-9' } });
    fireEvent.click(within(places).getByRole('button', { name: 'Make it home' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/s1/character-places', { character_id: 'c1', scene_set_id: 'set-9', role: 'home' }));
  });
});

