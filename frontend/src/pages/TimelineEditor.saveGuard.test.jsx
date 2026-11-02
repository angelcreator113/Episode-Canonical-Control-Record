/**
 * The legacy Timeline Editor never saves from a load that did not complete
 * (Timeline Editor redesign P0, 2026-11-02).
 *
 * Before P0 the page could not read the episode response, showed "not
 * found", and still bound Ctrl+S: a save from there sent no scenes and empty
 * beats and markers, and the server soft-deleted the episode's scenes and
 * emptied its timeline. These tests use the real save hook (only the network
 * call is mocked) and the API's real response shapes.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  episodeAPI: { getById: vi.fn() },
  platformAPI: { get: vi.fn() },
  sceneAPI: { getAll: vi.fn() },
  timelineDataAPI: { get: vi.fn(), update: vi.fn() },
  saveEpisodeData: vi.fn(),
}));
// The tracks stand-in exposes the editor's scene delete, so a test can
// remove a scene the way the real track's delete button does.
vi.mock('../components/Timeline/Timeline', () => ({
  default: ({ scenes, onSceneDelete }) => (
    <div data-testid="timeline-tracks">
      {(scenes || []).map((s) => (
        <button key={s.id} type="button" data-testid={`delete-${s.id}`} onClick={() => onSceneDelete(s.id)}>{s.title}</button>
      ))}
    </div>
  ),
}));
vi.mock('../components/Timeline/PreviewMonitor', () => ({ default: () => <div /> }));
vi.mock('../components/Timeline/ScenePicker', () => ({ default: () => <div /> }));
vi.mock('../components/Timeline/KeyframePropertyEditor', () => ({ default: () => <div /> }));
vi.mock('../components/SaveIndicator/SaveIndicator', () => ({ default: () => <div /> }));
vi.mock('../components/ExportDropdown/ExportDropdown', () => ({ default: () => <div /> }));
vi.mock('../components/LandscapeRequired', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('../components/Timeline/AssembleTakesSheet', () => ({ default: () => <div /> }));

import { episodeAPI, platformAPI, sceneAPI, timelineDataAPI, saveEpisodeData } from '../services/api';
import TimelineEditor from './TimelineEditor';

const EP = 'ep-a';
const episodeBody = { data: { id: EP, episode_number: 7, title: 'Episode A' }, script_revision: 3 };
const scenesBody = {
  success: true,
  data: [
    { id: 's1', scene_number: 1, title: 'Arrival', duration_seconds: 4 },
    { id: 's2', scene_number: 2, title: 'Reveal', duration_seconds: 6 },
  ],
  count: 2,
};
const timelineBody = {
  id: 'tl-a', episode_id: EP,
  beats: [{ id: 'b1', time: 1, title: 'Hook' }],
  markers: [{ id: 'm1', time: 2, label: 'Cut' }],
  audio_clips: [], character_clips: [], keyframes: [],
  basis: 'basis-loaded',
};

const renderAt = () => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/timeline`]}>
    <Routes>
      <Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} />
    </Routes>
  </MemoryRouter>
);

const pressCtrlS = () => fireEvent.keyDown(window, { key: 's', ctrlKey: true });

describe('the Timeline Editor saves only from a completed load (P0)', () => {
  let errorSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: episodeBody });
    platformAPI.get.mockResolvedValue({ data: { platform: 'youtube' } });
    sceneAPI.getAll.mockResolvedValue({ data: scenesBody });
    timelineDataAPI.get.mockResolvedValue({ data: timelineBody });
    saveEpisodeData.mockResolvedValue({ data: { success: true, scenes: [], timeline_basis: 'basis-next' } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('the episode failing to load: Ctrl+S sends nothing', async () => {
    episodeAPI.getById.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    renderAt();
    await screen.findByRole('alert');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  test('an episode response the page cannot read ("not found"): Ctrl+S sends nothing', async () => {
    episodeAPI.getById.mockResolvedValue({ data: { script_revision: 3 } });
    renderAt();
    expect((await screen.findByRole('alert')).textContent).toContain('was not found');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('the scenes failing to load: Ctrl+S sends nothing', async () => {
    sceneAPI.getAll.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    renderAt();
    await screen.findByRole('alert');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('a scenes response in an unknown shape (a partial load): Ctrl+S sends nothing', async () => {
    sceneAPI.getAll.mockResolvedValue({ data: { success: true } });
    renderAt();
    await screen.findByRole('alert');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('the timeline failing to load: Ctrl+S sends nothing', async () => {
    timelineDataAPI.get.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    renderAt();
    await screen.findByRole('alert');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('the platform failing to load: Ctrl+S sends nothing', async () => {
    platformAPI.get.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
    renderAt();
    await screen.findByRole('alert');
    pressCtrlS();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(saveEpisodeData).not.toHaveBeenCalled();
  });

  test('a real episode opens with its scenes (the real envelopes)', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByTestId('timeline-tracks')).toBeTruthy());
    expect(screen.getByText('Arrival')).toBeTruthy();
    expect(screen.getByText('Reveal')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('loaded: Ctrl+S sends every scene, names none for removal, and carries the loaded timeline basis', async () => {
    renderAt();
    await screen.findByTestId('delete-s1');
    pressCtrlS();
    await waitFor(() => expect(saveEpisodeData).toHaveBeenCalledTimes(1));
    const [id, payload] = saveEpisodeData.mock.calls[0];
    expect(id).toBe(EP);
    expect(payload.scenes.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(payload.removed_scene_ids).toEqual([]);
    expect(payload.timeline_basis).toBe('basis-loaded');
    expect(payload.timeline.beats).toEqual(timelineBody.beats);
    expect(payload.timeline.markers).toEqual(timelineBody.markers);
  });

  test('deleting a scene names exactly that scene for removal; the next save uses the returned basis', async () => {
    saveEpisodeData.mockResolvedValueOnce({ data: { success: true, scenes: [{ client_id: 's2', id: 's2' }], timeline_basis: 'basis-next' } });
    renderAt();
    fireEvent.click(await screen.findByTestId('delete-s1'));
    pressCtrlS();
    await waitFor(() => expect(saveEpisodeData).toHaveBeenCalledTimes(1));
    const first = saveEpisodeData.mock.calls[0][1];
    expect(first.scenes.map((s) => s.id)).toEqual(['s2']);
    expect(first.removed_scene_ids).toEqual(['s1']);
    expect(first.timeline_basis).toBe('basis-loaded');

    // After the save the server holds s2 only: nothing is named again.
    pressCtrlS();
    await waitFor(() => expect(saveEpisodeData).toHaveBeenCalledTimes(2));
    const second = saveEpisodeData.mock.calls[1][1];
    expect(second.removed_scene_ids).toEqual([]);
    expect(second.timeline_basis).toBe('basis-next');
  });
});
