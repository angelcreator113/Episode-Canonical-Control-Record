/**
 * Where the event goes next (Evoni, 2026-10-25: "I want them all"): beat
 * 14's preview, the episode's status card, what Start copies (in the
 * confirm dialog), the follow-up event, Fill what's missing (Accept, Skip,
 * Edit, Accept all; nothing saved until accepted), the defaults chips and
 * the clash lines. The real hooks, the API mocked.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EventFlowStrip from './EventFlowStrip';
import EventFieldHints from './EventFieldHints';
import StartCopiesPreview from './StartCopiesPreview';
import StartConfirmDialog from './StartConfirmDialog';
import useEventActions from '../../pages/eventPackage/useEventActions';
import useFillMissing from '../../pages/eventPackage/useFillMissing';
import useFollowUpEvent from '../../pages/eventPackage/useFollowUpEvent';

const EVENT = {
  id: 'ev-1', name: 'Velour Night', event_type: 'invite', host_brand: 'Maison Velour', source_profile_id: 5, deal_type: 'brand_partnership',
  canon_consequences: { pinned_goal_ids: ['g1', 'g2'], automation: { guest_profiles: [{ id: 1 }, { id: 2 }, { id: 3, featured: true }] } },
  outfit_pieces: [{ id: 9 }],
};
const FLOW = {
  success: true,
  beat14: { episode_id: null, host: { profile_id: 5, name: 'Ama' }, people: 2, attached: null, best: { id: 'o1', name: 'Maison Velour SS27 campaign', fit: { best: true, reasons: [{ text: 'Same brand as the host' }] } }, others: 1, draft: null },
  defaults: [
    { field: 'dress_code', value: 'Black tie', source: 'brand', basis: "Maison Velour's usual, 2 of its 3 other events" },
    { field: 'prestige', value: 8, source: 'brand', basis: "Maison Velour's usual, 2 of its 3 other events" },
  ],
  clashes: { lines: [
    { kind: 'day', field: 'date', text: 'Gallery Late is on the same day.' },
    { kind: 'guest', field: 'guests', text: 'Nia is also at Gallery Late that day.' },
    { kind: 'money', field: 'money', text: 'Costs about 520 coins; Lala has 300, 220 short right now.' },
  ] },
};
const DRAFTS = [
  { field: 'category', label: 'Category', value: 'luxury_prestige', source: 'ai', reason: 'A gala.' },
  { field: 'theme', label: 'Invitation theme', value: 'Midnight velvet', source: 'ai', reason: 'House colours.' },
  { field: 'partnership_base_fee', label: 'Partnership base', value: 1500, source: 'rate_card', reason: "The rate card's partnership base at tier 3" },
];

function Harness({ used = false, episodeId = null, putEvent, load = vi.fn(), setToast = vi.fn(), navigate = vi.fn() }) {
  const flow = useEventActions({ showId: 'show-1', eventId: 'ev-1', reloadTick: 0 });
  const fill = useFillMissing({ showId: 'show-1', eventId: 'ev-1', used, putEvent, load, setToast });
  const followUp = useFollowUpEvent({ showId: 'show-1', event: EVENT, organizer: { name: 'Maison Velour' }, venueLocation: { venue_type: 'rooftop_bar' }, navigate, setToast });
  return (
    <>
      <EventFlowStrip showId="show-1" used={used} lockEpisode={null} episodeId={episodeId} flow={flow.flow} fill={fill} followUp={followUp} />
      <EventFieldHints flow={flow.flow} fields={['dress_code', 'date']} used={used} putEvent={putEvent} load={load} setToast={setToast} />
    </>
  );
}
const renderStrip = (props = {}) => {
  const putEvent = props.putEvent || vi.fn(async () => ({}));
  const navigate = vi.fn();
  const load = vi.fn(async () => {});
  render(<MemoryRouter><Harness putEvent={putEvent} navigate={navigate} load={load} {...props} /></MemoryRouter>);
  return { putEvent, navigate, load };
};

const routeGets = (extra = {}) => api.get.mockImplementation(async (url) => {
  if (url === '/api/v1/world/show-1/events/ev-1/flow') return { data: FLOW };
  if (extra[url]) return { data: extra[url] };
  throw new Error(`unexpected GET ${url}`);
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('beat 14 preview', () => {
  test("the host's best fit, and what to do before the episode exists", async () => {
    routeGets();
    renderStrip();
    const card = await screen.findByTestId('beat14-preview');
    expect(card.textContent).toContain("This event's host can offer:");
    expect(within(card).getByTestId('beat14-name').textContent).toBe('Maison Velour SS27 campaign');
    expect(within(card).getByTestId('beat14-tag').textContent).toBe('best fit');
    expect(card.textContent).toContain('1 other open opportunity also fit');
    expect(within(card).queryByTestId('beat14-open-script')).toBeNull();
  });
});

describe('episode status', () => {
  test('"In the edit · needs thumbnail · releases …", linking to the episode and its beat 14', async () => {
    routeGets({
      '/api/v1/episodes/ep-9': { data: { id: 'ep-9', episode_number: 4, title: 'The Velvet Rope', status: 'in_review', thumbnail_url: null, title_approved_at: 'x', title_approved_value: 'The Velvet Rope', distribution_metadata: { youtube: { title: 'x' } } } },
      '/api/v1/feed-posts/episode/ep-9': { data: [{ status: 'live' }] },
      '/api/v1/world/show-1/release-schedule': { data: { schedule: {}, episodes: [{ episode_id: 'ep-9', number: 4, date: '2026-11-01', time: '10:00', source: 'schedule' }] } },
    });
    renderStrip({ episodeId: 'ep-9' });
    const line = await screen.findByTestId('episode-status-line');
    await waitFor(() => expect(line.textContent).toBe('In the edit · needs thumbnail · releases Sun, Nov 1 · 10:00 AM'));
    expect(screen.getByTestId('episode-status').textContent).toContain('Episode 4: The Velvet Rope');
    expect(screen.getByTestId('episode-status-open').getAttribute('href')).toBe('/episodes/ep-9?tab=overview');
    expect(screen.getByTestId('beat14-open-script').getAttribute('href')).toBe('/episodes/ep-9?tab=scripts');
  });
});

describe('what Start copies', () => {
  test('the counts inside the Start confirm dialog', () => {
    const readiness = { warningItems: [{ section: 'look', key: 'outfit', sectionLabel: 'Look', label: 'Outfit' }] };
    const copies = <StartCopiesPreview event={EVENT} seeds={{ deliverables: { data: { deliverables: [{ id: 'd' }, { id: 'e' }] } } }} venueDate={{ venueLocationId: 'loc' }} />;
    render(<StartConfirmDialog readiness={readiness} moneyWarnings={[]} confirmCount={1} start={{ starting: false, setStartConfirmOpen: vi.fn(), handleStartEpisode: vi.fn() }} copies={copies} />);
    const box = within(screen.getByTestId('start-confirm')).getByTestId('start-copies');
    expect(box.textContent).toBe('Starting this copies: 2 goals, 3 guests (1 featured), the deal and its 2 deliverables, the look (1 piece), the venue.');
    expect(within(box).getByTestId('start-copies-goals').textContent).toBe('2 goals, ');
  });
  test('nothing to copy: nothing shown', () => {
    const { container } = render(<StartCopiesPreview event={{ canon_consequences: {} }} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('follow-up event', () => {
  test('creates it through the create route with the host, brand and venue type, sets the deal type, opens the editor', async () => {
    routeGets({ '/api/v1/world/show-1/events/new-1': { event: { id: 'new-1', updated_at: '2026-10-25T10:00:01Z' } } });
    api.post.mockResolvedValue({ data: { event: { id: 'new-1', deal_type: 'invited_comped', updated_at: '2026-10-25T10:00:00Z' } } });
    api.put.mockResolvedValue({ data: {} });
    const { navigate } = renderStrip();
    fireEvent.click(await screen.findByTestId('follow-up-event'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/shows/show-1/season?tab=events&event=new-1'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events', expect.objectContaining({
      name: 'Maison Velour — follow-up', host_brand: 'Maison Velour', source_profile_id: 5, location_hint: 'Rooftop bar', parent_event_id: 'ev-1',
    }));
    const body = api.post.mock.calls[0][1];
    expect(body.event_date).toBeUndefined();
    expect(body.canon_consequences).toBeUndefined();
    expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/events/new-1', { deal_type: 'brand_partnership', expected_updated_at: '2026-10-25T10:00:01Z' });
  });
});

describe("Fill what's missing", () => {
  const ask = async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { drafts: DRAFTS, asked: ['category', 'theme'] } } });
    fireEvent.click(await screen.findByTestId('fill-missing'));
    return screen.findByTestId('fill-missing-panel');
  };

  test('every draft side by side; nothing saved until accepted; Accept saves one field', async () => {
    routeGets();
    const { putEvent } = renderStrip();
    await ask();
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1/fill-missing', {});
    expect(screen.getByTestId('fill-value-category').textContent).toBe('Luxury Prestige');
    expect(screen.getByTestId('fill-row-partnership_base_fee').textContent).toContain('Rate card');
    expect(putEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('fill-accept-theme'));
    await waitFor(() => expect(screen.getByTestId('fill-row-theme').dataset.state).toBe('saved'));
    expect(putEvent).toHaveBeenCalledWith({ theme: 'Midnight velvet' });
  });

  test('Skip saves nothing; Edit changes the draft before Accept; Accept all sends the rest in one PUT', async () => {
    routeGets();
    const { putEvent } = renderStrip();
    await ask();
    fireEvent.click(screen.getByTestId('fill-skip-category'));
    expect(screen.getByTestId('fill-row-category').dataset.state).toBe('skipped');
    fireEvent.click(screen.getByTestId('fill-editbtn-partnership_base_fee'));
    fireEvent.change(screen.getByTestId('fill-edit-partnership_base_fee'), { target: { value: '1800' } });
    fireEvent.click(screen.getByTestId('fill-accept-all'));
    await waitFor(() => expect(putEvent).toHaveBeenCalledTimes(1));
    expect(putEvent).toHaveBeenCalledWith({ theme: 'Midnight velvet', partnership_base_fee: 1800 });
    await waitFor(() => expect(screen.getByTestId('fill-row-theme').dataset.state).toBe('saved'));
    expect(screen.getByTestId('fill-row-category').dataset.state).toBe('skipped');
  });

  test('a refusal (budget) says why; a used event offers no Fill', async () => {
    routeGets();
    api.post.mockRejectedValue({ response: { status: 429, data: { error: 'Daily AI budget reached' } } });
    renderStrip();
    fireEvent.click(await screen.findByTestId('fill-missing'));
    expect((await screen.findByTestId('fill-missing-error')).textContent).toContain('Daily AI budget reached');
  });

  test('used: no Fill button', async () => {
    routeGets();
    renderStrip({ used: true });
    await screen.findByTestId('beat14-preview');
    expect(screen.queryByTestId('fill-missing')).toBeNull();
  });
});

describe('defaults chips and clash lines', () => {
  test("the brand's usual dress code beside the field, saved only when tapped", async () => {
    routeGets();
    const { putEvent } = renderStrip();
    const chip = await screen.findByTestId('default-chip-dress_code');
    expect(chip.textContent).toContain('Black tie');
    expect(chip.textContent).toContain("Maison Velour's usual");
    // Only the fields this place shows: prestige is the Stakes section's.
    expect(screen.queryByTestId('default-chip-prestige')).toBeNull();
    expect(putEvent).not.toHaveBeenCalled();
    fireEvent.click(chip);
    await waitFor(() => expect(putEvent).toHaveBeenCalledWith({ dress_code: 'Black tie' }));
  });

  test('one line of clashes in the strip; the day clash beside the date', async () => {
    routeGets();
    renderStrip();
    const summary = await screen.findByTestId('clash-summary');
    expect(summary.textContent).toBe('3 things to check: Gallery Late is on the same day · Nia is also at Gallery Late that day · Costs about 520 coins; Lala has 300, 220 short right now.');
    const hints = screen.getByTestId('field-hints-dress_code-date');
    expect(within(hints).getByTestId('clash-day').textContent).toContain('Gallery Late is on the same day.');
    expect(within(hints).queryByTestId('clash-guest')).toBeNull();
  });

  test('used: warnings stay, chips go', async () => {
    routeGets();
    renderStrip({ used: true });
    await screen.findByTestId('clash-summary');
    expect(screen.queryByTestId('default-chip-dress_code')).toBeNull();
    expect(screen.getByTestId('clash-day')).toBeTruthy();
  });
});
