/**
 * Production → Checklist as a hub (Evoni's Episode mock, 2026-10-05): the
 * progress card, the episode timeline from the production coverage (a row
 * per kind of piece, a column per beat, Lala's look in the script's closet
 * beat), and a card
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

const SCRIPT = '## BEAT: 1 · Opening Ritual\nPrime: "Hi."\n## BEAT: 8 · Transformation Loop\n[UI:OPEN ClosetCategory Outfit]\n';
const renderHub = (episode = {}) => {
  const onOpenTab = vi.fn();
  render(<MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala', script_content: SCRIPT, ...episode }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
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
    // 24: the Lookbook card's two checks count in the total (Task #2815).
    expect(within(summary).getByTestId('checklist-count').textContent).toMatch(/^\d+ of 24$/);
  });

  test('the timeline: a cell per beat per row, and Lala\'s look in the script\'s closet beat', async () => {
    renderHub();
    const states = async (key) => [...(await screen.findByTestId(`episode-timeline-row-${key}`)).querySelectorAll('.ckh-cell')].map((c) => c.dataset.state);
    expect(await states('environment')).toEqual(['ready', 'missing']);
    expect(await states('host')).toEqual(['missing', 'unused']);
    expect(await states('character')).toEqual(['unused', 'untracked']);
    expect(await states('interface')).toEqual(['unused', 'ready']);
    expect(await states('look')).toEqual(['unused', 'missing']);
    expect(screen.getByTestId('episode-timeline-open').getAttribute('href')).toBe('/episodes/ep-1/timeline');
    expect(screen.getByTestId('checklist-section-wardrobe').textContent).toContain("Lala's closet and her look for the event. Beat 8 needs it.");
  });

  test('a script with no closet beat names no beat (Task #2880)', async () => {
    renderHub({ script_content: '' });
    const row = await screen.findByTestId('episode-timeline-row-look');
    expect([...row.querySelectorAll('.ckh-cell')].map((c) => c.dataset.state)).toEqual(['unused', 'unused']);
    expect(screen.getByTestId('checklist-section-wardrobe').textContent).not.toMatch(/Beat \d/);
  });

  test('the Overlays card: the title overlay and placed overlays, opening Production → Overlays', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/timeline/placements') return { data: { data: [{ id: 'p1' }] } };
      return { data: {} };
    });
    const onOpenTab = vi.fn();
    render(<MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala', title_overlay_asset_id: null }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
    const card = await screen.findByTestId('checklist-section-onscreen');
    expect(card.textContent).toContain('Overlays');
    await within(card).findByText('In progress');
    expect(within(card).getByText('Title overlay made')).toBeTruthy();
    expect(within(card).getByText('Overlays placed on the video')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Open Overlays' }));
    expect(onOpenTab).toHaveBeenCalledWith('overlays');
    // Social & Content now opens Assets, where its social tasks are.
    expect(within(screen.getByTestId('checklist-section-social')).getByRole('button', { name: 'Open Assets' })).toBeTruthy();
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

  // The Style Page card (was Lookbook; Tasks #2815, #2876): "Style sheet
  // ready x of 12" from the shared rule (lib/styleReadiness), the sheet's
  // status, and a link to the Style Page.
  // The server's readiness (Task #2877), as GET /style-sheet returns it.
  const CHIPS = ['Front', 'Side', 'Back', 'Hero', 'Hair', 'Nails', 'Beauty', 'Venue', 'Inspo', 'Wardrobe', 'Palette', 'Tagline'];
  const readiness = (ready) => {
    const items = CHIPS.map((label) => ({ key: label.toLowerCase(), label, ready: ready.includes(label) }));
    return { items, done: ready.length, total: 12, missing: items.filter((i) => !i.ready).map((i) => i.label) };
  };

  test("the Style Page card: ready x of 12 as the server computed it, the sheet status, opening the Style Page", async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/lookbook') {
        return { data: { data: { sheet_status: 'draft' } } };
      }
      if (url === '/api/v1/episodes/ep-1/style-sheet') {
        return { data: { data: { readiness: readiness(['Front', 'Hero', 'Venue', 'Inspo']) } } };
      }
      return { data: {} };
    });
    const onOpenTab = vi.fn();
    render(<MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala' }} showId="show-1" onOpenTab={onOpenTab} /></MemoryRouter>);
    const card = await screen.findByTestId('checklist-section-lookbook');
    expect(card.textContent).toContain('Style Page');
    await within(card).findByText('Style sheet ready 4 of 12 · missing: Side, Back, Hair, Nails, Beauty, Wardrobe, Palette, Tagline');
    expect(within(card).getByText('Style sheet ready (12 of 12)')).toBeTruthy();
    expect(within(card).getByText('Style sheet approved')).toBeTruthy();
    expect(within(card).getByText('Draft')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Open Style Page' }));
    expect(onOpenTab).toHaveBeenCalledWith('lookbook');
  });

  test('the Style Page card is complete when all 12 are ready and the sheet is approved', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episodes/ep-1/lookbook') {
        return { data: { data: { sheet_status: 'approved' } } };
      }
      if (url === '/api/v1/episodes/ep-1/style-sheet') {
        return { data: { data: { readiness: readiness(CHIPS) } } };
      }
      return { data: {} };
    });
    render(<MemoryRouter><EpisodeProductionChecklist episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala' }} showId="show-1" onOpenTab={vi.fn()} /></MemoryRouter>);
    const card = await screen.findByTestId('checklist-section-lookbook');
    await within(card).findByText('Complete');
  });
});
