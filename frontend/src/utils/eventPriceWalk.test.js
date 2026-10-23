import { describe, test, expect } from 'vitest';
import { unpricedItems, nextUnpriced, getPriceWalk, setPriceWalk } from './eventPriceWalk';

const DEAL = { deal_components: ['paid_for_content', 'partnership_base', 'paid_to_appear'], partnership_base_fee: null, appearance_fee: 200 };

describe('unpricedItems', () => {
  test('deliverables, then the fee components, then costs Lala pays; each with a key and a label', () => {
    const items = unpricedItems({
      event: DEAL,
      deliverables: [{ id: 'd1', description: 'Reel', fee: null }, { id: 'd2', description: 'Story', fee: 0 }],
      costs: [{ id: 'c1', label: 'Car', kind: 'travel', amount: null, paid_by: 'lala' }, { id: 'c2', kind: 'glam', amount: null, paid_by: 'host' }],
    });
    expect(items.map((i) => i.key)).toEqual(['deliverable:d1', 'component:partnership_base_fee', 'cost:c1']);
    expect(items.map((i) => i.label)).toEqual(['Reel', 'Partnership base', 'Car']);
  });

  test('a deal that does not pay its deliverables needs no fee on them; a legacy event has no costs or components', () => {
    expect(unpricedItems({ event: { deal_components: ['partnership_base'], partnership_base_fee: 5 }, deliverables: [{ id: 'd1', fee: null }] })).toEqual([]);
    expect(unpricedItems({ event: {}, deliverables: [{ id: 'd1', fee: null }], costs: [{ id: 'c1', amount: null, paid_by: 'lala' }] })).toEqual([]);
  });
});

describe('the walk', () => {
  test('nextUnpriced skips what was offered; the walk is kept by event', () => {
    const items = [{ key: 'a' }, { key: 'b' }];
    expect(nextUnpriced(items, ['a'])).toEqual({ key: 'b' });
    expect(nextUnpriced(items, ['a', 'b'])).toBeNull();
    setPriceWalk('ev-9', { current: 'a', done: ['a'] });
    expect(getPriceWalk('ev-9')).toEqual({ current: 'a', done: ['a'] });
    setPriceWalk('ev-9', null);
    expect(getPriceWalk('ev-9')).toBeNull();
  });
});
