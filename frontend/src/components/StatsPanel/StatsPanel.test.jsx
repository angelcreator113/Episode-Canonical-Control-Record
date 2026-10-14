/**
 * The stats panel, the audience's overlay (Task 3164): its editor on the
 * show's Overlays, and the episode's preview and downloads.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import StatsPanelEditor from './StatsPanelEditor';
import EpisodeStatsPanel from './EpisodeStatsPanel';

const ART = { id: 'stats_art', name: 'Stats panel', url: 'https://x/art.png', asset_id: 'asset-1', category: 'production', stats_panel: null };
const COIN = { id: 'coin_icon', name: 'Coin icon', url: 'https://x/coin.png', category: 'production' };
const SPOT = { id: 'c', stat: 'coins', x: 10, y: 20, w: 25, h: 60, icon: 'coin_icon', color: '#ffffff' };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.put).mockReset();
});

describe('StatsPanelEditor', () => {
  test('add a number, pick its stat and icon, save the boxes on the art', async () => {
    vi.mocked(api.put).mockImplementation((url, body) => Promise.resolve({ data: { data: { asset_id: 'asset-1', spots: body.spots } } }));
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<StatsPanelEditor showId="show-1" overlay={ART} overlays={[ART, COIN]} onSaved={onSaved} onClose={onClose} />);
    expect(screen.queryAllByTestId('stats-panel-row')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('stats-panel-add'));
    fireEvent.click(screen.getByTestId('stats-panel-add'));
    const rows = screen.getAllByTestId('stats-panel-row');
    expect(rows).toHaveLength(2);
    // The art is never offered as its own icon.
    expect(within(rows[0]).getAllByRole('option').map((o) => o.textContent)).toContain('Coin icon');
    expect(within(rows[0]).queryByRole('option', { name: 'Stats panel' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Icon 1'), { target: { value: 'coin_icon' } });
    fireEvent.change(screen.getByLabelText('Stat 2'), { target: { value: 'followers' } });
    fireEvent.click(screen.getByTestId('stats-panel-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/ui-overlays/show-1/stats-panel/asset-1');
    expect(body.spots.map((s) => [s.stat, s.icon])).toEqual([['coins', 'coin_icon'], ['followers', null]]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ART, body.spots));
    expect(onClose).toHaveBeenCalled();
  });

  test('a box drags in percent of the art', () => {
    render(<StatsPanelEditor showId="show-1" overlay={{ ...ART, stats_panel: { spots: [SPOT] } }} overlays={[ART, COIN]} />);
    const art = screen.getByTestId('stats-panel-preview');
    art.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 100, right: 1000, bottom: 100 });
    const box = screen.getByTestId('stats-panel-spot-c');
    // jsdom's pointer events carry no coordinates, so mouse events stand in.
    const at = (type, x, y) => new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    act(() => { box.dispatchEvent(at('pointerdown', 100, 50)); });
    act(() => { window.dispatchEvent(at('pointermove', 150, 60)); });
    act(() => { window.dispatchEvent(at('pointerup', 150, 60)); });
    expect(box.style.left).toBe('15%');
    expect(box.style.top).toBe('30%');
  });

  test('"Stop using as stats panel" makes it an ordinary overlay', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { asset_id: 'asset-1', spots: null } } });
    const onSaved = vi.fn();
    render(<StatsPanelEditor showId="show-1" overlay={{ ...ART, stats_panel: { spots: [SPOT] } }} overlays={[ART, COIN]} onSaved={onSaved} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stats-panel-stop'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/stats-panel/asset-1', { spots: null }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'stats_art' }), null));
  });
});

describe('EpisodeStatsPanel', () => {
  const EPISODE = { id: 'ep-2', episode_number: 2 };
  const renderPanel = () => render(<MemoryRouter><EpisodeStatsPanel showId="show-1" episode={EPISODE} /></MemoryRouter>);

  test("shows the episode's numbers before → after, each with its icon, and downloads the PNG", async () => {
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/ui-overlays/show-1/stats-panel/episode/ep-2') {
        return Promise.resolve({ data: { data: { panel: { url: 'https://x/art.png' }, spots: [{ ...SPOT, text: '700 → 600' }] } } });
      }
      if (url === '/api/v1/ui-overlays/show-1') return Promise.resolve({ data: { data: [ART, COIN] } });
      if (url.endsWith('/png?size=4k')) return Promise.resolve({ data: new Blob(['png']), headers: { 'content-disposition': 'attachment; filename="stats-panel-episode-02-4k.png"' } });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    renderPanel();
    const box = await screen.findByTestId('stats-panel-spot-c');
    expect(box.textContent).toBe('700 → 600');
    await waitFor(() => expect(box.querySelector('img')?.getAttribute('src')).toBe('https://x/coin.png'));
    fireEvent.click(screen.getByTestId('eot-stats-download-4k'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/stats-panel/episode/ep-2/png?size=4k', { responseType: 'blob' }));
    expect(screen.getByTestId('eot-stats-download-1080p').textContent).toContain('1920 × 220');
  });

  test('without a panel it says where to set one up', async () => {
    vi.mocked(api.get).mockImplementation((url) => (url.includes('/stats-panel/')
      ? Promise.reject(Object.assign(new Error('no'), { response: { data: { code: 'NO_PANEL', error: 'Set up the stats panel first' } } }))
      : Promise.resolve({ data: { data: [] } })));
    renderPanel();
    expect((await screen.findByTestId('eot-stats-none')).textContent).toMatch(/Use as stats panel/);
    expect(screen.queryByTestId('eot-stats-download-1080p')).toBeNull();
  });
});
