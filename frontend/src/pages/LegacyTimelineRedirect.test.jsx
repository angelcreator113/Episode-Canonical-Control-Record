/** The old Timeline Editor's URLs land on the episode editor (deleted, Evoni 2026-11-03). */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LegacyTimelineRedirect from './LegacyTimelineRedirect';

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/episodes/:episodeId/timeline" element={<LegacyTimelineRedirect />} />
      <Route path="/studio/timeline" element={<LegacyTimelineRedirect />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('LegacyTimelineRedirect', () => {
  test("an episode's old timeline opens its editor", () => {
    renderAt('/episodes/ep-7/timeline');
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-7/editor');
  });
  test('/studio/timeline?episode_id= opens that episode in the editor; alone, the editor hub', () => {
    renderAt('/studio/timeline?episode_id=ep-9');
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-9/editor');
  });
  test('/studio/timeline alone opens the editor hub', () => {
    renderAt('/studio/timeline');
    expect(screen.getByTestId('where').textContent).toBe('/studio/editor');
  });
});
