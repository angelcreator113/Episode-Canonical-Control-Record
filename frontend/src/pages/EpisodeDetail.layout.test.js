/**
 * The episode page at phone width (Evoni, 2026-10-05: "alignment is off"):
 * the sticky episode header sits under the app's sticky top bar, not behind
 * it; the Production sub-tabs keep each label on one line and scroll
 * sideways; the wardrobe's slots column takes the full width once it wraps.
 * Checked in a browser at 375 and 1440px; these pin the rules.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p) => readFileSync(resolve(__dirname, p), 'utf8');
const css = read('EpisodeDetail.css');
const page = read('EpisodeDetail.jsx');
const header = read('../components/Header.jsx');
const game = read('../components/EpisodeWardrobeGameplay.jsx');

describe('episode page layout at phone width', () => {
  test('the episode header sticks under the app top bar, whose height Header publishes', () => {
    expect(css).toMatch(/@media \(max-width: 1279px\) \{\s*\.ed-header-new \{ top: var\(--app-header-h, 0px\); \}/);
    expect(header).toMatch(/setProperty\('--app-header-h'/);
    expect(header).toMatch(/<header className="header" ref=\{headerRef\}>/);
  });

  test('the Production sub-tabs keep one line each and scroll sideways', () => {
    const row = page.slice(page.indexOf('data-testid="ed-subtabs"'), page.indexOf('{s.label}'));
    expect(row).toMatch(/overflowX: 'auto'/);
    expect(row).toMatch(/whiteSpace: 'nowrap', flexShrink: 0/);
  });

  test('the slots column grows to the full width once it wraps', () => {
    expect(game).toMatch(/slotsPanel: \{ flex: '1 1 250px'/);
    expect(game).toMatch(/browsePanel: \{ flex: '999 1 280px'/);
  });
});
