/**
 * SectionEditor — Track 2.5 behavioral tests for the migrated apiClient call.
 *
 * Tests the extracted `saveSections` helper (Track 2-A migration).
 * Component rendering not exercised — helper takes plain args, returns
 * apiClient.put promise.
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
import { saveSections } from './SectionEditor';

describe('SectionEditor — saveSections() behavioral tests', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('happy path — calls apiClient.put with chapter URL + sections payload', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ok: true } });

    const sections = [
      { id: 's1', content: 'Intro', meta: { section_type: 'beat' } },
      { id: 's2', content: 'Climax', meta: { section_type: 'scene' } },
    ];

    await saveSections('chap-42', sections);

    expect(apiClient.put).toHaveBeenCalledTimes(1);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/storyteller/chapters/chap-42',
      { sections }
    );
  });

  test('error path — apiClient.put rejection propagates to caller', async () => {
    const err = new Error('Conflict');
    vi.mocked(apiClient.put).mockRejectedValue(err);

    await expect(saveSections('chap-42', [])).rejects.toBe(err);
  });
});
