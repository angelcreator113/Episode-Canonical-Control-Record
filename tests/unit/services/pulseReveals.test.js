/** services/pulseReveals — an item's state at a story moment (Task #2938; The Pulse spec §5). */
const { stateAt, resolveOrder, MOMENTS } = require('../../../src/services/pulseReveals');

describe('pulseReveals', () => {
  test('stateAt: revealed from its moment; before it, its mode; with no moment (Director view), revealed', () => {
    const teaser = { story_order: 24, mode: 'teaser' };
    const hidden = { story_order: 24, mode: 'hidden' };
    expect(stateAt(teaser, 23)).toBe('teaser');
    expect(stateAt(hidden, 23)).toBe('hidden');
    expect(stateAt(teaser, 24)).toBe('revealed');
    expect(stateAt(hidden, 37)).toBe('revealed');
    expect(stateAt(teaser, undefined)).toBe('revealed');
    expect(stateAt(null, 5)).toBe('revealed');
    // A moment not known yet (its event has no episode) waits.
    expect(stateAt({ story_order: null, mode: 'hidden' }, 99)).toBe('hidden');
    expect(stateAt({ story_order: null, mode: 'teaser' }, 99)).toBe('teaser');
  });
  test('resolveOrder: a set story time as given; an unknown moment is null', async () => {
    await expect(resolveOrder({}, { moment: 'story_time', story_order: 17 })).resolves.toBe(17);
    await expect(resolveOrder({}, { moment: 'story_time', story_order: null })).resolves.toBeNull();
    await expect(resolveOrder({}, { moment: 'soon' })).resolves.toBeNull();
    await expect(resolveOrder({}, { moment: 'during' })).resolves.toBeNull();
  });
  test('the spec’s moments, plus a set story time', () => {
    expect(MOMENTS).toEqual(['announced', 'invitation_sent', 'lala_arrives', 'during', 'after', 'story_time']);
  });
});
