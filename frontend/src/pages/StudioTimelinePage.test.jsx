/**
 * StudioTimelinePage honors the requested episode_id (§8(w) P4, Task #2212).
 * Production → Scenes → "Timeline Editor" opens /studio/timeline?episode_id=…;
 * the page used to ignore it and open the working episode instead.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

vi.mock('../services/api', () => ({
  episodeAPI: { getAll: vi.fn(() => Promise.resolve({ data: { episodes: [] } })) },
}));

import StudioTimelinePage from './StudioTimelinePage';

function OpenedTimeline() {
  const { episodeId } = useParams();
  return <div>timeline for {episodeId}</div>;
}

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/studio/timeline" element={<StudioTimelinePage />} />
      <Route path="/episodes/:episodeId/timeline" element={<OpenedTimeline />} />
    </Routes>
  </MemoryRouter>
);

describe('StudioTimelinePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('opens the requested episode, not the working episode', async () => {
    localStorage.setItem('working-episode-id', 'ep-working');
    renderAt('/studio/timeline?episode_id=ep-requested');
    expect(await screen.findByText('timeline for ep-requested')).toBeTruthy();
    expect(screen.queryByText('timeline for ep-working')).toBeNull();
  });

  test('with no episode requested, the working episode still opens', async () => {
    localStorage.setItem('working-episode-id', 'ep-working');
    renderAt('/studio/timeline');
    expect(await screen.findByText('timeline for ep-working')).toBeTruthy();
  });
});
