/**
 * Pull-to-refresh is back on Home, the public landing page and sign-in only
 * (Evoni, 2026-10-29). useAllowPullToRefresh marks <html> while the page is
 * mounted; the CSS (index.css) and main.jsx's touchmove guard read the mark.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import useAllowPullToRefresh from './useAllowPullToRefresh';

const SRC = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const mark = () => document.documentElement.dataset.pullRefresh;

function Allowing() { useAllowPullToRefresh(); return null; }

describe('useAllowPullToRefresh', () => {
  afterEach(() => { cleanup(); delete document.documentElement.dataset.pullRefresh; });

  test('marks <html> while mounted and clears the mark on leaving', () => {
    expect(mark()).toBeUndefined();
    const { unmount } = render(<Allowing />);
    expect(mark()).toBe('on');
    unmount();
    expect(mark()).toBeUndefined();
  });

  test('only Home, the public landing page and sign-in use it', () => {
    const users = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.jsx?$/.test(f.name) && !/\.test\./.test(f.name) && !p.endsWith('useAllowPullToRefresh.js')
          && fs.readFileSync(p, 'utf8').includes('useAllowPullToRefresh()')) users.push(path.relative(SRC, p));
      }
    };
    walk(SRC);
    expect(users.sort()).toEqual(['pages/Home.jsx', 'pages/Login.jsx', 'pages/PublicLanding.jsx']);
  });

  test('the CSS lets a marked page overscroll, and the touchmove guard stands aside for it', () => {
    expect(read('index.css')).toMatch(/html\[data-pull-refresh="on"\],\s*html\[data-pull-refresh="on"\] body \{\s*overscroll-behavior-y: auto;/);
    expect(read('main.jsx')).toMatch(/if \(startY == null\) return;[^\n]*\n[^\n]*\n\s*if \(document\.documentElement\.dataset\.pullRefresh === 'on'\) return;/);
  });
});
