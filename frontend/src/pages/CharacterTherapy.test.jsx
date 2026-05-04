/**
 * CharacterTherapy — Track 6 CP6 behavioral tests (file 2 of 4 in CP6 batch).
 *
 * 9 fetch sites migrated via 9 module-scope helpers. 7 file-local on
 * /therapy/* + 2 duplicated locally from CP3 WriteMode.jsx
 * (listRegistriesApi, getRegistryApi) per v2.12 §9.11 file-local
 * helper convention.
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
  // Registry (duplicated from CP3)
  listRegistriesApi,
  getRegistryApi,
  // Therapy
  listWaitingApi,
  getTherapyProfileApi,
  openSessionApi,
  respondSessionApi,
  revealApi,
  closeSessionApi,
  clearWaitingApi,
} from './CharacterTherapy';

describe('CharacterTherapy — Track 6 CP6 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  describe('Character registry (duplicated from CP3)', () => {
    test('listRegistriesApi GET on /character-registry/registries', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { registries: [] } });
      await listRegistriesApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries');
    });

    test('getRegistryApi GET on /character-registry/registries/:id', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, registry: {} } });
      await getRegistryApi('reg-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/character-registry/registries/reg-1');
    });
  });

  describe('Therapy', () => {
    test('listWaitingApi GET on /therapy/waiting', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
      await listWaitingApi();
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/therapy/waiting');
    });

    test('getTherapyProfileApi GET on /therapy/profile/:charId', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, profile: {} } });
      await getTherapyProfileApi('c-1');
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/therapy/profile/c-1');
    });

    test('openSessionApi POST on /therapy/session-open', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, character_response: '...' } });
      const payload = {
        character_id: 'c-1',
        character_key: 'lala',
        event_description: 'argument with mom',
        profile: {},
      };
      await openSessionApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/session-open', payload);
    });

    test('respondSessionApi POST on /therapy/session-respond', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, character_response: 'ok' } });
      const payload = {
        character_id: 'c-1',
        character_key: 'lala',
        author_response: 'how do you feel?',
        current_state: {},
        defense: 'withdrawal',
      };
      await respondSessionApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/session-respond', payload);
    });

    test('revealApi POST on /therapy/reveal', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const payload = {
        character_id: 'c-1',
        character_key: 'lala',
        truth: 'mom knew',
        reveal_type: 'hidden_event',
        current_state: {},
      };
      await revealApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/reveal', payload);
    });

    test('closeSessionApi POST on /therapy/session-close', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });
      const payload = {
        character_id: 'c-1',
        emotional_state: {},
        baseline: {},
        session_log: [],
        sessions_completed: 1,
        known: [],
        sensed: [],
        never_knows: [],
        deja_vu_events: [],
        primary_defense: 'withdrawal',
      };
      await closeSessionApi(payload);
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/session-close', payload);
    });

    test('clearWaitingApi POST on /therapy/clear-waiting/:waitingId (no body)', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
      await clearWaitingApi('w-1');
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/therapy/clear-waiting/w-1');
    });
  });

  describe('Error path propagation', () => {
    test('listRegistriesApi rejection propagates', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
      await expect(listRegistriesApi()).rejects.toThrow('not authorized');
    });

    test('openSessionApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(openSessionApi({})).rejects.toThrow('rate limited');
    });

    test('closeSessionApi rejection propagates', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('conflict'));
      await expect(closeSessionApi({})).rejects.toThrow('conflict');
    });
  });
});
