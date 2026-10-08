/**
 * The play-through resumes and says what went wrong (Evoni, 2026-10-07:
 * "start the rest of lalas phone"). The saved state arrived after the phone
 * opened, and only /tap saved the screen, so a reopened play-through always
 * started on Home; a refused tap did nothing visible.
 */
import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => <div data-testid="content-renderer" /> }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

import PhonePreviewMode from './PhonePreviewMode';

const HOME = {
  id: 'home', name: 'Home', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png',
  screen_links: [{ id: 'z-dm', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages' }],
};
const DMS = { id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png', screen_links: [] };
const ICON = { id: 'icon-chat', name: 'Chat icon', category: 'phone_icon', generated: true, url: 'https://x/i.png' };

const playthroughWith = (over) => ({
  state: { state_flags: {}, visited_screens: [], completed_mission_ids: [], last_screen_id: null },
  loading: false, error: null,
  tap: vi.fn(), reset: vi.fn(), saveScreen: vi.fn(), clearError: vi.fn(),
  ...over,
});

afterEach(() => cleanup());

describe('play-through resume', () => {
  test('once the saved state arrives, the phone goes to the screen last on', async () => {
    const loadingPt = playthroughWith({ state: null, loading: true });
    const { rerender } = render(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={loadingPt} onClose={() => {}} />);
    expect(screen.getByAltText('Home')).toBeTruthy();
    const loaded = playthroughWith({ state: { ...loadingPt.state, state_flags: {}, visited_screens: ['home', 'dms'], completed_mission_ids: [], last_screen_id: 'dms' } });
    rerender(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={loaded} onClose={() => {}} />);
    expect(await screen.findByAltText('DMs')).toBeTruthy();
    expect(loaded.saveScreen).not.toHaveBeenCalled();
  });

  test('moving to a screen without a tap (Home) is saved too', async () => {
    const pt = playthroughWith({
      state: { state_flags: {}, visited_screens: [], completed_mission_ids: [], last_screen_id: 'dms' },
    });
    render(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    await screen.findByAltText('DMs');
    fireEvent.click(screen.getByTitle(/Home/));
    await waitFor(() => expect(pt.saveScreen).toHaveBeenCalledWith('home'));
  });

  test('an icon is never the first screen', () => {
    render(<PhonePreviewMode screens={[ICON, HOME]} onClose={() => {}} />);
    expect(screen.getByAltText('Home')).toBeTruthy();
  });
});

// Lala's Phone audit (Evoni, 2026-10-07).
describe('play-through taps and visits', () => {
  test('a tap names the screen it was made on', async () => {
    const pt = playthroughWith({ tap: vi.fn().mockResolvedValue({ effects: { navigate: null, toasts: [] }, state: null }) });
    const home = { ...HOME, asset_id: 'asset-home' };
    render(<PhonePreviewMode screens={[home, DMS]} initialScreen={home} playthrough={pt} onClose={() => {}} />);
    fireEvent.click(await screen.findByTitle('Messages'));
    await waitFor(() => expect(pt.tap).toHaveBeenCalledWith('z-dm', 'asset-home'));
  });

  test("a mission finished by landing on a screen is celebrated and its toast shown", async () => {
    const pt = playthroughWith({
      state: { state_flags: {}, visited_screens: [], completed_mission_ids: [], last_screen_id: 'dms' },
      saveScreen: vi.fn().mockResolvedValue({ effects: { toasts: [{ text: 'Inbox cleared', tone: 'success' }] }, newlyCompleted: [{ id: 'm1', name: 'Check the DMs' }] }),
    });
    render(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    await screen.findByAltText('DMs');
    fireEvent.click(screen.getByTitle(/Home/));
    expect(await screen.findByText('Inbox cleared')).toBeTruthy();
    expect(await screen.findByText(/Check the DMs/)).toBeTruthy();
  });
});

describe('play-through errors', () => {
  test('a refused tap is said on the phone, then cleared', async () => {
    const pt = playthroughWith({ error: 'zone is currently locked' });
    render(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    expect(await screen.findByText('Not saved: zone is currently locked')).toBeTruthy();
    expect(pt.clearError).toHaveBeenCalled();
  });
});
