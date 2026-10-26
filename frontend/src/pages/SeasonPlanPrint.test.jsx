/**
 * The season plan on one printable page (round 3, 2026-10-26): the sheet
 * from the Season page's reads, the pitch spot (the logline, or marked
 * empty for a later AI step), Print (the browser's), ?season=N.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import SeasonPlanPrint, { SeasonPlanSheet } from './SeasonPlanPrint';

const PHASES = [{ phase: 1, title: 'Foundation', tagline: 'She arrives', episode_start: 1, episode_end: 2 }];
const roadmap = (n) => ({
  arc: { id: `arc-${n}`, current_phase: 1 }, season_number: n, slot_count: 2, counts: {},
  phases: PHASES.map((p) => ({ ...p, slots: [
    { id: 's1', slot_number: 1, phase: 1, state: 'in_production', episode: { id: 'ep1', title: 'Opener' }, event: { id: 'ev1', name: 'Gala' } },
    { id: 's2', slot_number: 2, phase: 1, state: 'needs_event', episode: null, event: null, intention: {} },
  ] })),
});
let logline;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  logline = 'Lala builds a name in a city that tests her.';
  vi.mocked(api.get).mockImplementation(async (url) => {
    const [path, query = ''] = url.split('?');
    const season = new URLSearchParams(query).get('season');
    const n = season ? Number(season) : 2;
    if (path === '/api/v1/shows/show-1') return { data: { data: { name: 'Styling Adventures with Lala' } } };
    if (path === '/api/v1/world/show-1/arc') return { data: { arc: { id: `arc-${n}`, title: `Season ${n} title`, season_number: n, status: 'active', current_phase: 1, phases: PHASES, logline }, seasons: [], current_arc_id: 'arc-2' } };
    if (path === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: roadmap(n) } };
    if (path === '/api/v1/world/show-1/goals') return { data: { goals: [{ id: 'g1', title: 'Save coins', status: 'active', current_value: 600, target_value: 3000 }] } };
    if (path === '/api/v1/world/show-1/events') return { data: { events: [{ id: 'ev1', name: 'Velour Gala', event_date: '2026-10-30' }] } };
    if (path === '/api/v1/world/show-1/release-schedule') {
      return { data: { data: { state: 'active', schedule: { day: 'sun', time: '10:00', platforms: ['youtube'] }, seasons: [], episodes: [{ episode_id: 'ep1', date: '2026-11-01', source: 'schedule' }], slots: { 2: { date: '2026-11-08', source: 'schedule' } } } } };
    }
    if (path.endsWith('/season/threads')) return { data: { threads: [], drafts: [] } };
    if (path.endsWith('/season/needs')) return { data: { needs: [], counts: {} } };
    if (path.endsWith('/season/insights')) return { data: { insights: null } };
    return { data: {} };
  });
});

const renderAt = (search = '') => render(
  <MemoryRouter initialEntries={[`/shows/show-1/season/plan${search}`]}>
    <Routes><Route path="/shows/:showId/season/plan" element={<SeasonPlanPrint />} /></Routes>
  </MemoryRouter>,
);

describe('SeasonPlanPrint', () => {
  test('the season on one page: the pitch (its logline), the parts with release days, events, goals, the schedule', async () => {
    renderAt();
    const sheet = await screen.findByTestId('splan-sheet');
    expect(within(sheet).getByText('Season 2 title')).toBeTruthy();
    expect(within(sheet).getByText('Styling Adventures with Lala')).toBeTruthy();
    const pitch = within(sheet).getByTestId('splan-pitch');
    expect(pitch.getAttribute('data-slot')).toBe('plan-pitch');
    expect(pitch.textContent).toMatch(/Lala builds a name/);
    const part = await within(sheet).findByTestId('splan-part-1');
    expect(await within(part).findByText('Sun, Nov 1')).toBeTruthy();
    expect(within(part).getByText('Sun, Nov 8')).toBeTruthy();
    expect(within(part).getByText('In Production')).toBeTruthy();
    expect(await within(sheet).findByText(/Velour Gala · Oct 30, 2026/)).toBeTruthy();
    expect(within(sheet).getByTestId('splan-goals').textContent).toMatch(/Save coins · 600 of 3000/);
    expect(within(sheet).getByTestId('splan-releases').textContent).toMatch(/Releases on YouTube every Sunday at 10:00 AM/);
  });

  test('Print opens the browser\'s print (Save as PDF from there)', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderAt();
    await screen.findByTestId('splan-sheet');
    fireEvent.click(screen.getByTestId('splan-print'));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  test('?season=1 reads Season 1; Back keeps it', async () => {
    renderAt('?season=1');
    expect(await screen.findByText('Season 1 title')).toBeTruthy();
    expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).toContain('/api/v1/world/show-1/season/roadmap?season=1');
    expect(screen.getByRole('link', { name: /Season page/ }).getAttribute('href')).toBe('/shows/show-1/season?season=1');
  });

  test('no logline: the pitch spot is marked empty, and a later step can fill it', () => {
    const sheet = { eyebrow: 'Season 1', title: 'T', tagline: null, dates: null, pitch: null, parts: [], events: [], goals: [], releases: null, slotCount: 0 };
    const { rerender } = render(<SeasonPlanSheet sheet={sheet} />);
    const pitch = screen.getByTestId('splan-pitch');
    expect(pitch.className).toMatch(/is-empty/);
    expect(pitch.textContent).toMatch(/Not written yet/);
    rerender(<SeasonPlanSheet sheet={sheet} pitchSlot={<p>Two lines from later.</p>} />);
    expect(screen.getByTestId('splan-pitch').textContent).toMatch(/Two lines from later/);
  });
});
