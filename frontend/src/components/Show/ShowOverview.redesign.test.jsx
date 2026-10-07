/**
 * The Overview to Evoni's redesign (2026-10-05): one next step, the episode
 * in production with the checklist its Production tab shows, and the
 * episode's money from its linked event's forecast.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn() }));

import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import ShowOverview, { nextStepFor, checklistSummary } from './ShowOverview';
import { CHECKLIST_SECTIONS } from '../Episodes/EpisodeProductionChecklist';

const EP = { id: 'ep-1', episode_number: 1, season_number: 1, status: 'draft', title: 'I Designed My Outfit' };
const all = (pred) => Object.fromEntries(CHECKLIST_SECTIONS.flatMap((s) => s.items).filter(pred).map((i) => [i.id, true]));

describe('nextStepFor', () => {
  test('the first production step still missing a required item, with its fix link', () => {
    const checks = all((i) => !['wardrobe_ready'].includes(i.id));
    const step = nextStepFor({ showId: 'show-1', producing: [EP], checks });
    expect(step.title).toBe('Finish Wardrobe & Outfit for Episode 1');
    expect(step.detail).toBe('Still needed: required wardrobe slots covered.');
    expect(step.action).toEqual({ href: '/shows/show-1/world?tab=wardrobe-items', label: 'Upload' });
  });

  test('every required item done: the script; checks not loaded yet: continue', () => {
    expect(nextStepFor({ showId: 's', producing: [EP], checks: all(() => true) }).action).toEqual({ href: '/episodes/ep-1?tab=scripts', label: 'Open the script' });
    expect(nextStepFor({ showId: 's', producing: [EP], checks: null }).action).toEqual({ href: '/episodes/ep-1', label: 'Continue episode' });
  });

  test('nothing in production: a ready event, then an event to set up, then the season; a new show none', () => {
    expect(nextStepFor({ showId: 's', nextEvent: { id: 'e1', name: 'Velvet Hour' } }).title).toBe('Start an episode from Velvet Hour');
    const setup = nextStepFor({ showId: 's', attention: [{ event: { id: 'e2', name: 'Gala' }, missing: ['Organizer'] }] });
    expect(setup).toMatchObject({ title: 'Finish setting up Gala', detail: 'Missing: Organizer.', action: { href: '/shows/s/events/e2' } });
    expect(nextStepFor({ showId: 's' }).action).toEqual({ goTo: 'season', label: 'Season Plan' });
    expect(nextStepFor({ showId: 's', isNew: true })).toBeNull();
  });
});

describe('checklistSummary', () => {
  test('counts the live sections\' items and labels each section', () => {
    const live = CHECKLIST_SECTIONS.filter((s) => !s.unavailableReason);
    const total = live.flatMap((s) => s.items).length;
    const brief = live.find((s) => s.id === 'brief');
    const checks = Object.fromEntries(brief.items.map((i) => [i.id, true]));
    checks.event_linked = true;
    const sum = checklistSummary(checks);
    expect(sum.total).toBe(total);
    expect(sum.done).toBe(brief.items.length + 1);
    expect(sum.sections.map((s) => s.id)).toEqual(live.map((s) => s.id));
    expect(sum.sections.find((s) => s.id === 'brief').label).toBe('Complete');
    expect(sum.sections.find((s) => s.id === 'world').label).toBe('Complete');
    expect(sum.sections.find((s) => s.id === 'scene').label).toBe('Not started');
    // Only an optional item done: in progress, none of its required done.
    expect(checklistSummary({ wardrobe_inventory: true }).sections.find((s) => s.id === 'wardrobe')).toMatchObject({ state: 'in_progress', label: '0 of 1' });
  });
});

describe('ShowOverview, an episode in production', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(getEpisodeAnchorEvent).mockResolvedValue({ id: 'ev-9', name: 'Studio Session' });
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/season/roadmap')) return { data: { roadmap: null } };
      if (url === '/api/v1/world/show-1/events/ev-9/financial-forecast') {
        return { data: { success: true, income: { total: 600 }, expenses: { total: 450, outfit_retail: 300, outfit_rentals: 50 }, projected_balance: { baseline: 2050 } } };
      }
      return { data: {} };
    });
  });

  test('the banner, the card, the checklist and the money', async () => {
    render(<MemoryRouter><ShowOverview showId="show-1" episodes={[EP]} events={[]} goTo={() => {}} /></MemoryRouter>);
    const card = screen.getByTestId('sov-producing');
    expect(card.textContent).toContain('I Designed My Outfit');
    expect(card.textContent).toContain('Season 1 · Episode 1');
    expect(within(card).getByRole('link', { name: 'Open script' }).getAttribute('href')).toBe('/episodes/ep-1?tab=scripts');
    // The checks load: nothing set up but the linked event. Seven steps:
    // Lala's Phone is a live section since the checklist fixes (2026-10-07).
    await waitFor(() => expect(screen.getByTestId('sov-checklist').querySelectorAll('.sov-step')).toHaveLength(7));
    expect(screen.getByTestId('sov-next-step').textContent).toContain('Finish Episode Brief for Episode 1');
    const money = screen.getByTestId('sov-money');
    await waitFor(() => expect(money.textContent).toContain('+600'));
    expect(money.textContent).toContain('−350'); // the look: retail plus rentals
    expect(money.textContent).toContain('−100'); // the rest of the spending
    expect(money.textContent).toContain('2,050');
  });

  test('no linked event: the money card says so', async () => {
    vi.mocked(getEpisodeAnchorEvent).mockResolvedValue(null);
    render(<MemoryRouter><ShowOverview showId="show-1" episodes={[EP]} events={[]} goTo={() => {}} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('sov-money').textContent).toContain('No event is linked to this episode yet'));
  });
});
