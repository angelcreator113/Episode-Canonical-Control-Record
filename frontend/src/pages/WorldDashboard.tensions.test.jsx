/**
 * The State tab's Tensions speak the scanner's and the proposal's contracts
 * (2026-10-04): a pair's characters are objects { id, name } (the page read
 * char_a_name, which never existed, so every pair rendered nameless);
 * Propose Scene sends the pair itself (it sent char_a_id / char_b_id, which
 * the route never read, so it was refused 400) and lands on Story
 * Evaluation with the proposal; and the three empties are told apart: the
 * scan failed, nothing to scan, nothing simmering.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import WorldDashboard from './WorldDashboard';

const PAIR = { char_a: { id: 'c-1', name: 'Lala', world_tag: 'lalaverse' }, char_b: { id: 'c-2', name: 'Nia Vale' }, tension_state: 'Explosive', relationship_type: 'rival', conflict_summary: 'The Dazzle Season cover.', romantic: false };
const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}|{JSON.stringify(l.state?.sceneProposal?.character_ids)}</div>; };
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/universe" element={<WorldDashboard embedded />} />
      <Route path="/story-evaluation" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const scanner = (body) => vi.mocked(api.get).mockImplementation(async (url) => (url.includes('tension-scanner') ? { data: body } : { data: { snapshots: [], events: [] } }));

beforeEach(() => {
  window.history.pushState({}, '', '/universe?tab=state&sub=tensions');
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('State tab: the Tensions contracts', () => {
  test('a pair shows both names from the nested characters, and Propose Scene sends the pair and lands with the ids', async () => {
    scanner({ status: 'ok', pairs: [PAIR], count: 1, characters_scanned: 5 });
    vi.mocked(api.post).mockResolvedValue({ data: { proposal: { scene_title: 'Lala × Nia Vale — Explosive', characters: ['lala', 'niavale'], character_ids: ['c-1', 'c-2'] } } });
    renderAt('/universe?tab=state&sub=tensions');
    // The scanner's own panel (the hub's front page lists the pair too).
    const panel = await screen.findByTestId('wd-tensions-panel');
    expect((await within(panel).findByText(/Lala/)).textContent).toContain('Nia Vale');
    expect(screen.queryByText(/Unknown/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Propose Scene' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/create-tension-proposal', { char_a: PAIR.char_a, char_b: PAIR.char_b, tension_state: 'Explosive', relationship_type: 'rival', conflict_summary: 'The Dazzle Season cover.', romantic: false }));
    expect((await screen.findByTestId('where')).textContent).toBe('/story-evaluation|["c-1","c-2"]');
  });

  test('a failed scan is not "no tension"', async () => {
    scanner({ status: 'scan_failed', pairs: [], count: 0, characters_scanned: 0, error: 'relation "world_characters" does not exist' });
    renderAt('/universe?tab=state&sub=tensions');
    const box = await screen.findByTestId('tensions-scan-failed');
    expect(box.textContent).toContain('relation "world_characters" does not exist');
    expect(box.textContent).toContain('This is not "no tension"');
  });

  test('nothing to scan and nothing simmering are told apart', async () => {
    scanner({ status: 'ok', pairs: [], count: 0, characters_scanned: 0 });
    const { unmount } = renderAt('/universe?tab=state&sub=tensions');
    expect((await screen.findByTestId('tensions-no-data')).textContent).toContain('No active characters with relationship data');
    unmount();
    scanner({ status: 'ok', pairs: [], count: 0, characters_scanned: 7 });
    renderAt('/universe?tab=state&sub=tensions');
    expect((await screen.findByTestId('tensions-none')).textContent).toContain('No high-tension pairs among 7 characters');
  });

  test("a refused proposal shows the route's reason", async () => {
    scanner({ status: 'ok', pairs: [PAIR], count: 1, characters_scanned: 5 });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { error: 'char_a.name and char_b.name required' } } });
    renderAt('/universe?tab=state&sub=tensions');
    fireEvent.click(await screen.findByRole('button', { name: 'Propose Scene' }));
    expect(await screen.findByText('char_a.name and char_b.name required')).toBeTruthy();
  });
});

describe('State tab: the front page drives the tabs below', () => {
  test('"Take a snapshot" opens World State at the label; the temperature rows are not listed as snapshots', async () => {
    window.history.pushState({}, '', '/universe?tab=state&sub=tensions');
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('tension-scanner')) return { data: { status: 'ok', pairs: [], count: 0, characters_scanned: 3 } };
      if (url.includes('state/snapshots')) return { data: { snapshots: [
        { id: 't1', snapshot_label: 'temperature_update', created_at: '2026-10-03', metadata: { world_temperature: { value: 55 } } },
        { id: 's1', snapshot_label: 'Before the gala', world_facts: ['Velvet is in'], created_at: '2026-09-01' },
      ] } };
      return { data: { events: [] } };
    });
    renderAt('/universe?tab=state&sub=tensions');
    fireEvent.click(await screen.findByRole('button', { name: 'Take a snapshot' }));
    const label = await screen.findByLabelText('Snapshot label *');
    await waitFor(() => expect(document.activeElement).toBe(label));
    const panel = screen.getByRole('tabpanel', { name: 'World State' });
    expect(within(panel).getByText('Before the gala')).toBeTruthy();
    expect(within(panel).queryByText('temperature_update')).toBeNull();
    expect(within(panel).getByText(/One world temperature reading is kept/)).toBeTruthy();
    // Nothing records a reading per episode (the wiring map, §4), so the page doesn't say so.
    expect(screen.queryByText(/accepted episode/)).toBeNull();
  });
});
