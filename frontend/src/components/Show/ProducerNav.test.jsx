/**
 * Producer Mode's six tabs as one navigation (Evoni, 2026-11-20): the one
 * list, each tab's address, and the two ways the bar is used: by Producer
 * Mode (its own five switch in place) and by the Season page (links).
 */
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import ProducerNav, { PRODUCER_TABS, producerTabHref } from './ProducerNav';

const show = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const css = readFileSync(resolve(__dirname, '../../pages/WorldAdmin.css'), 'utf8');
const worldAdmin = readFileSync(resolve(__dirname, '../../pages/WorldAdmin.jsx'), 'utf8');
const seasonPage = readFileSync(resolve(__dirname, '../../pages/SeasonPage.jsx'), 'utf8');

describe('the one list', () => {
  test('six tabs, in order, Season the one that is a page of its own', () => {
    expect(PRODUCER_TABS.map((t) => t.label)).toEqual(['Overview', 'Season', 'Assets', 'Cast & Continuity', 'World', 'Release']);
    expect(PRODUCER_TABS.filter((t) => t.page === 'season').map((t) => t.key)).toEqual(['season-page']);
    for (const t of PRODUCER_TABS) expect(Boolean(t.landing) || t.page === 'season').toBe(true);
  });

  test('each tab opens on the sub-tab Producer Mode opens it on: its first, or the tab itself', () => {
    // WorldAdmin's SUBS, read from its source: a tab's landing is its first sub-tab's key.
    const subs = worldAdmin.slice(worldAdmin.indexOf('const SUBS = {'), worldAdmin.indexOf('const TABS = PRODUCER_TABS.map'));
    for (const t of PRODUCER_TABS) {
      if (t.page === 'season') continue;
      const block = subs.match(new RegExp(`\\n  ${t.key}: \\[([\\s\\S]*?)\\n  \\],`));
      const first = block ? block[1].match(/\{ key: '([^']+)'/)[1] : t.key;
      expect([t.key, t.landing]).toEqual([t.key, first]);
    }
  });

  test('nothing else defines the six: Producer Mode builds its tabs from the list, and the Season page only renders the bar', () => {
    expect(worldAdmin).toMatch(/const TABS = PRODUCER_TABS\.map\(/);
    expect(worldAdmin).not.toMatch(/label: 'Cast & Continuity'/);
    expect(worldAdmin).toMatch(/<ProducerNav showId=\{showId\} active=\{activeTab\} onSelect=\{switchTab\} counts=\{counts\} \/>/);
    expect(seasonPage).toMatch(/<ProducerNav showId=\{showId\} active="season-page" \/>/);
    expect(seasonPage).not.toMatch(/Cast & Continuity/);
    // The Season page does not mount Producer Mode.
    expect(seasonPage).not.toMatch(/from '\.\/WorldAdmin'/);
  });

  test('addresses keep the show, and are escaped', () => {
    expect(producerTabHref('show-1', 'overview')).toBe('/shows/show-1/world?tab=overview');
    expect(producerTabHref('show-1', 'season-page')).toBe('/shows/show-1/season');
    expect(producerTabHref('show-1', 'wardrobe')).toBe('/shows/show-1/world?tab=scene-sets');
    expect(producerTabHref('a b/c', 'release')).toBe('/shows/a%20b%2Fc/world?tab=release-next');
    expect(producerTabHref('show-1', 'nonsense')).toBeNull();
  });
});

describe('seen from the Season page (no onSelect)', () => {
  test('six links for this show; the open one is marked; no count', () => {
    show(<ProducerNav showId="show-2" active="season-page" />);
    const nav = screen.getByRole('navigation', { name: 'Producer Mode' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(6);
    for (const a of links) expect(a.getAttribute('href')).toContain('/shows/show-2/');
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual(['Season']);
    expect(links.find((a) => a.textContent === 'Season').className).toContain('active');
    expect(within(nav).queryByRole('button')).toBeNull();
    expect(nav.querySelector('.wa-tab-count')).toBeNull();
  });
});

describe('seen from Producer Mode (onSelect)', () => {
  test('its own five are buttons that switch in place; Season is a link; a count is drawn where one is passed', () => {
    const onSelect = vi.fn();
    show(<ProducerNav showId="show-1" active="world" onSelect={onSelect} counts={{ world: 3 }} />);
    const nav = screen.getByRole('navigation', { name: 'Producer Mode' });
    expect(within(nav).getAllByRole('button').map((b) => b.querySelector('.wa-tab-label').textContent)).toEqual(['Overview', 'Assets', 'Cast & Continuity', 'World', 'Release']);
    const season = within(nav).getByRole('link', { name: 'Season' });
    expect(season.getAttribute('href')).toBe('/shows/show-1/season');
    expect(season.getAttribute('data-testid')).toBe('wa-tab-season');
    const world = within(nav).getByRole('button', { name: /World/ });
    expect(world.getAttribute('aria-current')).toBe('page');
    expect(within(world).getByLabelText('3 waiting').textContent).toBe('3');
    fireEvent.click(within(nav).getByRole('button', { name: 'Assets' }));
    expect(onSelect).toHaveBeenCalledWith('wardrobe');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('the bar\'s styles', () => {
  test('44px targets, a focus ring, and on a phone one row that slides (no two-column grid)', () => {
    expect(css).toMatch(/\.wa-tab \{ min-height: 44px; \}/);
    expect(css).toMatch(/\.wa-tab:focus-visible \{ outline: 3px solid var\(--accent-dark\); outline-offset: 2px; \}/);
    // The phone block that holds the tab bar's own rules.
    const at = css.indexOf('  .wa-tab-bar { padding: 8px; gap: 8px; border-radius: 14px; }');
    expect(at).toBeGreaterThan(-1);
    const start = css.lastIndexOf('@media', at);
    expect(css.slice(start, css.indexOf('{', start))).toMatch(/max-width: 600px/);
    const block = css.slice(at, css.indexOf('\n}', at)).split('\n').filter((l) => /\.wa-tab/.test(l)).join('\n');
    expect(block).not.toMatch(/grid-template-columns/);
    expect(block).not.toMatch(/overflow-x: visible/);
    expect(block).not.toMatch(/white-space: normal/);
    // The row itself scrolls (the base rule), so the page does not.
    expect(css).toMatch(/\.wa-tab-bar \{[^}]*overflow-x: auto;/);
    expect(css).toMatch(/\.wa-tab \{[^}]*flex-shrink: 0; white-space: nowrap;/);
  });
});
