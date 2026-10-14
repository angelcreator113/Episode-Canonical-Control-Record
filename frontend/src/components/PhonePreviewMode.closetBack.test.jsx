/**
 * Closet sections keep her own icons (Task #3165; Evoni, 2026-10-14): a
 * section page opened with no history (an old link, a resumed play-through)
 * has Back to Closet, and Closet's Back goes home. History still wins.
 */
import React from 'react';
import { vi, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => <div data-testid="content-renderer" /> }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

import PhonePreviewMode from './PhonePreviewMode';

const ICON = (id) => ({ id, name: id, category: 'phone_icon', generated: true, url: `https://x/${id}.png` });
const HOME = { id: 'homepage', name: 'Homepage', generated: true, is_home: true, url: 'https://x/home.png', screen_links: [
  { id: 'h1', x: 10, y: 80, w: 15, h: 10, label: 'Closet', target: 'closet', icon_overlay_id: 'closet_icon' },
  { id: 'h2', x: 30, y: 80, w: 15, h: 10, label: 'Shoes shortcut', target: 'shoe_page' },
] };
const CLOSET = { id: 'closet', name: 'Closet', generated: true, url: 'https://x/closet.png', screen_links: [
  { id: 'c1', x: 10, y: 40, w: 15, h: 10, label: 'Shoes', target: 'shoe_page', icon_overlay_id: 'shoe_icon' },
] };
const SHOES = { id: 'shoe_page', name: 'Shoes', generated: true, url: 'https://x/shoes.png', screen_links: [] };
const SCREENS = [HOME, CLOSET, SHOES, ICON('closet_icon'), ICON('shoe_icon')];

afterEach(() => cleanup());

const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));

test('a section page with no history goes back to Closet, then home', async () => {
  render(<PhonePreviewMode screens={SCREENS} initialScreen={SHOES} onClose={() => {}} />);
  back();
  await screen.findByAltText('Closet');
  back();
  await screen.findByAltText('Homepage');
  expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
});

test('with history, Back still returns to the screen Lala came from', async () => {
  render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} />);
  fireEvent.click(screen.getByTitle('Shoes shortcut'));
  await screen.findByAltText('Shoes');
  back();
  await screen.findByAltText('Homepage');
});
