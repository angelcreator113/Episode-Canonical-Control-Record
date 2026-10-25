/**
 * Producer Mode → Overview (Evoni's mock, 2026-10-17): the helpers (in
 * production, seasons, the opening episode, Main Characters, the asset
 * tabs), and the show-level parts: Up next (the season's next slot), Needs
 * your attention, Lala now, and a new show's first steps.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import ShowOverview, { episodesInProduction, seasonsOf, defaultEpisode, mainCharacters, assetTabs } from './ShowOverview';

const ROADMAP = {
  season_number: 1, next_slot_number: 7,
  phases: [{ phase: 1, slots: [
    { slot_number: 6, label: 'S1 · E6', intention: { story_purpose: 'A win' } },
    { slot_number: 7, label: 'S1 · E7', intention: { story_purpose: 'Her first real setback' } },
  ] }],
};
const renderIt = (props = {}) => {
  const goTo = vi.fn();
  render(<MemoryRouter><ShowOverview showId="show-1" goTo={goTo} {...props} /></MemoryRouter>);
  return goTo;
};

describe('ShowOverview helpers', () => {
  test('in production: draft to in review, not accepted, in episode order', () => {
    const eps = [
      { id: 'a', episode_number: 3, status: 'draft' },
      { id: 'b', episode_number: 1, status: 'in_review' },
      { id: 'c', episode_number: 2, status: 'published' },
      { id: 'd', episode_number: 4, status: 'in_build', evaluation_status: 'accepted' },
    ];
    expect(episodesInProduction(eps).map((e) => e.id)).toEqual(['b', 'a']);
  });

  test('seasons and the episode the Overview opens on', () => {
    expect(seasonsOf([{ season_number: 2 }, {}, { season_number: 1 }])).toEqual([1, 2]);
    expect(defaultEpisode([{ id: 'p', episode_number: 5, status: 'published' }, { id: 'd', episode_number: 6, status: 'draft' }]).id).toBe('d');
    expect(defaultEpisode([{ id: 'p1', episode_number: 1, status: 'published' }, { id: 'p2', episode_number: 2, status: 'published' }]).id).toBe('p2');
    expect(defaultEpisode([])).toBeNull();
  });

  test('Main Characters: Lala, JustAWoman, two supporting at most, then the episode\'s guests', () => {
    const reg = [
      { id: 'r1', character_key: 'lala', display_name: 'Lala', portrait_url: 'l.jpg', status: 'finalized' },
      { id: 'r2', character_key: 'justawoman', display_name: 'JustAWoman', status: 'accepted' },
      { id: 'r3', character_key: 'sable', display_name: 'Sable', role_type: 'support', role_label: 'Creative Partner', sort_order: 1 },
      { id: 'r4', character_key: 'x', display_name: 'Declined One', role_type: 'support', status: 'declined' },
      { id: 'r5', character_key: 'y', display_name: 'Rival', role_type: 'pressure', sort_order: 2 },
      { id: 'r6', character_key: 'z', display_name: 'Third', role_type: 'mirror', sort_order: 3 },
    ];
    const rows = mainCharacters(reg, [{ performer: 'guest', guest_name: 'Tasha' }, { performer: 'guest', guest_name: 'Tasha' }, { performer: 'lala' }]);
    expect(rows.map((r) => [r.name, r.tag])).toEqual([
      ['Lala', 'Primary'], ['JustAWoman', 'Supporting'], ['Sable', 'Supporting'], ['Rival', 'Supporting'], ['Guests', 'Guest'],
    ]);
    expect(rows[0].portrait).toBe('l.jpg');
    expect(rows[2].role).toBe('Creative Partner');
    expect(rows[4].role).toBe('Tasha');
    expect(mainCharacters([], []).map((r) => r.name)).toEqual(['Lala', 'JustAWoman', 'Guests']);
  });

  test('asset tabs read each route\'s rows', () => {
    const tabs = assetTabs({
      clips: [{ id: 'c1', label: 'Take 1', thumbnail_url: 't.jpg', performer: 'lala', beat_number: 2, duration_seconds: 45 }],
      sceneSets: [{ id: 's1', name: 'Studio', base_still_url: 's.jpg', isPrimary: true }],
      images: [{ id: 'i1', name: 'Invite', s3_url_processed: 'i.png', media_type: 'image' }, { id: 'v1', media_type: 'video' }],
      cues: [{ id: 'm1', title: 'Opening theme' }],
      phone: [{ name: 'Home', url: 'h.png', generated: true }, { name: 'Missing', generated: false }],
      placements: [{ id: 'p1', asset: { name: 'Title card', s3_url_raw: 'p.png' } }],
    });
    expect(tabs.map((t) => [t.label, t.items.length])).toEqual([
      ['Raw Clips', 1], ['Scene Sets', 1], ['Images', 1], ['Audio', 1], ['Phone Screens', 1], ['Overlays', 1],
    ]);
    expect(tabs[0].items[0]).toMatchObject({ title: 'Take 1', image: 't.jpg', tags: ['Lala', 'Scene 2'], length: 45 });
    expect(tabs[1].items[0]).toMatchObject({ image: 's.jpg', tags: ['Primary'] });
    expect(tabs[5].items[0]).toMatchObject({ title: 'Title card', image: 'p.png' });
  });
});

describe('ShowOverview', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });

  test('names the season\'s next slot and links to the Season page (the Season Plan tab is retired)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { roadmap: ROADMAP } });
    const goTo = renderIt({ episodes: [], events: [{ id: 'x', status: 'used', used_in_episode_id: 'e' }] });
    const slot = await screen.findByTestId('sov-next-slot');
    await waitFor(() => expect(slot.textContent).toContain('Next slot: S1 · E7'));
    expect(slot.textContent).toContain('Her first real setback');
    expect(within(slot).getByRole('link').getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap');
    expect(within(screen.getByTestId('sov-next')).getByRole('link', { name: 'View Plan' }).getAttribute('href')).toBe('/shows/show-1/season');
    expect(goTo).not.toHaveBeenCalled();
    expect(screen.getByTestId('sov-producing').textContent).toContain('Nothing in production');
    expect(screen.getByTestId('sov-attention').textContent).toContain('Nothing needs attention.');
    expect(screen.queryByTestId('sov-first-steps')).toBeNull();
  });

  test('no season yet: "Set up the season" opens the Season page', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { roadmap: null } });
    renderIt({ episodes: [], events: [] });
    const slot = await screen.findByTestId('sov-next-slot');
    await waitFor(() => expect(slot.textContent).toContain('No season planned yet.'));
    expect(within(slot).getByRole('link', { name: 'Set up the season' }).getAttribute('href')).toBe('/shows/show-1/season');
  });

  test('a season that fails to load says so, with Retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ data: { roadmap: ROADMAP } });
    renderIt();
    const slot = await screen.findByTestId('sov-next-slot');
    await waitFor(() => expect(slot.textContent).toContain("Couldn't load the season."));
    fireEvent.click(within(slot).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(slot.textContent).toContain('Next slot: S1 · E7'));
  });

  test('a new show sees its first steps; Lala\'s stats are cards linking to her history', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { roadmap: null } });
    const goTo = renderIt({ charState: { state: { coins: 500, reputation: 3 } } });
    expect(screen.getByTestId('sov-first-steps')).toBeTruthy();
    const lala = screen.getByTestId('sov-lala');
    expect([...lala.querySelectorAll('.pov-stat')].map((t) => t.textContent.replace(/\s+/g, ''))).toEqual(['Coins500', 'Reputation3']);
    fireEvent.click(within(lala).getByRole('button', { name: 'History' }));
    expect(goTo).toHaveBeenCalledWith('characters-list');
    await waitFor(() => expect(screen.getByTestId('sov-next-slot').textContent).toContain('No season planned yet.'));
  });
});
