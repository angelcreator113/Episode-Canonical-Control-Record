/**
 * Story & Events (Evoni's mock, 2026-10-18, step 6 of the character page):
 * a new tab with its own sections; the overview's counts, latest episode,
 * what is coming up, recent posts, Lala's goals and the timeline; each list
 * in full with pages.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import CharacterProfilePage, { TabStory, goalsOf, timelineOf, timelineNow } from './CharacterProfilePage';

const NOW = new Date('2026-10-18T00:00:00Z').getTime();
const CHARACTER = { id: 'c1', display_name: 'Sable', feed_profile_id: 7, status: 'accepted' };
const APPEARANCES = {
  linked: true,
  episodes: [{ id: 'ep1', episode_number: 1, title: 'I Designed My Outfit' }, { id: 'ep2', episode_number: 2, title: 'The Gala' }],
  events: [
    { id: 'v1', show_id: 's1', name: 'Wearable Experiments', role: 'host', event_date: '2026-11-12', episode: { id: 'ep1', episode_number: 1 }, goals: [{ label: 'Build her brand' }] },
    { id: 'v2', show_id: 's1', name: 'The Honey Table Brunch', role: 'guest', event_date: '2026-12-05', description: 'A creative brunch', goals: [] },
    { id: 'v3', show_id: 's1', name: 'Spring Gala', role: 'guest', event_date: '2026-04-01' },
  ],
};
const TRAIL = {
  posts: [
    { id: 'p1', text: 'the dress before it knew', status: 'posted', at: '2026-10-14T10:00:00Z' },
    { id: 'p2', text: 'sketching', status: 'draft', at: '2026-10-16T10:00:00Z' },
  ],
  stories: [{ id: 's1', title: 'The Linen Swap', format: 'short_story', status: 'draft', show_id: 'sh1' }],
  chapters: [{ id: 'ch1', book_id: 'b1', title: 'One', book_title: 'Before Lala', written: false }],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (url.endsWith('/story-trail') ? { data: TRAIL } : { data: {} }));
});

const renderTab = (openTab = vi.fn()) => render(
  <MemoryRouter><TabStory character={CHARACTER} feedProfile={{ id: 7 }} appearances={APPEARANCES} openTab={openTab} now={NOW} /></MemoryRouter>,
);

describe('Story & Events', () => {
  test('the overview: counts, latest episode, coming up, posts, goals', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByTestId('ch-st-posts').textContent).toContain('the dress before it knew'));
    expect(within(screen.getByTestId('ch-story-tiles')).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '2Episodes', '3Events2 upcoming', '2Pulse posts1 posted', "1Lala's goalsat their events", '2Stories & chapters',
    ]);
    expect(screen.getByTestId('ch-st-latest').textContent).toContain('Episode 2The Gala');
    const upcoming = screen.getByTestId('ch-st-upcoming');
    expect(within(upcoming).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/shows/s1/events/v1', '/shows/s1/events/v2']);
    expect(upcoming.textContent).toContain('Nov12');
    expect(upcoming.textContent).toContain('A creative brunch');
    expect(upcoming.textContent).not.toContain('Spring Gala');
    expect(screen.getByTestId('ch-st-goals').textContent).toContain('Build her brandAt Wearable Experiments');
  });

  test('each section in full; posts drafting goes to Voice & Pulse', async () => {
    const openTab = vi.fn();
    renderTab(openTab);
    const nav = screen.getByRole('navigation', { name: 'Story sections' });
    fireEvent.click(within(nav).getByRole('button', { name: /Events/ }));
    expect(within(nav).getByRole('button', { name: /Events/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByTestId('ch-st-events')).getAllByRole('link')).toHaveLength(3);
    expect(screen.getByTestId('ch-st-events').textContent).toContain('Past');
    fireEvent.click(within(nav).getByRole('button', { name: /Episodes/ }));
    expect(within(screen.getByTestId('ch-st-episodes')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/episodes/ep2', '/episodes/ep1']);
    expect(screen.getByTestId('ch-st-episodes').textContent).toContain('Wearable Experiments · Hosting');
    fireEvent.click(within(nav).getByRole('button', { name: /Stories & chapters/ }));
    await waitFor(() => expect(screen.getByTestId('ch-st-stories').textContent).toContain('The Linen Swap'));
    expect(screen.getByTestId('ch-st-stories').textContent).toContain('Before Lala · not written yet');
    fireEvent.click(within(nav).getByRole('button', { name: /Pulse posts/ }));
    fireEvent.click(screen.getByRole('button', { name: /Draft new posts/ }));
    expect(openTab).toHaveBeenCalledWith('voice');
  });

  test('goals and the timeline in order', () => {
    expect(goalsOf(APPEARANCES).map((g) => g.label)).toEqual(['Build her brand']);
    expect(timelineOf(APPEARANCES, TRAIL).map((x) => x.title)).toEqual([
      'Guest at an event', 'Posted to The Pulse', 'Drafted a post', 'Hosts an event', 'Guest at an event',
      'Featured in Episode 1', 'Featured in Episode 2',
    ]);
    // The overview's strip: from today on, else the latest.
    const items = timelineOf(APPEARANCES, TRAIL);
    // Two ahead (Nov 12, Dec 5), so the strip reaches back two to fill four.
    expect(timelineNow(items, NOW, 4).map((x) => x.key)).toEqual(['post-p1', 'post-p2', 'event-v1', 'event-v2']);
    // Before everything: from the start; after everything: the latest four.
    expect(timelineNow(items, 0, 2).map((x) => x.key)).toEqual(['event-v3', 'post-p1']);
    expect(timelineNow(items, Date.UTC(2030, 0, 1), 2).map((x) => x.key)).toEqual(['event-v1', 'event-v2']);
  });

  test('the tab opens from ?tab=story', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url.endsWith('/story-trail')) return { data: TRAIL };
      return { data: {} };
    });
    render(
      <MemoryRouter initialEntries={['/character/c1?tab=story']}>
        <Routes><Route path="/character/:id" element={<CharacterProfilePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('ch-story-tab')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Story & Events' }).getAttribute('aria-current')).toBe('page');
  });
});
