import { describe, test, expect } from 'vitest';
import {
  PROCESSING_STATES,
  PROCESSING_GIVE_UP_MS,
  backgroundRemovalStarted,
  deriveProcessingState,
  pollableIds,
  pickProcessedFields,
} from './wardrobeProcessingState';

const T0 = 1_000_000;
const original = { id: 'a', s3_url: 'https://b/a.jpg', s3_url_processed: null };
const finished = { id: 'a', s3_url: 'https://b/a.jpg', s3_url_processed: 'https://b/a-nobg.png' };

describe('backgroundRemovalStarted', () => {
  test('only the explicit started flag counts', () => {
    expect(backgroundRemovalStarted({ background_removal: 'started' })).toBe(true);
    expect(backgroundRemovalStarted({ background_removal: 'not_started' })).toBe(false);
    expect(backgroundRemovalStarted({ success: true, data: {} })).toBe(false); // older server
    expect(backgroundRemovalStarted(undefined)).toBe(false);
  });
});

describe('deriveProcessingState', () => {
  test('untracked item shows nothing, whatever its URLs', () => {
    expect(deriveProcessingState(original, undefined, T0)).toBe(PROCESSING_STATES.NONE);
    expect(deriveProcessingState(finished, undefined, T0)).toBe(PROCESSING_STATES.NONE);
    expect(deriveProcessingState({ id: 'x' }, undefined, T0)).toBe(PROCESSING_STATES.NONE);
  });

  test('tracked, no processed URL, inside the window → processing', () => {
    expect(deriveProcessingState(original, { startedAt: T0 }, T0 + 1000)).toBe(PROCESSING_STATES.PROCESSING);
    expect(deriveProcessingState(original, { startedAt: T0 }, T0 + PROCESSING_GIVE_UP_MS - 1)).toBe(PROCESSING_STATES.PROCESSING);
  });

  test('processed URL present → ready', () => {
    expect(deriveProcessingState(finished, { startedAt: T0 }, T0 + 5000)).toBe(PROCESSING_STATES.READY);
    // even past the window, a late arrival still counts as ready
    expect(deriveProcessingState(finished, { startedAt: T0 }, T0 + PROCESSING_GIVE_UP_MS * 2)).toBe(PROCESSING_STATES.READY);
  });

  test('window passed without a processed URL → stalled', () => {
    expect(deriveProcessingState(original, { startedAt: T0 }, T0 + PROCESSING_GIVE_UP_MS)).toBe(PROCESSING_STATES.STALLED);
  });

  test('failed retry → stalled; retry in flight → processing regardless of time', () => {
    expect(deriveProcessingState(original, { startedAt: T0, failed: true }, T0)).toBe(PROCESSING_STATES.STALLED);
    expect(deriveProcessingState(original, { startedAt: T0, retrying: true }, T0 + PROCESSING_GIVE_UP_MS * 3)).toBe(PROCESSING_STATES.PROCESSING);
  });

  test('tracked item with no source image, or a bad tracker, shows nothing', () => {
    expect(deriveProcessingState({ id: 'a', s3_url: null }, { startedAt: T0 }, T0)).toBe(PROCESSING_STATES.NONE);
    expect(deriveProcessingState(original, { startedAt: 'nope' }, T0)).toBe(PROCESSING_STATES.NONE);
    expect(deriveProcessingState(null, { startedAt: T0 }, T0)).toBe(PROCESSING_STATES.NONE);
  });
});

describe('pollableIds', () => {
  test('polls only live, in-window, non-retrying, non-failed trackers', () => {
    const trackers = {
      b: { startedAt: T0 },
      a: { startedAt: T0 },
      old: { startedAt: T0 - PROCESSING_GIVE_UP_MS },
      retrying: { startedAt: T0, retrying: true },
      failed: { startedAt: T0, failed: true },
    };
    expect(pollableIds(trackers, T0 + 10)).toEqual(['a', 'b']);
    expect(pollableIds({}, T0)).toEqual([]);
    expect(pollableIds(undefined, T0)).toEqual([]);
  });
});

describe('pickProcessedFields', () => {
  test('keeps only the fields the removal job writes', () => {
    const fresh = { ...finished, s3_key_processed: 'k', s3_url_bg_pink: 'p', name: 'Slip', episodes: [] };
    expect(pickProcessedFields(fresh)).toEqual({
      id: 'a', s3_url_processed: 'https://b/a-nobg.png', s3_key_processed: 'k', s3_url_bg_pink: 'p',
    });
  });
});
