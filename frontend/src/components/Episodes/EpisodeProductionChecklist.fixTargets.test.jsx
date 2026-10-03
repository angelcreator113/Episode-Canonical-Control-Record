/**
 * The checklist's Fix buttons land where the work is (audit LINK-03,
 * 2026-10-03): a missing scene set opens this show's Scene Sets with the
 * checklist as the way back, never the clip library; the phone's screens
 * open Lala's Phone. In this app, so Back returns here.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => null) }));

import api from '../../services/api';
import EpisodeProductionChecklist, { checklistFixTarget } from './EpisodeProductionChecklist';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' };

describe('checklistFixTarget', () => {
  test('a missing scene set opens this show\'s Scene Sets, carrying the checklist back', () => {
    expect(checklistFixTarget('scene_sets', { episode: EPISODE, showId: 'show-1' })).toEqual({
      label: 'Scene Sets',
      href: '/shows/show-1/world?tab=scene-sets&from=%2Fepisodes%2Fep-1%3Ftab%3Dchecklist&fromLabel=Gala%20Night&need=Scene%20sets%20assigned',
    });
    expect(checklistFixTarget('overlays_generated', { episode: EPISODE, showId: 'show-1' })).toEqual({ label: "Lala's Phone", href: '/shows/show-1/world?tab=overlays-tab' });
    expect(checklistFixTarget('scene_images', { episode: EPISODE, showId: 'show-1' })).toEqual({ label: 'Open Scenes', href: '/episodes/ep-1?tab=scenes' });
  });

  test('no target without the show for show work, nor for an item with no page', () => {
    expect(checklistFixTarget('scene_sets', { episode: EPISODE, showId: null })).toBeNull();
    expect(checklistFixTarget('arc_position', { episode: EPISODE, showId: null })).toEqual({ label: 'Set up', href: '/episodes/ep-1/plan' });
    expect(checklistFixTarget('social_checklist', { episode: EPISODE, showId: 'show-1' })).toBeNull();
    expect(checklistFixTarget('scene_sets', { episode: null, showId: 'show-1' })).toBeNull();
  });
});

describe('the Scene Sets Fix button', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/scene-sets') return { data: { data: [] } };
      return { data: {} };
    });
  });

  test('opens the show\'s Scene Sets in this app, with the way back', async () => {
    const Probe = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
    render(
      <MemoryRouter initialEntries={['/episodes/ep-1?tab=checklist']}>
        <Routes>
          <Route path="/episodes/:id" element={<EpisodeProductionChecklist episode={EPISODE} showId="show-1" />} />
          <Route path="/shows/:id/world" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    const row = (await screen.findByText(/^Scene sets assigned/)).closest('div');
    fireEvent.click(row.querySelector('button'));
    expect((await screen.findByTestId('where')).textContent).toBe(
      '/shows/show-1/world?tab=scene-sets&from=%2Fepisodes%2Fep-1%3Ftab%3Dchecklist&fromLabel=Gala%20Night&need=Scene%20sets%20assigned',
    );
  });
});
