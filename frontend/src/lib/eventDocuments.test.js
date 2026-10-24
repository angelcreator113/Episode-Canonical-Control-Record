import { vi, describe, test, expect } from 'vitest';
import { docState, docOverlay, lineOfPiece, shoppingLines, careerSections, documentByline } from './eventDocuments';

describe('eventDocuments (Evoni, 2026-10-06)', () => {
  test('the status chip', () => {
    expect(docState(null)).toEqual({ key: 'none', label: 'Not drafted' });
    expect(docState({ status: 'draft' }).label).toBe('Draft');
    expect(docState({ status: 'approved' }).label).toBe('Approved');
  });

  test('the overlay: made on approval, current while the approved version stands, outdated after an edit', () => {
    expect(docOverlay(null)).toBeNull();
    expect(docOverlay({ status: 'draft', version: 1 })).toMatchObject({ key: 'not_made', label: 'Overlay made on approval' });
    expect(docOverlay({ status: 'approved', version: 1 })).toMatchObject({ key: 'not_made', label: 'No overlay yet' });
    const overlay = { url: 'https://x/o.png', version: 2 };
    expect(docOverlay({ status: 'approved', version: 2, overlay })).toMatchObject({ key: 'current', url: overlay.url });
    expect(docOverlay({ status: 'draft', version: 3, overlay })).toMatchObject({ key: 'outdated', label: 'Overlay out of date until approved' });
    expect(docOverlay({ status: 'approved', version: 3, overlay }).label).toBe('Overlay out of date');
  });

  test('a piece\'s line by its category', () => {
    expect(lineOfPiece({ category: 'dress' })).toBe('dress');
    expect(lineOfPiece({ category: 'Handbag' })).toBe('purse');
    expect(lineOfPiece({ clothing_category: 'heels' })).toBe('shoes');
    // A jacket fills an outerwear line when the list names one (Task 3205).
    expect(lineOfPiece({ category: 'outerwear' })).toBe('outerwear');
    expect(lineOfPiece({ category: 'something else' })).toBeNull();
  });

  test('the shopping list\'s lines carry the look\'s pieces: owned ticked, the rest their coins', () => {
    const doc = { items: [
      { slot: 'dress', label: 'Find a statement piece' },
      { slot: 'shoes', label: 'Find polished flats' },
      { slot: 'jewelry', label: 'Find earrings' },
      { slot: 'purse', label: 'Find a bag' },
    ] };
    const pieces = [
      { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, is_owned: false },
      { name: 'Gold Drops', category: 'earrings', coin_cost: 90, is_owned: true },
      { name: 'Polished Flats', category: 'shoes', coin_cost: 180, is_owned: false },
    ];
    const { lines, total } = shoppingLines(doc, pieces);
    expect(lines.map((l) => [l.slot, l.piece?.name || null, l.owned, l.cost])).toEqual([
      ['dress', 'Sculpted Dress', false, 420],
      ['shoes', 'Polished Flats', false, 180],
      ['jewelry', 'Gold Drops', true, 0],
      ['purse', null, false, 0],
    ]);
    expect(total).toBe(600);
  });

  test('the episode\'s look adds up as Finalize charges it, and a piece no line takes is a line of its own (Task #2787)', () => {
    const doc = { items: [
      { slot: 'dress', label: 'Find a statement piece' },
      { slot: 'shoes', label: 'Find heels' },
      { slot: 'jewelry', label: 'Find earrings' },
    ] };
    // episodeLook pieces: each with the charge Finalize books, or why it is free.
    const pieces = [
      { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, is_owned: false, charge: { category: 'wardrobe_purchase', amount: 420 }, free_because: null },
      { name: 'Satin Heels', category: 'shoes', coin_cost: 300, is_owned: false, charge: null, free_because: 'bought' },
      { name: 'Gold Drops', category: 'jewelry', coin_cost: 90, is_owned: false, charge: null, free_because: 'gifted' },
      { name: 'Pearl Choker', category: 'jewelry', coin_cost: 150, is_owned: false, charge: { category: 'wardrobe_purchase', amount: 150 }, free_because: null },
      { name: 'Velvet Wrap', category: 'outerwear', coin_cost: 200, is_owned: false, charge: { category: 'wardrobe_rental', amount: 60 }, free_because: null },
    ];
    const { lines, total } = shoppingLines(doc, pieces);
    expect(lines.map((l) => [l.slot, l.label, l.piece?.name || null, l.owned, l.cost])).toEqual([
      ['dress', 'Find a statement piece', 'Sculpted Dress', false, 420],
      ['shoes', 'Find heels', 'Satin Heels', true, 0], // already bought: not charged again
      ['jewelry', 'Find earrings', 'Gold Drops', true, 0], // gifted
      ['extra', 'Pearl Choker', 'Pearl Choker', false, 150], // a second jewelry piece
      ['extra', 'Velvet Wrap', 'Velvet Wrap', false, 60], // no line for it; its rental
    ]);
    expect(total).toBe(630);
  });

  test('an overlay drawn with another total than the look\'s now is out of date', () => {
    const overlay = { url: 'https://x/list.png', version: 2, look_total: 420 };
    const doc = { status: 'approved', version: 2, overlay };
    expect(docOverlay(doc, 420).key).toBe('current');
    expect(docOverlay(doc, 630)).toMatchObject({ key: 'outdated', label: 'Overlay out of date: the look changed' });
    expect(docOverlay(doc).key).toBe('current'); // no total to compare: by version only
    expect(docOverlay({ ...doc, overlay: { url: 'u', version: 2 } }, 630).key).toBe('current'); // drawn before totals were kept
  });

  test('the career plan\'s sections', () => {
    const s = careerSections({ items: [{ label: 'a' }, { label: 'b', section: 'bigger_goals' }, { label: 'c', section: 'this_event' }] });
    expect(s.thisEvent.map((i) => i.label)).toEqual(['a', 'c']);
    expect(s.biggerGoals.map((i) => i.label)).toEqual(['b']);
  });

  test('the byline names the host and the date', () => {
    expect(documentByline({ host_brand: 'Studio by Sable', event_date: '2026-11-12' })).toBe('for Studio by Sable · Nov 12');
    expect(documentByline({ name: 'Gala' })).toBe('for Gala');
    expect(documentByline(null)).toBe('');
    // Free text is kept, not dropped by new Date(); "March 15" is not read as a moment.
    expect(documentByline({ host_brand: 'Velour', event_date: 'Friday, March 15th' })).toBe('for Velour · Friday, March 15th');
    expect(documentByline({ host_brand: 'Velour', event_date: 'March 15' })).toBe('for Velour · March 15');
  });
});

describe('the career plan carry preview and the amount note (2026-10-24)', () => {
  test('planLeftOut: over the limit, optional ideas go first, then the last goals; bigger goals never count', async () => {
    const { planLeftOut } = await import('./eventDocuments');
    const items = [
      { label: 'A', task_source: 'goal' }, { label: 'B', task_source: 'optional' },
      { label: 'C', task_source: 'goal' }, { label: 'G', section: 'bigger_goals' }, { label: 'D', task_source: 'goal' },
    ];
    expect([...planLeftOut(items, 2)].sort()).toEqual([1, 4]);
    expect(planLeftOut(items, 4).size).toBe(0);
    expect(planLeftOut(items, null).size).toBe(0);
  });

  test('amountNote says which amounts a version names that its source does not', async () => {
    const { amountNote } = await import('./eventDocuments');
    expect(amountNote({ checks: { amounts: { ok: false, invented: [1500] } } }, 'career_plan')).toBe('Names 1,500 coins, which the deal does not state.');
    expect(amountNote({ checks: { amounts: { ok: true, invented: [] } } }, 'shopping_list')).toBeNull();
    expect(amountNote({}, 'shopping_list')).toBeNull();
  });
});
