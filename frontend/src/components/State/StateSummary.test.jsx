/**
 * The State front page (the mock, 2026-10-06): the world after each
 * episode, the tensions by level, what changed; a plain line where there
 * is nothing, and a failed read is never "nothing".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import { rememberShow } from '../../utils/activeShow';
import StateSummary from './StateSummary';

const SHOWS = [{ id: 'show-b', name: 'Styling Adventures' }];
const EPISODES = [
  { id: 'ep1', episode_number: 1, title: 'The Studio Session', evaluation_status: 'accepted' },
  { id: 'ep2', episode_number: 2, title: 'The Gala' },
];
const HISTORY = [
  { id: 'h1', character_key: 'lala', source: 'computed', episode_id: 'ep1', episode_number: 1, deltas_json: { reputation: 3, stress: -2 }, created_at: '2026-10-02T00:00:00Z' },
];
const respond = (over = {}) => vi.mocked(api.get).mockImplementation(async (url) => {
  if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
  if (url.startsWith('/api/v1/episodes')) { if (over.episodesFail) throw new Error('500'); return { data: { data: over.episodes ?? EPISODES, pagination: { total: (over.episodes ?? EPISODES).length } } }; }
  if (url === '/api/v1/world/show-b/history') { if (over.historyFail) throw new Error('500'); return { data: { success: true, history: over.history ?? HISTORY } }; }
  return { data: {} };
});
const SNAPS = [
  { id: 't1', snapshot_label: 'temperature_update', created_at: '2026-10-03', metadata: { world_temperature: { value: 62 } } },
  { id: 's1', snapshot_label: 'The world before Lala', world_facts: ['Velvet is in'], created_at: '2026-09-01' },
];
const PAIRS = [
  { char_a: { id: 'a', name: 'Sable' }, char_b: { id: 'b', name: 'Lala' }, tension_state: 'Simmering', relationship_type: 'rival', conflict_summary: 'The studio lease.' },
  { char_a: { id: 'c', name: 'Nia' }, char_b: { id: 'd', name: 'Rex' }, tension_state: 'Explosive', relationship_type: 'ex' },
];
const renderIt = (props = {}) => render(<MemoryRouter><StateSummary snapshots={SNAPS} tensions={{ pairs: PAIRS, scan: { status: 'ok', characters_scanned: 6 } }} {...props} /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  rememberShow('show-b');
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('StateSummary', () => {
  test('the baseline, each episode after Complete or not yet, the temperature, the tensions hottest first and what changed', async () => {
    respond();
    const onTakeSnapshot = vi.fn();
    renderIt({ onTakeSnapshot });
    const eps = await screen.findByTestId('st-episodes');
    expect(within(eps).getByText('The world before Lala')).toBeTruthy();
    expect(within(eps).getByText('after Complete · Reputation +3 · Stress −2')).toBeTruthy();
    expect(within(eps).getByText('Not yet')).toBeTruthy();
    expect(within(eps).getByRole('link', { name: 'The Gala' }).getAttribute('href')).toBe('/episodes/ep2');
    expect(screen.getByTestId('st-temperature').textContent).toBe('World temperature 62');
    // A temperature reading is not a snapshot anyone saved.
    expect(screen.getByTestId('st-saved').textContent).toContain('1 snapshot saved by hand');
    const tensions = screen.getByTestId('st-tensions');
    expect(within(tensions).getAllByRole('listitem').map((li) => li.querySelector('strong').textContent)).toEqual(['Nia & Rex', 'Sable & Lala']);
    expect(within(tensions).getByText('rival · The studio lease.')).toBeTruthy();
    expect(screen.queryByText(/cooling|heating/)).toBeNull();
    expect(screen.getByRole('link', { name: '+ Add' }).getAttribute('href')).toBe('/world-studio');
    expect(within(screen.getByTestId('st-changes')).getByText('Reputation +3 · Stress −2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take a snapshot' }));
    expect(onTakeSnapshot).toHaveBeenCalled();
  });

  test('empty: no baseline, no episodes, nothing simmering, nothing moved', async () => {
    respond({ episodes: [], history: [] });
    renderIt({ snapshots: [], tensions: { pairs: [], scan: { status: 'ok', characters_scanned: 4 } } });
    expect((await screen.findByTestId('st-no-episodes')).textContent).toContain('No episodes yet');
    expect(screen.getByText('No baseline yet')).toBeTruthy();
    expect(screen.getByTestId('st-no-tension').textContent).toContain('Nothing simmering among 4 characters');
    expect(screen.getByTestId('st-no-changes')).toBeTruthy();
  });

  test('a failed read says so, never "nothing"', async () => {
    respond({ episodesFail: true, historyFail: true });
    renderIt({ snapshots: [], snapshotsFailed: true, tensions: { pairs: [], scan: { status: 'scan_failed', error: 'boom' } } });
    expect(await screen.findByText('The episodes could not be read just now.')).toBeTruthy();
    expect(screen.getByText('The state history could not be read just now.')).toBeTruthy();
    expect(screen.getByText('The snapshots could not be read just now.')).toBeTruthy();
    expect(screen.getByText(/The scan could not run/)).toBeTruthy();
    expect(screen.queryByTestId('st-no-tension')).toBeNull();
    expect(screen.queryByTestId('st-no-changes')).toBeNull();
  });

  test('more tensions than the card holds open the scanner', async () => {
    respond();
    const many = Array.from({ length: 7 }, (_, i) => ({ char_a: { id: `a${i}`, name: `A${i}` }, char_b: { id: `b${i}`, name: `B${i}` }, tension_state: 'High' }));
    const onOpenTensions = vi.fn();
    renderIt({ tensions: { pairs: many, scan: { status: 'ok', characters_scanned: 14 } }, onOpenTensions });
    expect(within(await screen.findByTestId('st-tensions')).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'See all 7 in the scanner' }));
    expect(onOpenTensions).toHaveBeenCalled();
  });
});
