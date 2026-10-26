/**
 * Fill what's missing is the page's one AI entry point (Evoni, 2026-10-25:
 * "Merge the Suggest with AI button into Fill what's missing"). These are
 * the behaviours Suggest with AI had, now in the Fill panel under the
 * header: one ask (POST …/fill-missing); the AI drafts beside the page's
 * own suggestions ("From this event's facts": a suggested Basics field the
 * AI did not draft, and the organizer the event was started from); Accept /
 * Edit / Skip each, Accept all in one PUT, Close writing nothing; fresh
 * ideas for the basics when nothing is empty; the server's words for a
 * budget refusal or a 502. The Event section keeps only a pointer.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';
const FILL_URL = '/api/v1/world/show-1/events/ev-1/fill-missing';

// An opportunity event: category and format are suggested from its facts
// (award_show → Arts Entertainment, Gala); time and dress code are empty.
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
  event_date: '2026-11-09', description: 'A night.', updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: { opportunity_type: 'award_show' } },
};
// Every field the AI drafts, set: the ask is for fresh ideas.
const FULL = {
  category: 'fashion', format: 'gala', event_time: '19:00', dress_code: 'Black tie', theme: 'Velvet', mood: 'Hushed',
  narrative_stakes: 'Her first red carpet', fail_consequence: 'She is overlooked', success_unlock: 'The press notices her',
  career_milestone: 'First award show',
};
const PROFILE = { id: 42, display_name: 'Ama Velour', handle: '@ama' };

let stored;
let startedFromProfile;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  stored = JSON.parse(JSON.stringify(EVENT));
  startedFromProfile = null;
  vi.mocked(api.get).mockImplementation(async (url) => (url === EVENT_URL
    ? { data: { success: true, event: stored, sourceProfile: null, startedFromProfile, sceneSet: null, venueLocation: null, invitationAsset: null } }
    : { data: { success: true, deliverables: [], locked: false } }));
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    stored = { ...stored, ...body, updated_at: new Date().toISOString() };
    return { data: { success: true, event: stored } };
  });
});

const ok = (drafts) => ({ data: { success: true, data: { drafts, asked: [] } } });
const ai = (field, label, value, reason, extra = {}) => ({ field, label, value, source: 'ai', reason, ...extra });
const openPanel = async () => {
  fireEvent.click(await screen.findByTestId('fill-missing'));
  return screen.findByTestId('fill-missing-panel');
};

describe("Fill what's missing — what Suggest with AI did", () => {
  test('The Event section has no Suggest with AI, only a pointer to the strip', async () => {
    renderPage();
    await screen.findByTestId('fill-missing');
    expect(screen.queryByTestId('ai-suggest')).toBeNull();
    expect(screen.queryByText('Suggest with AI')).toBeNull();
    const pointer = screen.getByTestId('ai-pointer');
    expect(pointer.textContent).toContain('AI drafts: Fill what’s missing');
    expect(pointer.closest('#epp-sec-identity')).toBeTruthy();
    fireEvent.click(pointer);
    expect(document.activeElement).toBe(screen.getByTestId('fill-missing'));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('one ask, then the AI drafts and the page\'s own uncovered suggestions, each labelled', async () => {
    let release;
    vi.mocked(api.post).mockImplementation((url) => (url === FILL_URL
      ? new Promise((r) => { release = () => r(ok([
        ai('category', 'Category', 'luxury_prestige', 'A members-only room.'),
        ai('event_time', 'Time', '19:30', 'Dinners seat at half past seven.'),
        ai('dress_code', 'Dress code', 'Golden-hour formal', 'The mood is warm and golden.'),
        { field: 'appearance_fee', label: 'Appearance fee', value: 800, source: 'rate_card', reason: "The rate card's appearance fee at tier 3" },
      ])); })
      : Promise.resolve({ data: {} })));
    renderPage();
    const btn = await screen.findByTestId('fill-missing');
    expect(btn.textContent).toContain('Fill what\'s missing');
    fireEvent.click(btn);
    expect(api.post).toHaveBeenCalledWith(FILL_URL, {});
    expect(screen.getByTestId('fill-missing').textContent).toContain('Drafting…');
    expect(screen.getByTestId('fill-missing').disabled).toBe(true);
    release();

    const panel = await screen.findByTestId('fill-missing-panel');
    const rows = [...panel.querySelectorAll('[data-testid^="fill-row-"]')];
    expect(rows.map((r) => r.dataset.source)).toEqual(['ai', 'ai', 'ai', 'facts', 'rate_card']);
    expect(rows[0].textContent).toContain('AI draft · A members-only room.');
    // The format the AI left alone comes from the event's facts, with its reason.
    expect(rows[3].dataset.testid).toBe('fill-row-format');
    expect(rows[3].textContent).toMatch(/Gala/);
    expect(rows[3].textContent).toContain('From this event’s facts');
    expect(rows[4].textContent).toContain('Rate card');
    // A field the AI drafted is not listed twice.
    expect(panel.querySelectorAll('[data-testid="fill-row-category"]')).toHaveLength(1);
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Accept all writes the open drafts, facts and edits included, skips left out, in one PUT', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([
      ai('category', 'Category', 'luxury_prestige', 'r1'),
      ai('dress_code', 'Dress code', 'Golden-hour formal', 'r2'),
      ai('event_time', 'Time', '19:30', 'r3'),
    ]));
    renderPage();
    const panel = await openPanel();
    fireEvent.click(within(panel).getByTestId('fill-editbtn-dress_code'));
    fireEvent.change(within(panel).getByTestId('fill-edit-dress_code'), { target: { value: 'Golden formal' } });
    fireEvent.click(within(panel).getByTestId('fill-skip-event_time'));
    expect(within(panel).getByTestId('fill-row-event_time').dataset.state).toBe('skipped');
    fireEvent.click(within(panel).getByTestId('fill-accept-all'));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe(EVENT_URL);
    expect(body).toEqual(expect.objectContaining({ category: 'luxury_prestige', dress_code: 'Golden formal', format: 'gala' }));
    expect(body).not.toHaveProperty('event_time');
    await waitFor(() => expect(screen.getByTestId('fill-row-format').dataset.state).toBe('saved'));
    await waitFor(() => expect(screen.getByTestId('basics-category').getAttribute('data-state')).toBe('set'));
  });

  test('accepting one facts row saves only it; Close writes nothing more', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([ai('dress_code', 'Dress code', 'Golden-hour formal', 'r')]));
    renderPage();
    await openPanel();
    fireEvent.click(screen.getByTestId('fill-accept-format'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual({ format: 'gala', expected_updated_at: EVENT.updated_at });
    await waitFor(() => expect(screen.getByTestId('fill-row-format').dataset.state).toBe('saved'));
    fireEvent.click(screen.getByTestId('fill-close'));
    expect(screen.queryByTestId('fill-missing-panel')).toBeNull();
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  test('Close before accepting writes nothing', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([ai('category', 'Category', 'luxury_prestige', 'r')]));
    renderPage();
    await openPanel();
    fireEvent.click(screen.getByTestId('fill-close'));
    expect(screen.queryByTestId('fill-missing-panel')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('the organizer the event was started from is a facts row; accepting it saves the organizer', async () => {
    stored = { ...stored, canon_consequences: { automation: { opportunity_type: 'award_show', started_from_profile_id: 42 } } };
    startedFromProfile = PROFILE;
    vi.mocked(api.post).mockResolvedValue(ok([]));
    renderPage();
    const panel = await openPanel();
    const row = within(panel).getByTestId('fill-row-organizer');
    expect(row.dataset.source).toBe('facts');
    expect(row.textContent).toContain('Ama Velour (creator)');
    expect(row.textContent).toContain('From this event’s facts · You started this event from their Pulse profile');
    expect(within(row).queryByTestId('fill-editbtn-organizer')).toBeNull();
    fireEvent.click(within(row).getByTestId('fill-accept-organizer'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual(expect.objectContaining({ source_profile_id: 42, host: 'Ama Velour' }));
  });

  test('an empty AI answer still offers the page\'s own suggestions; with none, it says so', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([]));
    renderPage();
    await openPanel();
    expect(screen.getByTestId('fill-row-category').dataset.source).toBe('facts');
    expect(screen.queryByTestId('fill-empty')).toBeNull();
  });

  test('with nothing empty it reads Suggest fresh ideas and asks for ideas; each says what it replaces', async () => {
    stored = { ...stored, ...FULL };
    vi.mocked(api.post).mockResolvedValue(ok([
      ai('format', 'Format', 'dinner', 'A seated dinner instead.', { current: 'gala' }),
      ai('event_date', 'Date', '2026-11-15', 'A Sunday before the finale.', { current: '2026-11-09' }),
    ]));
    renderPage();
    const btn = await screen.findByTestId('fill-missing');
    expect(btn.textContent).toContain('Suggest fresh ideas');
    expect(screen.getByTestId('ai-pointer').textContent).toContain('AI ideas: Suggest fresh ideas');
    fireEvent.click(btn);
    expect(api.post).toHaveBeenCalledWith(FILL_URL, { mode: 'ideas' });
    const panel = await screen.findByTestId('fill-missing-panel');
    expect(panel.textContent).toContain('Fresh ideas');
    expect(within(panel).getByTestId('fill-current-format').textContent).toBe('Now: Gala');
    expect(within(panel).getByTestId('fill-value-event_date').textContent).toBe('Sun, Nov 15');
    expect(within(panel).getByTestId('fill-current-event_date').textContent).toBe('Now: Mon, Nov 9');
    fireEvent.click(within(panel).getByTestId('fill-accept-all'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toEqual({ format: 'dinner', event_date: '2026-11-15', expected_updated_at: EVENT.updated_at });
  });

  test('fresh ideas with nothing new says so, and offers no Accept all', async () => {
    stored = { ...stored, ...FULL };
    vi.mocked(api.post).mockResolvedValue(ok([]));
    renderPage();
    await openPanel();
    expect(screen.getByTestId('fill-empty').textContent).toBe('No new ideas this time.');
    expect(screen.queryByTestId('fill-accept-all')).toBeNull();
  });

  test.each([
    [429, 'AI budget for today is used up.', 'AI budget for today is used up.'],
    [502, 'The model answered with nothing usable.', 'The model answered with nothing usable.'],
    [500, 'stack trace', 'Couldn’t draft the missing fields right now. Try again in a moment.'],
  ])('a %s shows %s', async (status, serverError, shown) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('fail'), { response: { status, data: { success: false, error: serverError } } }));
    renderPage();
    fireEvent.click(await screen.findByTestId('fill-missing'));
    expect((await screen.findByTestId('fill-missing-error')).textContent).toContain(shown);
    expect(err).toHaveBeenCalledWith('[EventPackage] fill what\'s missing failed:', expect.any(Error));
    expect(screen.getByTestId('fill-missing').disabled).toBe(false);
    expect(api.put).not.toHaveBeenCalled();
    err.mockRestore();
  });

  test('a used event offers neither Fill nor the pointer', async () => {
    stored = { ...stored, used_in_episode_id: 'ep-1' };
    renderPage();
    await screen.findByTestId('terms-locked-banner');
    expect(screen.queryByTestId('fill-missing')).toBeNull();
    expect(screen.queryByTestId('ai-pointer')).toBeNull();
  });
});
