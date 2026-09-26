/**
 * PhonePreviewMode — behaviour pins (Task #1990, C2).
 *
 * Written before the Preview draws through PhoneDevice, and required to pass
 * unchanged after it. The Preview's look is allowed to change (doctrine rule
 * 10), so these pin what it does, not its markup: taps, back, home, locked
 * zones, missions, playthrough, close and the breadcrumb.
 *
 * ScreenContentRenderer and PhoneMapView are stubbed because they fetch; the
 * Preview does not use them before C2, and the stubs are harmless there.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({
  default: () => <div data-testid="content-renderer" />,
}));

vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

import PhonePreviewMode from './PhonePreviewMode';

const HOME = {
  id: 'home', name: 'Home', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 'show-1',
  screen_links: [
    { id: 'z-dm', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages' },
    { id: 'z-locked', x: 40, y: 20, w: 15, h: 10, target: 'dms', label: 'Secret',
      conditions: [{ key: 'unlocked', op: 'eq', value: true }] },
    { id: 'z-flag', x: 70, y: 20, w: 15, h: 10, label: 'Look',
      actions: [{ type: 'set_state', key: 'seen', value: true }] },
  ],
};
const DMS = {
  id: 'dms', name: 'DMs', generated: true, url: 'https://x/dms.png', show_id: 'show-1', screen_links: [],
};
const SCREENS = [HOME, DMS];
const MISSION = {
  id: 'm1', name: 'First look',
  objectives: [{ id: 'o1', label: 'Look once', condition: [{ key: 'seen', op: 'eq', value: true }] }],
};

function renderPreview(props = {}) {
  return render(
    <PhonePreviewMode screens={SCREENS} initialScreen={HOME} onClose={() => {}} {...props} />,
  );
}

async function goToDms() {
  fireEvent.click(screen.getByTitle('Messages'));
  await screen.findByAltText('DMs');
}

afterEach(() => cleanup());

describe('PhonePreviewMode behaviour (Task #1990)', () => {
  test('a zone tap navigates to its target', async () => {
    renderPreview();
    expect(screen.getByAltText('Home')).toBeTruthy();
    await goToDms();
    expect(screen.queryByAltText('Home')).toBeNull();
  });

  test('back returns to the previous screen', async () => {
    renderPreview();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await goToDms();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByAltText('Home');
  });

  test('home returns to the first screen', async () => {
    renderPreview();
    await goToDms();
    fireEvent.click(screen.getByTitle('Home'));
    await screen.findByAltText('Home');
  });

  test('a locked zone is not rendered until its condition holds', () => {
    renderPreview();
    expect(screen.getByTitle('Messages')).toBeTruthy();
    expect(screen.queryByTitle('Secret')).toBeNull();
  });

  test('a mission completes on its condition', async () => {
    renderPreview({ missions: [MISSION] });
    expect(screen.getByText('0/1')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Look'));
    await screen.findByText(/MISSION COMPLETE/);
    expect(screen.getByText('First look')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  test('with a playthrough, a tap goes to its tap handler', async () => {
    const state = { state_flags: {}, visited_screens: [], completed_mission_ids: [] };
    const playthrough = {
      state,
      tap: vi.fn().mockResolvedValue({ state, effects: { navigate: 'dms', toasts: [] } }),
      reset: vi.fn(),
    };
    renderPreview({ playthrough });
    fireEvent.click(screen.getByTitle('Messages'));
    expect(playthrough.tap).toHaveBeenCalledWith('z-dm');
    await screen.findByAltText('DMs');
  });

  test('the Close control and ESC call onClose', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });
    fireEvent.click(screen.getByTitle('Close (ESC)'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('the breadcrumb shows the path', async () => {
    renderPreview();
    await goToDms();
    expect(screen.getByText('>')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getAllByText('DMs').length).toBeGreaterThan(0);
  });
});
