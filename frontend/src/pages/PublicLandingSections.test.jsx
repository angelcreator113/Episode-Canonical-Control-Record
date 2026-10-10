/**
 * The landing page's sections 3–8 (docs/design/2026-10-landing-and-
 * stylesheet.md Part 1, amended by #2819; Task #2809): the blueprint's
 * copy, in order, with visible labelled placeholders where art is owed,
 * mailto contact buttons, placeholder Privacy and Terms, the AA pairs the
 * cards use, and no API calls.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import PublicLanding from './PublicLanding';
import { FLAGSHIP, WORLD, STUDIO, COLLABORATE, CLOSING, CONTACT_EMAIL } from '../components/site/siteContent';
import { contrast, readToken } from '../styles/contrast';

const renderPage = () => render(<MemoryRouter><PublicLanding /></MemoryRouter>);
const section = (id) => document.getElementById(id);

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network in tests')));
});
afterEach(() => { fetchSpy.mockRestore(); vi.clearAllMocks(); });

describe('public landing: sections 3–8', () => {
  test('sections render in the spec order and make no network calls', () => {
    renderPage();
    const ids = [...document.querySelectorAll('main > section, main > footer')].map((el) => el.id || el.dataset.testid || el.tagName.toLowerCase());
    expect(ids).toEqual(['site-hero', 'flagship', 'our-world', 'featured-production', 'inside-prime-studios', 'collaborate', 'contact', 'footer']);
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });

  test('flagship: the show copy, a labelled art placeholder, and Discover the Show', () => {
    renderPage();
    const s = within(section('flagship'));
    expect(s.getByRole('heading', { level: 2, name: FLAGSHIP.heading })).toBeTruthy();
    expect(s.getByText(FLAGSHIP.tagline)).toBeTruthy();
    expect(s.getByText(FLAGSHIP.body)).toBeTruthy();
    expect(s.getByText(FLAGSHIP.imageLabel)).toBeTruthy();
    expect(s.getByRole('link', { name: FLAGSHIP.button }).getAttribute('href')).toBe('#featured-production');
  });

  test('Our World: three pillars, each with an image placeholder', () => {
    renderPage();
    const s = within(section('our-world'));
    expect(s.getByRole('heading', { level: 2, name: WORLD.heading })).toBeTruthy();
    expect(s.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(WORLD.pillars.map((p) => p.title));
    expect(s.getAllByTestId('site-media-placeholder')).toHaveLength(3);
    for (const p of WORLD.pillars) expect(s.getByText(p.body)).toBeTruthy();
  });

  test('Inside Prime Studios: "One World. Many Ways In." with four brand cards', () => {
    renderPage();
    const s = within(section('inside-prime-studios'));
    expect(s.getByRole('heading', { level: 2, name: 'One World. Many Ways In.' })).toBeTruthy();
    expect(s.getByText(STUDIO.line)).toBeTruthy();
    expect(s.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'A World of Its Own', 'The Book Series', 'Made in Our Own Studio', 'Fashion as Storytelling',
    ]);
    expect(s.getAllByTestId('site-media-placeholder')).toHaveLength(4);
    expect(s.getByRole('link', { name: STUDIO.button }).getAttribute('href')).toBe('#collaborate');
  });

  test('Collaborate: three toned cards and a mailto button', () => {
    renderPage();
    const s = within(section('collaborate'));
    expect(s.getByRole('heading', { level: 2, name: COLLABORATE.heading })).toBeTruthy();
    const cards = section('collaborate').querySelectorAll('[data-tone]');
    expect([...cards].map((c) => c.dataset.tone)).toEqual(['blush', 'champagne', 'ice']);
    const href = s.getByRole('link', { name: COLLABORATE.button }).getAttribute('href');
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?subject=`)).toBe(true);
  });

  test('closing and footer: Start a Conversation by email, placeholder Privacy and Terms, Enter Studio', () => {
    renderPage();
    const s = within(section('contact'));
    expect(s.getByRole('heading', { level: 2, name: CLOSING.heading })).toBeTruthy();
    expect(s.getByRole('link', { name: CLOSING.button }).getAttribute('href')).toMatch(/^mailto:/);
    const footer = within(document.querySelector('.site-footer'));
    expect(footer.getByText(CLOSING.footer)).toBeTruthy();
    expect(screen.getByTestId('site-footer-privacy').textContent).toMatch(/Privacy.*coming soon/);
    expect(screen.getByTestId('site-footer-terms').textContent).toMatch(/Terms.*coming soon/);
    expect(footer.getByRole('link', { name: 'Enter Studio' }).getAttribute('href')).toBe('/login');
  });

  test('no images are shown until art is supplied: placeholders only', () => {
    renderPage();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getAllByTestId('site-media-placeholder')).toHaveLength(8);
  });

  test('the contact address is the obvious placeholder until Evoni supplies one', () => {
    expect(CONTACT_EMAIL).toMatch(/\.invalid$/);
  });

  test('the card and closing colour pairs pass AA (4.5:1)', () => {
    const css = readFileSync(resolve(__dirname, '../styles/site-tokens.css'), 'utf8');
    const t = (n) => readToken([css], n);
    for (const bg of ['--site-blush', '--site-champagne', '--site-ice', '--site-white', '--site-ivory']) {
      expect(contrast(t('--site-plum'), t(bg))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t('--site-ivory'), t('--site-plum'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--site-champagne'), t('--site-plum'))).toBeGreaterThanOrEqual(4.5);
  });
});
