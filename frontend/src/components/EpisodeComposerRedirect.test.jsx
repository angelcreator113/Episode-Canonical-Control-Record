/**
 * The old composer link keeps its episode (audit LINK-02, 2026-10-03):
 * /episodes/:id/composer opens that episode's thumbnails, not the generic
 * Template Library, and replaces itself in history so Back skips it.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import EpisodeComposerRedirect, { episodeThumbnailsPath } from './EpisodeComposerRedirect';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

describe('EpisodeComposerRedirect', () => {
  test('/episodes/ep-7/composer lands on /thumbnails/ep-7', () => {
    render(
      <MemoryRouter initialEntries={['/episodes/ep-7/composer']}>
        <Routes>
          <Route path="/episodes/:episodeId/composer" element={<EpisodeComposerRedirect />} />
          <Route path="/thumbnails/:episodeId" element={<Where />} />
          <Route path="/template-studio" element={<div data-testid="template-library" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe('/thumbnails/ep-7');
    expect(screen.queryByTestId('template-library')).toBeNull();
    expect(episodeThumbnailsPath('ep-7')).toBe('/thumbnails/ep-7');
  });
});
