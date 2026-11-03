/**
 * A phone, and which way it is held (Evoni, 2026-11-03): a touch screen whose
 * short side is under 600 px is a phone; tablets and desktops never are.
 */
import { describe, test, expect, vi } from 'vitest';
import { readPhoneOrientation } from './usePhoneOrientation';

const win = ({ coarse, portrait, w, h }) => ({
  matchMedia: vi.fn((q) => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(orientation: portrait)' ? portrait : false })),
  screen: { width: w, height: h },
  innerWidth: w,
  innerHeight: h,
});

describe('readPhoneOrientation', () => {
  test('a phone held upright, and sideways', () => {
    expect(readPhoneOrientation(win({ coarse: true, portrait: true, w: 390, h: 844 }))).toMatchObject({ phone: true, portrait: true });
    expect(readPhoneOrientation(win({ coarse: true, portrait: false, w: 844, h: 390 }))).toMatchObject({ phone: true, portrait: false });
  });

  test('a tablet, a desktop and a narrow desktop window are not phones', () => {
    expect(readPhoneOrientation(win({ coarse: true, portrait: true, w: 768, h: 1024 }))).toMatchObject({ phone: false, portrait: false });
    expect(readPhoneOrientation(win({ coarse: false, portrait: false, w: 1440, h: 900 }))).toMatchObject({ phone: false, portrait: false });
    expect(readPhoneOrientation(win({ coarse: false, portrait: true, w: 390, h: 844 }))).toMatchObject({ phone: false, portrait: false });
  });

  test('no matchMedia (an old browser, a test) is never a phone', () => {
    expect(readPhoneOrientation({})).toMatchObject({ phone: false, portrait: false });
    expect(readPhoneOrientation(null)).toMatchObject({ phone: false, portrait: false });
  });
});
