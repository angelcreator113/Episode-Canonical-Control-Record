/**
 * Home as the show's front page and today's work (Evoni, 2026-10-23: "combine
 * the homepage and daily update page", laid out like her mockup).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Evoni' } }) }));

import apiClient from '../services/api';
import Home, { daysUntil, trending, continueEpisode, todoItems, upcomingEvent, homeShow } from './Home';
import { EPS, EVENTS, POSTS, UPDATE, answerFor } from './Home.fixtures';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);
const href = (testid) => screen.getByTestId(testid).getAttribute('href');

describe('Home helpers', () => {
  test('daysUntil reads a date and refuses free text', () => {
    const now = new Date('2026-10-23T09:00:00');
    expect(daysUntil('2026-10-25', now)).toBe(2);
    expect(daysUntil('Fri Oct 23 2026', now)).toBe(0);
    expect(daysUntil('Friday, the night of the gala', now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });

  test('trending is most liked first', () => {
    expect(trending(POSTS).map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    expect(trending(POSTS, 1)).toHaveLength(1);
  });

  test('continueEpisode picks the most recently worked-on episode still in progress', () => {
    expect(continueEpisode(EPS.slice(0, 2)).id).toBe('ep-6');
    expect(continueEpisode([EPS[1]]).id).toBe('ep-5');
    expect(continueEpisode([])).toBeNull();
  });

  test('todoItems lists the waiting items in group order', () => {
    expect(todoItems(UPDATE.waiting).map((r) => `${r.group}:${r.item.id}`)).toEqual(['drafts:d1', 'findings:c3']);
    expect(todoItems(undefined)).toEqual([]);
  });

  test('upcomingEvent falls back to the soonest dated unused event, marked not ready', () => {
    const up = upcomingEvent(EVENTS);
    expect(up.event.id).toBe('ev-2');
    expect(up.ready).toBe(false);
    expect(upcomingEvent([{ id: 'u', status: 'used', used_in_episode_id: 'e' }])).toBeNull();
  });

  test('homeShow is the remembered show, else the one with the most episodes', () => {
    const shows = [{ id: 'a', episodeCount: 1 }, { id: 'b', episodeCount: 9 }];
    localStorage.removeItem('primeStudios.activeShowId');
    expect(homeShow(shows).id).toBe('b');
    localStorage.setItem('primeStudios.activeShowId', 'a');
    expect(homeShow(shows).id).toBe('a');
    localStorage.removeItem('primeStudios.activeShowId');
    expect(homeShow([])).toBeNull();
  });
});

describe('Home layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('primeStudios.activeShowId');
    vi.mocked(apiClient.get).mockImplementation(answerFor());
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
  });

  test('the hero is the show, with Continue to the episode in progress', async () => {
    renderHome();
    const hero = await screen.findByTestId('home-hero');
    expect(within(hero).getByRole('heading', { level: 1 }).textContent).toBe('Styling Adventures with Lala');
    expect(hero.classList.contains('has-picture')).toBe(true);
    expect(within(hero).getByAltText('Lala').getAttribute('src')).toBe('https://img/lala.jpg');
    expect(href('home-continue-top')).toBe('/episodes/ep-6');
  });

  test('the tiles open real pages, the missing ones swapped for real ones', async () => {
    renderHome();
    await screen.findByTestId('home-hero');
    expect(href('home-tile-episodes')).toBe('/shows/show-1/world?tab=episodes-production');
    expect(href('home-tile-closet')).toBe('/shows/show-1/world?tab=wardrobe-items');
    expect(href('home-tile-style')).toBe('/episodes/ep-6?tab=lookbook');
    expect(href('home-tile-cast')).toBe('/character-registry?view=world');
    expect(href('home-tile-map')).toBe('/universe?tab=world&sub=map');
    expect(href('home-tile-bank')).toBe('/shows/show-1/world?tab=finances');
    expect(href('home-tile-shop')).toBe('/shop-the-look');
    expect(href('home-tile-pulse')).toBe('/pulse');
  });

  test('Continue Episode shows the stage; Upcoming Event the next unused event', async () => {
    renderHome();
    const cont = await screen.findByTestId('home-continue');
    expect(within(cont).getByText('The Fashion Studio Experiment')).toBeTruthy();
    expect(within(cont).getByText('Production · stage 3 of 5')).toBeTruthy();
    const ev = screen.getByTestId('home-event');
    expect(within(ev).getByText('The Honey Table')).toBeTruthy();
    expect(within(ev).getByText('Still being set up')).toBeTruthy();
    expect(within(ev).getByRole('link', { name: 'View event' }).getAttribute('href')).toBe('/shows/show-1/world?tab=events&event=ev-2');
  });

  test('Trending is the most liked posts first', async () => {
    renderHome();
    const tr = await screen.findByTestId('home-trending');
    expect([...tr.querySelectorAll('.hp-trend__text')].map((n) => n.textContent)).toEqual(['Which bag?', 'New hair', 'Quiet']);
    expect(within(tr).getByText('15K')).toBeTruthy();
  });

  test("Lala's numbers and the newest look", async () => {
    renderHome();
    const j = await screen.findByTestId('home-journey');
    expect(within(j).getByText('1,250')).toBeTruthy();
    const shop = screen.getByTestId('home-shop');
    expect(within(shop).getByText('Episode 5: Rooftop Brunch')).toBeTruthy();
    expect(within(shop).getByRole('link', { name: "Shop Lala's closet" }).getAttribute('href')).toBe('/shop-the-look/abcdefghijkl');
  });

  test("Today's To-Do decides an item here, and reads the rest from /today", async () => {
    renderHome();
    const todo = await screen.findByTestId('home-todo');
    expect(within(todo).getByTestId('home-since').textContent).toBe('4 went live · 6 scheduled · 1 new · AI $1.42 of $10.00');
    expect(within(todo).getByText('3')).toBeTruthy();
    const row = within(todo).getByTestId('home-todo-drafts:d1');
    fireEvent.click(within(row).getByRole('button', { name: /Publish/ }));
    await waitFor(() => expect(within(row).getByText('Published')).toBeTruthy());
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/feed-posts/d1', { status: 'live' });
    // A finding is fixed elsewhere: Open, not a decision.
    expect(within(within(todo).getByTestId('home-todo-findings:c3')).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/character/c3');
    expect(within(todo).getByRole('link', { name: 'Open tasks' }).getAttribute('href')).toBe('/today');
  });

  test('a failed decision says so and leaves the buttons', async () => {
    vi.mocked(apiClient.put).mockRejectedValue({ response: { status: 409, data: { error: 'Already live' } } });
    renderHome();
    const row = await screen.findByTestId('home-todo-drafts:d1');
    fireEvent.click(within(row).getByRole('button', { name: /Publish/ }));
    expect((await within(row).findByRole('alert')).textContent).toBe('Already live');
    expect(within(row).getByRole('button', { name: /Publish/ })).toBeTruthy();
  });

  test('without the daily update (not an admin) the To-Do card says so; the rest still shows', async () => {
    vi.mocked(apiClient.get).mockImplementation(answerFor({ '/api/v1/daily-update': Object.assign(new Error('403'), { response: { status: 403 } }) }));
    renderHome();
    const todo = await screen.findByTestId('home-todo');
    expect(within(todo).getByText(/isn.t available right now/)).toBeTruthy();
    expect(screen.getByTestId('home-trending')).toBeTruthy();
  });
});
