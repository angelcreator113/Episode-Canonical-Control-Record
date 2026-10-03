/**
 * One show workspace: /shows/:id sends the old show-page tabs to their homes
 * in Producer Mode, so old links and bookmarks keep working (the show page's
 * "Open wardrobe" still lands on Assets → Wardrobe).
 */
import React from 'react';
import { describe, beforeEach, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ShowDetail from './ShowDetail';
import { rememberedShowId } from '../utils/activeShow';

let where;
function Where() { const l = useLocation(); where = `${l.pathname}${l.search}`; return null; }
const go = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/shows/:id" element={<ShowDetail />} />
      <Route path="/shows/:id/world" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('ShowDetail → the one show workspace', () => {
  beforeEach(() => { window.localStorage.clear(); where = null; });

  test.each([
    ['', 'overview'],
    ['?tab=studio', 'overview'],
    ['?tab=episodes', 'episodes-production'],
    ['?tab=assets', 'scene-sets'],
    ['?tab=wardrobe', 'wardrobe-items'],
    ['?tab=distribution', 'distribution'],
    ['?tab=insights', 'insights'],
    ['?tab=nonsense', 'overview'],
  ])('/shows/show-1%s opens ?tab=%s', (search, tab) => {
    go(`/shows/show-1${search}`);
    expect(where).toBe(`/shows/show-1/world?tab=${tab}`);
  });

  test('the show becomes the active show', () => {
    go('/shows/show-1');
    expect(rememberedShowId()).toBe('show-1');
  });
});
