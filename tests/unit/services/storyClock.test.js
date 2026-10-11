/**
 * services/storyClock — story time is the episode order (docs/FEED_POSTS.md
 * rule 9, 2026-10-04).
 */
const { orderOf, beatOrder, postOrder, label, presentOrder, checkAtBeat, parseAt, resolveAt, postOrderSql } = require('../../../src/services/storyClock');

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
  test("an event's moments sit between before and during (Task #2937)", () => {
    expect(orderOf(3, 'announced')).toBe(32);
    expect(orderOf(3, 'invitation_sent')).toBe(33);
    expect(orderOf(3, 'lala_arrives')).toBe(34);
    expect(label(32)).toBe('Announced Ep 3');
    expect(label(33)).toBe('Invitation sent Ep 3');
    expect(label(34)).toBe('Lala arrives Ep 3');
    expect(checkAtBeat(34, 3)).toEqual({ ok: true, check: 'ok' });
  });
  test('parseAt: an order or ep:<n>:<phase>; anything else is null', () => {
    expect(parseAt('37')).toBe(37);
    expect(parseAt(' 7 ')).toBe(7);
    expect(parseAt(42)).toBe(42);
    expect(parseAt('ep:3:after_episode')).toBe(37);
    expect(parseAt('ep:2:lala_arrives')).toBe(24);
    for (const bad of ['ep:3:soon', 'ep:x:after_episode', '-1', '3.5', 'present', '', null, undefined, -2, 1.5]) expect(parseAt(bad)).toBeNull();
  });
  test('resolveAt: absent is undefined, present asks the show, a bad value is a 400', async () => {
    const models = { Episode: { findOne: jest.fn().mockResolvedValue({ episode_number: 4 }) } };
    await expect(resolveAt(models, 'show', undefined)).resolves.toBeUndefined();
    await expect(resolveAt(models, 'show', '')).resolves.toBeUndefined();
    await expect(resolveAt(models, 'show', 'present')).resolves.toBe(47);
    await expect(resolveAt(models, 'show', 'ep:1:announced')).resolves.toBe(12);
    await expect(resolveAt(models, 'show', 'later')).rejects.toMatchObject({ status: 400 });
  });
  test('postOrderSql: the stamp, else the episode and its phase', () => {
    const sql = postOrderSql('FeedPost');
    expect(sql).toMatch(/^COALESCE\("FeedPost"\."story_order", \(SELECT e\.episode_number \* 10/);
    expect(sql).toContain("WHEN 'lala_arrives' THEN 4");
    expect(sql).toContain('ELSE 5 END');
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
