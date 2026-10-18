/**
 * Scene Sets seventh audit (2026-10-18): features that held alone but broke
 * together in the open panel.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import { ApprovedBaseRow, usesText } from './SceneSetsTab';
import { UsePhotosFromSet, EventPhotosSet } from '../components/SceneSets/EventPhotos';
import LookVariants from '../components/SceneSets/LookVariants';
import DressedAngles from '../components/SceneSets/DressedAngles';
import EventLookImage from '../components/EventPackage/EventLookImage';

describe('Scene Sets seventh audit', () => {
  beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

  test('an event version is not offered as the location\'s everyday look', () => {
    const { container } = render(<ApprovedBaseRow set={{ id: 'v', name: 'Gala', world_location_id: 'loc', base_still_url: 'x', version_of: { id: 'e', name: 'Bedroom' } }} />);
    expect(container.textContent).not.toMatch(/everyday look/);
  });

  test("the location's everyday look is not offered as one event's photos, saying why", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { everyday_sets: [{ id: 'set-9', name: 'Atelier', is_everyday_look: true }], events: [] } } });
    render(<MemoryRouter><UsePhotosFromSet set={{ id: 'set-1', name: 'Studio' }} event={{ id: 'ev-1', name: 'Gala' }} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('event-photos-use-ev-1'));
    const option = await screen.findByRole('option', { name: /Atelier/ });
    expect(option.disabled).toBe(true);
    expect(option.textContent).toMatch(/the location's everyday look/);
  });

  test("a locked event's photos are not offered \"Stop using these photos\"; the links open the other set's panel and close this one", () => {
    const onLeave = vi.fn();
    render(<MemoryRouter><EventPhotosSet photosSet={{ id: 'v1', name: 'Gala photos' }} showId="show-1" event={{ id: 'ev-1', name: 'Gala', locked: true }} onLeave={onLeave} /></MemoryRouter>);
    expect(screen.queryByTestId('event-photos-stop-v1')).toBeNull();
    expect(screen.getByTestId('event-photos-locked-v1').textContent).toMatch(/place is locked/);
    const link = screen.getByTestId('event-photos-open-v1');
    expect(link.getAttribute('href')).toMatch(/set=v1&zone=place/);
    fireEvent.click(link);
    expect(onLeave).toHaveBeenCalled();
  });

  test('an everyday set\'s event versions are named among its uses', () => {
    expect(usesText({ versions: 2, events: 1 })).toBe('Used by 1 event, 2 event versions.');
  });

  test('Times & Weather, an event\'s look and the dressed angles read again when their refresh key changes', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: null } });
    const count = (part) => vi.mocked(api.get).mock.calls.filter(([u]) => String(u).includes(part)).length;

    const lv = render(<LookVariants setId="set-1" pollMs={60000} refreshKey="a" />);
    await waitFor(() => expect(count('set-1')).toBe(1));
    lv.rerender(<LookVariants setId="set-1" pollMs={60000} refreshKey="b" />);
    await waitFor(() => expect(count('set-1')).toBe(2));
    lv.unmount();

    const el = render(<MemoryRouter><EventLookImage showId="show-1" eventId="ev-7" pollMs={60000} refreshKey="a" /></MemoryRouter>);
    await waitFor(() => expect(count('ev-7')).toBeGreaterThanOrEqual(1));
    const before = count('ev-7');
    el.rerender(<MemoryRouter><EventLookImage showId="show-1" eventId="ev-7" pollMs={60000} refreshKey="b" /></MemoryRouter>);
    await waitFor(() => expect(count('ev-7')).toBeGreaterThan(before));
    el.unmount();

    const da = render(<DressedAngles episodeId="ep-3" setId="set-3" pollMs={60000} refreshKey="a1" />);
    await waitFor(() => expect(count('ep-3')).toBeGreaterThanOrEqual(1));
    const first = count('ep-3');
    da.rerender(<DressedAngles episodeId="ep-3" setId="set-3" pollMs={60000} refreshKey="a1,a2" />);
    await waitFor(() => expect(count('ep-3')).toBeGreaterThan(first));
  });
});
