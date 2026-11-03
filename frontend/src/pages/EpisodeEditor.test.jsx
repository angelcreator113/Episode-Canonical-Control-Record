/**
 * The episode editor at /episodes/:episodeId/editor (Timeline Editor redesign
 * P1). The mocks answer in the API's real shapes:
 * - GET /episodes/:id            { data: episode, script_revision }
 * - GET /episodes/:id/edit       { success, data: { edit_revision, rows, edit } }; 404 EPISODE_EDIT_OFF when off
 * - GET /episodes/:id/edit/findings { success, data: { ready, counts, findings } }
 * - GET /episode-clips/:id       { success, data: [clip] }
 * - GET /episodes/:id/scene-sets { success, data: [set with angles] }
 * - GET /voice-studio/:id/playable { success, data: { takes, held } }
 * P1 reads only: no test path may send a write.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// An admin is signed in unless a test says otherwise (editing is an admin's).
const auth = vi.hoisted(() => ({ user: { id: 'u1', groups: ['admin'] } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import EpisodeEditor from './EpisodeEditor';

const EP = 'ep-1';
const EDIT = {
  fps: 30,
  beatModes: {},
  beatDurations: {},
  sceneClips: [{ id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: 0, source_out_ms: 6000, source_duration_ms: null, duration_ms: 6000 }],
  segments: [{ id: 's1', raw_clip_id: 'r1', source_in_ms: 0, source_out_ms: 6000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0,
    layout: { x: 1300, y: 700, w: 540, h: 304 }, audio_in_ms: 0, audio_out_ms: 6000, audio_gain_db: -2, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0, status: 'draft' }],
  pip: { id: 'p1', default_layout: null, default_visible: true, use_cutout: true },
  visibility: [],
  items: [],
  audioItems: [],
  lineTimes: {},
  voiceTakes: {},
};
const FINDINGS = { ready: false, edit_revision: 7, counts: { blocking: 2, warning: 0 }, findings: [
  { code: 'scene_missing', severity: 'blocking', beat: 2 },
  { code: 'line_audio_unapproved', severity: 'blocking', beat: 1, line_index: 0 },
] };

const ok = (data) => Promise.resolve({ data: { success: true, data } });
const fail = (status, body = {}) => Promise.reject(Object.assign(new Error(`HTTP ${status}`), { response: { status, data: body } }));

function answer(overrides = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (overrides[url]) return overrides[url]();
    if (url === `/api/v1/episodes/${EP}`) return Promise.resolve({ data: { data: { id: EP, episode_number: 3, title: 'A New Alliance', show_id: 'show-1' }, script_revision: 4 } });
    if (url === `/api/v1/episodes/${EP}/edit`) return ok({ edit_revision: 7, rows: {}, edit: EDIT });
    if (url === `/api/v1/episodes/${EP}/edit/findings`) return ok(FINDINGS);
    if (url === `/api/v1/episode-clips/${EP}`) return ok([{ id: 'r1', performer: 'justawoman', label: 'Prime take', thumbnail_url: 'https://cdn/r1.jpg', duration_seconds: 6, beat_number: 1 }]);
    if (url === `/api/v1/episodes/${EP}/scene-sets`) return ok([{ id: 'set1', name: 'Closet', angles: [{ id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' }] }]);
    if (url === `/api/v1/voice-studio/${EP}/playable`) return ok({ script_revision: 'x', takes: [], held: [] });
    return fail(404);
  });
}

const renderAt = () => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/editor`]}>
    <Routes><Route path="/episodes/:episodeId/editor" element={<EpisodeEditor />} /></Routes>
  </MemoryRouter>
);

const noWrites = () => {
  for (const m of ['post', 'put', 'patch', 'delete']) expect(api[m]).not.toHaveBeenCalled();
};

describe('EpisodeEditor: reading the edit (P1) and the working preview (P2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom has no media playback: play and pause only record that they were asked.
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('with the episode edit switched off it says so, links back to the episode, and writes nothing', async () => {
    answer({ [`/api/v1/episodes/${EP}/edit`]: () => fail(404, { success: false, code: 'EPISODE_EDIT_OFF' }) });
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toContain('The episode edit is switched off');
    expect(screen.getByRole('link', { name: '← Back to the episode' }).getAttribute('href')).toBe(`/episodes/${EP}?tab=edit`);
    expect(screen.queryByRole('link', { name: /Timeline Editor/ })).toBeNull();
    noWrites();
  });

  test('an unknown episode is "not found", not an empty editor', async () => {
    answer({ [`/api/v1/episodes/${EP}/edit`]: () => fail(404, { success: false, code: 'NOT_FOUND' }) });
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toContain('Episode not found');
    expect(screen.queryByTestId('editor-timeline')).toBeNull();
  });

  test('opens the edit: breadcrumbs, title, revision, findings count, the 14-beat rail and every lane', async () => {
    answer();
    renderAt();
    expect(await screen.findByText('Episode 3: A New Alliance')).toBeTruthy();
    expect(screen.getByText('Edit revision 7')).toBeTruthy();
    // The back arrow returns to the episode's Edit pill (Evoni, 2026-11-03).
    expect(screen.getByRole('link', { name: 'Back to the episode' }).getAttribute('href')).toMatch(/\/episodes\/[^/?]+\?tab=edit$/);
    await waitFor(() => expect(screen.getByText('2 blocking · 0 warnings')).toBeTruthy());
    const rail = screen.getByTestId('beat-rail');
    expect(within(rail).getAllByRole('button', { pressed: false }).length).toBe(14);
    expect(within(rail).getByRole('button', { name: /^Beat 1: Opening Ritual\. Blocking findings \(1 blocking\)/ })).toBeTruthy();
    expect(within(rail).getByRole('button', { name: /^Beat 2: Login Sequence\. Blocking findings/ })).toBeTruthy();
    const tl = screen.getByTestId('editor-timeline');
    for (const name of ['Scene', 'Lala & guests', 'Prime PIP', 'Prime VO', 'Dialogue', 'Phone', 'Gameplay', 'Overlays', 'Music', 'SFX', 'Captions & titles']) {
      expect(within(tl).getByText(name)).toBeTruthy();
    }
    expect(within(tl).getByText('Phone screens: Gate 2b (their state model)')).toBeTruthy();
    expect(within(tl).queryByText(/Performer layer: Gate 2/)).toBeNull();
    noWrites();
  });

  test('render and export are disabled and say why; with nothing selected or done, the edit buttons are off', async () => {
    answer();
    renderAt();
    await screen.findByText('Episode 3: A New Alliance');
    for (const name of [/^Preview Render \(Pending: the render host/, /^Export Video \(Pending: the render host/]) {
      const b = screen.getByRole('button', { name });
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('aria-disabled')).toBe('true');
    }
    for (const name of [/^Undo$/, /^Redo$/, /^Split$/, /^Cut$/, /^Paste$/, /^Delete$/]) expect(screen.getByRole('button', { name }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Save Draft/ }).disabled).toBe(false);
    noWrites();
  });

  test("the preview shows the scene and Prime's PIP where the edit places it; clicking the PIP selects her segment and the inspector shows her stored values", async () => {
    answer();
    renderAt();
    const monitor = await screen.findByTestId('editor-monitor');
    await waitFor(() => expect(within(monitor).getByRole('img', { name: 'Closet · Wide' }).getAttribute('src')).toBe('https://cdn/a1.jpg'));
    const pip = within(monitor).getByRole('button', { name: 'Prime PIP: Prime take' });
    const box = within(monitor).getByTestId('preview-pip');
    expect(box.style.left).toBe(`${(1300 / 1920) * 100}%`);
    expect(box.style.width).toBe(`${(540 / 1920) * 100}%`);
    fireEvent.click(pip);
    expect(pip.getAttribute('aria-pressed')).toBe('true');
    // The inspector shows her stored layout and audio, read only.
    expect(screen.getByLabelText('Position X').value).toBe('1300');
    expect(screen.getByLabelText('Width').value).toBe('540');
    expect(screen.getByLabelText('Rotation (Deferred (D5))').disabled).toBe(true);
    fireEvent.click(within(screen.getByRole('region', { name: 'Inspector' })).getByRole('tab', { name: 'Audio' }));
    expect(screen.getByLabelText('Gain').value).toBe('-2');
    noWrites();
  });

  test('clicking a beat enters Beat Focus: its card, its findings and its media', async () => {
    answer();
    renderAt();
    const rail = await screen.findByTestId('beat-rail');
    fireEvent.click(within(rail).getByRole('button', { name: /^Beat 2: Login Sequence/ }));
    const card = screen.getByTestId('beat-card');
    expect(card.textContent).toContain('Beat 2: Login Sequence');
    expect(card.textContent).toContain('No scene clip in this beat');
    expect(screen.getByText('Showing beat 2: Login Sequence')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Leave beat 2/ }));
    expect(screen.queryByText('Showing beat 2: Login Sequence')).toBeNull();
  });

  test('track toggles are view settings: kept in this browser, never sent to the server', async () => {
    answer();
    renderAt();
    await screen.findByTestId('editor-timeline');
    const hide = screen.getByRole('button', { name: 'Hide Prime PIP in the preview (view only, not saved)' });
    fireEvent.click(hide);
    expect(within(screen.getByTestId('editor-monitor')).queryByRole('button', { name: /Prime PIP/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lock Scene for editing in this browser' }));
    expect(JSON.parse(localStorage.getItem(`tle-view-${EP}`))).toEqual({ prime: { hidden: true }, scene: { locked: true } });
    noWrites();
  });

  test('media failing to load is said in its panel; the edit still opens', async () => {
    answer({ [`/api/v1/episode-clips/${EP}`]: () => fail(500, { error: 'boom' }) });
    renderAt();
    expect(await screen.findByText(/Raw clips could not be loaded/)).toBeTruthy();
    expect(screen.getByTestId('editor-timeline')).toBeTruthy();
  });

  test("P2: Prime plays from her cutout in the preview, and Play and Space start and stop the clock without writing anything", async () => {
    answer({ [`/api/v1/episode-clips/${EP}`]: () => ok([{ id: 'r1', performer: 'justawoman', label: 'Prime take', thumbnail_url: 'https://cdn/r1.jpg',
      url_raw: 'https://cdn/r1.mp4', url_cutout: 'https://cdn/r1-cutout.webm', duration_seconds: 6, beat_number: 1 }]) });
    renderAt();
    const monitor = await screen.findByTestId('editor-monitor');
    await waitFor(() => expect(within(monitor).getByLabelText('Prime: Prime take').getAttribute('src')).toBe('https://cdn/r1-cutout.webm'));
    expect(within(monitor).getByLabelText('Prime: Prime take').muted).toBe(true);
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play.disabled).toBe(false);
    fireEvent.click(play);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    noWrites();
  });
});
