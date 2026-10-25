/**
 * Phone round step 1, D2 (Evoni, 2026-10-25): a mission finished by landing
 * on a screen can open another screen, as its reward does after a tap. The
 * reward's screen opens; a reward loop stops.
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

const S = (id, name, links = [], extra = {}) => ({ id, name, category: 'phone', generated: true, url: `https://x/${id}.png`, screen_links: links, ...extra });
const HOME = S('home', 'Home', [{ id: 'z-dm', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages' }], { is_home: true });
const DMS = S('dms', 'DMs');
const PRIZE = S('prize', 'Prize');
const ATTIC = S('attic', 'Attic');

const playthroughWith = (over) => ({
  state: { state_flags: {}, visited_screens: [], completed_mission_ids: [], last_screen_id: null },
  loading: false, error: null,
  tap: vi.fn(), reset: vi.fn(), saveScreen: vi.fn().mockResolvedValue({ effects: null, newlyCompleted: [] }), clearError: vi.fn(),
  ...over,
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('a reward that opens a screen on arrival (D2)', () => {
  test('landing on DMs finishes a mission whose reward opens Prize: the phone goes there', async () => {
    const saveScreen = vi.fn(async (id) => (id === 'dms'
      ? { effects: { navigate: 'prize', toasts: [] }, newlyCompleted: [{ id: 'm1', name: 'Check the DMs' }] }
      : { effects: null, newlyCompleted: [] }));
    const pt = playthroughWith({ saveScreen, tap: vi.fn().mockResolvedValue({ effects: { navigate: 'dms', toasts: [] }, state: null }) });
    render(<PhonePreviewMode screens={[HOME, DMS, PRIZE]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    fireEvent.click(await screen.findByTitle('Messages'));
    expect(await screen.findByAltText('Prize', {}, { timeout: 2000 })).toBeTruthy();
    expect(saveScreen).toHaveBeenCalledWith('dms');
    await waitFor(() => expect(saveScreen).toHaveBeenCalledWith('prize'));
  });

  test('a reward loop stops after a few screens', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Every screen's arrival opens the next one, round and round.
    const next = { dms: 'prize', prize: 'attic', attic: 'dms' };
    const saveScreen = vi.fn(async (id) => ({ effects: { navigate: next[id] || null, toasts: [] }, newlyCompleted: [] }));
    const pt = playthroughWith({ saveScreen, tap: vi.fn().mockResolvedValue({ effects: { navigate: 'dms', toasts: [] }, state: null }) });
    render(<PhonePreviewMode screens={[HOME, DMS, PRIZE, ATTIC]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    fireEvent.click(await screen.findByTitle('Messages'));
    // Home (opened), DMs (tapped), then prize → attic → dms (3 hops), and
    // it stops.
    await waitFor(() => expect(saveScreen).toHaveBeenCalledTimes(5), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 700));
    expect(saveScreen.mock.calls.map((c) => c[0])).toEqual(['home', 'dms', 'prize', 'attic', 'dms']);
    expect(screen.getByAltText('DMs')).toBeTruthy();
    expect(console.warn).toHaveBeenCalled();
  });

  test('a reward that names the screen already shown does nothing', async () => {
    const saveScreen = vi.fn(async (id) => ({ effects: { navigate: id === 'dms' ? 'dms' : null, toasts: [] }, newlyCompleted: [] }));
    const pt = playthroughWith({ saveScreen, tap: vi.fn().mockResolvedValue({ effects: { navigate: 'dms', toasts: [] }, state: null }) });
    render(<PhonePreviewMode screens={[HOME, DMS]} initialScreen={HOME} playthrough={pt} onClose={() => {}} />);
    fireEvent.click(await screen.findByTitle('Messages'));
    await screen.findByAltText('DMs');
    await new Promise((r) => setTimeout(r, 500));
    expect(saveScreen.mock.calls.map((c) => c[0])).toEqual(['home', 'dms']);
    expect(screen.getByAltText('DMs')).toBeTruthy();
  });
});
