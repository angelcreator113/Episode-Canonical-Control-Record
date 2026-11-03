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
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
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

function setupServer({ refuseNext = null, c1b = true, edit = editWith(), clips = [PRIME_CLIP], sources = null } = {}) {
  server = { rev: 7, edit, writes: [], refuseNext, c1b, clips, sources };
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === `/api/v1/episodes/${EP}`) return Promise.resolve({ data: { data: { id: EP, episode_number: 3, title: 'A New Alliance' } } });
    if (url === BASE) return ok({ edit_revision: String(server.rev), c1b: server.c1b, rows: {}, edit: server.edit });
    if (url === `${BASE}/findings`) return ok({ ready: true, counts: { blocking: 0, warning: 0 }, findings: [] });
    if (url === `${BASE}/sources`) return server.sources ? ok(server.sources) : refuse(404, 'NOT_FOUND', 'not found');
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
      raw_clip_id: 'r1', source_in_ms: 0, source_out_ms: 6000, anchor_kind: 'beat_start', anchor_beat: 1, offset_ms: 0,
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

// The audit of 2026-11-03 (Part A): each confirmed problem, kept fixed.
describe('EpisodeEditor: reliability (audit 2026-11-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.user = { id: 'u1', groups: ['admin'] };
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { auth.user = { id: 'u1', groups: ['admin'] }; vi.restoreAllMocks(); });

  test('A4: while a field saves, the inspector keeps its fields (read only), so the next field keeps focus', async () => {
    setupServer();
    let release;
    const post = vi.mocked(api.post).getMockImplementation();
    vi.mocked(api.post).mockImplementationOnce((...a) => new Promise((res) => { release = () => res(post(...a)); }));
    renderAt();
    await opened();
    selectPrime();
    const x = within(inspector()).getByLabelText('Position X');
    const y = within(inspector()).getByLabelText('Position Y');
    x.focus();
    fireEvent.change(x, { target: { value: '1200' } });
    y.focus();
    fireEvent.blur(x);
    await waitFor(() => expect(release).toBeTypeOf('function'));
    // Saving: the same input is still there, read only, and still focused.
    expect(within(inspector()).getByLabelText('Position Y')).toBe(y);
    expect(y.readOnly).toBe(true);
    expect(document.activeElement).toBe(y);
    await act(async () => { release(); });
    await waitFor(() => expect(screen.getByText('Edit revision 8')).toBeTruthy());
    expect(y.readOnly).toBe(false);
    expect(document.activeElement).toBe(y);
  });

  test('A4: a refused value does not stay in its field; the stored one comes back and the same value can be sent again', async () => {
    setupServer({ refuseNext: [400, 'BAD_RANGE', 'Out must be within the take (0–6000 ms)'] });
    renderAt();
    await opened();
    selectPrime();
    const out = within(inspector()).getByLabelText('Source out');
    fireEvent.change(out, { target: { value: '9000' } });
    fireEvent.keyDown(out, { key: 'Enter' });
    expect((await screen.findByTestId('editor-notice')).textContent).toMatch(/Out must be within the take/);
    await waitFor(() => expect(within(inspector()).getByLabelText('Source out').value).toBe('6000'));
    fireEvent.change(within(inspector()).getByLabelText('Source out'), { target: { value: '9000' } });
    fireEvent.keyDown(within(inspector()).getByLabelText('Source out'), { key: 'Enter' });
    await waitFor(() => expect(server.writes).toHaveLength(2));
  });

  test('A3: a Prime stretch with no commentary is put back, and pasted, with none (and her mute kept)', async () => {
    const quiet = { ...SEG, audio_in_ms: null, audio_out_ms: null, audio_muted: true };
    setupServer({ edit: editWith({ segments: [quiet] }) });
    renderAt();
    await opened();
    selectPrime();
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });
    await waitFor(() => expect(server.writes).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /^Undo$/ }));
    await waitFor(() => expect(server.writes).toHaveLength(2));
    expect(lastWrite().path).toBe('/segments');
    expect(lastWrite().body).toMatchObject({ no_commentary: true, audio_muted: true, audio_gain_db: -2 });
    expect(lastWrite().body).not.toHaveProperty('audio_in_ms');
    await waitFor(() => expect(screen.getByRole('button', { name: /Paste/ }).disabled).toBe(false));
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(server.writes).toHaveLength(3));
    expect(lastWrite().body).toMatchObject({ no_commentary: true, audio_muted: true, anchor_kind: 'edit_start' });
    expect(lastWrite().body).not.toHaveProperty('audio_in_ms');
  });

  test('A6: someone who is not an admin gets the editor read only, and nothing is sent', async () => {
    auth.user = { id: 'u2', groups: ['viewer'] };
    setupServer();
    renderAt();
    await opened();
    expect(screen.getByTestId('editor-read-only').textContent).toMatch(/editing needs an admin account/i);
    selectPrime();
    expect(screen.getByRole('button', { name: /^Delete$/ }).disabled).toBe(true);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(within(inspector()).getByLabelText('Position X').readOnly).toBe(true);
    expect(within(inspector()).getByText('Read only.')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(server.writes).toHaveLength(0);
  });

  test('A8: a drag the system takes over (pointercancel) changes nothing and puts the block back', async () => {
    setupServer();
    renderAt();
    await opened();
    const block = within(screen.getByTestId('editor-timeline')).getByRole('button', { name: /^Music: Bed/ });
    const left = block.style.left;
    const px = parseFloat(block.style.width) / 4000;
    fireEvent.pointerDown(block, { button: 0, clientX: 10, pointerId: 3 });
    fireEvent.pointerMove(block, { clientX: 10 + px * 1000, pointerId: 3 });
    expect(block.style.left).not.toBe(left);
    fireEvent.pointerCancel(block, { pointerId: 3 });
    expect(block.style.left).toBe(left);
    fireEvent.pointerUp(block, { clientX: 10 + px * 1000, pointerId: 3 });
    await new Promise((r) => setTimeout(r, 20));
    expect(server.writes).toHaveLength(0);
  });

  test('A8: Prime dragged in the preview and then cancelled saves nothing; the inspector shows her stored place', async () => {
    setupServer();
    renderAt();
    await opened();
    selectPrime();
    const pip = screen.getByTestId('preview-pip');
    fireEvent.pointerDown(pip, { button: 0, clientX: 100, clientY: 100, pointerId: 4 });
    fireEvent.pointerMove(pip, { clientX: 140, clientY: 100, pointerId: 4 });
    fireEvent.lostPointerCapture(pip, { pointerId: 4 });
    await new Promise((r) => setTimeout(r, 20));
    expect(server.writes).toHaveLength(0);
    expect(within(inspector()).getByLabelText('Position X').value).toBe('1300');
  });
});

