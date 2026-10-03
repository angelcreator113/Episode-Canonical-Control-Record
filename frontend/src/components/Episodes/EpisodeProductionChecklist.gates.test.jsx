/**
 * Readiness gates (audit GATE-01, GATE-02; 2026-10-03): "Scene plan
 * generated (14 beats)" follows the server's beat coverage, not a row
 * count; "Required wardrobe slots covered" follows the show's slot
 * coverage, not "any piece exists".
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => null) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';

let plan;
let coverage;
let slotCoverage;
const renderChecklist = () => render(
  <MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1' }} showId="show-1" /></MemoryRouter>,
);
const planItem = () => screen.findByText(/^Scene plan generated \(14 beats\)/);
const slotsItem = () => screen.findByText(/^Required wardrobe slots covered/);
const inventoryItem = () => screen.findByText(/^Wardrobe pieces uploaded/);

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: plan, coverage, readiness: { ready: plan.length, total: plan.length, not_ready: [] } } };
    if (url === '/api/v1/wardrobe/slot-coverage?show_id=show-1') return { data: { data: slotCoverage } };
    return { data: {} };
  });
  slotCoverage = { inventory: 0, covered: false, missing: ['outfit', 'shoes'], text: 'No wardrobe pieces uploaded' };
});

describe('GATE-01: the 14-beat plan', () => {
  test('one beat is not a plan: required, unticked, the missing beats named, and the next step is the plan', async () => {
    plan = [{ beat_number: 1, locked: true }];
    coverage = { complete: false, present: 1, expected: 14, missing: [2, 3], duplicates: [], unknown: 0, text: '1 of 14 beats · missing beats 2 and 3' };
    renderChecklist();
    const label = await planItem();
    expect(label.style.textDecoration).toBe('none');
    expect(label.textContent).toMatch(/required/i);
    expect((await screen.findByTestId('check-note-scene_plan')).textContent).toBe('1 of 14 beats · missing beats 2 and 3');
    expect((await screen.findByTestId('checklist-scene-next')).textContent).toContain('Next: Complete the beat plan: 1 of 14 beats · missing beats 2 and 3');
    // Locks never count before the plan is whole.
    expect((await screen.findByText(/^Scene plan locked/)).style.textDecoration).toBe('none');
  });

  test('fourteen beats, once each, is the plan', async () => {
    plan = Array.from({ length: 14 }, (_, i) => ({ beat_number: i + 1, locked: true }));
    coverage = { complete: true, present: 14, expected: 14, missing: [], duplicates: [], unknown: 0, text: '14 of 14 beats' };
    renderChecklist();
    await waitFor(async () => expect((await planItem()).style.textDecoration).toBe('line-through'));
    expect(screen.queryByTestId('check-note-scene_plan')).toBeNull();
    expect((await screen.findByText(/^Scene plan locked/)).style.textDecoration).toBe('line-through');
  });

  test('rows without a coverage result are not taken as a plan', async () => {
    plan = Array.from({ length: 14 }, (_, i) => ({ beat_number: i + 1, locked: false }));
    coverage = undefined;
    renderChecklist();
    expect((await planItem()).style.textDecoration).toBe('none');
    expect((await screen.findByTestId('check-note-scene_plan')).textContent).toBe('Beat coverage was not reported');
  });
});

describe('GATE-02: required wardrobe slots', () => {
  beforeEach(() => {
    plan = [];
    coverage = { complete: false, present: 0, expected: 14, missing: [], duplicates: [], unknown: 0, text: '0 of 14 beats' };
  });

  test('one piece is inventory, not coverage: the missing slots are named', async () => {
    slotCoverage = { inventory: 1, covered: false, missing: ['outfit', 'jewelry'], text: 'Missing required slots: outfit, jewelry' };
    renderChecklist();
    await waitFor(async () => expect((await inventoryItem()).style.textDecoration).toBe('line-through'));
    const slots = await slotsItem();
    expect(slots.style.textDecoration).toBe('none');
    expect(slots.textContent).toMatch(/required/i);
    expect((await screen.findByTestId('check-note-wardrobe_ready')).textContent).toBe('Missing required slots: outfit, jewelry');
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url.startsWith('/api/v1/wardrobe?'))).toBe(false);
  });

  test('every required slot with a piece is covered', async () => {
    slotCoverage = { inventory: 5, covered: true, missing: [], text: 'Required slots covered: outfit, shoes' };
    renderChecklist();
    await waitFor(async () => expect((await slotsItem()).style.textDecoration).toBe('line-through'));
    expect(screen.queryByTestId('check-note-wardrobe_ready')).toBeNull();
  });

  test('a failed read is not an empty wardrobe', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.startsWith('/api/v1/wardrobe/slot-coverage')) throw new Error('boom');
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: [], coverage } };
      return { data: {} };
    });
    renderChecklist();
    expect((await screen.findByTestId('check-note-wardrobe_ready')).textContent).toBe('Wardrobe could not be read');
    expect((await slotsItem()).style.textDecoration).toBe('none');
    spy.mockRestore();
  });
});
