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

describe('look baselines (Look changed — redraft the list?)', () => {
  test('lookPiecesKey ignores order; lookChangedSince compares within one version only', async () => {
    const { lookPiecesKey, lookChangedSince } = await import('./eventDocuments');
    expect(lookPiecesKey([{ id: 'b' }, { id: 'a' }, null, {}])).toBe('a,b');
    expect(lookChangedSince({ version: 2, pieces: 'a,b' }, 2, 'a,c')).toBe(true);
    expect(lookChangedSince({ version: 2, pieces: 'a,b' }, 2, 'a,b')).toBe(false);
    expect(lookChangedSince({ version: 1, pieces: 'a,b' }, 2, 'a,c')).toBe(false);
    expect(lookChangedSince(null, 2, 'a')).toBe(false);
  });
  test('read and write through sessionStorage; a storage that throws is logged and reads as none', async () => {
    const { readLookBaselines, writeLookBaselines } = await import('./eventDocuments');
    window.sessionStorage.clear();
    writeLookBaselines('ev-7', { shopping_list: { version: 1, pieces: 'a' } });
    expect(readLookBaselines('ev-7')).toEqual({ shopping_list: { version: 1, pieces: 'a' } });
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(readLookBaselines('ev-7')).toEqual({});
    expect(err).toHaveBeenCalled();
    spy.mockRestore();
    err.mockRestore();
  });
});
