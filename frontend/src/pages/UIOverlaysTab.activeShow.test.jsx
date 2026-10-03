/**
 * The standalone Lala's Phone page (/phone-hub) opens on the active show
 * (utils/activeShow) rather than the first show the API returns; with
 * several shows and none active it asks (audit CTX-01); a show chosen there
 * becomes the active show.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/PhoneHub', () => ({ default: () => <div data-testid="phone-hub" /> }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';
import { rememberShow, rememberedShowId } from '../utils/activeShow';

const SHOWS = [{ id: 'show-a', name: 'Another Show' }, { id: 'show-b', name: 'Styling Adventures' }];
const overlayLoads = () => vi.mocked(api.get).mock.calls.map(([u]) => u).filter((u) => u.startsWith('/api/v1/ui-overlays/'));

describe('UIOverlaysTab standalone: the active show', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => (
      url === '/api/v1/shows' ? { data: { success: true, data: SHOWS } } : { data: { success: true, data: [], missions: [] } }
    ));
  });

  test('opens on the show last opened, not the first one returned', async () => {
    rememberShow('show-b');
    render(<UIOverlaysTab />);
    await waitFor(() => expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-b'))).toBe(true));
    expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-a'))).toBe(false);
  });

  test('with several shows and none active it asks which, loading nothing; the choice becomes the active show (audit CTX-01)', async () => {
    render(<UIOverlaysTab />);
    const chooser = await screen.findByTestId('show-chooser');
    expect(chooser.textContent).toContain('Another Show');
    expect(overlayLoads()).toEqual([]);
    fireEvent.click(screen.getByTestId('show-chooser-show-b'));
    await waitFor(() => expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-b'))).toBe(true));
    expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-a'))).toBe(false);
    expect(rememberedShowId()).toBe('show-b');
    expect(screen.queryByTestId('show-chooser')).toBeNull();
  });

  test('the only show opens without asking', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (
      url === '/api/v1/shows' ? { data: { data: [SHOWS[1]] } } : { data: { success: true, data: [], missions: [] } }
    ));
    render(<UIOverlaysTab />);
    await waitFor(() => expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-b'))).toBe(true));
    expect(screen.queryByTestId('show-chooser')).toBeNull();
  });

  test('the header select still switches shows and makes the choice the active show', async () => {
    rememberShow('show-a');
    render(<UIOverlaysTab />);
    await waitFor(() => expect(overlayLoads().some((u) => u.startsWith('/api/v1/ui-overlays/show-a'))).toBe(true));
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'show-b' } });
    expect(rememberedShowId()).toBe('show-b');
  });
});
