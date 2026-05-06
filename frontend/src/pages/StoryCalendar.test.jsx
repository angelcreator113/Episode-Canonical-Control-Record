/**
 * StoryCalendar — Track 6 CP11 behavioral tests (file 5 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. Note: paths
 * are /storyteller/calendar/events (storyteller-scoped), NOT
 * /calendar/events (which CulturalCalendar+CultureEvents use) —
 * the URL difference means these are FRESH helpers, not file-local
 * dups despite surface-time speculation.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import {
  listStoryCalendarEventsApi,
  listStoryCalendarMarkersApi,
  createStoryCalendarEventApi,
} from './StoryCalendar';

describe('StoryCalendar — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listStoryCalendarEventsApi GET on /storyteller/calendar/events (no qs when "all")', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listStoryCalendarEventsApi('all');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/calendar/events');
  });

  test('listStoryCalendarEventsApi GET appends ?event_type=... when filtered', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listStoryCalendarEventsApi('story_event');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/calendar/events?event_type=story_event');
  });

  test('listStoryCalendarMarkersApi GET on /storyteller/calendar/markers', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { markers: [] } });
    await listStoryCalendarMarkersApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/storyteller/calendar/markers');
  });

  test('createStoryCalendarEventApi POST on /storyteller/calendar/events', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { event: {} } });
    const payload = { title: 'Premiere', event_type: 'story_event', start_datetime: '2026-05-01T18:00' };
    await createStoryCalendarEventApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/storyteller/calendar/events', payload);
  });

  describe('Error path propagation', () => {
    test('listStoryCalendarEventsApi rejection propagates (caller catches → empty)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listStoryCalendarEventsApi('all')).rejects.toThrow('not authorized');
    });

    test('listStoryCalendarMarkersApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listStoryCalendarMarkersApi()).rejects.toThrow('not authorized');
    });

    test('createStoryCalendarEventApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('validation'));
      await expect(createStoryCalendarEventApi({})).rejects.toThrow('validation');
    });
  });
});
