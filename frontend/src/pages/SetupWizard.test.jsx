/**
 * SetupWizard — Track 6 CP11 behavioral tests (file 4 of 17).
 *
 * 3 fetch sites migrated via 3 module-scope helpers. Onboarding
 * conversation flow; no cross-CP duplication.
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
  startOnboardingApi,
  respondOnboardingApi,
  confirmOnboardingApi,
} from './SetupWizard';

describe('SetupWizard — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('startOnboardingApi POST on /onboarding/start with empty payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { conversation_id: 'c-1', message: 'Welcome', beat: 1 },
    });
    const out = await startOnboardingApi({});
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/onboarding/start', {});
    expect(out.conversation_id).toBe('c-1');
  });

  test('respondOnboardingApi POST on /onboarding/respond with creator_message + beat + history', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Tell me more' } });
    const payload = {
      creator_message: 'A world of glass',
      current_beat: 2,
      conversation_history: [{ role: 'assistant', content: 'Hi' }],
      extracted_so_far: {},
    };
    await respondOnboardingApi(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/onboarding/respond', payload);
  });

  test('confirmOnboardingApi POST on /onboarding/confirm with extracted + ids', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { built: { cast_shells: [] } } });
    await confirmOnboardingApi({ extracted: {}, show_id: 's-1', registry_id: 'r-1' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/onboarding/confirm',
      { extracted: {}, show_id: 's-1', registry_id: 'r-1' },
    );
  });

  describe('Error path propagation', () => {
    test('startOnboardingApi rejection propagates (caller catches → fallback message)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('not authorized'));
      await expect(startOnboardingApi({})).rejects.toThrow('not authorized');
    });

    test('respondOnboardingApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(respondOnboardingApi({})).rejects.toThrow('rate limited');
    });

    test('confirmOnboardingApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('build failed'));
      await expect(confirmOnboardingApi({})).rejects.toThrow('build failed');
    });
  });
});
