/**
 * Old episode thumbnail links keep their episode (audit LINK-02, 2026-10-03;
 * Evoni, 2026-10-20): /episodes/:id/composer and /thumbnails/:id open the
 * one thumbnail editor on that episode, and replace themselves in history
 * so Back skips them.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import EpisodeComposerRedirect, { episodeThumbnailsPath } from './EpisodeComposerRedirect';

const Where = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
};

const land = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/episodes/:episodeId/composer" element={<EpisodeComposerRedirect />} />
      <Route path="/thumbnails/:episodeId" element={<EpisodeComposerRedirect />} />
      <Route path="/template-studio/youtube" element={<Where />} />
      <Route path="/template-studio" element={<div data-testid="template-library" />} />
    </Routes>
  </MemoryRouter>,
);

describe('EpisodeComposerRedirect', () => {
  test('/episodes/ep-7/composer opens the thumbnail editor on ep-7', () => {
    land('/episodes/ep-7/composer');
    expect(screen.getByTestId('where').textContent).toBe('/template-studio/youtube?episode=ep-7');
    expect(screen.queryByTestId('template-library')).toBeNull();
    expect(episodeThumbnailsPath('ep-7')).toBe('/template-studio/youtube?episode=ep-7');
  });

  test('the retired gallery, /thumbnails/ep-7, opens the editor on ep-7', () => {
    land('/thumbnails/ep-7');
    expect(screen.getByTestId('where').textContent).toBe('/template-studio/youtube?episode=ep-7');
  });
});
