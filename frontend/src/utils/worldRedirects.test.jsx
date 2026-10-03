/**
 * The duplicate world editors' routes open their owner's page on the
 * matching tab (audit IA-04, 2026-10-03), and a page opens on the tab its
 * URL names.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WORLD_REDIRECTS, tabFromSearch } from './worldRedirects';

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname}{l.search}</div>; };

describe('WORLD_REDIRECTS', () => {
  test.each(Object.entries(WORLD_REDIRECTS))('%s opens %s', (from, to) => {
    render(
      <MemoryRouter initialEntries={[from]}>
        <Routes>
          {Object.entries(WORLD_REDIRECTS).map(([path, target]) => <Route key={path} path={path} element={<Navigate to={target} replace />} />)}
          <Route path="/social-systems" element={<Where />} />
          <Route path="/world-foundation" element={<Where />} />
          <Route path="/culture-events" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe(to);
  });

  test('every target is a Sidebar page with a tab', () => {
    for (const to of Object.values(WORLD_REDIRECTS)) {
      expect(['/social-systems', '/world-foundation', '/culture-events']).toContain(to.split('?')[0]);
      expect(to).toMatch(/\?tab=\w+$/);
    }
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
});
