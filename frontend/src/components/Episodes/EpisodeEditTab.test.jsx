/**
 * Production → Edit (Evoni, 2026-11-03): where the episode's edit stands, read
 * from the C1 routes in their real shapes, and Open the editor. It writes
 * nothing; where the episode edit is off it says so.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import EpisodeEditTab, { editContents, beatCount } from './EpisodeEditTab';

const BASE = '/api/v1/episodes/ep-1/edit';
const EDIT = {
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [{ id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: 6000 }],
  segments: [], pip: null, visibility: [], audioItems: [], lineTimes: {}, voiceTakes: {},
  items: [
    { id: 'p1', kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0, duration_ms: 2000, values: { raw_clip_id: 'r2', source_in_ms: 0, source_out_ms: 2000, layout: { x: 0, y: 0, w: 1920, h: 1080 }, layer: 0 } },
    { id: 'k1', kind: 'caption', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0, duration_ms: 3000, values: { text: 'Hi', style_key: 'title', layout: { x: 0, y: 0, w: 10, h: 10 } } },
  ],
};
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const off = () => Promise.reject(Object.assign(new Error('off'), { response: { status: 404, data: { success: false, code: 'EPISODE_EDIT_OFF' } } }));

function serve({ edit = ok({ edit_revision: '12', c1b: true, rows: {}, edit: EDIT }), versions = [{ id: 'v1', name: 'Rough cut', edit_revision: '9', created_at: '2026-11-02T10:00:00Z' }] } = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === BASE) return edit;
    if (url === `${BASE}/findings`) return ok({ ready: false, counts: { blocking: 2, warning: 1 }, findings: [
      { code: 'scene_missing', severity: 'blocking', beat: 2 }, { code: 'scene_missing', severity: 'blocking', beat: 3 }, { code: 'prime_missing', severity: 'warning', beat: 1 },
    ] });
    if (url === `${BASE}/versions`) return ok(versions);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}
const renderTab = (props = {}) => render(<MemoryRouter><EpisodeEditTab episodeId="ep-1" admin {...props} /></MemoryRouter>);

describe('Production → Edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('says where the edit stands and opens the editor full screen; it writes nothing', async () => {
    serve();
    renderTab();
    const open = await screen.findByTestId('eet-open');
    expect(open.getAttribute('href')).toBe('/episodes/ep-1/editor');
    expect(screen.getByText(/edit revision 12/)).toBeTruthy();
    expect(screen.getByText(/last draft “Rough cut”/)).toBeTruthy();
    expect(within(screen.getByTestId('eet-findings')).getByText(/2 blocking/)).toBeTruthy();
    expect(within(screen.getByTestId('eet-findings')).getByText(/1 warning$/)).toBeTruthy();
    expect(within(screen.getByTestId('eet-beats')).getByText(/2 blocked/)).toBeTruthy();
    expect(screen.queryByText(/C1b migration/)).toBeNull();
    for (const m of ['post', 'patch', 'put', 'delete']) expect(api[m]).not.toHaveBeenCalled();
  });

  test('beat counts read as English', () => {
    expect([beatCount('clear', 1), beatCount('warning', 1), beatCount('warning', 2), beatCount('blocked', 12), beatCount('empty', 3)])
      .toEqual(['1 ready', '1 with a warning', '2 with warnings', '12 blocked', '3 empty']);
  });

  test('counts what the edit holds', () => {
    expect(editContents(EDIT)).toEqual([
      ['Scene clips', 1], ['Prime segments', 0], ['Lines placed', 0], ['Lala & guests', 1], ['Captions & titles', 1], ['Music & SFX', 0],
    ]);
  });

  test('where the episode edit is switched off it says so, with no Open button', async () => {
    serve({ edit: off() });
    renderTab();
    const box = await screen.findByTestId('eet-unavailable');
    expect(within(box).getByText(/switched off on this server/)).toBeTruthy();
    expect(screen.queryByTestId('eet-open')).toBeNull();
    expect(within(box).queryByRole('link')).toBeNull(); // the old Timeline Editor was deleted (2026-11-03)
  });

  test('a server without C1b, and a viewer who is not an admin, are told what they can do', async () => {
    serve({ edit: ok({ edit_revision: '3', c1b: false, rows: {}, edit: { ...EDIT, items: [] } }), versions: [] });
    renderTab({ admin: false });
    await screen.findByTestId('eet-open');
    expect(screen.getByText(/need the C1b migration/)).toBeTruthy();
    expect(screen.getByText(/Editing needs an admin account/)).toBeTruthy();
    expect(screen.getByText(/no saved drafts yet/)).toBeTruthy();
  });
});
