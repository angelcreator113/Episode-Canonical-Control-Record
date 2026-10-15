/**
 * A Back zone is the phone's Back (Evoni, 2026-10-15): a zone labelled "Back"
 * goes to the screen Lala came from, not to the screen it was saved with
 * (the old "Add back buttons" saved every one as "open the home screen").
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

const BACK = (id) => ({ id, x: 4, y: 5, w: 18, h: 6, label: 'Back', target: 'homepage' });
const HOME = { id: 'homepage', name: 'Homepage', generated: true, is_home: true, url: 'https://x/home.png', screen_links: [
  { id: 'h1', x: 10, y: 80, w: 15, h: 10, label: 'Closet', target: 'closet' },
] };
const CLOSET = { id: 'closet', name: 'Closet', generated: true, url: 'https://x/closet.png', screen_links: [
  BACK('c-back'),
  { id: 'c1', x: 10, y: 40, w: 15, h: 10, label: 'Shoes', target: 'shoe_page' },
] };
const SHOES = { id: 'shoe_page', name: 'Shoes', generated: true, url: 'https://x/shoes.png', screen_links: [BACK('s-back')] };
const SCREENS = [HOME, CLOSET, SHOES];

afterEach(() => cleanup());

test('a Back zone saved as "open the home screen" goes back to the screen Lala came from', async () => {
  render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} />);
  fireEvent.click(screen.getByTitle('Closet'));
  await screen.findByAltText('Closet');
  fireEvent.click(screen.getByTitle('Shoes'));
  await screen.findByAltText('Shoes');
  // Shoes' Back zone targets the home screen, but Lala came from Closet.
  fireEvent.click(screen.getByTitle('Back'));
  await screen.findByAltText('Closet');
  fireEvent.click(screen.getByTitle('Back'));
  await screen.findByAltText('Homepage');
});

test('with no history, a Back zone goes where the phone\'s Back would', async () => {
  render(<PhonePreviewMode screens={SCREENS} initialScreen={SHOES} onClose={() => {}} />);
  fireEvent.click(screen.getByTitle('Back'));
  await screen.findByAltText('Homepage');
});

test('the tap still runs for a playthrough, and the phone goes back, not to the saved screen', async () => {
  const playthrough = {
    state: { last_screen_id: null, state_flags: {}, visited_screens: [], completed_mission_ids: [] },
    loading: false, error: null,
    tap: vi.fn().mockResolvedValue({ state: null, effects: { navigate: 'homepage', toasts: [] } }),
    reset: vi.fn(), saveScreen: vi.fn().mockResolvedValue(null), clearError: vi.fn(),
  };
  render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} playthrough={playthrough} />);
  playthrough.tap.mockResolvedValueOnce({ state: null, effects: { navigate: 'closet', toasts: [] } });
  fireEvent.click(screen.getByTitle('Closet'));
  await screen.findByAltText('Closet');
  playthrough.tap.mockResolvedValueOnce({ state: null, effects: { navigate: 'shoe_page', toasts: [] } });
  fireEvent.click(screen.getByTitle('Shoes'));
  await screen.findByAltText('Shoes');
  fireEvent.click(screen.getByTitle('Back'));
  await screen.findByAltText('Closet');
  expect(playthrough.tap).toHaveBeenCalledWith('s-back', null);
});
