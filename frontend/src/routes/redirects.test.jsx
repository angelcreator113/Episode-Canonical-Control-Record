/**
 * The moved addresses keep working (Task #3157): /feed opens The Pulse with
 * its query and hash, and /website opens Admin's Website tab. The redirects
 * are rendered for real in a router, and App.jsx is checked to mount them.
 */
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PulseRedirect, WebsiteRedirect } from './redirects';

function Where() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="where">{`${pathname}${search}${hash}`}</div>;
}

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/feed" element={<PulseRedirect />} />
      <Route path="/website" element={<WebsiteRedirect />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('moved addresses', () => {
  test.each([
    ['/feed', '/pulse'],
    ['/feed?tab=people&layer=lalaverse', '/pulse?tab=people&layer=lalaverse'],
    ['/feed?post=abc#comments', '/pulse?post=abc#comments'],
    ['/website', '/admin?tab=website'],
    ['/website?sub=slots', '/admin?tab=website'],
  ])('%s opens %s', async (from, to) => {
    renderAt(from);
    expect((await screen.findByTestId('where')).textContent).toBe(to);
  });

  test('App mounts the redirects on /feed, /website and /book/:id', () => {
    const app = readFileSync(resolve(__dirname, '../App.jsx'), 'utf8');
    expect(app).toMatch(/<Route path="\/feed" element={<PulseRedirect \/>} \/>/);
    expect(app).toMatch(/<Route path="\/website" element={<WebsiteRedirect \/>} \/>/);
    expect(app).toMatch(/<Route path="\/book\/:id" element={<BookToWriteRedirect \/>} \/>/);
    expect(app).toMatch(/import \{ PulseRedirect, WebsiteRedirect, BookToWriteRedirect \} from '\.\/routes\/redirects';/);
  });
});
