/**
 * Editing in the episode editor (Timeline Editor redesign P3). The mock
 * server answers in the C1 routes' real shapes and keeps an edit revision:
 * every write must send the revision it holds, and gets the next one back.
 * The tests check what each gesture sends, that undo sends its exact
 * inverse, and that a stale page, a locked lane and a refused write save
 * nothing.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import EpisodeEditor from './EpisodeEditor';

const EP = 'ep-1';
const BASE = `/api/v1/episodes/${EP}/edit`;
const SEG = {
  id: 's1', raw_clip_id: 'r1', source_in_ms: 0, source_out_ms: 6000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0,
  layout: { x: 1300, y: 700, w: 540, h: 304 }, audio_in_ms: 0, audio_out_ms: 6000, audio_gain_db: -2, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0, status: 'draft',
};
const editWith = (over = {}) => ({
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [{ id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: 6000 }],
  segments: [SEG], pip: null, visibility: [], items: [],
  audioItems: [{ id: 'm1', track: 'music', asset_ref: 'Bed', slot: null, source_in_ms: 0, source_out_ms: 4000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null }],
  lineTimes: {},
  voiceTakes: { ap1: { playable: true, state: 'current', association_id: 'as1', beat_number: 1, line_index: 0, in_ms: 0, out_ms: 1500, source_duration_ms: 2000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, normalise: false } },
  ...over,
});

let server;
const ok = (data) => Promise.resolve({ data: { success: true, data } });
const refuse = (status, code, error) => Promise.reject(Object.assign(new Error(code), { response: { status, data: { success: false, code, error } } }));

const PRIME_CLIP = { id: 'r1', performer: 'justawoman', label: 'Prime take', url_raw: 'https://cdn/r1.mp4', duration_seconds: 6, beat_number: 1 };
const LALA_CLIP = { id: 'r2', performer: 'lala', label: 'Lala twirl', url_raw: 'https://cdn/r2.mp4', url_cutout: 'https://cdn/r2-cut.webm', key_status: 'done', duration_seconds: 4, beat_number: 1 };

function setupServer({ refuseNext = null, c1b = true, edit = editWith(), clips = [PRIME_CLIP] } = {}) {
  server = { rev: 7, edit, writes: [], refuseNext, c1b, clips };
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === `/api/v1/episodes/${EP}`) return Promise.resolve({ data: { data: { id: EP, episode_number: 3, title: 'A New Alliance' } } });
    if (url === BASE) return ok({ edit_revision: String(server.rev), c1b: server.c1b, rows: {}, edit: server.edit });
    if (url === `${BASE}/findings`) return ok({ ready: true, counts: { blocking: 0, warning: 0 }, findings: [] });
    if (url === `${BASE}/versions`) return ok([{ id: 'v1', name: 'Before the split', edit_revision: '5', created_at: '2026-11-02T10:00:00Z' }]);
    if (url === `/api/v1/episode-clips/${EP}`) return ok(server.clips);
    if (url === `/api/v1/episodes/${EP}/scene-sets`) return ok([{ id: 'set1', name: 'Closet', angles: [{ id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' }] }]);
    if (url === `/api/v1/voice-studio/${EP}/playable`) return ok({ takes: [{ approval_id: 'ap1', beat_number: 1, line_index: 0, in_ms: 0, out_ms: 1500, audio_url: 'https://cdn/ap1.webm' }], held: [] });
    return refuse(404, 'NOT_FOUND', 'not found');
  });
  const write = (method) => (url, payload, opts) => {
    // axios sends a DELETE's body as its config's `data`.
    const body = method === 'delete' ? payload?.data : payload;
    server.writes.push({ method, path: url.replace(BASE, ''), body });
    if (server.refuseNext) { const r = server.refuseNext; server.refuseNext = null; return refuse(...r); }
    if (body?.dry_run) return ok({ dry_run: true, for_edit_revision: String(server.rev), beat: 1, from: { ms: 6000 }, to: { ms: body.duration_ms }, changes: [{ key: 'segment:s1' }], duration_ms: { from: 6000, to: body.duration_ms }, findings_added: [], findings_cleared: [] });
    if (String(body?.edit_revision) !== String(server.rev)) return refuse(409, 'EDIT_CHANGED', 'The edit changed since this page read it.');
    if (url.endsWith('/versions')) return ok({ version_id: 'v2', edit_revision: String(server.rev) });
    server.rev += 1;
    const path = url.replace(BASE, '');
    const extra = path === '/segments' ? { segment_id: 's2' } : path === '/dialogue' ? { item_id: 'd9' } : path === '/scene-clips' ? { scene_clip_id: 'c9' }
      : path === '/visibility' ? { rule_id: 'v9' } : path.endsWith('/split') && path.startsWith('/scene-clips') ? { scene_clip_id: 'c1', new_scene_clip_id: 'c10' }
        : path === '/ops' ? { results: body.steps.map(() => ({})) } : path === '/items' ? { item_id: 'i9', duration_ms: body.duration_ms ?? null } : {};
    return ok({ ...extra, edit_revision: String(server.rev) });
  };
  for (const m of ['post', 'patch', 'put', 'delete']) vi.mocked(api[m]).mockImplementation(write(m));
}

const renderAt = () => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/editor`]}>
    <Routes><Route path="/episodes/:episodeId/editor" element={<EpisodeEditor />} /></Routes>
  </MemoryRouter>
);
const opened = async () => {
  await screen.findByTestId('editor-timeline');
  await waitFor(() => expect(screen.getByText('Edit revision 7')).toBeTruthy());
};
const inspector = () => screen.getByRole('region', { name: 'Inspector' });
const lastWrite = () => server.writes[server.writes.length - 1];
const selectPrime = () => fireEvent.click(within(screen.getByTestId('editor-monitor')).getByRole('button', { name: 'Prime PIP: Prime take' }));

// jsdom has no PointerEvent: a MouseEvent with a pointerId stands in, so clientX and button arrive.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  };
}

describe('EpisodeEditor: editing (P3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test("placing Prime's take at the playhead sends one segment, with the page's revision; undo deletes exactly it; redo places it again", async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Place Prime take at the playhead' }));
    await waitFor(() => expect(screen.getByText('Edit revision 8')).toBeTruthy());
    expect(server.writes[0]).toEqual({ method: 'post', path: '/segments', body: { raw_clip_id: 'r1', anchor_kind: 'edit_start', offset_ms: 0, edit_revision: '7' } });

    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(screen.getByText('Edit revision 9')).toBeTruthy());
    expect(server.writes[1]).toEqual({ method: 'delete', path: '/segments/s2', body: { edit_revision: '8' } });

    fireEvent.click(screen.getByRole('button', { name: /^Redo$/ }));
    await waitFor(() => expect(screen.getByText('Edit revision 10')).toBeTruthy());
    expect(server.writes[2]).toMatchObject({ method: 'post', path: '/segments', body: { raw_clip_id: 'r1', edit_revision: '9' } });
  });

  test("a field in the inspector saves on Enter: Prime's place; undo puts the stored place back", async () => {
    setupServer();
    renderAt();
    await opened();
    selectPrime();
    const x = within(inspector()).getByLabelText('Position X');
    fireEvent.change(x, { target: { value: '1200' } });
    fireEvent.keyDown(x, { key: 'Enter' });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/segments/s1/layout', body: { layout: { x: 1200, y: 700, w: 540, h: 304 }, edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'post', path: '/segments/s1/layout', body: { layout: { x: 1300, y: 700, w: 540, h: 304 }, edit_revision: '8' } });
  });

  test('dragging Prime in the preview saves her new place once, on release', async () => {
    setupServer();
    renderAt();
    await opened();
    selectPrime();
    const box = within(screen.getByTestId('editor-monitor')).getByTestId('preview-pip');
    fireEvent.pointerDown(box, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 160, clientY: 80, pointerId: 1 });
    expect(within(inspector()).getByLabelText('Position X').value).toBe('1360');
    fireEvent.pointerMove(box, { clientX: 200, clientY: 80, pointerId: 1 });
    expect(server.writes).toHaveLength(0);
    fireEvent.pointerUp(box, { clientX: 200, clientY: 80, pointerId: 1 });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toMatchObject({ method: 'post', path: '/segments/s1/layout', body: { layout: { x: 1400, y: 680, w: 540, h: 304 } } }); // 100 px right, 20 px up; nothing to snap to
  });

  test("Delete removes the selected segment; undo puts it back with its stored values", async () => {
    setupServer();
    renderAt();
    await opened();
    selectPrime();
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'delete', path: '/segments/s1', body: { edit_revision: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'post', path: '/segments', body: {
      raw_clip_id: 'r1', source_in_ms: 0, source_out_ms: 6000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0,
      layout: { x: 1300, y: 700, w: 540, h: 304 }, audio_in_ms: 0, audio_out_ms: 6000, audio_gain_db: -2, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0,
      edit_revision: '8',
    } });
  });

  test('a lane locked in this browser refuses the change and sends nothing', async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Lock Prime PIP for editing in this browser' }));
    selectPrime();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect((await screen.findByTestId('editor-notice')).textContent).toMatch(/lane is locked/);
    expect(server.writes).toHaveLength(0);
  });

  test('a change refused as stale (409) reloads the edit, says so, and leaves nothing to undo', async () => {
    setupServer();
    renderAt();
    await opened();
    server.rev = 12; // someone else saved meanwhile
    selectPrime();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect((await screen.findByTestId('editor-notice')).textContent).toMatch(/changed in another tab or by someone else/);
    await waitFor(() => expect(screen.getByText('Edit revision 12')).toBeTruthy());
    expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(true);
  });

  test("a refused change shows the server's reason and saves nothing", async () => {
    setupServer({ refuseNext: [409, 'COMMENTARY_OUTSIDE_TRIM', 'The commentary would be cut away entirely.'] });
    renderAt();
    await opened();
    selectPrime();
    const out = within(inspector()).getByLabelText('Source out');
    fireEvent.change(out, { target: { value: '100' } });
    fireEvent.blur(out);
    expect((await screen.findByTestId('editor-notice')).textContent).toMatch(/commentary would be cut away entirely/);
    expect(screen.getByText('Edit revision 7')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(true);
  });

  test("Split sends the source time at the playhead; undo explains it can't be undone and sends nothing", async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: 'Next edit point' })); // 4000, the music item's end; step back a second
    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    selectPrime();
    fireEvent.click(screen.getByRole('button', { name: /^Split$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/segments/s1/split', body: { at_source_ms: 3000, edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).title).toMatch(/can't be undone/));
    expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(true);
  });

  test('an approved take is placed in its own beat with its line association', async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(within(screen.getByRole('region', { name: 'Media' })).getByRole('button', { name: 'Place Beat 1 · line 1 at the playhead' }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/dialogue', body: { approval_id: 'ap1', association_id: 'as1', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0, edit_revision: '7' } });
  });

  test("a beat's new length is previewed (a dry run, no revision) before it is applied with the revision the preview was worked out for", async () => {
    setupServer();
    renderAt();
    await opened();
    const card = within(inspector()).getByTestId('beat-card');
    fireEvent.change(within(card).getByLabelText(/Set its length/), { target: { value: '8000' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Preview the change' }));
    expect((await within(card).findByTestId('beat-plan')).textContent).toMatch(/1 thing moves/);
    expect(server.writes[0]).toEqual({ method: 'post', path: '/beats/1/duration', body: { duration_ms: 8000, dry_run: true } });
    fireEvent.click(within(card).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'post', path: '/beats/1/duration', body: { duration_ms: 8000, edit_revision: '7' } });
  });

  test('Save Draft names a version without changing the edit; a saved draft is restored only after a confirmation', async () => {
    setupServer();
    vi.spyOn(window, 'prompt').mockReturnValue('Before trims');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/versions', body: { name: 'Before trims', edit_revision: '7' } });
    expect(screen.getByText('Edit revision 7')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Saved drafts…' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Restore “Before the split”/ }));
    expect(confirm).toHaveBeenCalled();
    expect(server.writes).toHaveLength(1); // declined: nothing restored
  });

  // ── P4: the API additions ─────────────────────────────────────────────
  test('P4: a scene clip splits at the playhead; undo is one batch that removes the new part and gives the first back its length', async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.click(within(screen.getByTestId('editor-timeline')).getByRole('button', { name: /^Scene: Closet · Wide/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Split$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/scene-clips/c1/split', body: { at_ms: 2000, edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'post', path: '/ops', body: { edit_revision: '8', steps: [
      { op: 'remove', id: 'c10', body: { what: 'scene_clip' } },
      { op: 'scene-clip.update', id: 'c1', body: { duration_ms: 6000 } },
    ] } });
  });

  test("P4: a sound's level changes in place; undo puts the stored level back", async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(within(screen.getByTestId('editor-timeline')).getByRole('button', { name: /^Music: Bed/ }));
    fireEvent.click(within(inspector()).getByRole('tab', { name: 'Audio' }));
    const gain = within(inspector()).getByLabelText('Gain');
    fireEvent.change(gain, { target: { value: '-9' } });
    fireEvent.keyDown(gain, { key: 'Enter' });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'patch', path: '/audio-items/m1', body: { gain_db: -9, edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'patch', path: '/audio-items/m1', body: { gain_db: -6, edit_revision: '8' } });
  });

  test('P4: dragging a sound moves it on the clock (one change, on release)', async () => {
    setupServer();
    renderAt();
    await opened();
    const block = within(screen.getByTestId('editor-timeline')).getByRole('button', { name: /^Music: Bed/ });
    const px = parseFloat(block.style.width) / 4000; // the block is 4000 ms wide
    fireEvent.pointerDown(block, { button: 0, clientX: 10, pointerId: 2 });
    fireEvent.pointerMove(block, { clientX: 10 + px * 1000, pointerId: 2 });
    fireEvent.pointerUp(block, { clientX: 10 + px * 1000, pointerId: 2 });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toMatchObject({ method: 'patch', path: '/audio-items/m1', body: { anchor_kind: 'edit_start', edit_revision: '7' } });
    expect(Math.abs(lastWrite().body.offset_ms - 1000)).toBeLessThanOrEqual(34);
  });
});

describe('EpisodeEditor: Gate 2a (D3, D4, D5)', () => {
  const CAPTION = { id: 'k1', kind: 'caption', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, duration_ms: 3000,
    values: { text: 'Hello', style_key: 'lower_third', layout: { x: 100, y: 850, w: 800, h: 120, opacity: 0.5 } } };
  const monitor = () => screen.getByTestId('editor-monitor');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('the Text tab adds a title at the playhead for 3 seconds; undo deletes it', async () => {
    setupServer();
    vi.spyOn(window, 'prompt').mockReturnValue('  A New Alliance ');
    renderAt();
    await opened();
    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
    fireEvent.click(screen.getByRole('button', { name: /Add title/ }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/items', body: {
      kind: 'caption', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0, duration_ms: 3000,
      values: { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 420, w: 1600, h: 240 } }, edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toMatchObject({ method: 'delete', path: '/items/i9' });
  });

  test("Lala's + places her whole take over the scene, full frame; a Prime take still goes to the PIP", async () => {
    setupServer({ clips: [PRIME_CLIP, LALA_CLIP] });
    renderAt();
    await opened();
    await screen.findByText('Lala twirl');
    fireEvent.click(screen.getByRole('button', { name: 'Place Lala twirl at the playhead' }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/items', body: {
      kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0,
      values: { raw_clip_id: 'r2', source_in_ms: 0, source_out_ms: 4000, layout: { x: 0, y: 0, w: 1920, h: 1080 }, layer: 0 }, edit_revision: '7' } });
  });

  test('a caption is drawn, dragged in the preview (keeping its opacity), and its words and opacity change in the inspector', async () => {
    setupServer({ edit: editWith({ items: [CAPTION] }) });
    renderAt();
    await opened();
    const box = within(monitor()).getByTestId('preview-caption-k1');
    expect(box.style.opacity).toBe('0.5');
    expect(box.className).toMatch(/is-lower-third/);
    fireEvent.click(within(monitor()).getByRole('button', { name: 'Caption: Hello' }));
    fireEvent.pointerDown(box, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 140, clientY: 100, pointerId: 1 });
    expect(within(inspector()).getByLabelText('Position X').value).toBe('140');
    fireEvent.pointerUp(box, { clientX: 140, clientY: 100, pointerId: 1 });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'patch', path: '/items/k1', body: { values: { layout: { x: 140, y: 850, w: 800, h: 120, opacity: 0.5 } }, edit_revision: '7' } });

    const text = within(inspector()).getByLabelText('Text');
    fireEvent.change(text, { target: { value: 'Hello, Lala' } });
    fireEvent.blur(text);
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite()).toEqual({ method: 'patch', path: '/items/k1', body: { values: { text: 'Hello, Lala' }, edit_revision: '8' } });

    const opacity = within(inspector()).getByLabelText('Opacity');
    expect(opacity.value).toBe('50');
    fireEvent.change(opacity, { target: { value: '80' } });
    fireEvent.keyDown(opacity, { key: 'Enter' });
    await waitFor(() => expect(server.writes).toHaveLength(3));
    expect(lastWrite().body.values.layout).toEqual({ x: 100, y: 850, w: 800, h: 120, opacity: 0.8 });
  });

  test("Prime's opacity is set on her layout", async () => {
    setupServer();
    renderAt();
    await opened();
    selectPrime();
    const opacity = within(inspector()).getByLabelText('Opacity');
    expect(opacity.value).toBe('100');
    fireEvent.change(opacity, { target: { value: '60' } });
    fireEvent.keyDown(opacity, { key: 'Enter' });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/segments/s1/layout', body: { layout: { x: 1300, y: 700, w: 540, h: 304, opacity: 0.6 }, edit_revision: '7' } });
  });

  test("the beat card sets a beat's visual mode (undo puts back 'not chosen') and switches it at the playhead", async () => {
    setupServer();
    renderAt();
    await opened();
    const card = screen.getByTestId('beat-card');
    fireEvent.change(within(card).getByLabelText('Visual mode of beat 1'), { target: { value: 'cinematic' } });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toEqual({ method: 'post', path: '/beats/1/mode', body: { visual_mode: 'cinematic', edit_revision: '7' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /^Undo$/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite().body).toEqual({ visual_mode: null, edit_revision: '8' });

    fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
    fireEvent.click(await within(screen.getByTestId('beat-card')).findByRole('button', { name: 'Switch to cinematic at the playhead' }));
    await waitFor(() => expect(server.writes).toHaveLength(3));
    expect(lastWrite()).toEqual({ method: 'post', path: '/items', body: {
      kind: 'visual_mode', anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 1000, values: { mode: 'cinematic' }, edit_revision: '9' } });
  });

  test('without the C1b migration on the server, nothing C1b is sent and the editor says why', async () => {
    setupServer({ c1b: false });
    vi.spyOn(window, 'prompt').mockReturnValue('Hi');
    renderAt();
    await opened();
    expect(within(screen.getByTestId('beat-card')).queryByLabelText('Visual mode of beat 1')).toBeNull();
    expect(within(screen.getByTestId('beat-card')).getByText(/need the C1b migration/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
    fireEvent.click(screen.getByRole('button', { name: /Add caption/ }));
    expect(await screen.findByTestId('editor-notice')).toHaveProperty('textContent', expect.stringMatching(/needs the C1b migration/));
    expect(server.writes).toHaveLength(0);
  });
});
