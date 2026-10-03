/**
 * Repairable setup (audit STATE-01, 2026-10-03): a partly initialised
 * episode shows "Setup did not finish" with the missing beats and the
 * failure, and Resume setup asks the server for just the missing beats,
 * then rechecks; a complete episode shows nothing of the kind.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => null) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';

let plan; let coverage;
const renderChecklist = (episode) => render(
  <MemoryRouter><EpisodeProductionChecklist episode={episode} showId="show-1" /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan, coverage, readiness: { ready: plan.length, total: plan.length, not_ready: [] } } };
    if (url === '/api/v1/wardrobe/slot-coverage?show_id=show-1') return { data: { data: { inventory: 0, covered: false, missing: [], text: '' } } };
    return { data: {} };
  });
});

describe('Resume setup', () => {
  test('a partial setup is named, and Resume asks for the missing beats then rechecks', async () => {
    plan = Array.from({ length: 13 }, (_, i) => ({ beat_number: i + 1 === 6 ? 14 : i + 1, locked: false }));
    coverage = { complete: false, present: 13, expected: 14, missing: [6], duplicates: [], unknown: 0, text: '13 of 14 beats · missing beat 6' };
    const episode = { id: 'ep-1', show_id: 'show-1', setup_status: { complete: false, steps: { scene_plan: { status: 'partial', missing: [6], failed: [{ beat: 6, reason: 'disk full' }] }, locations: { status: 'complete' } } } };
    vi.mocked(api.post).mockImplementation(async () => {
      coverage = { complete: true, present: 14, expected: 14, missing: [], duplicates: [], unknown: 0, text: '14 of 14 beats' };
      return { data: { success: true, data: { scene_plan: { status: 'complete', created: 1, existing: 13, missing: [], failed: [] } } } };
    });
    renderChecklist(episode);
    const banner = await screen.findByTestId('setup-incomplete');
    expect(banner.textContent).toContain('Setup did not finish.');
    expect(banner.textContent).toContain('13 of 14 beats · missing beat 6');
    expect(banner.textContent).toContain('beat 6: disk full');

    fireEvent.click(screen.getByTestId('setup-resume'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/setup/resume'));
    expect(await screen.findByText(/Setup resumed: 1 beat made, 13 already there/)).toBeTruthy();
    // The plan is reread; with every beat present and the episode's own status now stale, the server's coverage decides.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan'));
  });

  test('a complete episode shows no repair', async () => {
    plan = Array.from({ length: 14 }, (_, i) => ({ beat_number: i + 1, locked: false }));
    coverage = { complete: true, present: 14, expected: 14, missing: [], duplicates: [], unknown: 0, text: '14 of 14 beats' };
    renderChecklist({ id: 'ep-1', show_id: 'show-1', setup_status: { complete: true, steps: {} } });
    await screen.findByText(/^Scene plan generated/);
    expect(screen.queryByTestId('setup-incomplete')).toBeNull();
  });

  test('a legacy episode with beats missing and no setup record still offers the repair', async () => {
    plan = [{ beat_number: 1, locked: false }];
    coverage = { complete: false, present: 1, expected: 14, missing: [2, 3], duplicates: [], unknown: 0, text: '1 of 14 beats · missing beats 2 and 3' };
    renderChecklist({ id: 'ep-1', show_id: 'show-1' });
    expect((await screen.findByTestId('setup-incomplete')).textContent).toContain('1 of 14 beats');
  });
});
