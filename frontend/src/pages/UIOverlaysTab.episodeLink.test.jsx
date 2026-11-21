/**
 * Assets › Lala's Phone: a mission's link to its episode (Evoni, 2026-11-15,
 * Producer Mode PR A). It opens the episode's Phone tool, so it says so; and
 * in the app it is a router link, so the page is not reloaded.
 */
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { EpisodePhoneLink } from './UIOverlaysTab';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };

describe('EpisodePhoneLink', () => {
  test('in the app: names the Phone, and a click moves the router without leaving the page', () => {
    render(
      <MemoryRouter initialEntries={['/shows/show-1/world?tab=overlays-tab']}>
        <Routes>
          <Route path="/shows/:id/world" element={<><Where /><EpisodePhoneLink episodeId="ep-1" /></>} />
          <Route path="/episodes/:id" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Open its phone in the episode' });
    expect(link.getAttribute('href')).toBe('/episodes/ep-1?tab=phone');
    fireEvent.click(link);
    // The router handled it: the same document, at the episode's Phone tool.
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=phone');
  });

  test('with no router around it (the tab mounted on its own) it is still a working link', () => {
    render(<EpisodePhoneLink episodeId="ep-1" />);
    expect(screen.getByRole('link', { name: 'Open its phone in the episode' }).getAttribute('href')).toBe('/episodes/ep-1?tab=phone');
  });
});
