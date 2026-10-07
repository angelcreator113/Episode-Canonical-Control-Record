/**
 * Event Package Basics — category and format suggestions (Task #1888).
 *
 * A new event opens with category and format proposed, each with the fact
 * it rests on. Nothing is written until Evoni accepts; accepting saves
 * through the existing event PUT, and an accepted format immediately
 * brings the time and dress-code suggestions that read it.
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

// An opportunity-pipeline event as it reaches the Package: no category, no
// format, no time, no dress code.
const BASE_EVENT = {
  id: 'ev-1',
  show_id: 'show-1',
  name: 'Velour Awards Night',
  event_type: 'invite',
  prestige: 6,
  event_date: '2026-11-09',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: {
    automation: { source: 'opportunity_pipeline', opportunity_type: 'award_show', event_date_auto: '2026-11-09' },
  },
};

let stored;

function payload() {
  return {
    success: true, event: stored, sourceProfile: null, startedFromProfile: null,
    sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage Basics — category and format suggestions', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(BASE_EVENT));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) return { data: payload() };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    // The PUT stores what it is sent (minus the version key), as the route does.
    vi.mocked(api.put).mockImplementation(async (url, body) => {
      if (url !== EVENT_URL) return { data: { success: true } };
      const { expected_updated_at: _v, ...fields } = body;
      stored = { ...stored, ...fields, updated_at: '2026-09-25T10:05:00.000Z' };
      return { data: { success: true, event: stored } };
    });
  });

  test('category and format open as suggestions with their basis; nothing is written', async () => {
    renderPage();
    const category = await screen.findByTestId('basics-category');
    const format = screen.getByTestId('basics-format');

    expect(category.getAttribute('data-state')).toBe('suggested');
    expect(within(category).getByText('Arts Entertainment')).toBeTruthy();
    expect(within(category).getByText('From opportunity: award show')).toBeTruthy();
    expect(format.getAttribute('data-state')).toBe('suggested');
    expect(within(format).getByText('Gala')).toBeTruthy();

    // No format saved yet, so time and dress code wait for one (Task #2148).
    expect(screen.getByTestId('basics-time').getAttribute('data-state')).toBe('waiting');
    expect(screen.getByTestId('basics-dressCode').getAttribute('data-state')).toBe('waiting');

    expect(api.put).not.toHaveBeenCalled();
  });

  test('Task #2148: a waiting row reads "Waiting for format", offers Set, and no suggestion', async () => {
    renderPage();
    const time = await screen.findByTestId('basics-time');
    const dress = screen.getByTestId('basics-dressCode');

    for (const [key, row] of [['time', time], ['dressCode', dress]]) {
      expect(screen.getByTestId(`basics-${key}-state`).textContent).toContain('Waiting for format');
      expect(screen.queryByTestId(`basics-${key}-suggestion`)).toBeNull();
      expect(screen.queryByTestId(`basics-${key}-accept`)).toBeNull();
      // Listed once under Still to fill, its name opening it (Evoni's review, item 5).
      expect(within(screen.getByTestId('basics-to-fill')).getByTestId(`basics-${key}`)).toBe(row);
      expect(within(row).getByRole('button')).toBeTruthy();
    }

    // Readiness lists both as not ready, with the waiting note.
    for (const id of ['readiness-missing-identity-time', 'readiness-missing-look-dress_code']) {
      const li = screen.getByTestId(id);
      expect(li.getAttribute('data-item-state')).toBe('waiting');
      expect(li.textContent).toContain('Waiting for format');
    }
  });

  test('Task #2148: a waiting time can still be typed and saved directly', async () => {
    renderPage();
    const time = await screen.findByTestId('basics-time');
    fireEvent.click(within(time).getByRole('button', { name: 'Time' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start time' });
    expect(within(dialog).queryByText(/Fill in suggestion/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Start time'), { target: { value: '19:45' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ event_time: '19:45' });
    await waitFor(() => expect(screen.getByTestId('basics-time').getAttribute('data-state')).toBe('set'));
  });

  test('accepting the category saves it through the event PUT', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('basics-category-accept'));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe(EVENT_URL);
    expect(body).toMatchObject({ category: 'arts_entertainment' });
    expect(body).not.toHaveProperty('format');

    await waitFor(() => expect(screen.getByTestId('basics-category').getAttribute('data-state')).toBe('set'));
  });

  test('accepting the format saves it and brings the time and dress-code suggestions (the cascade)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('basics-format-accept'));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe(EVENT_URL);
    expect(body).toMatchObject({ format: 'gala' });
    expect(body).not.toHaveProperty('event_time');
    expect(body).not.toHaveProperty('dress_code');

    await waitFor(() => expect(screen.getByTestId('basics-format').getAttribute('data-state')).toBe('set'));
    const time = screen.getByTestId('basics-time');
    expect(time.getAttribute('data-state')).toBe('suggested');
    expect(within(time).getByText('From format: gala')).toBeTruthy();
    const dress = screen.getByTestId('basics-dressCode');
    expect(dress.getAttribute('data-state')).toBe('suggested');
    expect(within(dress).getByText('black tie formal')).toBeTruthy();

    // The cascade proposes; it does not write.
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  test('thin facts: no suggestion, the fields read missing', async () => {
    stored = { ...stored, name: 'Event with Kai', canon_consequences: { automation: {} } };
    renderPage();
    const category = await screen.findByTestId('basics-category');
    expect(category.getAttribute('data-state')).toBe('missing');
    expect(screen.getByTestId('basics-format').getAttribute('data-state')).toBe('missing');
    expect(screen.queryByTestId('basics-category-suggestion')).toBeNull();
    expect(screen.queryByTestId('basics-format-suggestion')).toBeNull();
  });

  // Evoni's review, item 5: one "Still to fill" line, one Fill in that walks it.
  test('what is still to fill is listed once; Fill in opens each in turn, Close stops', async () => {
    stored = { ...stored, name: 'Event with Kai', canon_consequences: { automation: {} } };
    renderPage();
    const list = await screen.findByTestId('basics-to-fill');
    const keys = [...list.querySelectorAll('[data-testid^="basics-"][data-state]')].map((li) => li.getAttribute('data-testid'));
    expect(keys).toEqual(expect.arrayContaining(['basics-category', 'basics-format']));
    // A set field reads as plain text: no "Set" tag.
    expect(screen.getByTestId('basics-date').getAttribute('data-state')).toBe('set');
    expect(screen.queryByTestId('basics-date-state')).toBeNull();

    const first = list.querySelector('[data-state] button').textContent;
    fireEvent.click(screen.getByTestId('basics-fill-in'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toMatch(new RegExp(first === 'Time' ? 'Start time' : first, 'i'));
    const input = dialog.querySelector('input, select, textarea');
    fireEvent.change(input, { target: { value: input.tagName === 'SELECT' ? input.options[1].value : (input.type === 'time' ? '19:45' : 'Something') } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Saved, and the next field opens on its own.
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const next = await screen.findByRole('dialog');
    expect(next.getAttribute('aria-label')).not.toBe(dialog.getAttribute('aria-label'));
    fireEvent.click(within(next).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('a set field is a plain row, not in Still to fill', async () => {
    stored = { ...stored, category: 'arts_entertainment', format: 'gala', event_time: '19:00', dress_code: 'black tie', description: 'A night.' };
    renderPage();
    const category = await screen.findByTestId('basics-category');
    expect(category.getAttribute('data-state')).toBe('set');
    expect(screen.queryByTestId('basics-category-state')).toBeNull();
    expect(screen.queryByTestId('basics-to-fill')).toBeNull();
  });

  test('a stored value outside the taxonomy is still flagged', async () => {
    stored = { ...stored, format: 'red_carpet' };
    renderPage();
    const format = await screen.findByTestId('basics-format');
    expect(format.getAttribute('data-state')).toBe('set');
    expect(screen.getByTestId('basics-format-unlisted')).toBeTruthy();
    expect(screen.queryByTestId('basics-format-suggestion')).toBeNull();
  });
});

// ─── Task #2128: Auto-drafted and Edited (doctrine rule 14) ──────────────
describe('EventPackagePage Basics — Auto-drafted and Edited (Task #2128)', () => {
  // A from-profile event with a creation draft: the columns equal the saved
  // copies, so each drafted field reads Auto-drafted.
  const DRAFTED_EVENT = {
    ...BASE_EVENT,
    description: 'A golden-hour sculpt session to close out summer.',
    dress_code: 'Sleek performance activewear',
    category: 'fitness',
    format: 'workout_class',
    event_time: '18:30',
    canon_consequences: {
      automation: {
        started_from_profile_id: 42,
        event_date_auto: '2026-11-09',
        auto_drafted: {
          description: 'ai_draft', dress_code: 'ai_draft', category: 'ai_draft', format: 'ai_draft', event_time: 'ai_draft',
        },
        drafted_values: {
          description: 'A golden-hour sculpt session to close out summer.',
          dress_code: 'Sleek performance activewear',
          category: 'fitness',
          format: 'workout_class',
          event_time: '18:30',
        },
      },
    },
  };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = JSON.parse(JSON.stringify(DRAFTED_EVENT));
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) return { data: payload() };
      return { data: { success: true, deliverables: [], locked: false } };
    });
    vi.mocked(api.put).mockImplementation(async (url, body) => {
      if (url !== EVENT_URL) return { data: { success: true } };
      const { expected_updated_at: _v, ...fields } = body;
      stored = { ...stored, ...fields, updated_at: '2026-09-25T10:05:00.000Z' };
      return { data: { success: true, event: stored } };
    });
  });

  test('drafted fields read Auto-drafted · AI draft; the date reads Auto-drafted · schedule', async () => {
    renderPage();
    await screen.findByTestId('basics-category');
    for (const key of ['time', 'description', 'dressCode', 'category', 'format']) {
      expect(screen.getByTestId(`basics-${key}`).getAttribute('data-state')).toBe('auto_drafted');
      expect(screen.getByTestId(`basics-${key}-state`).textContent).toContain('Auto-drafted · AI draft');
    }
    expect(screen.getByTestId('basics-date').getAttribute('data-state')).toBe('auto_drafted');
    expect(screen.getByTestId('basics-date-state').textContent).toContain('Auto-drafted · schedule');
    // The value shows, with Edit (not "Not set" / Set).
    const category = screen.getByTestId('basics-category');
    expect(within(category).getByText('Fitness')).toBeTruthy();
    expect(within(category).getByText('Edit')).toBeTruthy();
    expect(screen.queryByText('Auto-scheduled')).toBeNull();
  });

  test('changing a drafted field makes it Edited', async () => {
    stored = { ...stored, dress_code: 'All white' };
    renderPage();
    const dress = await screen.findByTestId('basics-dressCode');
    expect(dress.getAttribute('data-state')).toBe('edited');
    expect(screen.getByTestId('basics-dressCode-state').textContent).toContain('Edited');
    expect(within(dress).getByText('All white')).toBeTruthy();
  });

  test('saving a new date sends only the date (flag kept) and the date reads Edited', async () => {
    renderPage();
    const date = await screen.findByTestId('basics-date');
    fireEvent.click(within(date).getByText('Edit'));
    expect(screen.getByTestId('basics-dialog-draft-note').textContent).toContain('Auto-drafted · schedule');
    const dialog = screen.getByRole('dialog', { name: 'Event date' });
    fireEvent.change(within(dialog).getByLabelText('Event date'), { target: { value: '2026-12-01' } });
    fireEvent.click(within(dialog).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [, body] = vi.mocked(api.put).mock.calls[0];
    expect(body).toMatchObject({ event_date: '2026-12-01' });
    expect(body).not.toHaveProperty('canon_consequences');
    await waitFor(() => expect(screen.getByTestId('basics-date').getAttribute('data-state')).toBe('edited'));
  });
});
