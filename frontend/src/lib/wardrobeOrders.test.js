/** Import orders helpers (Task 3102). */
import { describe, test, expect } from 'vitest';
import { KEEP_FOR_LATER, confirmLines, lineFacts, pieceOptions, startingPicks, summaryText } from './wardrobeOrders';

const NEW = { order_id: '111-1', asin: 'B0SATIN001', title: 'Satin slip', order_date: '2026-09-14', price_paid: 48.99, quantity: 2, currency: 'USD', website: 'amazon.com', status: 'new', suggestion: { wardrobe_id: 'w1', reason: 'name' } };
const PLAIN = { ...NEW, order_id: '111-2', asin: 'B0PHONECAS', title: 'Phone case', quantity: 1, suggestion: null };
const DUP = { ...NEW, order_id: '111-3', status: 'duplicate', suggestion: null };

describe('wardrobeOrders', () => {
  test('new lines start ticked on their suggestion, else kept for later; duplicates are left out', () => {
    expect(startingPicks([NEW, PLAIN, DUP])).toEqual({
      '111-1|B0SATIN001': { include: true, wardrobe_id: 'w1' },
      '111-2|B0PHONECAS': { include: true, wardrobe_id: KEEP_FOR_LATER },
    });
  });

  test('confirmLines sends the ticked new lines with their piece, without the preview-only fields', () => {
    const picks = { ...startingPicks([NEW, PLAIN]), '111-2|B0PHONECAS': { include: false, wardrobe_id: '' } };
    const out = confirmLines([NEW, PLAIN, DUP], picks);
    expect(out).toEqual([{ order_id: '111-1', asin: 'B0SATIN001', title: 'Satin slip', order_date: '2026-09-14', price_paid: 48.99, quantity: 2, currency: 'USD', website: 'amazon.com', wardrobe_id: 'w1' }]);
    expect(confirmLines([PLAIN], startingPicks([PLAIN]))[0].wardrobe_id).toBeNull();
  });

  test('lineFacts, pieceOptions and summaryText read plainly', () => {
    expect(lineFacts(NEW)).toMatch(/^14 Sept? 2026 · \$48\.99 · ×2$/);
    expect(lineFacts({ ...PLAIN, currency: 'GBP', order_date: null })).toBe('GBP 48.99');
    expect(pieceOptions([{ id: 'b', name: 'Zip boot' }, { id: 'a', name: 'Ankle sock' }, { id: 'c' }]).map((p) => p.id)).toEqual(['a', 'b']);
    expect(summaryText({ matched: 2, unmatched: 1, duplicates: 3 })).toBe('2 put on pieces, 1 kept for later, 3 already imported.');
    expect(summaryText({ matched: 1 })).toBe('1 put on a piece.');
    expect(summaryText({})).toBe('Nothing to import.');
  });
});
