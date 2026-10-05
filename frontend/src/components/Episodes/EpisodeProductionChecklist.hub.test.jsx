/**
 * Production → Checklist as a hub (Evoni's Episode mock, 2026-10-05): the
 * progress card, the episode timeline from the production coverage (a row
 * per kind of piece, a column per beat, Lala's look on Beat 8), and a card
 * per section with where it is worked on.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => ({ id: 'ev-1', outfit_pieces: [] })) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';

const ind = (requirement, met) => ({ requirement, met, text: null });
const COVERAGE = { covered: 0, total: 2, beats: [
  { number: 1, name: 'Opening Ritual', indicators: { environment: ind('required', true), host: ind('required', false), character: ind('not_required', false), interface: ind('not_required', false) } },
  { number: 8, name: 'Transformation Loop', indicators: { environment: ind('required', false), host: ind('not_required', false), character: ind('required', null), interface: ind('required', true) } },
] };

const renderHub = () => {
  const onOpenTab = vi.fn();
  render(<MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala' }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
  return { onOpenTab };
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { arc_number: 1, position_in_arc: 1, episode_archetype: 'Trial', designed_intent: 'pass', narrative_purpose: 'x', forward_hook: 'y' } } };
    if (url === '/api/v1/episode-brief/ep-1/production-coverage') return { data: { success: true, data: COVERAGE } };
    return { data: {} };
  });
});

describe('Checklist hub', () => {
  test('the progress card counts the checks', async () => {
    renderHub();
    const summary = await screen.findByTestId('checklist-summary');
    await screen.findByTestId('episode-timeline-row-environment');
    expect(within(summary).getByTestId('checklist-count').textContent).toMatch(/^\d+ of 21$/);
  });

  test('the timeline: a cell per beat per row, and Lala\'s look on Beat 8', async () => {
    renderHub();
    const states = async (key) => [...(await screen.findByTestId(`episode-timeline-row-${key}`)).querySelectorAll('.ckh-cell')].map((c) => c.dataset.state);
    expect(await states('environment')).toEqual(['ready', 'missing']);
    expect(await states('host')).toEqual(['missing', 'unused']);
    expect(await states('character')).toEqual(['unused', 'untracked']);
    expect(await states('interface')).toEqual(['unused', 'ready']);
    expect(await states('look')).toEqual(['unused', 'missing']);
    expect(screen.getByTestId('episode-timeline-open').getAttribute('href')).toBe('/episodes/ep-1/timeline');
  });

  test('a complete card says so and opens where it is worked on', async () => {
    const { onOpenTab } = renderHub();
    const brief = await screen.findByTestId('checklist-section-brief');
    await within(brief).findByText('Complete');
    expect(brief.className).toContain('is-complete');
    fireEvent.click(within(brief).getByRole('button', { name: 'Open Overview' }));
    expect(onOpenTab).toHaveBeenCalledWith('overview');
    const world = screen.getByTestId('checklist-section-world');
    expect((await within(world).findByText('Open the event package')).getAttribute('href')).toBe('/shows/show-1/events/ev-1');
  });
});
