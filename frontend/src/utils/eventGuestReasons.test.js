import { describe, test, expect } from 'vitest';
import { guestReasons, MAX_REASONS } from './eventGuestReasons';

describe('guestReasons', () => {
  test('each fact the data records, in order', () => {
    expect(guestReasons({
      guest: { relationship: 'collab' },
      profile: { city: 'dazzle_district', followers: [{ character_key: 'lala' }], follower_tier: 'mega', current_trajectory: 'rising' },
      organizer: { city: 'dazzle_district' },
    })).toEqual(['Collaborated with the organizer', 'Same district as the organizer', 'Lala follows her']);
    expect(MAX_REASONS).toBe(3);
  });

  test('a high following and a trajectory', () => {
    expect(guestReasons({ profile: { follower_tier: 'macro', current_trajectory: 'viral_moment' } }))
      .toEqual(['High Pulse following', 'Having a viral moment']);
  });

  test('nothing the data supports: none, never a guess', () => {
    expect(guestReasons({ profile: { follower_tier: 'micro', current_trajectory: 'plateauing', city: 'echo_park' }, organizer: { city: 'radiance_row' } })).toEqual([]);
    expect(guestReasons({ guest: { relationship: 'rival' } })).toEqual([]); // the role's own reason says it
    expect(guestReasons({ profile: { city: 'echo_park' }, organizer: null })).toEqual([]);
    expect(guestReasons()).toEqual([]);
  });
});
