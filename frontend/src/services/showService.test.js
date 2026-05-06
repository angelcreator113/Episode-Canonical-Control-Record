/**
 * showService — Track 6 CP9 behavioral tests (file 1 of 8 in CP9 batch).
 *
 * Service-module structure: each method internally calls apiClient.
 * Service contract preserved — getAllShows() returns array, getShowById()
 * returns object, etc. CP9 precedence inversion noted: showService is the
 * canonical /shows accessor; CP2 SceneSetsTab + CP5 SeriesPage + CP7 Home
 * have file-local listShowsApi duplicates per Track 6 file-local convention.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from './api';
import { showService } from './showService';

describe('showService — Track 6 CP9 service-module migration', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getAllShows GET on /shows; returns result.data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 's1' }] } });
    const result = await showService.getAllShows();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows');
    expect(result).toEqual([{ id: 's1' }]);
  });

  test('getAllShows returns [] on empty response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    const result = await showService.getAllShows();
    expect(result).toEqual([]);
  });

  test('getShowById GET on /shows/:id; returns result.data', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 's1' } } });
    const result = await showService.getShowById('s1');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/shows/s1');
    expect(result).toEqual({ id: 's1' });
  });

  test('createShow POST on /shows with payload; returns result.data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'new' } } });
    const payload = { title: 'New Show', description: 'desc' };
    const result = await showService.createShow(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/shows', payload);
    expect(result).toEqual({ id: 'new' });
  });

  test('updateShow PUT on /shows/:id; returns result.data', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { data: { id: 's1', title: 'Updated' } } });
    const result = await showService.updateShow('s1', { title: 'Updated' });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/shows/s1', { title: 'Updated' });
    expect(result).toEqual({ id: 's1', title: 'Updated' });
  });

  test('deleteShow DELETE on /shows/:id; returns response.data', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
    const result = await showService.deleteShow('s1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/shows/s1');
    expect(result).toEqual({ success: true });
  });

  describe('Error path propagation', () => {
    test('getAllShows rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(showService.getAllShows()).rejects.toThrow('not authorized');
    });

    test('createShow exposes response.data.message via wrapped Error', async () => {
      const httpErr = new Error('validation');
      httpErr.response = { status: 400, data: { message: 'title required' } };
      vi.mocked(apiClient.post).mockRejectedValue(httpErr);
      await expect(showService.createShow({})).rejects.toThrow('title required');
    });

    test('updateShow falls back to error.message when no response.data.message', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('network down'));
      await expect(showService.updateShow('s1', {})).rejects.toThrow('network down');
    });

    test('deleteShow falls back to default text when neither response.data.message nor error.message', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue({});
      await expect(showService.deleteShow('s1')).rejects.toThrow('Failed to delete show');
    });
  });
});
