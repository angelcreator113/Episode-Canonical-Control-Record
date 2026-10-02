/**
 * S8 (Evoni, 2026-10-02; docs/EVENT_EPISODE_FLOW.md §8(dd)): "Other pages ...
 * show status only, with one entry point: 'Open in Scene Sets →', landing on
 * the exact set and zone, with a way back to the page it came from."
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OpenInSceneSets, { SceneSetsBackLink } from './OpenInSceneSets';
import { sceneSetPath } from '../utils/sceneSets';

describe('sceneSetPath (S8)', () => {
  test('the set alone, as before; with a zone and the page to come back to', () => {
    expect(sceneSetPath('show-1', 'set-1')).toBe('/shows/show-1/world?tab=scene-sets&set=set-1');
    expect(sceneSetPath('show-1', 'set-1', { zone: 'front', from: '/episodes/ep-1/plan', fromLabel: 'Beat Plan' }))
      .toBe('/shows/show-1/world?tab=scene-sets&set=set-1&zone=front&from=%2Fepisodes%2Fep-1%2Fplan&fromLabel=Beat%20Plan');
  });
});

describe('OpenInSceneSets (S8)', () => {
  test('links to the set and zone, carrying the page it is on', () => {
    render(
      <MemoryRouter initialEntries={['/episodes/ep-1/plan?view=list']}>
        <OpenInSceneSets showId="show-1" setId="set-1" zone="angle-9" fromLabel="Beat Plan" />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Open in Scene Sets →' });
    expect(link.getAttribute('href')).toBe('/shows/show-1/world?tab=scene-sets&set=set-1&zone=angle-9&from=%2Fepisodes%2Fep-1%2Fplan%3Fview%3Dlist&fromLabel=Beat%20Plan');
  });

  test('without a show it says where to find the set instead of linking nowhere', () => {
    render(<MemoryRouter><OpenInSceneSets showId={null} setId="set-1" /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Scene Sets/)).toBeTruthy();
  });
});

describe('SceneSetsBackLink (S8)', () => {
  const at = (search) => render(
    <MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}><SceneSetsBackLink /></MemoryRouter>
  );
  test('goes back to the page it came from', () => {
    at('?tab=scene-sets&set=set-1&from=%2Fepisodes%2Fep-1%2Fplan&fromLabel=Beat%20Plan');
    expect(screen.getByRole('link', { name: '← Back to Beat Plan' }).getAttribute('href')).toBe('/episodes/ep-1/plan');
  });
  test('only to a page of this app', () => {
    at('?tab=scene-sets&from=https%3A%2F%2Fexample.com');
    expect(screen.queryByRole('link')).toBeNull();
  });
  test('and not to another site through a protocol-relative path', () => {
    at('?tab=scene-sets&from=%2F%2Fexample.com');
    expect(screen.queryByRole('link')).toBeNull();
  });
});
