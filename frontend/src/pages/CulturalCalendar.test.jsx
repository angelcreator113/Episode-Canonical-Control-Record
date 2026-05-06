/**
 * CulturalCalendar — Track 6 CP10 behavioral tests (file 2 of 8).
 *
 * 4 fetch sites migrated via 4 module-scope helpers. listShowsApi
 * duplicated locally per v2.12 §9.11 (CP2/CP5/CP7 + CP9 showService have
 * it; v2.16 service-precedence-inversion note: showService is canonical).
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

vi.mock('../hooks/usePageData', () => ({ default: () => ({ data: {}, updateItem: vi.fn(), addItem: vi.fn(), removeItem: vi.fn(), saving: false }) }));
vi.mock('../components/EditItemModal', () => ({
  EditItemModal: () => null,
  PageEditContext: { Provider: ({ children }) => children },
  EditableList: () => null,
}));
vi.mock('../components/PushToBrain', () => ({ default: () => null }));

import apiClient from '../services/api';
import {
  listShowsApi,
  autoSpawnEventApi,
  deleteCalendarEventApi,
  listCalendarEventsApi,
} from './CulturalCalendar';

describe('CulturalCalendar — Track 6 CP10 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('listShowsApi GET on /shows', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });
    await listShowsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
  });

  test('autoSpawnEventApi POST on /calendar/events/:eventId/auto-spawn', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { events: [] } } });
    await autoSpawnEventApi('e-1', { show_id: 'show-1', event_count: 1, max_guests: 6 });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/calendar/events/e-1/auto-spawn',
      { show_id: 'show-1', event_count: 1, max_guests: 6 },
    );
  });

  test('deleteCalendarEventApi DELETE on /calendar/events/:eventId', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    await deleteCalendarEventApi('e-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/calendar/events/e-1');
  });

  test('listCalendarEventsApi GET with event_type query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listCalendarEventsApi('lalaverse_cultural');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/events?event_type=lalaverse_cultural');
  });

  test('listCalendarEventsApi GET without event_type', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    await listCalendarEventsApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/calendar/events');
  });

  describe('Error path propagation', () => {
    test('listShowsApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listShowsApi()).rejects.toThrow('not authorized');
    });

    test('autoSpawnEventApi exposes response.data.error for UX', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { error: 'show_id required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(autoSpawnEventApi('e-1', {})).rejects.toMatchObject({
        response: { data: { error: 'show_id required' } },
      });
    });
  });
});
