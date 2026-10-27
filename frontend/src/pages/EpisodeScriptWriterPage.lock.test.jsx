/**
 * The Script Writer's Lock saves the script over the episode's (A1c R1, W4):
 * it sends the episode's script revision the page read, asks before
 * replacing an episode's script, and when the episode's script changed since
 * the page opened, says so, locks nothing, and reads the revision again.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../services/api';
import EpisodeScriptWriterPage from './EpisodeScriptWriterPage';

const REV1 = `sr1-${'a'.repeat(40)}`;
const REV2 = `sr1-${'b'.repeat(40)}`;
const SCRIPT_ROW = { id: 's-1', version: 1, status: 'draft', script_text: '## BEAT: 1\nLala: hi', script_json: null };
let serverRevision;

const renderPage = () => render(
  <MemoryRouter initialEntries={['/episodes/ep-1/script-writer']}>
    <Routes><Route path="/episodes/:episodeId/script-writer" element={<EpisodeScriptWriterPage />} /></Routes>
  </MemoryRouter>,
);
const refusal = (code, error) => Object.assign(new Error(code), { response: { status: 409, data: { code, error } } });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  serverRevision = REV1;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1') return { data: { data: { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' }, script_revision: serverRevision } };
    if (url === '/api/v1/episode-scripts/ep-1') return { data: { data: [SCRIPT_ROW] } };
    if (url.startsWith('/api/v1/episode-scripts/ep-1/version/')) return { data: { data: SCRIPT_ROW } };
    return { data: { data: null } };
  });
});
afterEach(() => { vi.restoreAllMocks(); });

const lockButton = () => screen.findByRole('button', { name: /Lock Script/ });
const waitForRevision = () => waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1'));

describe('Script Writer: Lock and the episode\'s script revision', () => {
  test('Lock sends the revision the page read; the overwrite question resends it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.post)
      .mockRejectedValueOnce(refusal('SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED', 'This episode already has a script.'))
      .mockResolvedValueOnce({ data: { data: { ...SCRIPT_ROW, status: 'locked' }, script_revision: REV2 } });
    renderPage();
    await waitForRevision();
    fireEvent.click(await lockButton());
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/episode-scripts/s-1/lock', { script_revision: REV1 }]);
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(['/api/v1/episode-scripts/s-1/lock', { script_revision: REV1, confirmOverwrite: true }]);
  });

  test('a script saved to the episode since: nothing is locked, the page says so and reads the revision again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(refusal('SCRIPT_CHANGED', 'This script changed since you opened it. Nothing was saved.'));
    renderPage();
    await waitForRevision();
    serverRevision = REV2;
    fireEvent.click(await lockButton());
    expect((await screen.findByText(/changed since this page opened, so this script was not locked/)).textContent)
      .toContain('Open the episode\'s Script tab to see the newer script, or Lock again to replace it.');
    // Still a draft here: the Lock button stays.
    expect(await lockButton()).toBeTruthy();
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.filter(([u]) => u === '/api/v1/episodes/ep-1').length).toBe(2));
    // The next Lock is against the episode's script as it is now.
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { ...SCRIPT_ROW, status: 'locked' }, script_revision: `sr1-${'c'.repeat(40)}` } });
    fireEvent.click(await lockButton());
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual({ script_revision: REV2 });
  });

  test('a page opened before revisions (none sent) is told the same way', async () => {
    serverRevision = undefined;
    vi.mocked(api.post).mockRejectedValueOnce(refusal('SCRIPT_REVISION_REQUIRED', 'This page is out of date.'));
    renderPage();
    await waitForRevision();
    fireEvent.click(await lockButton());
    expect(await screen.findByText(/was not locked or saved over it/)).toBeTruthy();
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual({ script_revision: null });
  });
});