// Prepare From Existing Work, B1 (2026-11-03): what the episode already has, beat by beat.
describe('EpisodeEditor: Existing work (B1)', () => {
  const SOURCES = {
    plan: [
      { id: 'p1', beat_number: 1, sort_order: 0, chosen_by_user: true, locked: false, scene_set: { id: 'set1', name: 'Closet' }, linked: true,
        angle_label: 'WIDE', angle: { id: 'a1', label: 'WIDE', still_image_url: 'https://cdn/a1.jpg', video_clip_url: null }, status: 'ready', text: 'Ready to place', place: { still: true, video: false } },
      { id: 'p3', beat_number: 3, sort_order: 0, chosen_by_user: false, locked: false, scene_set: { id: 'set2', name: 'Cafe' }, linked: false,
        angle_label: 'WIDE', angle: { id: 'a9', label: 'WIDE', still_image_url: 'https://cdn/a9.jpg', video_clip_url: null }, status: 'not_linked',
        text: "This set isn't linked to the episode, so the editor can't place it. Link it on the episode's Overview.", place: null },
      { id: 'p4', beat_number: 4, sort_order: 0, chosen_by_user: true, locked: false, scene_set: { id: 'set1', name: 'Closet' }, linked: true,
        angle_label: 'TOP', angle: null, status: 'missing', text: 'Top angle missing', place: null },
    ],
    summary: { plan_rows: 3, beats_planned: 3, ready: 1, not_linked: 1, missing: 1, no_set: 0, set_removed: 0, set_picture: 0 },
  };
  const WHOLE = { id: 'r7', performer: 'justawoman', label: 'Whole episode take', url_raw: 'https://cdn/r7.mp4', duration_seconds: 300, beat_number: null,
    beat_marks: [{ beat: 3, t: 41 }, { beat: 4, t: 67 }] };
  const LOOSE = { id: 'r8', performer: 'lala', label: 'Loose clip', url_raw: 'https://cdn/r8.mp4', duration_seconds: 5, beat_number: null };
  const STARRED = { ...PRIME_CLIP, id: 'r9', label: 'Best take', is_favorite: true, beat_number: 3 };
  const work = () => screen.getByTestId('existing-work');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.user = { id: 'u1', groups: ['admin'] };
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('the media panel points to the scene plan; the tab lists each beat with its plan, its footage and why something cannot be placed', async () => {
    setupServer({ sources: SOURCES, clips: [PRIME_CLIP, WHOLE, LOOSE, STARRED] });
    renderAt();
    await opened();
    const media = screen.getByRole('region', { name: 'Media' });
    fireEvent.click(await within(media).findByRole('button', { name: 'See Existing work' }));
    expect(within(media).getByRole('tab', { name: 'Existing work' }).getAttribute('aria-selected')).toBe('true');
    // Six tabs are wider than the panel: the row slides sideways (useSideScroll).
    expect(within(media).getByTestId('media-tabs').className).toMatch(/\bside-scroll\b/);
    expect(within(work()).getByLabelText('Scene plan summary').textContent).toMatch(/3 of 14 beats planned.*1 ready.*1 set not linked.*1 missing.*4 clips \(1 with no beat\)/);
    const beat1 = within(work()).getByRole('region', { name: /^Beat 1:/ });
    expect(beat1.textContent).toMatch(/Closet · WIDE/);
    expect(beat1.textContent).toMatch(/On the edit/); // c1 is angle a1 in beat 1
    expect(beat1.textContent).toMatch(/Chosen by you/);
    const beat3 = within(work()).getByRole('region', { name: /^Beat 3:/ });
    expect(beat3.textContent).toMatch(/Set not linked/);
    expect(beat3.textContent).toMatch(/isn't linked to the episode/);
    expect(beat3.textContent).toMatch(/Suggested by the planner/);
    expect(within(beat3).queryByRole('button', { name: /Place Cafe/ })).toBeNull();
    // The whole-episode take shows in the beats it marks, with the mark; the ★ take is first.
    expect(beat3.textContent).toMatch(/Whole episode take.*marked at 00:41/);
    expect(within(beat3).getByLabelText('Your pick')).toBeTruthy();
    expect(beat3.textContent.indexOf('Best take')).toBeLessThan(beat3.textContent.indexOf('Whole episode take'));
    expect(within(work()).getByRole('region', { name: /^Beat 4:/ }).textContent).toMatch(/Top angle missing/);
    expect(within(work()).getByRole('region', { name: /^Beat 2:/ }).textContent).toMatch(/No scene planned for this beat/);
    expect(within(work()).getByRole('region', { name: 'Clips not assigned to a beat' }).textContent).toMatch(/Loose clip/);
    expect(server.writes).toHaveLength(0);
  });

  test("a ready planned angle is placed into its own beat with its +, whatever the playhead or Beat Focus", async () => {
    setupServer({ sources: { ...SOURCES, plan: [{ ...SOURCES.plan[0], id: 'p6', beat_number: 6 }] } });
    renderAt();
    await opened();
    fireEvent.click(within(screen.getByRole('region', { name: 'Media' })).getByRole('tab', { name: 'Existing work' }));
    fireEvent.click(await within(work()).findByRole('button', { name: 'Place Closet · WIDE (still)' }));
    await waitFor(() => expect(server.writes).toHaveLength(1));
    expect(lastWrite()).toMatchObject({ method: 'post', path: '/scene-clips', body: { beat_number: 6, source_kind: 'angle_still', source_id: 'a1', duration_ms: 5000 } });
  });

  test('Beat Focus no longer hides a clip with no beat: it is listed and says "No beat"; a tile says ★ and beat marks', async () => {
    setupServer({ clips: [PRIME_CLIP, WHOLE, LOOSE, { ...STARRED, beat_number: 9 }] });
    renderAt();
    await opened();
    fireEvent.click(screen.getAllByRole('button', { name: /^Beat 1:/ })[0]);
    const media = screen.getByRole('region', { name: 'Media' });
    expect(media.textContent).toMatch(/Loose clip/);
    expect(media.textContent).toMatch(/Whole episode take/);
    expect(media.textContent).toMatch(/Prime · No beat · 2 beat marks/);
    expect(media.textContent).not.toMatch(/Best take/); // beat 9, not this beat
  });

  test('when the scene plan cannot be read, the tab says so and the rest of the editor works', async () => {
    setupServer();
    renderAt();
    await opened();
    fireEvent.click(within(screen.getByRole('region', { name: 'Media' })).getByRole('tab', { name: 'Existing work' }));
    expect((await within(work()).findByRole('alert')).textContent).toMatch(/scene plan could not be read/);
    expect(screen.getByText('Edit revision 7')).toBeTruthy();
  });
});

// On a phone (Evoni, 2026-11-03): held upright, turn it; sideways, the compact editor with drawers.
describe('EpisodeEditor: on a phone', () => {
  let portrait;
  let listeners;
  const media = () => {
    listeners = [];
    window.matchMedia = vi.fn((q) => ({
      get matches() { return q === '(pointer: coarse)' ? true : q === '(orientation: portrait)' ? portrait : false; },
      addEventListener: (_e, fn) => listeners.push(fn),
      removeEventListener: () => {},
    }));
    Object.defineProperty(window, 'screen', { configurable: true, value: { width: 390, height: 844 } });
  };
  const turn = (upright) => { portrait = upright; act(() => { for (const fn of listeners) fn(); }); };
  let savedMatch;
  let savedScreen;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.user = { id: 'u1', groups: ['admin'] };
    savedMatch = window.matchMedia;
    savedScreen = Object.getOwnPropertyDescriptor(window, 'screen');
    portrait = true;
    media();
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(function play() { return Promise.resolve(); });
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(function pause() {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    window.matchMedia = savedMatch;
    if (savedScreen) Object.defineProperty(window, 'screen', savedScreen);
    vi.restoreAllMocks();
  });

  test('held upright it asks to be turned (the editor stays loaded); turned sideways the editor shows, timeline and all', async () => {
    setupServer();
    renderAt();
    await opened();
    const rotate = screen.getByTestId('editor-rotate');
    expect(within(rotate).getByRole('heading', { name: 'Turn your phone sideways' })).toBeTruthy();
    expect(within(rotate).getByRole('link', { name: /Back to the episode/ }).getAttribute('href')).toBe(`/episodes/${EP}?tab=edit`);
    expect(document.querySelector('.tle').className).toMatch(/\bis-phone-portrait\b/);
    turn(false);
    expect(screen.queryByTestId('editor-rotate')).toBeNull();
    expect(document.querySelector('.tle').className).toMatch(/\bis-phone\b/);
    expect(document.querySelector('.tle').className).not.toMatch(/is-phone-portrait/);
    expect(screen.getByTestId('editor-timeline')).toBeTruthy();
    expect(server.writes).toHaveLength(0);
  });

  test('sideways, the media panel and the inspector open as drawers, one at a time; Escape closes them', async () => {
    portrait = false;
    setupServer();
    renderAt();
    await opened();
    const tle = () => document.querySelector('.tle').className;
    fireEvent.click(screen.getByRole('button', { name: 'Media panel' }));
    expect(tle()).toMatch(/has-drawer-media/);
    expect(screen.getByRole('button', { name: 'Media panel' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Inspector' }));
    expect(tle()).toMatch(/has-drawer-inspector/);
    expect(tle()).not.toMatch(/has-drawer-media/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tle()).not.toMatch(/has-drawer/);
  });

  test('turning the phone upright while it plays stops the playback', async () => {
    portrait = false;
    setupServer();
    renderAt();
    await opened();
    const play = () => document.querySelector('.tle-play');
    fireEvent.click(play());
    await waitFor(() => expect(play().getAttribute('aria-label')).toBe('Pause'));
    turn(true);
    await waitFor(() => expect(play().getAttribute('aria-label')).toBe('Play'));
  });

  test('on a desktop there is no rotate card and no drawer buttons', async () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
    setupServer();
    renderAt();
    await opened();
    expect(screen.queryByTestId('editor-rotate')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Media panel' })).toBeNull();
    expect(document.querySelector('.tle').className).toBe('tle');
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
