/**
 * TimelineEditor loads exactly the requested episode (§8(w) P4, Task #2212).
 * An unknown id shows an error and loads nothing else; it used to fall back
 * to a placeholder "Untitled Episode" timeline.
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
    sceneAPI.getAll.mockResolvedValue({ data: [] });
    timelineDataAPI.get.mockResolvedValue({ data: {} });
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
    episodeAPI.getById.mockResolvedValue({ data: { id: 'ep-a', episode_number: 7, title: 'Episode A' } });

    renderAt('ep-a');

    await waitFor(() => expect(screen.getByText(/Episode 7 · Episode A/)).toBeTruthy());
    expect(episodeAPI.getById).toHaveBeenCalledWith('ep-a');
    expect(timelineDataAPI.get).toHaveBeenCalledWith('ep-a');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('an episode with no scenes has an empty timeline, not three invented scenes (audit TRUTH-05)', async () => {
    episodeAPI.getById.mockResolvedValue({ data: { id: 'ep-a', episode_number: 7, title: 'Episode A' } });
    renderAt('ep-a');
    const notice = await screen.findByTestId('timeline-empty');
    expect(notice.textContent).toContain('No scenes yet');
    expect(screen.queryByText(/Intro|Main Content|Outro/)).toBeNull();
    expect(screen.getByTestId('timeline-tracks')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('scenes or timeline data failing to load is an error with Retry, never sample scenes (audit TRUTH-05)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    episodeAPI.getById.mockResolvedValue({ data: { id: 'ep-a', episode_number: 7, title: 'Episode A' } });
    sceneAPI.getAll.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }));
    renderAt('ep-a');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('could not be loaded, so the timeline was not opened. Nothing was changed.');
    expect(screen.queryByTestId('timeline-tracks')).toBeNull();
    expect(screen.queryByText(/Intro|Main Content|Outro/)).toBeNull();

    sceneAPI.getAll.mockResolvedValue({ data: [{ id: 's1', scene_number: 1, title: 'Arrival', duration_seconds: 4 }] });
    screen.getByTestId('timeline-retry').click();
    await waitFor(() => expect(screen.getByTestId('timeline-tracks')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('timeline-empty')).toBeNull();
    spy.mockRestore();
  });
});
