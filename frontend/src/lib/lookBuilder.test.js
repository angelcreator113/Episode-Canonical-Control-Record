/**
 * The look builder's helpers (Evoni's Producer Mode redesign, 2026-10-05).
 */
import { describe, test, expect } from 'vitest';
import { restoreLook, lookIds, toggleInLook, pieceReach, lookRows, lookCosts, canSaveLook, matchesDressCode, dressCodeKeywords, sameLook } from './lookBuilder';

const dress = { id: 'd', name: 'Slip Dress', clothing_category: 'dress', is_owned: true };
const top = { id: 't', name: 'Top', clothing_category: 'top', is_owned: true };
const shoes = { id: 's', name: 'Pumps', clothing_category: 'shoes', is_owned: false, lock_type: 'coin', coin_cost: 200 };
const earrings = { id: 'e', name: 'Pearls', clothing_category: 'jewelry', is_owned: false, lock_type: 'coin', coin_cost: 900 };
const ring = { id: 'r', name: 'Ring', clothing_category: 'jewelry', is_owned: true };
const notForSale = { id: 'n', name: 'Gift', clothing_category: 'bag', is_owned: false, lock_type: 'none' };
const lala = { coins: 500, reputation: 3 };

describe('lookBuilder', () => {
  test('a saved outfit restores into its slots, every piece selectable', () => {
    const look = restoreLook([dress, shoes, earrings, ring]);
    expect(look.body.id).toBe('d');
    expect(look.shoes).toMatchObject({ id: 's', can_select: true, in_saved_look: true });
    expect(look.jewelry.map((p) => p.id)).toEqual(['e', 'r']);
    expect([...lookIds(look)].sort()).toEqual(['d', 'e', 'r', 's']);
  });

  test('toggling: a piece goes in by its slot and comes out again; a top clears the dress', () => {
    let look = toggleInLook({}, dress, lala);
    look = toggleInLook(look, shoes, lala);
    expect([...lookIds(look)].sort()).toEqual(['d', 's']);
    look = toggleInLook(look, top, lala);
    expect(look.body).toBeUndefined();
    expect(look.top.id).toBe('t');
    look = toggleInLook(look, shoes, lala);
    expect(look.shoes).toBeUndefined();
  });

  test('reach: owned and affordable pieces go in; the rest say why', () => {
    expect(pieceReach(shoes, lala, {}).ok).toBe(true);
    expect(pieceReach(earrings, lala, {})).toEqual({ ok: false, why: 'Lala needs 900 coins for this piece' });
    expect(pieceReach(notForSale, lala, {})).toEqual({ ok: false, why: 'Lala does not own this piece and it is not for sale' });
    // A piece already in the saved look stays, whatever its reach.
    expect(pieceReach(earrings, lala, restoreLook([earrings])).ok).toBe(true);
  });

  test('the rows: worn pieces, then the slots still worth picking', () => {
    const rows = lookRows(toggleInLook({}, dress, lala));
    expect(rows.map((r) => [r.slot, r.item?.id || null])).toEqual([
      ['body', 'd'], ['shoes', null], ['accessories', null], ['jewelry', null], ['perfume', null],
    ]);
    const split = lookRows(toggleInLook({}, top, lala)).map((r) => [r.slot, r.item?.id || null]);
    expect(split.slice(0, 2)).toEqual([['top', 't'], ['bottom', null]]);
  });

  test('the money: unowned pieces cost their coins; payday adds the deal', () => {
    const look = toggleInLook(toggleInLook({}, dress, lala), shoes, lala);
    expect(lookCosts(look, 500, 650)).toEqual({ cost: 200, have: 500, after: 300, pays: 650, payday: 950 });
    // A piece already saved to the episode costs nothing more.
    expect(lookCosts(restoreLook([dress, shoes]), 500, 0).cost).toBe(0);
  });

  test('saving needs a dress or a top and bottom, shoes, reach and the coins', () => {
    expect(canSaveLook({}, null)).toEqual({ ok: false, why: 'Pick a dress, or a top and a bottom' });
    const noShoes = toggleInLook({}, dress, lala);
    expect(canSaveLook(noShoes, null).why).toBe('Pick shoes');
    const look = toggleInLook(noShoes, shoes, lala);
    expect(canSaveLook(look, lookCosts(look, 500, 0)).ok).toBe(true);
    expect(canSaveLook(look, lookCosts(look, 100, 0))).toEqual({ ok: false, why: 'Lala cannot afford this look yet' });
  });

  test('dress code: keywords, else the dress code\'s words; a piece matches on its style, color or tags', () => {
    expect(dressCodeKeywords({ dress_code_keywords: ['Satin', 'black'] })).toEqual(['satin', 'black']);
    expect(dressCodeKeywords({ dress_code: 'Black tie, no denim' })).toEqual(['black', 'tie', 'denim']);
    expect(matchesDressCode({ color: 'black' }, ['black', 'tie'])).toBe(true);
    expect(matchesDressCode({ tags: ['Evening'], aesthetic_tags: ['satin'] }, ['satin'])).toBe(true);
    expect(matchesDressCode({ color: 'pink' }, ['black'])).toBe(false);
    expect(matchesDressCode({ color: 'black' }, [])).toBe(false);
  });

  test('sameLook compares the pieces, not their order', () => {
    expect(sameLook(restoreLook([dress, shoes]), restoreLook([shoes, dress]))).toBe(true);
    expect(sameLook(restoreLook([dress]), restoreLook([dress, shoes]))).toBe(false);
  });
});
