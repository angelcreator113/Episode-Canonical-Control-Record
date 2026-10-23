/**
 * Production › Scenes (Evoni's Production mock, 2026-10-17): the scenes in
 * order, the chosen scene's linked clip (cut-out first) or picture, its
 * location's angles (picking one saves it), the details, the director's
 * note, lock, and the quick actions.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn() } };
});

import api from '../../services/api';
import { rawClipsApi } from '../../lib/rawClipsApi';
import EpisodeSceneWorkspace, { clipsFor, clipSource, sceneSeconds } from './EpisodeSceneWorkspace';

const PLAN = [
  { id: 'b1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: 'set-1', angle_label: 'WIDE', shot_type: 'establishing', director_note: 'Talk to camera', locked: true, sceneSet: { id: 'set-1', name: "Lala's Bedroom", scene_type: 'HOME_BASE', base_still_url: 'https://x/bed.jpg' } },
  { id: 'b2', beat_number: 2, beat_name: 'Travel to Studio', scene_set_id: 'set-1', angle_label: 'WIDE', locked: false, sceneSet: { id: 'set-1', name: "Lala's Bedroom" } },
  { id: 'b3', beat_number: 3, beat_name: 'Arrival', scene_set_id: null, locked: false },
];
const SET = {
  id: 'set-1', name: "Lala's Bedroom", scene_type: 'HOME_BASE', time_of_day: 'morning',
  angles: [
    { id: 'a1', angle_label: 'WIDE', angle_name: 'Wide (Main)', still_image_url: 'https://x/wide.jpg' },
    { id: 'a2', angle_label: 'CLOSE', angle_name: 'Close Up', still_image_url: 'https://x/close.jpg' },
  ],
};
const CLIPS = [
  { id: 'c1', beat_number: 1, label: 'Take 1', duration_seconds: 12, url_raw: 'https://x/t1.mp4', url_cutout: 'https://x/t1.webm', created_at: '2026-10-17T01:00:00Z' },
  { id: 'c2', beat_number: 1, label: 'Take 2', duration_seconds: 10, url_raw: 'https://x/t2.mp4', created_at: '2026-10-17T02:00:00Z' },
];

const renderWs = (props = {}) => render(
  <MemoryRouter><EpisodeSceneWorkspace episode={{ id: 'ep-1', show_id: 'show-1' }} onOpenTab={vi.fn()} onToast={vi.fn()} {...props} /></MemoryRouter>,
);

describe('scene helpers', () => {
  test('a scene\'s clips newest first, the cut-out first, and their length', () => {
    expect(clipsFor(CLIPS, 1).map((c) => c.id)).toEqual(['c2', 'c1']);
    expect(clipSource(CLIPS[0])).toBe('https://x/t1.webm');
    expect(clipSource(CLIPS[1])).toBe('https://x/t2.mp4');
    expect(sceneSeconds(CLIPS, 1)).toBe(22);
    expect(sceneSeconds(CLIPS, 2)).toBeNull();
  });
});

describe('EpisodeSceneWorkspace', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/scene-sets/set-1') return { data: { success: true, data: SET } };
      return { data: {} };
    });
    vi.mocked(api.put).mockReset().mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: {} });
    rawClipsApi.list.mockReset().mockResolvedValue(CLIPS);
  });

  test('the scenes in order, with location, length and lock; the first is chosen and plays its newest clip', async () => {
    renderWs();
    const first = await screen.findByTestId('esw-scene-1');
    expect(first.getAttribute('aria-current')).toBe('true');
    expect(first.textContent).toContain('01 Opening Ritual');
    expect(first.textContent).toContain("Lala's Bedroom");
    expect(first.textContent).toContain('0:22');
    expect(within(first).getByLabelText('Locked')).toBeTruthy();
    expect(screen.getByTestId('esw-scene-3').textContent).toContain('No location');
    expect(screen.getByText('1 of 3 with a clip · 0:22')).toBeTruthy();
    expect(screen.getByTestId('esw-video').getAttribute('src')).toBe('https://x/t2.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Take 1' }));
    expect(screen.getByTestId('esw-video').getAttribute('src')).toBe('https://x/t1.webm');
  });

  test('details come from the scene and its location', async () => {
    renderWs();
    await screen.findByTestId('esw-scene-1');
    const details = screen.getByRole('region', { name: 'Scene details' });
    await waitFor(() => expect(within(details).getByText('Morning')).toBeTruthy());
    expect(within(details).getByText('Home Base')).toBeTruthy();
    expect(within(details).getByText('Establishing')).toBeTruthy();
    expect(within(details).getByText('0:22')).toBeTruthy();
    expect(await within(details).findByDisplayValue('Talk to camera')).toBeTruthy();
  });

  test('a scene with no clip shows its picture and points to Files', async () => {
    const onOpenTab = vi.fn();
    renderWs({ onOpenTab });
    fireEvent.click(await screen.findByTestId('esw-scene-2'));
    await waitFor(() => expect(screen.getByTestId('esw-picture').getAttribute('src')).toBe('https://x/wide.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Link one in Files' }));
    expect(onOpenTab).toHaveBeenCalledWith('files');
  });

  test('picking an angle saves it as the scene\'s choice', async () => {
    renderWs();
    fireEvent.click(await screen.findByTestId('esw-scene-2'));
    fireEvent.click(await screen.findByRole('button', { name: /Close Up/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2', { angle_label: 'CLOSE', chosen: true }));
  });

  test('a locked scene is not changed; its note waits for unlock', async () => {
    const onToast = vi.fn();
    renderWs({ onToast });
    await screen.findByTestId('esw-scene-1');
    expect(screen.getByLabelText("Director's note").disabled).toBe(true);
    // Its angles are not offered while it is locked, saying why (eighth audit).
    const closeUp = await screen.findByRole('button', { name: /Close Up/ });
    expect(closeUp.disabled).toBe(true);
    expect(closeUp.getAttribute('title')).toBe('This scene is locked. Unlock it to change it.');
    fireEvent.click(closeUp);
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('esw-lock'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/1/lock'));
  });

  test('the director\'s note saves', async () => {
    renderWs();
    fireEvent.click(await screen.findByTestId('esw-scene-2'));
    fireEvent.change(screen.getByLabelText("Director's note"), { target: { value: 'Window light, slow push' } });
    fireEvent.click(screen.getByRole('button', { name: /Save note/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2', { director_note: 'Window light, slow push' }));
  });

  test('a scene with no location says so; quick actions open the right tabs', async () => {
    const onOpenTab = vi.fn();
    renderWs({ onOpenTab });
    fireEvent.click(await screen.findByTestId('esw-scene-3'));
    expect(screen.getByText('This scene has no location yet. Choose one in the Plan.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Edit in the Plan/ }));
    expect(onOpenTab).toHaveBeenCalledWith('beatplan');
    expect(screen.getByRole('link', { name: /Open timeline/ }).getAttribute('href')).toBe('/episodes/ep-1/timeline');
  });

  test('no plan yet sends to the Beat Plan', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    const onOpenTab = vi.fn();
    renderWs({ onOpenTab });
    fireEvent.click(await screen.findByRole('button', { name: 'Open the Plan' }));
    expect(onOpenTab).toHaveBeenCalledWith('beatplan');
  });

  // Eighth audit (2026-10-19).
  test("the stage shows the server's picture (the dressed look or variant) before the angle's plain still", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: [{ ...PLAN[1], location: { image: { url: 'https://x/gala-dressed.jpg' } } }] } };
      if (url === '/api/v1/scene-sets/set-1') return { data: { success: true, data: SET } };
      return { data: {} };
    });
    const { container } = renderWs();
    fireEvent.click(await screen.findByTestId('esw-scene-2'));
    await screen.findByRole('button', { name: /Close Up/ });
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://x/gala-dressed.jpg');
  });

  test('a removed location says so and points to Move my beats, with no Add angle', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/scene-sets/set-1') throw Object.assign(new Error('gone'), { response: { status: 404 } });
      return { data: {} };
    });
    renderWs();
    fireEvent.click(await screen.findByTestId('esw-scene-2'));
    expect((await screen.findByTestId('esw-set-failed')).textContent).toMatch(/was removed.*Move my beats/);
    expect(screen.queryByText('Add angle')).toBeNull();
  });
});
