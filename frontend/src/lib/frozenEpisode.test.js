import { describe, expect, it } from 'vitest';
import { FROZEN_EPISODE_CODES, deleteFailureText, isFrozenEpisodeRefusal } from './frozenEpisode';

const refusal = (code, error) => ({ message: 'Request failed with status code 409', response: { status: 409, data: { code, error } } });

describe('frozenEpisode (A1.2c)', () => {
  it('knows both refusal codes', () => {
    expect(FROZEN_EPISODE_CODES).toEqual(['EPISODE_SNAPSHOT_FROZEN', 'EVENT_EPISODE_FROZEN']);
    expect(isFrozenEpisodeRefusal(refusal('EPISODE_SNAPSHOT_FROZEN', 'x'))).toBe(true);
    expect(isFrozenEpisodeRefusal(refusal('OTHER', 'x'))).toBe(false);
    expect(isFrozenEpisodeRefusal(new Error('network'))).toBe(false);
  });
  it('shows the server\'s reason for a refused delete, never the bare HTTP status', () => {
    const text = 'This episode has been filmed (since 2026-10-23), so it cannot be deleted.';
    expect(deleteFailureText(refusal('EPISODE_SNAPSHOT_FROZEN', text))).toBe(text);
    expect(deleteFailureText(new Error('Network Error'))).toBe('Network Error');
    expect(deleteFailureText({})).toBe('The episode was not deleted.');
  });
});
