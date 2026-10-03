/**
 * Social Systems Brain Manifest (Brain Update step 1; docs/BRAIN_OWNERSHIP.md):
 * one card per source item with a stable key; presentation never pushed.
 */
const { buildCards, DOMAINS } = require('../../../src/services/brainManifests/socialSystems');

describe('Social Systems Brain Manifest', () => {
  test('keys follow the item name, not its position, so reordering changes nothing', () => {
    const a = { name: 'The Connector', content: 'x' };
    const b = { name: 'The Rebel', content: 'y' };
    const one = buildCards({ ARCHETYPES: [a, b] }).cards.map((c) => [c.source_key, c.content]);
    const two = buildCards({ ARCHETYPES: [b, a] }).cards.map((c) => [c.source_key, c.content]);
    expect(new Map(one)).toEqual(new Map(two));
    expect(one[0][0]).toBe('social_systems:archetype:the-connector');
  });

  test('a duplicate name gets its own key; an unnamed item is skipped and reported', () => {
    const { cards, skipped } = buildCards({ ECONOMY_STREAMS: [{ stream: 'Creator Shops' }, { stream: 'Creator Shops' }, { what: 'no name' }] });
    expect(cards.map((c) => c.source_key)).toEqual(['social_systems:economy:creator-shops', 'social_systems:economy:creator-shops-2']);
    expect(skipped).toEqual([{ domain: 'Economy Stream', index: 2 }]);
  });

  test('a field the editor added is carried under a readable label; icon, color and num never are', () => {
    const [card] = buildCards({ LEGACY_SIGNALS: [{ signal: 'Becoming a Reference Point', icon: '📌', color: '#a889c8', num: '05', looksLike: 'Cited', hostTendency: 'high' }] }).cards;
    expect(card.content).toBe('Becoming a Reference Point (Legacy Signal)\nLooks like: Cited\nHost tendency: high');
    expect(card).toMatchObject({ category: 'world', severity: 'important', domain: 'Legacy Signal' });
  });

  test('every page_content key is a domain; anything else on the page is not pushed', () => {
    expect(DOMAINS).toHaveLength(8);
    expect(buildCards({ expandedArch: '11', LEGENDARY_GROUPS: [{ group: 'x' }] }).cards).toEqual([]);
  });
});
