/**
 * Placing a still picture in the editor (Gate 2b PR 1b): the Graphics tab
 * offers the episode's and the show's approved pictures, placing one writes
 * an `overlay` item, a locked Overlays lane refuses, and an edit with no
 * picture is the editor it always was.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: { id: 'u1', groups: ['admin'] } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import EpisodeEditor from './EpisodeEditor';

const EP = 'ep-1';
const SHOW = 'show-1';
const BASE = `/api/v1/episodes/${EP}/edit`;
const ok = (data) => Promise.resolve({ data: { success: true, data } });

const PICTURE = { id: 'img-1', url: 'https://cdn/title.png', width: 1920, height: 1080, name: 'Episode title' };
const OVERLAY_ITEM = {
  id: 'o1', kind: 'overlay', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0,
  values: { asset_id: 'img-1', layout: { x: 0, y: 0, w: 1920, h: 1080 }, fit: 'contain', layer: 0 }, duration_ms: 2000,
};
const editWith = (items = []) => ({
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [{ id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: 6000 }],
  segments: [], pip: null, visibility: [], items, audioItems: [], lineTimes: {}, voiceTakes: {},
});

let server;
function setup({ items = [], images = [], sourcesFails = false } = {}) {
  server = { rev: 7, edit: editWith(items), writes: [] };
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === `/api/v1/episodes/${EP}`) return Promise.resolve({ data: { data: { id: EP, show_id: SHOW, episode_number: 3, title: 'A New Alliance' } } });
    if (url === BASE) return ok({ edit_revision: String(server.rev), c1b: true, rows: {}, edit: server.edit });
    if (url === `${BASE}/findings`) return ok({ ready: true, counts: { blocking: 0, warning: 0 }, findings: [] });
    if (url === `${BASE}/sources`) {
      return sourcesFails
        ? Promise.reject(Object.assign(new Error('nope'), { response: { status: 500, data: { error: 'nope' } } }))
        : ok({ plan: [], summary: {}, images });
    }
    if (url === `${BASE}/versions`) return ok([]);
    if (url === `/api/v1/episodes/${EP}/overlays`) return ok({ pieces: [{ key: 'title_overlay', label: 'Title overlay', status: 'approved', asset_id: 'img-1', image_url: 'https://cdn/title.png' }] });
    if (url.startsWith(`/api/v1/ui-overlays/${SHOW}`)) return ok([{ id: 'messages', name: 'Messages', category: 'phone', asset_id: 'img-phone', url: 'https://cdn/msg.png', variants: null }]);
    if (url === `/api/v1/episode-clips/${EP}`) return ok([]);
    if (url === `/api/v1/episodes/${EP}/scene-sets`) return ok([{ id: 'set1', name: 'Closet', angles: [{ id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' }] }]);
    if (url === `/api/v1/voice-studio/${EP}/playable`) return ok({ takes: [], held: [] });
    return ok(null);
  });
  vi.mocked(api.post).mockImplementation((url, body) => {
    server.writes.push({ url, body });
    server.rev += 1;
    return ok({ edit_revision: String(server.rev), id: 'new-item' });
  });
}

const draw = () => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/editor`]}>
    <Routes><Route path="/episodes/:episodeId/editor" element={<EpisodeEditor />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.post).mockReset(); localStorage.clear(); });
afterEach(() => { localStorage.clear(); });

describe('the Graphics tab', () => {
  test('offers the episode’s pieces and the show’s pictures, and placing one writes an overlay item', async () => {
    setup();
    draw();
    fireEvent.click(await screen.findByRole('tab', { name: 'Graphics' }));
    expect(await screen.findByTitle('Title overlay')).toBeTruthy();
    expect(screen.getByTitle('Messages')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Place Title overlay at the playhead' }));
    await waitFor(() => expect(server.writes.length).toBe(1));
    const { url, body } = server.writes[0];
    expect(url).toBe(`${BASE}/items`);
    expect(body).toMatchObject({ kind: 'overlay', values: { asset_id: 'img-1' }, duration_ms: 4000, edit_revision: '7' });
    // No box is sent: the service places it over the whole frame itself.
    expect(body.values.layout).toBeUndefined();
  });

  test('a locked Overlays lane refuses the placement and writes nothing', async () => {
    localStorage.setItem(`tle-view-${EP}`, JSON.stringify({ overlays: { locked: true } }));
    setup();
    draw();
    fireEvent.click(await screen.findByRole('tab', { name: 'Graphics' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Place Title overlay at the playhead' }));
    await waitFor(() => expect(screen.getByTestId('editor-notice').textContent).toMatch(/locked/i));
    expect(server.writes).toEqual([]);
  });
});

describe('a placed picture', () => {
  test('is on the Overlays lane and on the monitor, named after the picture', async () => {
    setup({ items: [OVERLAY_ITEM], images: [PICTURE] });
    draw();
    expect(await screen.findByTestId('preview-overlay-o1')).toBeTruthy();
    expect(screen.getByTestId('preview-overlay-o1').querySelector('img').getAttribute('src')).toBe('https://cdn/title.png');
    expect(screen.getAllByTitle(/Episode title/).length).toBeGreaterThan(0);
  });

  test('a picture the episode may not draw says so; a failed read says something else', async () => {
    setup({ items: [OVERLAY_ITEM], images: [] });
    draw();
    expect((await screen.findByTestId('preview-overlay-o1')).textContent).toBe('The graphic is missing');
  });

  test('when the graphics could not be read at all, it is not called missing', async () => {
    setup({ items: [OVERLAY_ITEM], sourcesFails: true });
    draw();
    expect((await screen.findByTestId('preview-overlay-o1')).textContent).toBe('The graphics could not be read');
  });
});

describe('an edit with no pictures', () => {
  test('draws no overlay and keeps the lane’s own line about what it can do', async () => {
    setup();
    draw();
    await screen.findByTestId('editor-monitor');
    expect(screen.queryByTestId(/^preview-overlay-/)).toBeNull();
    expect(screen.getByText('Static graphics supported · Animated widgets and interactive phone behavior not yet available')).toBeTruthy();
  });
});
