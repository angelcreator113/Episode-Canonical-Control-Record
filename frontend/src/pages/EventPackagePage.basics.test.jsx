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

    // No format saved yet, so time and dress code have nothing to read.
    expect(screen.getByTestId('basics-time').getAttribute('data-state')).toBe('missing');
    expect(screen.getByTestId('basics-dressCode').getAttribute('data-state')).toBe('missing');

    expect(api.put).not.toHaveBeenCalled();
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

  test('a stored value outside the taxonomy is still flagged', async () => {
    stored = { ...stored, format: 'red_carpet' };
    renderPage();
    const format = await screen.findByTestId('basics-format');
    expect(format.getAttribute('data-state')).toBe('set');
    expect(screen.getByTestId('basics-format-unlisted')).toBeTruthy();
    expect(screen.queryByTestId('basics-format-suggestion')).toBeNull();
  });
});
