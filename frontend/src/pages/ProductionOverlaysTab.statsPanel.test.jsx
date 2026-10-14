/**
 * Assets → Overlays and the stats panel (Task 3164): an overlay with a
 * picture can be the panel's art; its card opens the panel editor, and a
 * saved panel is marked on its card. The Sizes help gives the panel's size.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ProductionOverlaysTab from './ProductionOverlaysTab';

const OVERLAYS = [
  { id: 'stats_art', name: 'Stats Art', category: 'production', generated: true, url: 'https://x/art.png', asset_id: 'a-art', stats_panel: null },
  { id: 'coin_icon', name: 'Coin icon', category: 'production', generated: true, url: 'https://x/coin.png', asset_id: 'a-coin', stats_panel: null },
  { id: 'lower_third', name: 'Lower Third', category: 'production', generated: false, url: null, asset_id: null },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/ui-overlays/show-1') return { data: { success: true, data: OVERLAYS } };
    return { data: { success: true, data: {} } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { success: true, data: { asset_id: 'a-art', spots: body.spots } } }));
});

test('"Use as stats panel" opens the editor; a saved panel is marked on its card', async () => {
  render(<ProductionOverlaysTab showId="show-1" />);
  const button = await screen.findByTestId('sol-panel-stats_art');
  expect(button.textContent).toContain('Use as stats panel');
  expect(screen.queryByTestId('sol-panel-lower_third')).toBeNull();   // no picture, no panel
  fireEvent.click(button);
  expect(screen.getByTestId('stats-panel-editor')).toBeTruthy();
  fireEvent.click(screen.getByTestId('stats-panel-add'));
  fireEvent.click(screen.getByTestId('stats-panel-save'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1/stats-panel/a-art', { spots: [expect.objectContaining({ stat: 'coins' })] }));
  await waitFor(() => expect(screen.queryByTestId('stats-panel-editor')).toBeNull());
  expect(screen.getByTestId('sol-panel-stats_art').textContent).toContain('Stats panel');
  expect(screen.getByTestId('sol-panel-stats_art').className).toContain('is-panel');
});

test('the Sizes help gives the stats panel master', async () => {
  render(<ProductionOverlaysTab showId="show-1" />);
  fireEvent.click(await screen.findByTestId('sol-sizes-toggle'));
  expect(screen.getByTestId('sol-sizes').textContent).toMatch(/Stats panel: 1920 × 220 px, transparent, the 1600 × 180 design centred/);
});
