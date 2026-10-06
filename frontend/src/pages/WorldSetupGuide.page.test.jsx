/**
 * The World Setup Guide runs the LalaVerse Overview's checks
 * (WorldSetupProgress checkSetup, 2026-10-06): the routes' real shapes, the
 * active show rather than the first one, steps 1, 2 and 4 from the Brain
 * as well as saved edits, and "could not check" apart from "not done".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldSetupGuide from './WorldSetupGuide';

const respond = (url) => {
  if (url === '/api/v1/shows') return { data: { data: [{ id: 'show-a', name: 'Styling Adventures' }] } };
  if (url.includes('page-content/world_infrastructure')) return { data: { DREAM_CITIES: [{ name: 'Dazzle' }] } };
  if (url.includes('page-content/')) return { data: {} };
  if (url.includes('calendar/events')) return { data: { events: [] } };
  if (url.includes('world/locations')) return { data: { locations: [{ id: 1 }, { id: 2 }] } };
  if (url.includes('social-profiles')) return { data: { profiles: [{ id: 'p' }], pagination: { total: 13 } } };
  if (url.includes('/world/show-a/events')) return { data: { events: [{ id: 'e1' }] } };
  if (url.includes('franchise-brain/sync/status')) return { data: { data: { world_foundation: { cards: 0 }, social_systems: { cards: 14 }, cultural_memory: { cards: 0 } } } };
  return { data: {} };
};

describe('World Setup Guide', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => respond(url));
  });

  test('the same checks as the Overview: Brain, saved edits, real shapes, the active show', async () => {
    render(<MemoryRouter initialEntries={['/world-setup']}><WorldSetupGuide /></MemoryRouter>);
    expect(await screen.findByText('5/7')).toBeTruthy(); // memory and the calendar are not done
    expect(screen.getByTestId('guide-detail-infrastructure').textContent).toBe('Saved · 1 section');
    expect(screen.getByTestId('guide-detail-influencer').textContent).toBe('In the Brain · 14 cards');
    expect(screen.getByTestId('guide-detail-memory').textContent).toBe('Starter content only, not in the Brain yet');
    expect(screen.getByTestId('guide-detail-feed').textContent).toBe('13 profiles');
    expect(screen.getByTestId('guide-detail-calendar').textContent).toBe('0 cultural calendar events');
    const urls = vi.mocked(api.get).mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('/world/show-a/events?status=draft'))).toBe(true);
  });

  test("the steps name the Brain Update button, not the retired Push to Brain", async () => {
    render(<MemoryRouter initialEntries={['/world-setup']}><WorldSetupGuide /></MemoryRouter>);
    await screen.findByText('5/7');
    expect(screen.queryByText(/Push to Brain|Push each to Franchise Brain/)).toBeNull();
    expect(screen.getAllByText(/→ Brain Update/)).toHaveLength(3);
    expect(screen.getByText(/Brain Update \(Connect to Brain the first time\) copies the page into the Show Bible/)).toBeTruthy();
  });

  test('a check the server does not answer says "could not check"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('world/locations')) throw Object.assign(new Error('boom'), { response: { status: 500 } });
      return respond(url);
    });
    render(<MemoryRouter initialEntries={['/world-setup']}><WorldSetupGuide /></MemoryRouter>);
    expect(await screen.findByTestId('guide-unreachable-locations')).toBeTruthy();
    expect(screen.queryByTestId('guide-detail-locations')).toBeNull();
  });
});
