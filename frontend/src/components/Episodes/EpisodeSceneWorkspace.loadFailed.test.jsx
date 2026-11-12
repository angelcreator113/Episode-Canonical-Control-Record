/**
 * Scenes › Workspace when a read fails (Evoni, 2026-11-12): a failed plan
 * read says so with Retry and does not show "no scenes yet · Open the Plan";
 * a failed clips read says the clips didn't load, not that the scene has
 * none. Successful empty reads are as before.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn() } };
});

import api from '../../services/api';
import { rawClipsApi } from '../../lib/rawClipsApi';
import EpisodeSceneWorkspace from './EpisodeSceneWorkspace';

const PLAN = [{ id: 'b1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: null, locked: false }];
const planOk = (rows) => vi.mocked(api.get).mockImplementation(async (url) => (url.includes('/plan') ? { data: { data: rows } } : { data: { data: null } }));
const renderWs = () => {
  const onOpenTab = vi.fn();
  render(<MemoryRouter><EpisodeSceneWorkspace episode={{ id: 'ep-1', show_id: 'show-1' }} onOpenTab={onOpenTab} onToast={vi.fn()} /></MemoryRouter>);
  return { onOpenTab };
};

describe('EpisodeSceneWorkspace: a failed read is not an empty episode', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(rawClipsApi.list).mockReset();
    vi.mocked(rawClipsApi.list).mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the plan read fails: an error with Retry, not "no scenes yet"', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    renderWs();
    const failed = await screen.findByTestId('esw-load-failed');
    expect(failed.textContent).toContain('Could not load the scenes.');
    expect(screen.queryByText(/This episode has no scenes yet/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open the Plan' })).toBeNull();

    planOk([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/This episode has no scenes yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open the Plan' })).toBeTruthy();
  });

  test('the clips read fails: the scene shows, and it says the clips didn\'t load with Retry, not "No clip linked"', async () => {
    planOk(PLAN);
    vi.mocked(rawClipsApi.list).mockRejectedValue(new Error('Network Error'));
    renderWs();
    const note = await screen.findByTestId('esw-clips-failed');
    expect(note.textContent).toContain("Couldn't load this episode's clips.");
    expect(screen.queryByText(/No clip linked to this scene/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link one in Files' })).toBeNull();

    vi.mocked(rawClipsApi.list).mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No clip linked to this scene/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Link one in Files' })).toBeTruthy();
  });

  test('both reads succeed with nothing: the empty states and their actions, unchanged', async () => {
    planOk([]);
    renderWs();
    expect(await screen.findByText(/This episode has no scenes yet/)).toBeTruthy();
    expect(screen.queryByTestId('esw-load-failed')).toBeNull();
  });

  // A clips read that fails after the clips loaded (review follow-up, 2026-11-12):
  // the chosen scene still shows its clip, and the page says the clips could not be read.
  test('a later clips read fails while the chosen scene has a clip: the error and Retry show, the clip stays, and "No clip linked" is not said', async () => {
    const CLIP = { id: 'c1', beat_number: 1, label: 'Take 1', duration_seconds: 12, url_raw: 'https://x/t1.mp4', created_at: '2026-10-17T01:00:00Z' };
    planOk(PLAN);
    vi.mocked(rawClipsApi.list).mockResolvedValue([CLIP]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    renderWs();
    expect((await screen.findByTestId('esw-video')).getAttribute('src')).toBe('https://x/t1.mp4');
    expect(screen.queryByTestId('esw-clips-failed')).toBeNull();

    // Locking the scene re-reads the plan and the clips; this time the clips read fails.
    vi.mocked(rawClipsApi.list).mockRejectedValue(new Error('Network Error'));
    fireEvent.click(screen.getByTestId('esw-lock'));
    const note = await screen.findByTestId('esw-clips-failed');
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain("Couldn't load this episode's clips.");
    expect(note.textContent).toContain('from the last successful load and may be out of date');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByTestId('esw-video').getAttribute('src')).toBe('https://x/t1.mp4');
    expect(screen.queryByText(/No clip linked to this scene/)).toBeNull();

    // Retry reads again; a good answer clears the note and keeps the clip.
    vi.mocked(rawClipsApi.list).mockResolvedValue([CLIP]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByTestId('esw-clips-failed')).toBeNull());
    expect(screen.getByTestId('esw-video')).toBeTruthy();
  });

  test('a first clips read that fails for a scene with no clip: the error with Retry, and no "may be out of date" wording', async () => {
    planOk(PLAN);
    vi.mocked(rawClipsApi.list).mockRejectedValue(new Error('Network Error'));
    renderWs();
    const note = await screen.findByTestId('esw-clips-failed');
    expect(note.textContent).not.toContain('out of date');
  });
});
