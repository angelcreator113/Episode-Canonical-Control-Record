/**
 * Suggest with AI (Evoni, 2026-10-23: "use real AI for the suggestions").
 * One button in Basics asks POST …/suggest-basics; the review list shows
 * each suggestion with a checkbox, its value (editable) and why, beside the
 * page's own suggestions the AI did not cover. Save checked writes the
 * checked values in one PUT; Cancel writes nothing. A budget refusal or a
 * 502 shows the server's words; anything else a plain message.
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
const SUGGEST_URL = '/api/v1/world/show-1/events/ev-1/suggest-basics';

// An opportunity event: category and format are suggested from its facts
// (award_show → Arts Entertainment, Gala); time and dress code are empty.
const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
  event_date: '2026-11-09', description: 'A night.', updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: { opportunity_type: 'award_show' } },
};

let stored;

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
  vi.mocked(api.get).mockImplementation(async (url) => (url === EVENT_URL
    ? { data: { success: true, event: stored, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null } }
    : { data: { success: true, deliverables: [], locked: false } }));
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    stored = { ...stored, ...body, updated_at: new Date().toISOString() };
    return { data: { success: true, event: stored } };
  });
});

const ok = (suggestions) => ({ data: { success: true, data: { suggestions } } });

describe('Suggest with AI', () => {
  test('asks for the empty fields, then lists the AI rows and the page\'s own uncovered ones', async () => {
    let release;
    vi.mocked(api.post).mockImplementation((url) => (url === SUGGEST_URL
      ? new Promise((r) => { release = () => r(ok([
        { field: 'category', value: 'luxury_prestige', reason: 'A members-only room.' },
        { field: 'event_time', value: '19:30', reason: 'Dinners seat at half past seven.' },
        { field: 'dress_code', value: 'Golden-hour formal', reason: 'The mood is warm and golden.' },
      ])); })
      : Promise.resolve({ data: {} })));
    renderPage();
    const btn = await screen.findByTestId('ai-suggest');
    expect(btn.textContent).toContain('Suggest with AI');
    fireEvent.click(btn);
    expect(api.post).toHaveBeenCalledWith(SUGGEST_URL, {});
    expect(screen.getByTestId('ai-suggest').textContent).toContain('Asking AI…');
    expect(screen.getByTestId('ai-suggest').disabled).toBe(true);
    expect(screen.getByTestId('ai-suggest').getAttribute('aria-busy')).toBe('true');
    release();

    const review = await screen.findByTestId('suggest-review');
    expect(review.textContent).toContain('AI suggestions — check them before saving.');
    const rows = [...review.querySelectorAll('[data-testid^="suggest-row-"]')];
    expect(rows.map((r) => r.getAttribute('data-source'))).toEqual(['ai', 'ai', 'ai', 'facts']);
    expect(rows[0].textContent).toContain('A members-only room.');
    // The format the AI left alone comes from the event's facts.
    expect(rows[3].textContent).toMatch(/Format.*Suggested from the event’s facts/);
    expect(within(rows[3]).getByRole('combobox').value).toBe('gala');
    rows.forEach((r) => expect(within(r).getByRole('checkbox').checked).toBe(true));
  });

  test('Save checked writes the checked values, edits included, in one PUT', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([
      { field: 'category', value: 'luxury_prestige', reason: 'r1' },
      { field: 'dress_code', value: 'Golden-hour formal', reason: 'r2' },
    ]));
    renderPage();
    fireEvent.click(await screen.findByTestId('ai-suggest'));
    const review = await screen.findByTestId('suggest-review');
    const dress = within(review).getByTestId('suggest-row-ai-dressCode-1');
    fireEvent.change(within(dress).getByRole('textbox'), { target: { value: 'Golden formal' } });
    // Uncheck the facts row for format.
    fireEvent.click(within(within(review).getByTestId('suggest-row-facts-format')).getByRole('checkbox'));
    fireEvent.click(within(review).getByTestId('suggest-save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0]).toEqual([EVENT_URL, expect.objectContaining({ category: 'luxury_prestige', dress_code: 'Golden formal' })]);
    expect(vi.mocked(api.put).mock.calls[0][1]).not.toHaveProperty('format');
    await waitFor(() => expect(screen.queryByTestId('suggest-review')).toBeNull());
    await waitFor(() => expect(screen.getByTestId('basics-category').getAttribute('data-state')).toBe('set'));
  });

  test('Cancel writes nothing', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([{ field: 'category', value: 'luxury_prestige', reason: 'r' }]));
    renderPage();
    fireEvent.click(await screen.findByTestId('ai-suggest'));
    fireEvent.click(await screen.findByTestId('suggest-cancel'));
    expect(screen.queryByTestId('suggest-review')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('an empty answer says so; the page\'s own suggestions are still offered', async () => {
    vi.mocked(api.post).mockResolvedValue(ok([]));
    renderPage();
    fireEvent.click(await screen.findByTestId('ai-suggest'));
    expect((await screen.findByTestId('suggest-empty')).textContent).toBe('No new suggestions.');
    expect(screen.getByTestId('suggest-row-facts-category')).toBeTruthy();
  });

  test('with nothing empty it asks for new ideas on all six', async () => {
    stored = { ...stored, category: 'fashion', format: 'gala', event_time: '19:00', dress_code: 'Black tie' };
    vi.mocked(api.post).mockResolvedValue(ok([]));
    renderPage();
    fireEvent.click(await screen.findByTestId('ai-suggest'));
    await screen.findByTestId('suggest-empty');
    expect(api.post).toHaveBeenCalledWith(SUGGEST_URL, { fields: ['event_date', 'event_time', 'description', 'dress_code', 'category', 'format'] });
    expect(screen.queryByTestId('suggest-save')).toBeNull();
  });

  test.each([
    [429, 'AI budget for today is used up.', 'AI budget for today is used up.'],
    [502, 'The model answered with nothing usable.', 'The model answered with nothing usable.'],
    [500, 'stack trace', 'Couldn’t get suggestions right now. Try again in a moment.'],
  ])('a %s shows %s', async (status, serverError, shown) => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('fail'), { response: { status, data: { success: false, error: serverError } } }));
    renderPage();
    fireEvent.click(await screen.findByTestId('ai-suggest'));
    expect((await screen.findByTestId('ai-suggest-error')).textContent).toContain(shown);
    expect(err).toHaveBeenCalledWith('[EventPackage] suggest basics failed:', expect.any(Error));
    expect(screen.getByTestId('ai-suggest').disabled).toBe(false);
    expect(api.put).not.toHaveBeenCalled();
    err.mockRestore();
  });

  test('a used event offers no Suggest with AI', async () => {
    stored = { ...stored, used_in_episode_id: 'ep-1' };
    renderPage();
    await screen.findByTestId('terms-locked-banner');
    expect(screen.queryByTestId('ai-suggest')).toBeNull();
  });
});
