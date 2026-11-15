/**
 * The Roadmap's three links to an Event Package name the season they were
 * opened from (Evoni, 2026-11-15, Producer Mode PR A), so the package's
 * "Back to E… on the Roadmap" returns to a past season's Roadmap and not the
 * one in progress: the slot card's ⋯ menu, and the slot panel's link for a
 * started slot and for a pencilled one.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SlotCard } from './SeasonPageRoadmap';
import { SlotPanel } from './SeasonPlan';
import { parseFrom, returnLink } from '../../lib/eventFlow';

const started = {
  id: 'slot-4', slot_number: 4, phase: 2, label: 'S2 · E4', state: 'in_production', locked: true,
  episode: { id: 'ep-4', title: 'Gala Night', status: 'draft' }, event: { id: 'ev-4', name: 'Velour Night', status: 'used' },
  event_view: { event: { id: 'ev-4', name: 'Velour Night' }, source: 'episode', pencilled_event: null, needs_review: false, review_reasons: [], pencil_disagrees: false },
  intention: {}, result: {},
};
const pencilled = {
  id: 'slot-5', slot_number: 5, phase: 2, label: 'S2 · E5', state: 'event_ready', locked: false,
  episode: null, event: { id: 'ev-5', name: 'Brunch', status: 'ready' },
  event_view: { event: { id: 'ev-5', name: 'Brunch' }, source: 'pencil', pencilled_event: { id: 'ev-5', name: 'Brunch' }, needs_review: false, review_reasons: [], pencil_disagrees: false },
  intention: {}, result: {},
};
const back = (href) => returnLink(parseFrom(new URL(href, 'http://x').searchParams.get('from')), { showId: 'show-1' }).href;
const card = (season) => render(
  <MemoryRouter><SlotCard slot={started} showId="show-1" onOpen={vi.fn()} onIntention={vi.fn()} season={season} /></MemoryRouter>,
);
const panel = (slot, season) => render(
  <MemoryRouter><SlotPanel slot={slot} showId="show-1" available={[]} busy={false} episode={null} event={null} onPencil={vi.fn()} onIntention={vi.fn()} readOnly season={season} /></MemoryRouter>,
);

describe('the Roadmap\'s Event Package links', () => {
  test('the slot card\'s menu: a past season is named, and the package returns to it', () => {
    card(2);
    fireEvent.click(screen.getByTestId('szn-slot-menu-4'));
    const href = within(screen.getByRole('menu')).getByTestId('szn-slot-package-4').getAttribute('href');
    expect(href).toBe('/shows/show-1/events/ev-4?from=roadmap:4@2');
    expect(back(href)).toBe('/shows/show-1/season?tab=roadmap&season=2&slot=4');
  });

  test('the slot panel, a started slot: the same', () => {
    panel(started, 2);
    const href = screen.getByTestId('season-slot-package-4').getAttribute('href');
    expect(href).toBe('/shows/show-1/events/ev-4?from=roadmap:4@2');
    expect(back(href)).toBe('/shows/show-1/season?tab=roadmap&season=2&slot=4');
  });

  test('the slot panel, a pencilled slot: the same', () => {
    panel(pencilled, 3);
    const href = screen.getByTestId('season-slot-pencil-package-5').getAttribute('href');
    expect(href).toBe('/shows/show-1/events/ev-5?from=roadmap:5@3');
    expect(back(href)).toBe('/shows/show-1/season?tab=roadmap&season=3&slot=5');
  });

  test('with no season known the link is as it was: the slot, and the season in progress', () => {
    card(null);
    fireEvent.click(screen.getByTestId('szn-slot-menu-4'));
    const href = within(screen.getByRole('menu')).getByTestId('szn-slot-package-4').getAttribute('href');
    expect(href).toBe('/shows/show-1/events/ev-4?from=roadmap:4');
    expect(back(href)).toBe('/shows/show-1/season?tab=roadmap&slot=4');
  });
});
