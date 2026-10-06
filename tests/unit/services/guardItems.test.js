// The franchise guard's canon check items (the LalaVerse Show Bible "Check
// now", 2026-10-06): cleaned before the call, each warning attributed to one.
const { guardItems, itemOfWarning, GUARD_MAX_ITEMS, GUARD_ITEM_CHARS } = require('../../../src/services/guardItems');

describe('guardItems', () => {
  test('no items is null, so the route falls back to scene_brief', () => {
    expect(guardItems(undefined)).toBeNull();
    expect(guardItems(null)).toBeNull();
  });

  test('unusable items are a reason, never a silent pass', () => {
    expect(guardItems([])).toBe('items must be a non-empty array');
    expect(guardItems('x')).toBe('items must be a non-empty array');
    expect(guardItems(Array.from({ length: GUARD_MAX_ITEMS + 1 }, (_, i) => ({ key: `k${i}`, brief: 'b' })))).toBe(`at most ${GUARD_MAX_ITEMS} items per check`);
    expect(guardItems([{ key: 'a', brief: '' }])).toBe('each item needs a unique key and a brief');
    expect(guardItems([{ key: 'a', brief: 'x' }, { key: 'a', brief: 'y' }])).toBe('each item needs a unique key and a brief');
  });

  test('items are trimmed, labelled and their briefs cut', () => {
    const [item] = guardItems([{ key: ' episode:1 ', brief: 'z'.repeat(GUARD_ITEM_CHARS + 50) }]);
    expect(item.key).toBe('episode:1');
    expect(item.label).toBe('episode:1');
    expect(item.brief).toHaveLength(GUARD_ITEM_CHARS);
  });
});

describe('itemOfWarning', () => {
  const items = [{ key: 'episode:1' }, { key: 'event:7' }];
  test('names the item by its key, with or without brackets', () => {
    expect(itemOfWarning({ item: 'event:7' }, items)).toBe('event:7');
    expect(itemOfWarning({ item: '[episode:1]' }, items)).toBe('episode:1');
  });
  test('a key the request never sent is null', () => {
    expect(itemOfWarning({ item: 'event:99' }, items)).toBeNull();
    expect(itemOfWarning({}, items)).toBeNull();
  });
});
