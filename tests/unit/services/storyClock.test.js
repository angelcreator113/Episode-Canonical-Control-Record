/**
 * services/storyClock — story time is the episode order (docs/FEED_POSTS.md
 * rule 9, 2026-10-04).
 */
const { orderOf, beatOrder, postOrder, label, presentOrder, checkAtBeat } = require('../../../src/services/storyClock');

describe('storyClock', () => {
  test('order = episode * 10 + phase; a beat is during its episode', () => {
    expect(orderOf(3, 'before_episode')).toBe(31);
    expect(orderOf(3, 'during_episode')).toBe(35);
    expect(orderOf(3, 'after_episode')).toBe(37);
    expect(orderOf(3, 'week_later')).toBe(39);
    expect(orderOf(3, undefined)).toBe(35);
    expect(orderOf(null)).toBeNull();
    expect(beatOrder(4)).toBe(45);
  });
  test('postOrder: the stamp, else the episode and phase, else unknown', () => {
    expect(postOrder({ story_order: 27 }, 5)).toBe(27);
    expect(postOrder({ episode_id: 'e', timeline_position: 'after_episode' }, 2)).toBe(27);
    expect(postOrder({ episode_id: 'e' }, 2)).toBe(25);
    expect(postOrder({ episode_id: 'e' }, null)).toBeNull();
    expect(postOrder({}, 2)).toBeNull();
  });
  test('labels', () => {
    expect(label(27)).toBe('After Ep 2');
    expect(label(31)).toBe('Before Ep 3');
    expect(label(48)).toBe('The day after Ep 4');
    expect(label(7)).toBe('Backstory');
    expect(label(null)).toBeNull();
  });
  test('checkAtBeat: no later than the beat; unknown passes', () => {
    expect(checkAtBeat(27, 3)).toEqual({ ok: true, check: 'ok' });
    expect(checkAtBeat(35, 3)).toEqual({ ok: true, check: 'ok' });
    const late = checkAtBeat(37, 3);
    expect(late.ok).toBe(false);
    expect(late.message).toMatch(/After Ep 3; a beat of Ep 3 is earlier in story time/);
    expect(checkAtBeat(null, 3)).toEqual({ ok: true, check: 'unknown' });
    expect(checkAtBeat(27, null)).toEqual({ ok: true, check: 'unknown' });
  });
  test('presentOrder: after the latest published episode; backstory when none', async () => {
    const Episode = { findOne: jest.fn(async () => ({ episode_number: 4 })) };
    expect(await presentOrder({ Episode }, 's-1')).toBe(47);
    expect(Episode.findOne.mock.calls[0][0].where).toMatchObject({ show_id: 's-1', status: 'published' });
    expect(Episode.findOne.mock.calls[0][0].order).toEqual([['episode_number', 'DESC']]);
    expect(await presentOrder({ Episode: { findOne: jest.fn(async () => null) } }, 's-1')).toBe(7);
    expect(await presentOrder({}, 's-1')).toBe(7);
  });
});
