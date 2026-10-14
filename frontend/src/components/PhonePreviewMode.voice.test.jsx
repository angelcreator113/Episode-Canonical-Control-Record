/**
 * Voice on Lala's Phone (Task #3163; Evoni, 2026-10-14): tapping the Voice
 * icon shows "Lala speaks" and opens no screen, in the Preview and in
 * playback (with a playthrough), even when the zone or the server names a
 * screen. Other icons still navigate.
 */
import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => <div data-testid="content-renderer" /> }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

import PhonePreviewMode from './PhonePreviewMode';

const TALK = { id: 'talking_icon', name: 'Talking icon', category: 'phone_icon', generated: true, url: 'https://x/talk.png' };
const MSG = { id: 'messages_icon', name: 'Messages icon', category: 'phone_icon', generated: true, url: 'https://x/msg.png', opens_screen: 'dms' };
const HOME = {
  id: 'home', name: 'Home', generated: true, is_home: true, url: 'https://x/home.png', show_id: 'show-1',
  screen_links: [
    { id: 'z-voice', x: 10, y: 80, w: 15, h: 10, label: 'Voice', icon_overlay_id: 'talking_icon' },
    // A Voice zone that names a screen still opens nothing.
    { id: 'z-voice-2', x: 30, y: 80, w: 15, h: 10, label: 'Voice too', icon_url: TALK.url, target: 'dms' },
    { id: 'z-msg', x: 50, y: 80, w: 15, h: 10, label: 'Mail', icon_overlay_id: 'messages_icon', target: 'dms' },
  ],
};
const DMS = { id: 'dms', name: 'DMs', generated: true, url: 'https://x/dms.png', show_id: 'show-1', screen_links: [] };
const SCREENS = [HOME, DMS, TALK, MSG];

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Voice is an action, not a screen (Task #3163)', () => {
  test('in the Preview, Voice says "Lala speaks" and stays on the home', () => {
    vi.useFakeTimers();
    render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} />);
    fireEvent.click(screen.getByTitle('Voice'));
    expect(screen.getByText('Lala speaks')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Voice too'));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByAltText('Home')).toBeTruthy();
    expect(screen.queryByAltText('DMs')).toBeNull();
  });

  test('another icon still opens its screen, with no "Lala speaks"', async () => {
    render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} />);
    fireEvent.click(screen.getByTitle('Mail'));
    await screen.findByAltText('DMs');
    expect(screen.queryByText('Lala speaks')).toBeNull();
  });

  test('in playback, the tap is recorded, "Lala speaks" shows, and no screen opens even if the server names one', async () => {
    const state = { state_flags: {}, visited_screens: [], completed_mission_ids: [] };
    const playthrough = { state, tap: vi.fn().mockResolvedValue({ state, effects: { navigate: 'dms', toasts: [] } }), reset: vi.fn() };
    render(<PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} playthrough={playthrough} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Voice')); });
    expect(playthrough.tap).toHaveBeenCalledWith('z-voice', null);
    expect(screen.getByText('Lala speaks')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.getByAltText('Home')).toBeTruthy();
    expect(screen.queryByAltText('DMs')).toBeNull();
  });
});
