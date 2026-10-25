/**
 * World moments (Evoni, 2026-10-18: "start the scheduled world moments"):
 * the coming week from the calendar, Draft these and Plan next week, the
 * automatic switch with the server's flag, and the calendar saved.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import WorldMomentsTab from './WorldMomentsTab';

const cities = {
  dazzle_district: [{ id: 'runway_thursday', label: 'Runway Thursday', every: 'week', weekday: 4, on: true }],
  radiance_row: [], echo_park: [], ascent_tower: [], maverick_harbor: [],
};
const view = (over = {}) => ({
  data: {
    success: true,
    settings: { auto_enabled: false, cities, press: { reyna_voss: { on: true, weekday: 1 }, solene_beaumont: { on: true, weekday: 5 }, taye_okafor: { on: true, weekday: 3 }, asha_brennan: { on: true, weekday: 0 } }, trends: { on: true, weekday: 2 }, award_shows: { on: true } },
    plan: {
      from: '2026-10-19', to: '2026-10-25', moments: [
        { key: 'press:reyna_voss:2026-10-19', kind: 'press', date: '2026-10-19', label: 'The Real Rate: the week\'s piece', detail: 'Reyna Voss on the week\'s beauty moments', drafted: null },
        { key: 'city_event:dazzle_district:runway_thursday:2026-10-22', kind: 'city_event', date: '2026-10-22', label: 'Runway Thursday · Dazzle District', detail: 'Weekly fashion showcase', drafted: { status: 'drafted' } },
      ],
    },
    recent: [{ key: 'city_event:dazzle_district:runway_thursday:2026-10-22', label: 'Runway Thursday · Dazzle District', date: '2026-10-22', status: 'drafted', ref: { type: 'world_event', id: 'e-1' } }],
    server: { world_moments_enabled: false, pulse_engine_enabled: false },
    ...over,
  },
});

const renderIt = () => render(<MemoryRouter><WorldMomentsTab showId="s-1" /></MemoryRouter>);

describe('WorldMomentsTab', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue(view());
  });

  test('the next 7 days by day: a drafted moment says where it is, an open one can be chosen and drafted', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, results: [{ key: 'press:reyna_voss:2026-10-19', status: 'queued' }], drafted: 1 } });
    renderIt();
    const drafted = await screen.findByTestId('wm-moment-city_event:dazzle_district:runway_thursday:2026-10-22');
    expect(drafted.textContent).toContain('Draft in Events');
    const press = screen.getByTestId('wm-moment-press:reyna_voss:2026-10-19');
    fireEvent.click(within(press).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Draft these \(1\)/ }));
    expect(await screen.findByText('1 post queued.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/world-moments/draft', { show_id: 's-1', keys: ['press:reyna_voss:2026-10-19'] });
  });

  test('Plan next week drafts what is open', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, results: [{ status: 'drafted' }, { status: 'queued' }], drafted: 2 } });
    renderIt();
    fireEvent.click(await screen.findByRole('button', { name: 'Plan next week' }));
    expect(await screen.findByText('1 event draft, 1 post queued.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/world-moments/plan-next-week', { show_id: 's-1' });
  });

  test('the automatic switch says it also needs the server flag; turning it on saves only the switch', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true } });
    renderIt();
    expect((await screen.findByTestId('wm-server-note')).textContent).toContain('WORLD_MOMENTS_ENABLED=true');
    fireEvent.click(screen.getByRole('checkbox', { name: /Draft the coming week/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/world-moments/settings', { show_id: 's-1', auto_enabled: true }));
  });

  test('the calendar: a city event made monthly and saved', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true } });
    renderIt();
    const dazzle = await screen.findByTestId('wm-city-dazzle_district');
    fireEvent.change(within(dazzle).getByLabelText('Runway Thursday how often'), { target: { value: 'month' } });
    fireEvent.click(screen.getByRole('button', { name: /Save the calendar/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = vi.mocked(api.put).mock.calls[0][1];
    expect(body.cities.dazzle_district[0]).toMatchObject({ label: 'Runway Thursday', every: 'month', week_of_month: 1 });
    expect(await screen.findByText('The calendar is saved.')).toBeTruthy();
  });

  test('lately: a drafted event links to Events', async () => {
    renderIt();
    const row = await screen.findByTestId('wm-recent-city_event:dazzle_district:runway_thursday:2026-10-22');
    expect(within(row).getByRole('link', { name: 'Open Events' }).getAttribute('href')).toBe('/shows/s-1/season?tab=events&show=all');
  });
});
