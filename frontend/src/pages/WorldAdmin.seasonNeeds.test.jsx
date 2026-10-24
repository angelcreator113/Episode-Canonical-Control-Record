/**
 * Season Plan, planner PR 3 (2026-10-24), in the page: "Relationships the
 * season needs" under the roadmap; the slot panel lists its twists, secrets
 * and needs, and ranks "Pencil an event" by fit; "What the season knows"
 * folds the record and follow-ups the AI reads.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const PHASES = [
  { phase: 1, title: 'Doors', tagline: 'Get in', status: 'active', episode_start: 1, episode_end: 8 },
  { phase: 2, title: 'Rooms', tagline: null, status: 'upcoming', episode_start: 9, episode_end: 16 },
  { phase: 3, title: 'Keys', tagline: null, status: 'upcoming', episode_start: 17, episode_end: 24 },
];
const ARC = {
  id: 'arc-1', title: 'Velvet Season', tagline: 'Her own room', season_number: 1, status: 'active', current_phase: 1, current_episode: 0,
  episode_end: 24, emotional_temperature: 'rising', narrative_debt: [], progression_log: [], phases: PHASES,
};
const slot = (n) => ({
  id: `slot-${n}`, slot_number: n, phase: n <= 8 ? 1 : n <= 16 ? 2 : 3, label: `S1 · E${n}`, state: 'needs_event', locked: false,
  episode: null, event: null, intention: n === 4 ? { story_purpose: 'Jade arrives without the ring', desired_pressure: 'Low' } : {}, intention_editable: true, result: {},
});
const ROADMAP = {
  arc: { id: 'arc-1', title: 'Velvet Season', current_phase: 1 }, season_number: 1, slot_count: 24,
  counts: { done: 0, in_production: 0, event_ready: 0, needs_event: 24 },
  phases: PHASES.map((p) => ({ ...p, slots: Array.from({ length: 8 }, (_, i) => slot(p.episode_start + i)) })),
  unslotted_episodes: [],
  available_events: [{ id: 'ev-ball', name: 'A Ball', status: 'draft' }, { id: 'ev-coffee', name: 'Coffee Date', status: 'draft' }],
  next_slot_number: 1, phase_boundary: null,
};
const NEEDS = {
  counts: { there: 0, seed: 0, missing: 1 },
  needs: [{
    key: 'twist:t1:j|d', kind: 'twist', title: 'The ring', a: { id: 'j', name: 'Jade' }, b: { id: 'd', name: 'Dre' },
    slot: { id: 'slot-4', slot_number: 4, label: 'S1 · E4' }, state: 'missing', relationship: null, seed_why: 'Needed by E4: The ring',
  }],
};

function mockGets() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { episodes: [] } };
    if (url === '/api/v1/shows/show-1') return { data: { id: 'show-1', title: 'Show' } };
    if (url === '/api/v1/world/show-1/arc') return { data: { arc: ARC, next_season_number: 2 } };
    if (url === '/api/v1/world/show-1/season/roadmap') return { data: { roadmap: ROADMAP } };
    if (url === '/api/v1/world/show-1/goals') return { data: { goals: [] } };
    if (url === '/api/v1/world/show-1/season/threads') return { data: { threads: [], drafts: [] } };
    if (url === '/api/v1/world/show-1/season/proposals') return { data: { open: null, recent: [] } };
    if (url === '/api/v1/world/show-1/season/needs') return { data: NEEDS };
    if (url === '/api/v1/world/show-1/season/knows') return { data: { record: { episode_number: 3, title: 'The Gala', what_happened: 'Lala wins.', relationships: [], threads: [] }, follow_ups: [] } };
    if (url === '/api/v1/world/show-1/season/slots/slot-4/notes') return { data: { twists: { plant: [{ id: 't1', title: 'The ring', characters: ['Jade', 'Dre'] }], payoff: [] }, reveals: [{ id: 'r1', intent: 'hint', character_name: 'Jade', text: 'She pawned it' }] } };
    if (url === '/api/v1/world/show-1/season/slots/slot-4/event-fit') return { data: { events: [
      { id: 'ev-coffee', name: 'Coffee Date', reason: 'Fits the planned pressure (Low)', reason_kind: 'boost' },
      { id: 'ev-ball', name: 'A Ball', reason: 'Pressure High, planned Low', reason_kind: 'warn' },
    ] } };
    return { data: {} };
  });
}

const renderSeason = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=season']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  mockGets();
});

describe('Season Plan: what the season needs and knows', () => {
  test('the needs fold sits under the roadmap with its count of missing; the knows fold too', async () => {
    renderSeason();
    const needs = await screen.findByTestId('season-needs');
    await waitFor(() => expect(within(needs).getByTestId('season-needs-count').textContent).toBe('1 missing'));
    const roadmap = screen.getByTestId('season-roadmap');
    expect(roadmap.compareDocumentPosition(needs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const knows = screen.getByTestId('season-knows');
    expect(await within(knows).findByText('Episode 3')).toBeTruthy();
    expect(screen.getByTestId('season-proposals-start')).toBeTruthy();
  });

  test("a slot's panel: its twists, secrets, needs, and the pencil list best fit first", async () => {
    renderSeason();
    fireEvent.click(await screen.findByTestId('season-slot-4'));
    const panel = await screen.findByTestId('season-slot-panel');
    expect(await within(panel).findByTestId('slot-notes-twists')).toBeTruthy();
    expect(within(panel).getByTestId('slot-notes-reveals').textContent).toContain('She pawned it');
    expect(within(panel).getByTestId('slot-notes-needs').textContent).toContain('Jade');
    const select = within(panel).getByTestId('season-pencil-4');
    await waitFor(() => expect([...select.options].map((o) => o.textContent)).toEqual([
      'Pencil an event (best fit first)…', 'Coffee Date · Fits the planned pressure (Low)', 'A Ball · Pressure High, planned Low',
    ]));
    fireEvent.change(select, { target: { value: 'ev-coffee' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/slots/slot-4/event', { event_id: 'ev-coffee' }));
  });
});
