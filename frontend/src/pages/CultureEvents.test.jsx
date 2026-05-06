/**
 * CultureEvents — Track 6 CP11 behavioral tests (file 8 of 17).
 *
 * 4 fetch sites migrated via 4 helpers — 4-of-4 sites duplicate
 * CP10 CulturalCalendar helpers per v2.12 §9.11 file-local convention.
 * listShowsApi reaches 5-fold cross-CP existence (CP2 + CP5 + CP7
 * + CP9 showService + CP10 + CP11).
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
  listShowsApi,
  listCalendarEventsApi,
  autoSpawnEventApi,
  deleteCalendarEventApi,
} from './CultureEvents';

describe('CultureEvents — Track 6 CP11 file-local helpers (CP10 CulturalCalendar dups)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listShowsApi GET on /shows (5-fold cross-CP dup)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listShowsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
  });

  test('listCalendarEventsApi GET with event_type query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listCalendarEventsApi('lalaverse_cultural');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/calendar/events?event_type=lalaverse_cultural',
    );
  });

  test('listCalendarEventsApi encodes event_type', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listCalendarEventsApi('cultural & social');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/calendar/events?event_type=cultural%20%26%20social',
    );
  });

  test('autoSpawnEventApi POST on /calendar/events/:id/auto-spawn with payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { events: [{ name: 'Gala' }] } } });
    await autoSpawnEventApi('ev-1', { show_id: 's-1', event_count: 1, max_guests: 6 });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/calendar/events/ev-1/auto-spawn',
      { show_id: 's-1', event_count: 1, max_guests: 6 },
    );
  });

  test('deleteCalendarEventApi DELETE on /calendar/events/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteCalendarEventApi('ev-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/calendar/events/ev-1');
  });

  describe('Error path propagation', () => {
    test('listShowsApi rejection propagates (caller swallows)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listShowsApi()).rejects.toThrow('not authorized');
    });

    test('autoSpawnEventApi rejection propagates (caller flashes error)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(autoSpawnEventApi('ev-1', {})).rejects.toThrow('rate limited');
    });

    test('deleteCalendarEventApi rejection propagates', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('forbidden'));
      await expect(deleteCalendarEventApi('ev-1')).rejects.toThrow('forbidden');
    });
  });
});
