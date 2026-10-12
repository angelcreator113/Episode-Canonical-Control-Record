/**
 * A piece's real-world fields (Task #3019): the editor's starting values,
 * only the changed fields sent, and the server's refusal in plain words.
 */
import { describe, test, expect } from 'vitest';
import { REAL_FIELDS, realDraftFrom, realChanges, realWorldErrorText } from './wardrobeRealWorld';

const PIECE = {
  id: 'w1', name: 'Lilac Slip Dress', brand: 'Maison Belle', price: 420,
  real_brand: 'Reformation', real_price_paid: '128.00', real_order_date: '2026-09-14', real_source: null,
};

describe('wardrobeRealWorld', () => {
  test('the ten editable fields, without the source', () => {
    expect(REAL_FIELDS.map((f) => f.key)).toEqual([
      'real_brand', 'real_product_name', 'real_retailer', 'real_color', 'real_size',
      'real_price_paid', 'real_list_price', 'real_product_url', 'affiliate_url', 'real_order_date',
    ]);
  });

  test('realDraftFrom: every field as text, empty when unset', () => {
    const d = realDraftFrom(PIECE);
    expect(d.real_brand).toBe('Reformation');
    expect(d.real_price_paid).toBe('128.00');
    expect(d.real_order_date).toBe('2026-09-14');
    expect(d.affiliate_url).toBe('');
    expect(realDraftFrom({ real_order_date: '2026-09-14T00:00:00.000Z' }).real_order_date).toBe('2026-09-14');
  });

  test('realChanges: nothing changed sends nothing; a price reread as 128 is not a change', () => {
    expect(realChanges(PIECE, realDraftFrom(PIECE))).toEqual({});
    expect(realChanges(PIECE, { ...realDraftFrom(PIECE), real_price_paid: '128' })).toEqual({});
  });

  test('realChanges: only the changed fields; an emptied one is null; text trimmed', () => {
    const draft = { ...realDraftFrom(PIECE), real_brand: '', affiliate_url: ' https://shop.example/x?ref=lala ' };
    expect(realChanges({ ...PIECE, real_source: 'gmail' }, draft)).toEqual({
      real_brand: null, affiliate_url: 'https://shop.example/x?ref=lala',
    });
  });

  test('realChanges: the first real field on a piece with no source marks it manual', () => {
    expect(realChanges(PIECE, { ...realDraftFrom(PIECE), real_retailer: 'Nordstrom' }))
      .toEqual({ real_retailer: 'Nordstrom', real_source: 'manual' });
    expect(realChanges(PIECE, { ...realDraftFrom(PIECE), real_brand: '' })).toEqual({ real_brand: null });
  });

  test("realWorldErrorText: the server's refusal in plain words; other errors are not its", () => {
    const err = { response: { status: 400, data: { error: 'Invalid real-world fields', details: [
      'real_price_paid must be a number of zero or more', 'real_order_date must be a date, YYYY-MM-DD',
    ] } } };
    expect(realWorldErrorText(err)).toBe('Real world: Price paid must be a number of zero or more; Order date must be a date, YYYY-MM-DD.');
    expect(realWorldErrorText({ response: { data: { error: 'Item not found' } } })).toBeNull();
    expect(realWorldErrorText(new Error('offline'))).toBeNull();
  });
});
