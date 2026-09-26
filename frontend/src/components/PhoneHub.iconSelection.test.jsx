/**
 * PhoneHub — selecting an icon keeps the phone's screen (Task #2008,
 * doctrine rule 17: "Selecting an icon preserves the active phone screen and
 * highlights its placement(s) on that screen").
 *
 * The device keeps the last screen it showed (the home screen if none),
 * outlines only the selected icon's zones, persistent icons included, says so
 * when the icon has no placement there, and hands that screen to onNavigate
 * so Back returns to it rather than to the icon.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});

import PhoneHub from './PhoneHub';

const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png' };
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'icon', generated: true, url: 'https://x/mail.png' };
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 's-1',
  screen_links: [
    { id: 'z-call', x: 8, y: 14, w: 12, h: 9, target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' },
    { id: 'z-mail', x: 30, y: 14, w: 12, h: 9, target: 'calls', label: 'Mail', icon_url: 'https://x/mail.png' },
    { id: 'z-dock', x: 50, y: 90, w: 12, h: 8, target: 'calls', label: 'Dock call', icon_url: 'https://x/call-old.png', icon_overlay_id: 'call_icon', persistent: true },
  ],
};
const CALLS = {
  id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', show_id: 's-1',
  screen_links: [{ id: 'z-back', x: 0, y: 0, w: 20, h: 10, target: 'home', label: 'Home' }],
};
const SCREENS = [HOME, CALLS, CALL, MAIL];

function hub(activeScreen, props = {}) {
  return (
    <PhoneHub
      screens={SCREENS}
      activeScreen={activeScreen}
      onSelectScreen={() => {}}
      onNavigate={() => {}}
      activeTab="icons"
      suppressSectionTabs
      {...props}
    />
  );
}

function device(container) {
  return within(container.querySelector('.phone-hub-device'));
}

afterEach(() => cleanup());

describe('PhoneHub — selecting an icon keeps the phone\'s screen (Task #2008)', () => {
  test('the previous screen stays and only the selected icon\'s zones are highlighted', () => {
    const { container, rerender } = render(hub(HOME));
    rerender(hub(CALL));
    const d = device(container);
    expect(d.getByAltText('Homepage')).toBeTruthy();
    expect(d.queryByText('Select a screen')).toBeNull();
    expect(d.getByTitle('Call').getAttribute('data-highlighted')).toBe('true');
    expect(d.getByTitle('Dock call').getAttribute('data-highlighted')).toBe('true');
    expect(d.getByTitle('Mail').hasAttribute('data-highlighted')).toBe(false);
    expect(screen.queryByText(/isn't placed on/)).toBeNull();
  });

  test('with no screen shown before, the home screen is used', () => {
    const { container } = render(hub(CALL));
    const d = device(container);
    expect(d.getByAltText('Homepage')).toBeTruthy();
    expect(d.getByTitle('Call').getAttribute('data-highlighted')).toBe('true');
  });

  test('a category "icon" icon behaves the same, a legacy zone included', () => {
    const { container, rerender } = render(hub(HOME));
    rerender(hub(MAIL));
    const d = device(container);
    expect(d.getByAltText('Homepage')).toBeTruthy();
    expect(d.getByTitle('Mail').getAttribute('data-highlighted')).toBe('true');
    expect(d.getByTitle('Call').hasAttribute('data-highlighted')).toBe(false);
  });

  test('a persistent placement counts on another screen, and nothing is highlighted without a selected icon', () => {
    const { container, rerender } = render(hub(CALLS));
    expect(container.querySelector('[data-highlighted]')).toBeNull();
    rerender(hub(CALL));
    const d = device(container);
    expect(d.getByAltText('calls list')).toBeTruthy();
    expect(d.getByTitle('Dock call').getAttribute('data-highlighted')).toBe('true');
    expect(screen.queryByText(/isn't placed on/)).toBeNull();
  });

  test('an icon with no placement on the screen shown says so', () => {
    const { rerender } = render(hub(CALLS));
    rerender(hub(MAIL));
    expect(screen.getByText("○ Mail isn't placed on calls list")).toBeTruthy();
  });

  test('a tap while an icon is selected hands onNavigate the screen shown', () => {
    const onNavigate = vi.fn();
    const { container, rerender } = render(hub(HOME, { onNavigate }));
    rerender(hub(CALL, { onNavigate }));
    fireEvent.click(device(container).getByTitle('Mail'));
    expect(onNavigate).toHaveBeenCalledWith('calls', 'home');
  });
});
