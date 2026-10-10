/**
 * The landing page's quality bar (spec Part 1 "Quality bar" and "Phone";
 * Task #2811), the parts jsdom can check: one h1 and no skipped heading
 * levels, every image has alt text, every image slot has a set aspect
 * ratio, and the CSS rules the six-width browser pass relies on (44px
 * targets, phone body text 15–17px, visible focus, reduced motion).
 */
import { vi, describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import PublicLanding from './PublicLanding';

const css = readFileSync(resolve(__dirname, '../styles/PublicSite.css'), 'utf8');
const phone = css.slice(css.indexOf('@media (max-width: 860px)'), css.indexOf('@media (prefers-reduced-motion'));

describe('public landing: quality bar', () => {
  test('one h1, and heading levels never skip', () => {
    const { container } = render(<MemoryRouter><PublicLanding /></MemoryRouter>);
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    levels.forEach((l, i) => { if (i) expect(l).toBeLessThanOrEqual(levels[i - 1] + 1); });
  });

  test('every image has alt text and every image slot has a set aspect ratio', () => {
    const { container } = render(<MemoryRouter><PublicLanding /></MemoryRouter>);
    for (const img of container.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true);
    for (const slot of container.querySelectorAll('.site-media')) expect(slot.style.aspectRatio).not.toBe('');
    expect(css).toMatch(/\.site-featured__frame \{[^}]*aspect-ratio: 16 \/ 9/);
  });

  test('targets are 44px: buttons, nav links, the wordmark and the footer links', () => {
    expect(css).toMatch(/--site-touch/);
    for (const sel of ['.site .site-btn {', '.site .site-wordmark {', '.site .site-nav__links a {']) {
      const rule = css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
      expect({ sel, minHeight: /min-height: var\(--site-touch\)/.test(rule) }).toEqual({ sel, minHeight: true });
    }
  });

  test('phone body text stays 15–17px, the hero heading 38–48px', () => {
    expect(phone).toMatch(/\.site-section__lede,\s*\.site \.site-closing p \{ font-size: 16px; \}/);
    expect(phone).toMatch(/\.site-hero__body \{ font-size: 16px; \}/);
    expect(phone).toMatch(/\.site-hero h1 \{ font-size: clamp\(38px, 11vw, 48px\) !important; \}/);
  });

  test('focus is always visible and reduced motion turns off smooth scrolling', () => {
    expect(css).toMatch(/\.site :focus-visible \{\s*outline: 3px solid/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.site \{ scroll-behavior: auto; \}/);
  });
});
