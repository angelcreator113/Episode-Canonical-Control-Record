/**
 * The public landing page's frame and hero (docs/design/
 * 2026-10-landing-and-stylesheet.md Part 1 sections 1–2; Task #2808):
 * static (no API calls), "Enter Studio" to the existing login, a phone
 * menu with accessible focus, and the hero's real text and buttons.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import PublicLanding from './PublicLanding';

const renderPage = () => render(<MemoryRouter><PublicLanding /></MemoryRouter>);

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network in tests')));
});
afterEach(() => { fetchSpy.mockRestore(); vi.clearAllMocks(); });

describe('public landing: navigation and hero', () => {
  test('renders the hero with real text and makes no network calls', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Where Fashion Becomes a World.' })).toBeTruthy();
    expect(screen.getByText('AN ORIGINAL ENTERTAINMENT UNIVERSE')).toBeTruthy();
    expect(screen.getByText(/At Prime Studios, we create character-driven entertainment/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });

  test('the nav: wordmark, three section links, and Enter Studio to the existing login', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Our World', '#our-world'], ['Productions', '#featured-production'], ['Collaborate', '#collaborate'],
    ]);
    expect(screen.getByText('Prime Studios')).toBeTruthy();
    const enter = screen.getAllByRole('link', { name: 'Enter Studio' })[0];
    expect(enter.getAttribute('href')).toBe('/login');
  });

  test('hero buttons: Explore Our Universe goes to Our World; Watch Our Vision scrolls to Featured Production', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Explore Our Universe' }).getAttribute('href')).toBe('#our-world');
    const target = document.createElement('section');
    target.id = 'featured-production';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Our Vision' }));
    expect(target.scrollIntoView).toHaveBeenCalled();
    target.remove();
  });

  test('without the map the hero shows its placeholder field, not a broken image', () => {
    renderPage();
    expect(screen.getByTestId('site-hero-placeholder')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('the phone menu opens and closes, moves focus in, and Escape returns focus to its button', () => {
    renderPage();
    const button = screen.getByTestId('site-menu-button');
    const drawer = screen.getByTestId('site-drawer');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('site-drawer');
    expect(drawer.hidden).toBe(true);
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.hidden).toBe(false);
    expect(document.activeElement.textContent).toBe('Our World');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.click(within(drawer).getByRole('link', { name: 'Collaborate' }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
