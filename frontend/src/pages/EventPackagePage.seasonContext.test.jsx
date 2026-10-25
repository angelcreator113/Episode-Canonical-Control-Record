/**
 * Season Arc A4 (Evoni, 2026-10-01; EVENT_EPISODE_FLOW.md §8(ff)): "The Event
 * Package shows a small read-only Season Context block (season, phase, slot,
 * purpose). Season Arc provides intent; the Event Package owns the event's
 * facts."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
  updated_at: '2026-09-25T10:00:00.000Z', canon_consequences: { automation: {} },
};

function renderWith(context) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null } };
    }
    if (url === '/api/v1/world/show-1/season/event/ev-1') return { data: { success: true, context } };
    return { data: { success: true, deliverables: [], locked: false } };
  });
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage Season Context (§8(ff) A4)', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn?.mockReset?.()); });

  test('an event in a slot shows its season, phase, slot and purpose, read-only', async () => {
    renderWith({ in_slot: true, via: 'pencilled', label: 'S1 · E3', season_number: 1, phase: { number: 1, title: 'Foundation' }, story_purpose: 'Win the room' });

    const block = await screen.findByTestId('season-context');
    expect(within(block).getByText('S1 · E3')).toBeTruthy();
    expect(within(block).getByText(/Season 1 · Phase 1: Foundation · pencilled in/)).toBeTruthy();
    expect(within(block).getByText('Win the room')).toBeTruthy();
    expect(within(block).queryByRole('button')).toBeNull();
    expect(within(block).queryByRole('textbox')).toBeNull();
  });

  test('every purpose shows, primary first, with its thread, and the desired pressure (2026-10-25)', async () => {
    renderWith({
      in_slot: true, via: 'pencilled', label: 'S1 · E3', season_number: 1, phase: { number: 1, title: 'Foundation' },
      story_purpose: 'Win the room', desired_pressure: 'High',
      story_purposes: [
        { text: 'Win the room', primary: true, story_thread: null },
        { text: 'The rival notices her', primary: false, story_thread: 'The rival' },
        { text: '', primary: false, story_thread: 'Old debt' },
      ],
    });

    const block = await screen.findByTestId('season-context');
    const items = within(within(block).getByTestId('season-purposes')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['PrimaryWin the room', 'AlsoThe rival notices her · The rival', 'AlsoContinues Old debt']);
    expect(items[0].className).toBe('is-primary');
    expect(within(block).getByTestId('season-pressure').textContent).toBe('Desired pressure: High');
  });

  test('one purpose has no Primary tag; no pressure, no pressure line', async () => {
    renderWith({ in_slot: true, via: 'episode', label: 'S1 · E1', season_number: 1, phase: { number: 1, title: 'Foundation' },
      story_purposes: [{ text: 'Her first gala', primary: true, story_thread: null }] });
    const block = await screen.findByTestId('season-context');
    expect(within(block).getByTestId('season-purposes').textContent).toBe('Her first gala');
    expect(within(block).queryByTestId('season-pressure')).toBeNull();
  });

  test('an event in no slot names the next open slot and links to the roadmap', async () => {
    renderWith({ in_slot: false, season_number: 1, next_open: { label: 'S1 · E2', phase: { number: 1, title: 'Foundation' } } });

    const block = await screen.findByTestId('season-context');
    expect(block.textContent).toMatch(/Not on the roadmap yet; the next open slot is S1 · E2/);
    expect(block.textContent).toMatch(/Pencil it in on the Season page\./);
    expect(within(block).getByRole('link', { name: 'the Season page' }).getAttribute('href')).toBe('/shows/show-1/season?tab=roadmap');
  });

  test('a show with no season shows no block', async () => {
    renderWith(null);
    await screen.findByRole('heading', { name: 'Velour Awards Night' });
    expect(screen.queryByTestId('season-context')).toBeNull();
  });
});
