/**
 * TimelineEditor loads exactly the requested episode (§8(w) P4, Task #2212).
 * An unknown id shows an error and loads nothing else; it used to fall back
 * to a placeholder "Untitled Episode" timeline.
 *
 * The mocks answer in the API's real shapes (P0, 2026-11-02): these tests
 * used to mock { data: episode } and { data: [scenes] } one level too
 * shallow, which hid that the page could not open any real episode.
 * - GET /episodes/:id               { data: episode, script_revision }
 * - GET /episodes/:id/scenes        { success, data: [scene], count }
 * - GET /episodes/:id/timeline-data { id, episode_id, beats, ..., basis }
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  episodeAPI: { getById: vi.fn() },
  platformAPI: { get: vi.fn() },
  sceneAPI: { getAll: vi.fn() },
  timelineDataAPI: { get: vi.fn(), save: vi.fn(), update: vi.fn() },
}));
// The editor's heavy children are not under test here.
vi.mock('../components/Timeline/Timeline', () => ({ default: () => <div data-testid="timeline-tracks" /> }));
vi.mock('../components/Timeline/PreviewMonitor', () => ({ default: () => <div /> }));
vi.mock('../components/Timeline/ScenePicker', () => ({ default: () => <div /> }));
vi.mock('../components/Timeline/KeyframePropertyEditor', () => ({ default: () => <div /> }));
vi.mock('../components/SaveIndicator/SaveIndicator', () => ({ default: () => <div /> }));
vi.mock('../components/ExportDropdown/ExportDropdown', () => ({ default: () => <div /> }));
vi.mock('../components/LandscapeRequired', () => ({ default: ({ children }) => <>{children}</> }));
vi.mock('../hooks/useSaveManager', () => ({ default: () => ({ saveStatus: 'saved', markDirty: () => {}, saveNow: () => {} }) }));

import { episodeAPI, platformAPI, sceneAPI, timelineDataAPI } from '../services/api';
import TimelineEditor from './TimelineEditor';

const renderAt = (episodeId) => render(
  <MemoryRouter initialEntries={[`/episodes/${episodeId}/timeline`]}>
    <Routes>
      <Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} />
    </Routes>
  </MemoryRouter>
);

describe('TimelineEditor episode loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformAPI.get.mockResolvedValue({ data: { platform: 'youtube' } });
    sceneAPI.getAll.mockResolvedValue({ data: { success: true, data: [], count: 0 } });
    timelineDataAPI.get.mockResolvedValue({ data: { id: 'tl-a', episode_id: 'ep-a', beats: [], markers: [], audio_clips: [], character_clips: [], keyframes: [], basis: 'b0' } });
  });

  test('an unknown episode shows an error and loads nothing else', async () => {
    const notFound = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
    episodeAPI.getById.mockRejectedValue(notFound);

    renderAt('ep-missing');

    expect((await screen.findByRole('alert')).textContent).toContain('Episode ep-missing was not found');
    expect(screen.getByText('← Back to the episode')).toBeTruthy();
    expect(screen.queryByText(/Untitled Episode/)).toBeNull();
    expect(screen.queryByTestId('timeline-tracks')).toBeNull();
    expect(platformAPI.get).not.toHaveBeenCalled();
    expect(sceneAPI.getAll).not.toHaveBeenCalled();
    expect(timelineDataAPI.get).not.toHaveBeenCalled();
  });

  test('opened for episode A, it loads and shows episode A', async () => {
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-a', episode_number: 7, title: 'Episode A' }, script_revision: 3 } });

    renderAt('ep-a');

    await waitFor(() => expect(screen.getByText(/Episode 7 · Episode A/)).toBeTruthy());
    expect(episodeAPI.getById).toHaveBeenCalledWith('ep-a');
    expect(timelineDataAPI.get).toHaveBeenCalledWith('ep-a');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('an episode with no scenes has an empty timeline, not three invented scenes (audit TRUTH-05)', async () => {
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-a', episode_number: 7, title: 'Episode A' }, script_revision: 3 } });
    renderAt('ep-a');
    const notice = await screen.findByTestId('timeline-empty');
    expect(notice.textContent).toContain('No scenes yet');
    expect(screen.queryByText(/Intro|Main Content|Outro/)).toBeNull();
    expect(screen.getByTestId('timeline-tracks')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('scenes or timeline data failing to load is an error with Retry, never sample scenes (audit TRUTH-05)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-a', episode_number: 7, title: 'Episode A' }, script_revision: 3 } });
    sceneAPI.getAll.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }));
    renderAt('ep-a');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not be loaded, so the timeline was not opened. Nothing was changed.');
    expect(screen.queryByTestId('timeline-tracks')).toBeNull();
    expect(screen.queryByText(/Intro|Main Content|Outro/)).toBeNull();

    sceneAPI.getAll.mockResolvedValue({ data: { success: true, data: [{ id: 's1', scene_number: 1, title: 'Arrival', duration_seconds: 4 }], count: 1 } });
    screen.getByTestId('timeline-retry').click();
    await waitFor(() => expect(screen.getByTestId('timeline-tracks')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('timeline-empty')).toBeNull();
    spy.mockRestore();
  });

  test("another episode's record in the envelope is refused", async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-b', episode_number: 8, title: 'Episode B' }, script_revision: 1 } });
    renderAt('ep-a');
    expect((await screen.findByRole('alert')).textContent).toContain('Episode ep-a was not found');
    expect(sceneAPI.getAll).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('a scenes response in a shape the page does not know is a failed load, not "no scenes"', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-a', episode_number: 7, title: 'Episode A' }, script_revision: 3 } });
    sceneAPI.getAll.mockResolvedValue({ data: { success: true, scenes: 'not a list' } });
    renderAt('ep-a');
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    expect(screen.queryByTestId('timeline-empty')).toBeNull();
    expect(screen.queryByTestId('timeline-tracks')).toBeNull();
    spy.mockRestore();
  });

  test('a timeline response in a shape the page does not know is a failed load', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: { data: { id: 'ep-a', episode_number: 7, title: 'Episode A' }, script_revision: 3 } });
    timelineDataAPI.get.mockResolvedValue({ data: {} });
    renderAt('ep-a');
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    expect(screen.queryByTestId('timeline-tracks')).toBeNull();
    spy.mockRestore();
  });
});
