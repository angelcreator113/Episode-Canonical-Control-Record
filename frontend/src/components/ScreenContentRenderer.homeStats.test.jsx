/**
 * The stats panel on Lala's Phone (Task #3164): coins, reputation and
 * influence as of the beat's story order, a zone's own order, or the
 * present; followers only once The Pulse has her numbers.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { HomeStatsRenderer, CONTENT_TYPES, phoneStatsUrl } from './ScreenContentRenderer';
import { CONTENT_AREA_KINDS } from './phone/ContentAreaPicker';

const STATS = { at: 25, coins: 1650, reputation: 3, influence: 2, scale: 10, followers: { count: 62500, tier: { key: 'mid', label: 'Mid-tier' } } };
const reply = (data) => vi.mocked(api.get).mockResolvedValue({ data: { success: true, data } });

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  reply(STATS);
});

describe('Stats panel zone', () => {
  test('is a registered stats zone type, and the Content stage offers it', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'home_stats')).toMatchObject({ label: 'Stats Panel', group: 'stats' });
    expect(CONTENT_AREA_KINDS.find((k) => k.content_type === 'home_stats')).toMatchObject({ label: 'Stats panel' });
  });

  test("reads the stats at the beat's story order and shows each one", async () => {
    render(<HomeStatsRenderer showId="show-1" storyAt={25} />);
    await screen.findByTestId('home-stats-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/phone-stats?at=25');
    expect(screen.getByTestId('home-stats-coins').textContent).toContain('1,650');
    expect(screen.getByTestId('home-stats-reputation').textContent).toContain('3/10');
    expect(screen.getByTestId('home-stats-influence').textContent).toContain('2/10');
    expect(screen.getByTestId('home-stats-followers').textContent).toMatch(/Followers · Mid-tier.*62,500/);
  });

  test('followers are left out until The Pulse has her numbers, never shown as 0', async () => {
    reply({ ...STATS, followers: null });
    render(<HomeStatsRenderer showId="show-1" storyAt={25} />);
    await screen.findByTestId('home-stats-zone');
    expect(screen.queryByTestId('home-stats-followers')).toBeNull();
    expect(screen.getAllByTestId(/^home-stats-(coins|reputation|influence)$/)).toHaveLength(3);
  });

  test("a zone's own order wins; with no beat it reads the present", async () => {
    render(<HomeStatsRenderer showId="show-1" storyAt={25} config={{ at: 37 }} />);
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(phoneStatsUrl('show-1', 37)));
    render(<HomeStatsRenderer showId="show-1" />);
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/shows/show-1/phone-stats?at=present'));
  });

  test('a stat the server could not give shows a dash; no answer says so', async () => {
    reply({ ...STATS, reputation: null, followers: null });
    render(<HomeStatsRenderer showId="show-1" />);
    expect((await screen.findByTestId('home-stats-reputation')).textContent).toContain('—');
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    render(<HomeStatsRenderer showId="show-2" />);
    expect(await screen.findByText('No stats')).toBeTruthy();
  });

  test('ScreenContentRenderer passes the beat order through to a stats zone', async () => {
    render(<ScreenContentRenderer showId="show-1" storyAt={15} zones={[{ id: 'z1', content_type: 'home_stats', x: 0, y: 0, w: 50, h: 20 }]} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/phone-stats?at=15'));
  });
});
