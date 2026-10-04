/**
 * The duplicate world editors' routes open the LalaVerse hub on the matching
 * tab and sub-tab (audit IA-04, 2026-10-03; the hub, 2026-10-04), the four
 * former world pages' routes open their hub tab carrying their old ?tab= as
 * &sub=, and a page opens on the tab its URL names.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WORLD_REDIRECTS, HUB_TABS, hubTarget, tabFromSearch } from './worldRedirects';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };

describe('WORLD_REDIRECTS', () => {
  test.each(Object.entries(WORLD_REDIRECTS))('%s opens %s', (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          {Object.entries(WORLD_REDIRECTS).map(([path, target]) => <Route key={path} path={path} element={<Navigate to={target} replace />} />)}
          <Route path="/universe" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe(to);
  });

  test('every target is a hub tab with a sub-tab', () => {
    for (const to of Object.values(WORLD_REDIRECTS)) {
      expect(to).toMatch(/^\/universe\?tab=(world|society|culture|state)&sub=\w+$/);
    }
  });
});

describe('HUB_TABS and hubTarget', () => {
  test('the four former world pages map to the four hub tabs', () => {
    expect(HUB_TABS).toEqual({ '/world-dashboard': 'state', '/world-foundation': 'world', '/social-systems': 'society', '/culture-events': 'culture' });
  });
  test('a legacy ?tab= becomes the hub tab\'s &sub=', () => {
    expect(hubTarget('world', '')).toBe('/universe?tab=world');
    expect(hubTarget('world', '?tab=locations')).toBe('/universe?tab=world&sub=locations');
    expect(hubTarget('culture', '?show=1&tab=history')).toBe('/universe?tab=culture&sub=history');
  });
});

describe('tabFromSearch', () => {
  const TABS = [{ key: 'events' }, { key: 'awards' }, { key: 'history' }];
  test('the named tab when the page has it, else the fallback', () => {
    expect(tabFromSearch(TABS, 'events', '?tab=history')).toBe('history');
    expect(tabFromSearch(TABS, 'events', '?tab=nope')).toBe('events');
    expect(tabFromSearch(TABS, 'events', '')).toBe('events');
    expect(tabFromSearch(TABS, 'events', '?show=1&tab=awards')).toBe('awards');
  });
  test('a hub page reads its own tab from ?sub=, not the hub\'s ?tab=', () => {
    expect(tabFromSearch(TABS, 'events', '?tab=culture&sub=history', 'sub')).toBe('history');
    expect(tabFromSearch(TABS, 'events', '?tab=culture', 'sub')).toBe('events');
  });
});
