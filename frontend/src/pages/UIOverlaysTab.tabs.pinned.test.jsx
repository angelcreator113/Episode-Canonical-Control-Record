/**
 * UIOverlaysTab — the Phone Hub's tab keys and their views, pinned before the
 * stage shell (Task #2010, doctrine rule 18, step 1).
 *
 * Written on main and required to pass unchanged after the tab row becomes
 * Build · Connect · Content · Preview · Advanced. The row is stubbed to one
 * button per activeTab key, so these tests pin the page's key → view wiring,
 * not the row's labels: screens and icons open PhoneHub's grids, zones the
 * zone workspace, content the content workspace, missions the missions
 * editor; closing missions returns to screens; PhoneHub's onEditZones reaches
 * zones.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

const KEYS = ['screens', 'icons', 'zones', 'content', 'missions'];
vi.mock('../components/PhoneHubSectionTabs', () => ({
  default: ({ activeTab, onChangeTab }) => (
    <div data-testid="tab-row" data-active={activeTab}>
      {['screens', 'icons', 'zones', 'content', 'missions'].map((k) => (
        <button key={k} type="button" onClick={() => onChangeTab(k)}>{`tab-${k}`}</button>
      ))}
    </div>
  ),
}));

let hubProps = null;
vi.mock('../components/PhoneHub', async (importOriginal) => {
  const actual = await importOriginal();
  const Real = actual.default;
  return { ...actual, default: (props) => { hubProps = props; return <Real {...props} />; } };
});

vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => <div data-testid="view-zones" /> }));
vi.mock('../components/IconPlacementMode', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => <div data-testid="view-content" /> }));
vi.mock('../components/phone-editor/MissionEditor', () => ({
  default: ({ open, onClose }) => (open ? (
    <div data-testid="view-missions"><button type="button" onClick={onClose}>close missions</button></div>
  ) : null),
}));
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: [] };
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };

beforeEach(() => {
  vi.clearAllMocks();
  hubProps = null;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
});
afterEach(() => cleanup());

async function renderPage() {
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}

const grid = (cls) => document.querySelector(`.phone-hub-${cls}-grid`);
const views = () => ({
  screens: !!grid('screen'),
  icons: !!grid('icon'),
  zones: !!screen.queryByTestId('view-zones'),
  content: !!screen.queryByTestId('view-content'),
  missions: !!screen.queryByTestId('view-missions'),
});
const only = (key) => Object.fromEntries(KEYS.map((k) => [k, k === key]));

describe('UIOverlaysTab — tab keys open their views, pinned (Task #2010)', () => {
  test('the page opens on screens', async () => {
    await renderPage();
    expect(screen.getByTestId('tab-row').getAttribute('data-active')).toBe('screens');
    expect(views()).toEqual(only('screens'));
  });

  test.each(KEYS)('%s opens its view', async (key) => {
    await renderPage();
    fireEvent.click(screen.getByText(`tab-${key}`));
    await waitFor(() => expect(screen.getByTestId('tab-row').getAttribute('data-active')).toBe(key));
    // Missions is a modal over the page; the page underneath shows no grid.
    expect(views()).toEqual(only(key));
  });

  test('closing missions returns to screens', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('tab-missions'));
    fireEvent.click(await screen.findByText('close missions'));
    await waitFor(() => expect(screen.getByTestId('tab-row').getAttribute('data-active')).toBe('screens'));
    expect(views()).toEqual(only('screens'));
  });

  test('PhoneHub\'s onEditZones reaches zones', async () => {
    await renderPage();
    act(() => { hubProps.onEditZones(); });
    await waitFor(() => expect(screen.getByTestId('tab-row').getAttribute('data-active')).toBe('zones'));
    expect(views()).toEqual(only('zones'));
  });
});
