/**
 * Phone round step 1 (Evoni, 2026-10-25): the health check names links to a
 * screen the phone doesn't have (D1): a zone's Go to action, which wins over
 * its target on the phone, and a mission that needs the screen. A failed
 * read of the screens says why, not an empty phone (D4).
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SHOW = 's-1';
const z = (id, target, label, extra = {}) => ({ id, x: 10, y: 20, w: 12, h: 9, target, label, ...extra });
const scr = (id, name, links = [], extra = {}) => ({ id, name, category: 'phone', generated: true, url: `https://x/${id}.png`, asset_id: `a-${id}`, show_id: SHOW, screen_links: links, custom: true, custom_id: `c-${id}`, ...extra });
// "Messages" targets the Closet, but its own Go to action opens "dms",
// which was deleted.
const HOME = scr('home', 'Homepage', [z('z1', 'closet', 'Messages', { actions: [{ type: 'navigate', target: 'dms' }] }), z('z2', 'closet', 'Closet')], { is_home: true });
const CLOSET = scr('closet', 'Closet', [z('z3', 'home', 'Back')]);
const MISSIONS = [
  { id: 'm1', name: 'Read the DMs', episode_id: 'ep-1', objectives: [{ id: 'o1', label: 'Open the DMs', condition: [{ key: 'visited:dms', op: 'eq', value: true }] }], reward_actions: [] },
  { id: 'm2', name: 'Get dressed', episode_id: 'ep-1', objectives: [{ id: 'o2', label: 'Dress', condition: [{ key: 'visited:closet', op: 'eq', value: true }] }], reward_actions: [{ type: 'navigate', target: 'dms' }] },
  { id: 'm3', name: 'All fine', episode_id: 'ep-1', objectives: [{ id: 'o3', label: 'Home', condition: [{ key: 'visited:home', op: 'eq', value: true }] }], reward_actions: [] },
];

function mockApi({ items = [HOME, CLOSET], missions = MISSIONS } = {}) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: items } };
    if (url === `/api/v1/ui-overlays/${SHOW}/missions`) return { data: { success: true, missions } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderHub(opts) {
  mockApi(opts);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}

describe('health check: links to a screen that is gone (D1)', () => {
  test("a zone's Go to action to a missing screen is named in Things to check", async () => {
    await renderHub();
    fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
    const checks = await screen.findByTestId('zones-checks');
    expect(within(checks).getByText(`"Messages" has a Go to action to a screen that isn't on the phone`)).toBeTruthy();
  });

  test('missions that need a missing screen are named, each with a link to its episode', async () => {
    await renderHub();
    const panel = await screen.findByTestId('phone-mission-health');
    expect(panel.textContent).toContain("2 missions need a screen that isn't on the phone");
    expect(panel.textContent).toContain('Read the DMs: Open the DMs asks for a visit to "dms"');
    expect(panel.textContent).toContain('Get dressed: its reward opens "dms"');
    expect(panel.textContent).not.toContain('All fine');
    expect(within(panel).getAllByRole('link', { name: 'Open its episode' })[0].getAttribute('href')).toBe('/episodes/ep-1?tab=phone');
  });

  test('with every screen there, nothing is flagged', async () => {
    await renderHub({ items: [HOME, CLOSET, scr('dms', 'DMs')] });
    expect(screen.queryByTestId('phone-mission-health')).toBeNull();
  });

  test('deleting a screen the server reports missions for says so', async () => {
    mockApi();
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true, data: { deletedKey: 'closet', zonesRemoved: 2, navigateActionsRemoved: 0, missionRewardsRemoved: 0, missionsFlagged: [{ id: 'm2', name: 'Get dressed' }] } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
    const card = within(document.querySelector('.phone-hub-screen-grid')).getByText('Closet').closest('.screen-card');
    fireEvent.click(within(card).getByLabelText('Screen options'));
    fireEvent.click(within(card).getByText('Delete'));
    expect(await screen.findByText(/1 mission asks for a visit to it/)).toBeTruthy();
    expect(api.delete).toHaveBeenCalledWith(`/api/v1/ui-overlays/${SHOW}/types/c-closet`);
  });
});

describe('a failed read of the screens (D4)', () => {
  test("says the server's reason with Try again, not an empty phone", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === `/api/v1/ui-overlays/${SHOW}`) {
        throw Object.assign(new Error('Request failed with status code 500'), { response: { status: 500, data: { success: false, error: "Could not read the phone's screens: connection reset" } } });
      }
      if (url === `/api/v1/ui-overlays/${SHOW}/missions`) return { data: { success: true, missions: MISSIONS } };
      return { data: { success: true, data: [], missions: [] } };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<UIOverlaysTab showId={SHOW} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("The phone's screens didn't load: Could not read the phone's screens: connection reset");
    expect(within(alert).getByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(document.querySelector('.phone-hub-screen-grid')).toBeNull();
    // The missions aren't checked against a phone that didn't load.
    expect(screen.queryByTestId('phone-mission-health')).toBeNull();
  });
});
