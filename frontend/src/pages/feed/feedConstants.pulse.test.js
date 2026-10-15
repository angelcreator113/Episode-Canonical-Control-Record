// A LalaVerse profile's social is The Pulse (Evoni, 2026-10-15): every
// screen reads a platform through platformLabel.
import { describe, test, expect } from 'vitest';
import { platformLabel, PULSE_PLATFORM } from './feedConstants';

describe('platformLabel', () => {
  test('The Pulse, its private account, and Pulse posts', () => {
    expect(PULSE_PLATFORM).toBe('pulse');
    expect(platformLabel('pulse')).toBe('The Pulse');
    expect(platformLabel('pulse_private')).toBe('Private Pulse account');
    expect(platformLabel('lalaverse')).toBe('The Pulse');
  });
  test("JustAWoman's real apps read by their names", () => {
    expect(platformLabel('instagram')).toBe('Instagram');
    expect(platformLabel('twitter')).toBe('Twitter / X');
  });
  test('an unknown value reads as itself, nothing as empty', () => {
    expect(platformLabel('myspace')).toBe('myspace');
    expect(platformLabel(null)).toBe('');
  });
});
