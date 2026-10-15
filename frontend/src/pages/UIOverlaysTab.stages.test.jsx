/**
 * UIOverlaysTab — every Phone Hub view is reachable from a stage, and the
 * Preview stage saves nothing (Task #2010, doctrine rule 18).
 *
 * Real stage row, real PhoneHub and the real embedded Preview phone; the
 * workspaces not under test are stubbed to markers.
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
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => <div data-testid="view-zones" /> }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => <div data-testid="view-content" /> }));
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW,
  screen_links: [{ id: 'z-calls', x: 8, y: 14, w: 12, h: 9, target: 'calls', label: 'Open calls' }],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };

beforeEach(() => {
  vi.clearAllMocks();
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
const row = () => within(document.querySelector('.phone-hub-stage-row'));
const stage = (name) => fireEvent.click(row().getByRole('button', { name }));
const embedded = () => document.querySelector('[data-embedded="true"]');

describe('UIOverlaysTab — stages (Task #2010)', () => {
  test('Build shows the screens grid with the phone, and its toggle reaches the icons grid', async () => {
    await renderPage();
    expect(document.querySelector('.phone-hub-device .phone-hub-frame')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Build' })).getByRole('button', { name: /^Icons/ }));
    await waitFor(() => expect(document.querySelector('.phone-hub-icon-grid')).toBeTruthy());
    expect(document.querySelector('.phone-hub-screen-grid')).toBeNull();
  });

  test('Connect opens the zone workspace; Content the content workspace', async () => {
    await renderPage();
    stage('Connect');
    expect(await screen.findByTestId('view-zones')).toBeTruthy();
    stage('Content');
    expect(await screen.findByTestId('view-content')).toBeTruthy();
    expect(screen.queryByTestId('view-zones')).toBeNull();
  });

  // The phone on its own, large and centred (Evoni, 2026-10-15: "I thought
  // preview would enlarge it and I would just see the phone").
  test('Preview shows the phone on its own, with the screen it starts on picked above it', async () => {
    await renderPage();
    stage('Preview');
    await waitFor(() => expect(embedded()).toBeTruthy());
    const stageEl = document.querySelector('.phone-preview-stage');
    expect(stageEl.contains(embedded())).toBe(true);
    expect(stageEl.querySelectorAll('.phone-hub-frame')).toHaveLength(1);
    expect(screen.getByText('Tap the icons on the phone to try it. Nothing here is saved.')).toBeTruthy();
    // No screen grid, and no Producer Mode phone beside it.
    expect(document.querySelector('.phone-hub-screen-grid')).toBeNull();
    expect(document.querySelector('.phone-hub-device')).toBeNull();
    expect(within(stageEl).getByAltText('Homepage')).toBeTruthy();
    const start = within(stageEl).getByRole('combobox');
    expect(Array.from(start.options).map(o => o.textContent)).toEqual(['Homepage', 'calls list']);
  });

  test('Preview sends no request: entering, tapping through and picking a start screen', async () => {
    await renderPage();
    const before = ['get', 'post', 'put', 'patch', 'delete'].map(m => vi.mocked(api[m]).mock.calls.length);
    stage('Preview');
    await waitFor(() => expect(embedded()).toBeTruthy());
    const phone = () => within(document.querySelector('.phone-preview-stage'));
    fireEvent.click(phone().getByTitle('Open calls'));
    await waitFor(() => expect(phone().getByAltText('calls list')).toBeTruthy());
    // Picking a start screen restarts the phone there.
    fireEvent.change(phone().getByRole('combobox'), { target: { value: 'home' } });
    await waitFor(() => expect(phone().getByAltText('Homepage')).toBeTruthy());
    fireEvent.change(phone().getByRole('combobox'), { target: { value: 'calls' } });
    await waitFor(() => expect(phone().getByAltText('calls list')).toBeTruthy());
    const after = ['get', 'post', 'put', 'patch', 'delete'].map(m => vi.mocked(api[m]).mock.calls.length);
    expect(after).toEqual(before);
  });

  test('leaving Preview brings the Producer Mode phone back', async () => {
    await renderPage();
    stage('Preview');
    await waitFor(() => expect(embedded()).toBeTruthy());
    stage('Build');
    await waitFor(() => expect(embedded()).toBeNull());
    expect(document.querySelector('.phone-hub-device .phone-hub-frame')).toBeTruthy();
  });
});
