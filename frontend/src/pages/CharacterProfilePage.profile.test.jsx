/**
 * The pink-and-gold profile's new Overview cards (Evoni's Marisol Vega mock,
 * 2026-10-16): profile images, stats, their events, their people. Each reads
 * data the page already loads, or the existing photo routes.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { ProfileImages, TheirStats, TheirEvents, ConnectionsCard } from './CharacterProfilePage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Profile images', () => {
  beforeEach(() => { api.post.mockReset(); api.delete.mockReset(); });

  test('uploads a profile photo as `image` to photo?kind=portrait and shows it', async () => {
    const onSaved = vi.fn();
    api.post.mockResolvedValue({ data: { success: true, portrait_url: 'https://x/p.jpg' } });
    inRouter(<ProfileImages character={{ id: 'c1', display_name: 'velvetcore' }} onSaved={onSaved} />);
    const card = screen.getByTestId('ch-images');
    expect(within(card).getByText('No profile photo yet')).toBeTruthy();
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    fireEvent.change(within(card).getByLabelText('Add profile photo'), { target: { files: [file] } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ portrait_url: 'https://x/p.jpg' }));
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/api/v1/character-registry/characters/c1/photo?kind=portrait');
    expect(form.get('image')).toBe(file);
    expect(await within(card).findByText('Profile photo updated.')).toBeTruthy();
  });

  test('removes a cover photo, and shows the route\'s refusal', async () => {
    const onSaved = vi.fn();
    api.delete.mockResolvedValue({ data: { success: true } });
    inRouter(<ProfileImages character={{ id: 'c1', cover_url: 'https://x/c.jpg' }} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover photo' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/photo?kind=cover'));
    expect(onSaved).toHaveBeenCalledWith({ cover_url: null });

    api.post.mockRejectedValue({ response: { data: { error: 'The photo is 15 MB at most.' } } });
    fireEvent.change(screen.getByLabelText('Replace cover photo'), { target: { files: [new File(['x'], 'c.jpg')] } });
    expect((await screen.findByRole('alert')).textContent).toBe('The photo is 15 MB at most.');
  });
});

describe('Key stats', () => {
  test('counts followers, posts, events, episodes and connections from what is loaded', () => {
    inRouter(<TheirStats feedProfile={{ follower_count_approx: '412K' }}
      appearances={{ feed: { posts: 7 }, episodes: [{ id: 'e1' }, { id: 'e2' }], events: [{ id: 'v1' }] }}
      relationships={[{ id: 'r1' }]} entanglements={[{ id: 'n1' }, { id: 'n2' }]} />);
    const values = within(screen.getByTestId('ch-stats')).getAllByRole('listitem').map((li) => li.textContent);
    expect(values).toEqual(['412KFollowers', '7Posts', '1Events', '2Episodes', '3Connections']);
  });

  test('with no feed profile, followers read — and say where they come from; a non-list counts as none', () => {
    inRouter(<TheirStats feedProfile={null} appearances={{ linked: false, events: [], episodes: [] }} relationships={{}} entanglements={null} />);
    const card = screen.getByTestId('ch-stats');
    expect(within(card).getAllByRole('listitem')[0].textContent).toBe('—Followers');
    expect(within(card).getAllByRole('listitem')[4].textContent).toBe('0Connections');
    expect(card.textContent).toContain('come from their feed profile');
  });
});

describe('Their events', () => {
  test('lists hosted and attended events with date, venue and episode, linking each', () => {
    inRouter(<TheirEvents appearances={{ events: [
      { id: 'ev1', show_id: 's1', name: 'Velour Society Garden Soirée', role: 'host', event_date: 'Oct 18', venue_name: 'Radiance Row', episode: { episode_number: 4 } },
      { id: 'ev2', show_id: 's1', name: 'Crimson Atelier Launch', role: 'guest' },
    ] }} />);
    const card = screen.getByTestId('ch-events');
    const soiree = within(card).getByRole('link', { name: /Velour Society Garden Soirée/ });
    expect(soiree.getAttribute('href')).toBe('/shows/s1/events/ev1');
    expect(soiree.textContent).toContain('Oct 18 · Radiance Row');
    expect(soiree.textContent).toContain('Hosting · Episode 4');
    expect(within(card).getByRole('link', { name: /Crimson Atelier Launch/ }).textContent).toContain('No date yet');
  });

  test('says so when there are none', () => {
    inRouter(<TheirEvents appearances={{ events: [] }} />);
    expect(screen.getByTestId('ch-events').textContent).toContain('No events yet');
  });
});

describe('Their people', () => {
  test('shows up to four relationships with tension, and See all opens the Connections tab', () => {
    const openTab = vi.fn();
    const rels = ['Lala', 'Stable', 'Dior', 'Kai', 'Extra'].map((n, i) => ({ id: `r${i}`, related_name: n, relationship_type: 'rival', tension_state: 'volatile' }));
    inRouter(<ConnectionsCard relationships={rels} entanglements={[{ id: 'e1' }]} openTab={openTab} />);
    const card = screen.getByTestId('ch-ties');
    expect(within(card).getAllByRole('listitem')).toHaveLength(4);
    expect(within(card).getByText('Lala')).toBeTruthy();
    expect(within(card).queryByText('Extra')).toBeNull();
    expect(within(card).getAllByRole('img', { name: 'volatile: strained' })).toHaveLength(4);
    fireEvent.click(within(card).getByRole('button', { name: 'See all 6' }));
    expect(openTab).toHaveBeenCalledWith('connections');
  });

  test('with no relationships it says so, counting feed ties', () => {
    inRouter(<ConnectionsCard relationships={[]} entanglements={[{ id: 'e1' }]} openTab={vi.fn()} />);
    expect(screen.getByTestId('ch-ties').textContent).toContain('1 feed tie, no relationships yet.');
  });
});
