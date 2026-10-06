/**
 * The top of the Episode Overview (Evoni's Episode mock, 2026-10-05): the
 * next step, the four tiles, the story brief and "From the event", which
 * holds what the Planning card did (episode creation step 2): what Start
 * Episode carried from the event, and where to finish each gap.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', host_brand: 'Velour', prestige: 3,
  venue_location_id: 'loc-1', venue_name: 'Club Noir', scene_set_id: null,
  outfit_pieces: [], narrative_stakes: 'Her first red carpet',
  canon_consequences: { automation: { guest_profiles: [{ profile_id: 1, display_name: 'Maya Chen', featured: true }] } },
};
const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', description: 'Lala arrives late.', total_income: 439 };
let brief;

const renderTab = (props = {}) => {
  const onOpenTab = vi.fn();
  render(
    <MemoryRouter>
      <EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} onOpenTab={onOpenTab} checks={{ done: 16, total: 21 }} balance={1900} {...props} />
    </MemoryRouter>,
  );
  return { onOpenTab };
};

beforeEach(() => {
  vi.clearAllMocks();
  brief = { episode_id: 'ep-1', event_id: 'ev-1', episode_archetype: 'Redemption', designed_intent: 'pass', narrative_purpose: 'Her first credit', forward_hook: 'A second invite' };
  vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [EVENT] });
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, event: EVENT, sourceProfile: null, sceneSet: null, venueLocation: { id: 'loc-1', name: 'Club Noir' } } };
    }
    return { data: {} };
  });
});

describe('Episode Overview summary', () => {
  test('From the event lists Event, Place, Stakes, Cast, Look, with how many are ready', async () => {
    renderTab();
    const card = await screen.findByTestId('episode-planning');
    // The venue counts as carried without its scene set (Evoni, 2026-10-06).
    expect(within(card).getByTestId('episode-planning-count').textContent).toBe('4 of 5 ready');
    expect([...card.querySelectorAll('.eos-from-text strong')].map((e) => e.textContent)).toEqual(['Event', 'Place', 'Stakes', 'Cast', 'Look']);
    expect(within(card).getByTestId('episode-planning-event').textContent).toMatch(/Velour Awards Night · organized by Velour/);
    expect(within(card).getByTestId('episode-planning-cast').textContent).toMatch(/1 featured: Maya Chen/);
    expect(within(card).getByTestId('episode-planning-location').getAttribute('data-done')).toBe('true');
    expect(within(card).getByTestId('episode-planning-location').textContent).toMatch(/Club Noir · no scene set yet/);
    expect(within(card).getByTestId('episode-planning-package').getAttribute('href')).toBe('/shows/show-1/events/ev-1');
  });

  test('a missing look opens Wardrobe; a missing scene set opens the Event Package', async () => {
    const { onOpenTab } = renderTab();
    const card = await screen.findByTestId('episode-planning');
    expect(within(card).getByTestId('episode-planning-fix-location').getAttribute('href')).toBe('/shows/show-1/events/ev-1');
    fireEvent.click(within(card).getByTestId('episode-planning-fix-look'));
    expect(onOpenTab).toHaveBeenCalledWith('wardrobe');
  });

  test('with no script the next step is Generate the script, and it opens the Script tab', async () => {
    const { onOpenTab } = renderTab();
    await screen.findByTestId('episode-planning');
    const banner = screen.getByTestId('overview-next-step');
    expect(banner.textContent).toContain('Generate the script');
    expect(banner.textContent).toContain("The brief is done. Lala's look can wait, but Beat 8 will need it.");
    fireEvent.click(screen.getByTestId('overview-next-step-go'));
    expect(onOpenTab).toHaveBeenCalledWith('scripts');
  });

  test('the tiles: the checklist, the prestige, the coins after the episode, the look', async () => {
    const { onOpenTab } = renderTab();
    await screen.findByTestId('episode-planning');
    expect(screen.getByTestId('overview-tile-checklist').textContent).toContain('16 / 21');
    expect(screen.getByTestId('overview-tile-prestige').textContent).toContain('3 / 10');
    // 1,900 now plus the episode's estimated 439.
    expect(screen.getByTestId('overview-tile-coins').textContent).toContain('2,339');
    expect(screen.getByTestId('overview-tile-coins').textContent).toContain('estimate');
    expect(screen.getByTestId('overview-tile-look').textContent).toContain('Not chosen');
    fireEvent.click(within(screen.getByTestId('overview-tile-coins')).getByText('Open Money'));
    expect(onOpenTab).toHaveBeenCalledWith('money');
  });

  test('the story brief is complete with its four fields, and edits save to the brief', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: { ...brief, designed_intent: 'slay' } } });
    renderTab();
    expect((await screen.findByTestId('overview-brief-state')).textContent).toBe('Complete');
    const card = screen.getByTestId('overview-story-brief');
    expect(within(card).getByRole('button', { name: 'Pass' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(card).getByRole('button', { name: 'Slay' }));
    expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1', { designed_intent: 'slay' });
  });

  test('an episode with no source event shows no From the event card', async () => {
    brief = { episode_id: 'ep-1', event_id: null };
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
    renderTab();
    expect((await screen.findByTestId('overview-brief-state')).textContent).toBe('0 of 4 set');
    expect(screen.queryByTestId('episode-planning')).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1');
  });
});
