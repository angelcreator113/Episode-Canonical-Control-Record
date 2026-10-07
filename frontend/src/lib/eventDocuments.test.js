import { describe, test, expect } from 'vitest';
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
    expect(lineOfPiece({ category: 'outerwear' })).toBeNull();
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

  test('the career plan\'s sections', () => {
    const s = careerSections({ items: [{ label: 'a' }, { label: 'b', section: 'bigger_goals' }, { label: 'c', section: 'this_event' }] });
    expect(s.thisEvent.map((i) => i.label)).toEqual(['a', 'c']);
    expect(s.biggerGoals.map((i) => i.label)).toEqual(['b']);
  });

  test('the byline names the host and the date', () => {
    expect(documentByline({ host_brand: 'Studio by Sable', event_date: '2026-11-12' })).toBe('for Studio by Sable · Nov 12');
    expect(documentByline({ name: 'Gala' })).toBe('for Gala');
    expect(documentByline(null)).toBe('');
  });
});
