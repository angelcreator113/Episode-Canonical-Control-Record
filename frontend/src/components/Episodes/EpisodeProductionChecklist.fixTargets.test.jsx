/**
 * The checklist's Fix buttons land where the work is (audit LINK-03,
 * 2026-10-03): a missing scene set opens this show's Scene Sets with the
 * checklist as the way back, never the clip library; the phone's screens
 * open Lala's Phone. In this app, so Back returns here.
 */
import fs from 'fs';
import path from 'path';
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
    expect(checklistFixTarget('scene_images', { episode: EPISODE, showId: 'show-1' })).toEqual({ label: 'Open the Scenes plan', href: '/episodes/ep-1?tab=beatplan' });
  });

  /**
   * Phase 2 (Evoni, 2026-11-27). The venue image and the invitation are
   * sections of the EVENT PACKAGE, so that is where their Fix goes — the
   * page itself, not the Events list it used to open. Running the real app
   * is what caught that: both still opened the list, and no test said
   * otherwise. With no event read yet there is nothing to open, so the
   * destination stays the list, exactly as before.
   */
  /**
   * The other five Phase 2 destinations. Each was clicked in the running app
   * too, but only on an episode where that item was actually outstanding, so
   * these pin all five whatever the fixtures happen to hold.
   */
  test('the brief fields, the overlays and the social list each open their own page', () => {
    const at = { episode: EPISODE, showId: 'show-1' };
    expect(checklistFixTarget('narrative_purpose', at)).toEqual({ label: 'Write it', href: '/episodes/ep-1?tab=overview' });
    expect(checklistFixTarget('forward_hook', at)).toEqual({ label: 'Write it', href: '/episodes/ep-1?tab=overview' });
    expect(checklistFixTarget('title_overlay', at)).toEqual({ label: 'Open Overlays', href: '/episodes/ep-1?tab=overlays' });
    expect(checklistFixTarget('overlays_placed', at)).toEqual({ label: 'Open Overlays', href: '/episodes/ep-1?tab=overlays' });
    expect(checklistFixTarget('social_checklist', at)).toEqual({ label: 'Open the to-do lists', href: '/episodes/ep-1?tab=overlays' });
    // None of the five needs the show, so they stand without one.
    expect(checklistFixTarget('forward_hook', { episode: EPISODE, showId: null }).href).toBe('/episodes/ep-1?tab=overview');
  });

  test('the venue image and the invitation open the event package', () => {
    const withEvent = { episode: EPISODE, showId: 'show-1', eventId: 'ev-9' };
    expect(checklistFixTarget('venue_image', withEvent)).toEqual({ label: 'Add the image', href: '/shows/show-1/events/ev-9' });
    expect(checklistFixTarget('invitation_exists', withEvent)).toEqual({ label: 'Make the invitation', href: '/shows/show-1/events/ev-9' });
    // The bare path matters: the hand-off that wraps it writes the way back
    // in the form the package page reads, and an href already carrying
    // `from=` would not be wrapped at all.
    expect(checklistFixTarget('venue_image', withEvent).href).not.toContain('from=');
  });

  test('with no event read, they open the Events list as they did before', () => {
    const noEvent = { episode: EPISODE, showId: 'show-1' };
    const list = checklistFixTarget('event_linked', noEvent).href;
    expect(checklistFixTarget('venue_image', noEvent)).toEqual({ label: 'Add the image', href: list });
    expect(checklistFixTarget('invitation_exists', noEvent)).toEqual({ label: 'Make the invitation', href: list });
    // An event with no show is still not a destination.
    expect(checklistFixTarget('venue_image', { episode: EPISODE, showId: null, eventId: 'ev-9' })).toBeNull();
  });

  test('both Style Page items open the Style Page (Tasks #2815, #2876)', () => {
    expect(checklistFixTarget('lookbook_ready', { episode: EPISODE, showId: null })).toEqual({ label: 'Fill the Style Page', href: '/episodes/ep-1?tab=lookbook' });
    expect(checklistFixTarget('style_sheet_approved', { episode: EPISODE, showId: null })).toEqual({ label: 'Approve on the Style Page', href: '/episodes/ep-1?tab=lookbook' });
  });

  // Evoni, 2026-11-15 (Producer Mode PR A): Lala's stats are set on Cast &
  // Continuity. It opened Producer Mode's Overview, the page Producer Mode's
  // own checklist card sends from.
  test('character state opens Producer Mode where it is set, and says so', () => {
    expect(checklistFixTarget('character_state', { episode: EPISODE, showId: 'show-1' })).toEqual({
      label: 'Set up in Producer Mode', href: '/shows/show-1/world?tab=characters-list',
    });
    expect(checklistFixTarget('character_state', { episode: EPISODE, showId: null })).toBeNull();
  });

  test('no target without the show for show work, nor for an item with no page', () => {
    expect(checklistFixTarget('scene_sets', { episode: EPISODE, showId: null })).toBeNull();
    expect(checklistFixTarget('arc_position', { episode: EPISODE, showId: null })).toEqual({ label: 'Set up', href: '/episodes/ep-1/plan' });
    // Phase 2 gave the social list a destination of its own: Production →
    // Overlays, where EpisodeTodoList reads the very list this check counts.
    expect(checklistFixTarget('social_checklist', { episode: EPISODE, showId: 'show-1' }))
      .toEqual({ href: '/episodes/ep-1?tab=overlays', label: 'Open the to-do lists' });
    // Still no destination for these two: the Show Brain is not this
    // episode's to mend, and the AI title has no editor anywhere.
    expect(checklistFixTarget('show_brain', { episode: EPISODE, showId: 'show-1' })).toBeNull();
    expect(checklistFixTarget('title_generated', { episode: EPISODE, showId: 'show-1' })).toBeNull();
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

// Evoni, 2026-11-15 (Producer Mode PR A): the footer's Write Script opens the
// episode's Script tab and is not locked behind the checklist; Scene Plan
// stays in the app. Neither sets window.location.
describe('the footer: Write Script and Scene Plan', () => {
  const Probe = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };
  const draw = (props = {}) => render(
    <MemoryRouter initialEntries={['/episodes/ep-1?tab=checklist']}>
      <Routes>
        <Route path="/episodes/:id" element={<><Probe /><EpisodeProductionChecklist episode={EPISODE} showId="show-1" {...props} /></>} />
        <Route path="/episodes/:id/plan" element={<Probe />} />
        <Route path="/episodes/:id/script-writer" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    // Nothing is done: every required item is unticked.
    vi.mocked(api.get).mockImplementation(async () => ({ data: {} }));
  });

  test('Write Script is not locked by unticked required items, and nothing says the script is', async () => {
    draw({ onOpenTab: vi.fn() });
    const button = await screen.findByTestId('ckh-write-script');
    expect(button.textContent).toBe('Write Script');
    expect(button.disabled).toBe(false);
    expect(document.body.textContent).not.toMatch(/unlock script generation/i);
    expect(document.querySelector('.ckh-foot-note')).toBeNull();
  });

  test('on the episode page it is the page\'s own tab change (the one that asks before unsaved script edits are left)', async () => {
    const onOpenTab = vi.fn();
    draw({ onOpenTab });
    fireEvent.click(await screen.findByTestId('ckh-write-script'));
    expect(onOpenTab).toHaveBeenCalledTimes(1);
    expect(onOpenTab).toHaveBeenCalledWith('scripts');
    // It went nowhere by itself: the page decides, and the older writer page was not opened.
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=checklist');
  });

  test('mounted without the page (Producer Mode), it opens the Script tab in the app', async () => {
    draw();
    fireEvent.click(await screen.findByTestId('ckh-write-script'));
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=scripts');
  });

  test('Scene Plan opens the plan in the app', async () => {
    draw({ onOpenTab: vi.fn() });
    fireEvent.click(await screen.findByTestId('ckh-scene-plan'));
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1/plan');
  });

  test('neither button reloads the page', () => {
    const src = fs.readFileSync(path.resolve(__dirname, 'EpisodeProductionChecklist.jsx'), 'utf8');
    expect(src).not.toMatch(/window\.location/);
  });
});
