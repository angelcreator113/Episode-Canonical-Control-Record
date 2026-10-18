/**
 * In the World to Evoni's mock (2026-10-18, step 5 of the character page):
 * world presence, the DREAM city map with their home, their events by
 * date, their story in the world, their places and latest posts.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import { WorldPresence, LalaVerseMap, WorldEvents, StoryInWorld, WorldPlaces, WorldFeed } from './CharacterProfilePage';
import { dreamCityOf } from '../lib/characterPage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const CHARACTER = { id: 'c1', display_name: 'Sable', role_type: 'support', appearance_mode: 'on_screen', status: 'accepted', world: 'lalaverse' };
const PROFILE = { city: 'echo_park' };
const APPEARANCES = {
  linked: true, place: { name: 'STUDIO BY SABLE’s Studio' },
  events: [
    { id: 'v1', show_id: 's1', name: 'Past Gala', role: 'guest', event_date: '2026-09-01' },
    { id: 'v2', show_id: 's1', name: 'Fabric and Form Showcase', role: 'host', event_date: '2026-11-20', event_time: '6:00 PM', venue_name: 'Dazzle District' },
    { id: 'v3', show_id: 's1', name: 'Wearable Experiments', role: 'host', event_date: '2026-11-12', episode: { episode_number: 1 } },
    { id: 'v4', show_id: 's1', name: 'Someday', role: 'guest', event_date: null },
  ],
};
const NOW = new Date('2026-10-18T00:00:00Z').getTime();

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('World presence', () => {
  test('home city and what it is the capital of, where they live, how they appear, their role; the world saves', async () => {
    const onSaved = vi.fn();
    inRouter(<WorldPresence character={CHARACTER} feedProfile={PROFILE} appearances={APPEARANCES} onSaved={onSaved} />);
    const card = screen.getByTestId('ch-world-presence');
    expect(card.textContent).toContain('Home cityEcho ParkCapital of entertainment');
    expect(card.textContent).toContain('Lives atSTUDIO BY SABLE’s Studio');
    expect(card.textContent).toContain('Appears asOn screen');
    expect(card.textContent).toContain('World roleSupporting · Event host');
    fireEvent.change(screen.getByLabelText('Story world'), { target: { value: 'series-2' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ world: 'series-2' }));
  });

  test('no city: Not set', () => {
    inRouter(<WorldPresence character={{ ...CHARACTER, world: null }} feedProfile={null} appearances={{ events: [] }} onSaved={vi.fn()} />);
    expect(screen.getByTestId('ch-world-presence').textContent).toContain('Home cityNot set');
    expect(screen.getByLabelText('Story world').value).toBe('');
  });
});

describe('the LalaVerse map', () => {
  test('the five DREAM cities, their home marked', () => {
    inRouter(<LalaVerseMap character={CHARACTER} feedProfile={PROFILE} />);
    const pins = within(screen.getByRole('list', { name: 'DREAM cities' })).getAllByRole('listitem');
    expect(pins).toHaveLength(5);
    const home = pins.filter((p) => p.className.includes('is-home'));
    expect(home.map((p) => p.textContent)).toEqual(['Echo ParkEntertainment (Home)']);
    expect(dreamCityOf('Dazzle District').capital).toBe('Fashion');
    expect(dreamCityOf('outside')).toBeNull();
  });
});

describe('their events', () => {
  test('upcoming soonest first, then past, then undated; three to a page', () => {
    inRouter(<WorldEvents appearances={APPEARANCES} now={NOW} />);
    const card = screen.getByTestId('ch-world-events');
    const names = () => within(card).getAllByRole('link').map((a) => a.querySelector('strong').textContent);
    expect(names()).toEqual(['Wearable Experiments', 'Fabric and Form Showcase', 'Past Gala']);
    expect(card.textContent).toContain('Nov 20, 2026 · 6:00 PM · Dazzle District');
    expect(within(card).getAllByRole('link')[2].textContent).toContain('Past');
    fireEvent.click(within(card).getByRole('button', { name: 'Next page' }));
    expect(names()).toEqual(['Someday']);
  });
});

describe('their story in the world', () => {
  test('living state, arc and threads', () => {
    inRouter(<StoryInWorld character={{
      ...CHARACTER, living_state: { current_situation: 'Opening the studio', momentum: 'Rising' }, arc_stage: 'rising_action',
      time_orientation: 'future', plot_threads: [{ title: 'The linen swap', status: 'open' }],
    }} gen={{ busy: null, run: vi.fn() }} />);
    const card = screen.getByTestId('ch-story-world');
    expect(card.textContent).toContain('Right nowOpening the studio');
    expect(card.textContent).toContain('MomentumRising');
    expect(card.textContent).not.toContain('The tension');
    expect(card.textContent).toContain('Arc: Rising action');
    expect(card.textContent).toContain('Lives in the future');
    expect(card.textContent).toContain('The linen swap · Open');
  });

  test('no living state: Generate', () => {
    inRouter(<StoryInWorld character={CHARACTER} gen={{ busy: null, run: vi.fn() }} />);
    expect(screen.getByText('Living state not generated yet.')).toBeTruthy();
  });
});

describe('their places and the feed', () => {
  test('places with pictures, View all opens Places', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { places: [{ role: 'home', scene_set_id: 'ss1', scene_set_name: 'The Studio', image_url: '/s.jpg' }], show_id: 's1' } });
    const openTab = vi.fn();
    inRouter(<WorldPlaces character={CHARACTER} openTab={openTab} />);
    const card = screen.getByTestId('ch-world-places');
    await waitFor(() => expect(card.textContent).toContain('The StudioHome'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/places');
    fireEvent.click(within(card).getByRole('button', { name: 'View all' }));
    expect(openTab).toHaveBeenCalledWith('places');
  });

  test('the latest three posted, no drafts', () => {
    const posts = [
      { id: 'p1', text: 'one', status: 'posted' }, { id: 'p2', text: 'draft', status: 'draft' },
      { id: 'p3', text: 'two', status: 'posted' }, { id: 'p4', text: 'three', status: 'posted' }, { id: 'p5', text: 'four', status: 'posted' },
    ];
    inRouter(<WorldFeed trail={{ posts }} openTab={vi.fn()} />);
    expect(within(screen.getByTestId('ch-world-feed')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two', 'three']);
  });
});
