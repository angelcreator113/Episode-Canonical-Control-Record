/**
 * Producer Mode → Overview, an episode in production (Evoni's mock,
 * 2026-10-17): its card (title, thumbnail, the switcher), the checklist as
 * section cards with their fix links, the actions, Episode Assets with
 * counts, Main Characters, Needs your attention, and the episode's money.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn() }));

import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import ShowOverview, { checklistSummary } from './ShowOverview';
import { CHECKLIST_SECTIONS } from '../Episodes/EpisodeProductionChecklist';

const EP = { id: 'ep-1', episode_number: 1, season_number: 1, status: 'draft', title: 'I Designed My Outfit', description: 'Lala steps into Studio by Sable.' };
const EP2 = { id: 'ep-2', episode_number: 2, season_number: 1, status: 'published', title: 'Second Look' };
const EP3 = { id: 'ep-3', episode_number: 1, season_number: 2, status: 'draft', title: 'New Season' };

const routes = (url) => {
  if (url.endsWith('/season/roadmap')) return { data: { roadmap: null } };
  if (url === '/api/v1/world/show-1/events/ev-9/financial-forecast') {
    return { data: { success: true, income: { total: 600 }, expenses: { total: 450, outfit_retail: 300, outfit_rentals: 50 }, projected_balance: { baseline: 2050 } } };
  }
  // The thumbnail editor's saved list; the old /api/v1/thumbnails reads are not called.
  if (url === '/api/v1/youtube-thumbnails/episodes/ep-1/saved') return { data: { success: true, data: [{ id: 7, url: 'https://b.s3.amazonaws.com/thumb.png', isPrimary: true }] } };
  if (url.startsWith('/api/v1/thumbnails/')) throw new Error(`old thumbnail read: ${url}`);
  if (url === '/api/v1/episode-clips/ep-1') return { data: { success: true, data: [{ id: 'c1', label: 'Lala_CamA.mp4', performer: 'lala', thumbnail_url: 'c.jpg', duration_seconds: 45 }, { id: 'c2', label: 'Guest.mov', performer: 'guest', guest_name: 'Tasha' }] } };
  if (url === '/api/v1/episodes/ep-1/scene-sets') return { data: { success: true, data: [{ id: 's1', name: 'Studio Interior' }] } };
  if (url.startsWith('/api/v1/registries')) return { data: { registries: [{ characters: [{ id: 'r1', character_key: 'lala', display_name: 'Lala' }, { id: 'r3', character_key: 'sable', display_name: 'Sable', role_type: 'support', role_label: 'Creative Partner' }] }] } };
  return { data: {} };
};

const renderIt = (props = {}) => render(
  <MemoryRouter><ShowOverview showId="show-1" episodes={[EP, EP2, EP3]} events={[]} goTo={() => {}} {...props} /></MemoryRouter>,
);

describe('checklistSummary', () => {
  test('counts the live sections\' items, labels each section, and names its first open required item', () => {
    const live = CHECKLIST_SECTIONS.filter((s) => !s.unavailableReason);
    const total = live.flatMap((s) => s.items).length;
    const brief = live.find((s) => s.id === 'brief');
    const checks = Object.fromEntries(brief.items.map((i) => [i.id, true]));
    checks.event_linked = true;
    const sum = checklistSummary(checks);
    expect(sum.total).toBe(total);
    expect(sum.done).toBe(brief.items.length + 1);
    expect(sum.sections.map((s) => s.id)).toEqual(live.map((s) => s.id));
    expect(sum.sections.find((s) => s.id === 'brief')).toMatchObject({ label: 'Complete', first_missing: null });
    expect(sum.sections.find((s) => s.id === 'scene').label).toBe('Not started');
    expect(checklistSummary({ wardrobe_inventory: true }).sections.find((s) => s.id === 'wardrobe')).toMatchObject({ state: 'in_progress', label: '0 of 1', first_missing: 'wardrobe_ready' });
  });
});

describe('ShowOverview, an episode in production', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockImplementation(async (url) => routes(url));
    vi.mocked(getEpisodeAnchorEvent).mockResolvedValue({ id: 'ev-9', name: 'Studio Session' });
  });

  test('the card: title, description, thumbnail to the YouTube builder, the actions', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    expect(card.textContent).toContain('I Designed My Outfit');
    expect(card.textContent).toContain('Lala steps into Studio by Sable.');
    expect(card.textContent).toContain('Now producing');
    expect(card.textContent).toContain('Draft');
    const thumb = within(card).getByTestId('sov-thumbnail');
    expect(thumb.getAttribute('href')).toBe('/template-studio/youtube?show=show-1&episode=ep-1');
    await waitFor(() => expect(thumb.querySelector('img').getAttribute('src')).toBe('https://b.s3.amazonaws.com/thumb.png'));
    expect(thumb.textContent).toContain('Edit Thumbnail');
    const href = (name) => within(card).getByRole('link', { name }).getAttribute('href');
    expect(href('Continue Episode')).toBe('/episodes/ep-1?tab=production');
    expect(href('Open Script')).toBe('/episodes/ep-1?tab=scripts');
    expect(href("Lala's Phone")).toBe('/episodes/ep-1?tab=phone');
    expect(href('Open Files')).toBe('/episodes/ep-1?tab=files');
  });

  test('the checklist: nine section cards with their states and fix links, and the count', async () => {
    renderIt();
    const list = screen.getByTestId('sov-checklist');
    await waitFor(() => expect(list.querySelectorAll('.pov-section')).toHaveLength(9));
    const brief = within(list).getByTestId('sov-section-brief');
    expect(brief.textContent).toContain('Episode Brief');
    expect(brief.textContent).toContain('Not started');
    expect(brief.getAttribute('href')).toMatch(/^\/episodes\/ep-1/);
    expect(list.textContent).toMatch(/\d+ of \d+ complete/);
    expect(within(list).getByRole('link', { name: 'View All' }).getAttribute('href')).toBe('/episodes/ep-1?tab=checklist');
  });

  test('the switcher picks another episode, and another season', async () => {
    renderIt();
    const card = screen.getByTestId('sov-producing');
    fireEvent.change(within(card).getByLabelText('Episode'), { target: { value: 'ep-2' } });
    await waitFor(() => expect(card.textContent).toContain('Second Look'));
    expect(card.textContent).toContain('Published');
    expect(within(card).getByRole('link', { name: 'Continue Episode' }).getAttribute('href')).toBe('/episodes/ep-2?tab=production');
    fireEvent.change(within(card).getByLabelText('Season'), { target: { value: '2' } });
    await waitFor(() => expect(card.textContent).toContain('New Season'));
  });

  test('Episode Assets: counts per tab, the clips first, a tab switch', async () => {
    renderIt();
    const assets = await screen.findByTestId('sov-assets');
    await waitFor(() => expect(within(assets).getByRole('tab', { name: 'Raw Clips (2)' })).toBeTruthy());
    expect(within(assets).getByRole('tab', { name: 'Scene Sets (1)' })).toBeTruthy();
    expect(within(assets).getByRole('tab', { name: 'Audio (0)' })).toBeTruthy();
    expect(assets.textContent).toContain('Lala_CamA.mp4');
    expect(assets.textContent).toContain('0:45');
    fireEvent.click(within(assets).getByRole('tab', { name: 'Scene Sets (1)' }));
    expect(assets.textContent).toContain('Studio Interior');
    expect(within(assets).getByRole('link', { name: 'View All Files' }).getAttribute('href')).toBe('/episodes/ep-1?tab=files');
  });

  test('Main Characters from the registry and the episode\'s guests', async () => {
    renderIt();
    const cast = screen.getByTestId('sov-cast');
    await waitFor(() => expect(cast.textContent).toContain('Sable'));
    expect(cast.textContent).toContain('Creative Partner');
    await waitFor(() => expect(cast.textContent).toContain('Tasha'));
    expect(within(cast).getByRole('link', { name: 'Manage Cast' }).getAttribute('href')).toBe('/character-registry');
  });

  test('the money from the linked event\'s forecast', async () => {
    renderIt();
    const money = screen.getByTestId('sov-money');
    await waitFor(() => expect(money.textContent).toContain('+600'));
    expect(money.textContent).toContain('−350');
    expect(money.textContent).toContain('−100');
    expect(money.textContent).toContain('2,050');
  });

  test('no linked event: the money card says so', async () => {
    vi.mocked(getEpisodeAnchorEvent).mockResolvedValue(null);
    renderIt();
    await waitFor(() => expect(screen.getByTestId('sov-money').textContent).toContain('No event is linked to this episode yet'));
  });
});
