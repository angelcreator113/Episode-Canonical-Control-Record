/**
 * PhoneMapStage — the Map stage (Evoni's mockup, 2026-10-08).
 */
import React from 'react';
import { vi, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('./PhoneDevice', () => ({ default: () => <div data-testid="device" /> }));
import PhoneMapStage from './PhoneMapStage';

afterEach(() => cleanup());

const S = (id, name, links = [], extra = {}) => ({ id, name, category: 'phone', generated: true, url: `https://x/${id}.png`, screen_links: links, ...extra });
const Z = (id, target, label) => ({ id, target, label, x: 1, y: 1, w: 5, h: 5 });
const HOME = S('home', 'Homepage', [Z('z1', 'closet', 'closet'), Z('z2', 'closet', 'wallet'), Z('z3', 'camera', 'camera')], { is_home: true });
const OVERLAYS = [HOME, S('closet', 'Closet', [Z('z4', 'home', 'back')]), S('camera', 'Camera'), S('hair', 'Hair Page')];

test('every tap out of home, with what the phone cannot do beside it', () => {
  render(<PhoneMapStage overlays={OVERLAYS} onOpenScreen={() => {}} />);
  expect(screen.getByText('3 taps out')).toBeTruthy();
  const taps = within(screen.getByTestId('phone-map-taps')).getAllByRole('button').map(b => b.textContent);
  expect(taps).toEqual(['Closet1 link onward', 'Closetfrom wallet · 1 link onward', 'Camerano taps onward']);
  expect(within(screen.getByTestId('phone-map-unreachable')).getByText('Hair Page')).toBeTruthy();
  // No dead ends (Task #3162): every screen but the home has the phone's own Back.
  expect(screen.queryByTestId('phone-map-dead-ends')).toBeNull();
  expect(screen.getByText("Every screen but Homepage has the phone's own Back.")).toBeTruthy();
  expect(screen.getByTestId('phone-map-opened-twice').textContent).toContain('On Homepage, Closet opens from closet and wallet.');
});

test('a screen opens in Connect', () => {
  const onOpenScreen = vi.fn();
  render(<PhoneMapStage overlays={OVERLAYS} onOpenScreen={onOpenScreen} />);
  fireEvent.click(screen.getByTestId('phone-map-tap-z3'));
  expect(onOpenScreen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'camera' }));
  fireEvent.click(within(screen.getByTestId('phone-map-unreachable')).getByRole('button', { name: 'Link it from Homepage' }));
  expect(onOpenScreen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'home' }));
});

test('all good says so, a screen with no taps onward included; no home asks for an image', () => {
  render(<PhoneMapStage overlays={[S('home', 'Homepage', [Z('z1', 'closet', 'closet')], { is_home: true }), S('closet', 'Closet')]} />);
  expect(screen.getByTestId('phone-map-all-good').textContent).toContain('Every screen can be reached');
  cleanup();
  render(<PhoneMapStage overlays={[]} />);
  expect(screen.getByText('Give a screen an image in Build to start the map.')).toBeTruthy();
});
