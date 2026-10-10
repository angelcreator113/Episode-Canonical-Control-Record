/**
 * Style sheet readiness, "Ready x of 12" (Evoni's ruling, 2026-10-10): the
 * one rule, on the server since Task #2877 (styleSheetService.styleReadiness).
 * The Style Page, the Production checklist and the Wardrobe panel read its
 * result from GET /style-sheet.
 */
jest.mock('../../../src/services/episodeLookbookService', () => ({ LookbookError: class extends Error {}, getLookbook: jest.fn() }));

const { styleReadiness, READINESS_CHIPS } = require('../../../src/services/styleSheetService');

const img = (extra = {}) => ({ id: Math.random().toString(36).slice(2), source: 'upload', in_lookbook: true, ...extra });
const FIVE = ['#A01428', '#B8962E', '#D4AF93', '#BB6573', '#E3D4AD'].map((hex) => ({ hex }));

const full = () => ({
  lb: {
    hair_name: 'soft glam waves', nails_name: 'crimson almond', tagline: 'Dressed for the experiment.', palette: FIVE,
    images: { front: [img()], side: [img()], back: [img()], hero: [img()], hair: [img()], nails: [img()], eyes: [img()], lips: [], skin: [], venue: [img()], inspo: [img()] },
    venue_options: [],
  },
  sheet: { wardrobe: { state: 'chosen', columns: [{ key: 'body', needed: false }] }, palette_sources: [] },
});
const chip = (r, key) => r.items.find((i) => i.key === key).ready;

describe('styleReadiness (server)', () => {
  test('twelve chips in order; all ready is 12 of 12', () => {
    expect(READINESS_CHIPS.map(([, label]) => label)).toEqual(['Front', 'Side', 'Back', 'Hero', 'Hair', 'Nails', 'Beauty', 'Venue', 'Inspo', 'Wardrobe', 'Palette', 'Tagline']);
    const { lb, sheet } = full();
    expect(styleReadiness(lb, sheet)).toMatchObject({ done: 12, total: 12, missing: [] });
  });

  test('an empty Lookbook with no saved look is 0 of 12', () => {
    const r = styleReadiness({ images: {} }, { wardrobe: { state: 'none', columns: [] } });
    expect(r).toMatchObject({ done: 0, total: 12 });
  });

  test('each look photo is its own chip', () => {
    for (const k of ['front', 'side', 'back', 'hero']) {
      const { lb, sheet } = full();
      lb.images[k] = [];
      const r = styleReadiness(lb, sheet);
      expect({ k, ready: chip(r, k), done: r.done }).toEqual({ k, ready: false, done: 11 });
    }
  });

  test('hair and nails need a photo AND a name', () => {
    let d = full(); d.lb.hair_name = '  ';
    expect(chip(styleReadiness(d.lb, d.sheet), 'hair')).toBe(false);
    d = full(); d.lb.images.nails = [];
    expect(chip(styleReadiness(d.lb, d.sheet), 'nails')).toBe(false);
  });

  test('beauty: any of eyes, lips, skin; inspo: her uploads only', () => {
    let d = full(); d.lb.images.eyes = [];
    expect(chip(styleReadiness(d.lb, d.sheet), 'beauty')).toBe(false);
    d = full(); d.lb.images.inspo = [img({ source: 'texture' })];
    expect(chip(styleReadiness(d.lb, d.sheet), 'inspo')).toBe(false);
  });

  test('venue: one In lookbook, or the scene set image the sheet falls back to', () => {
    const d = full();
    d.lb.images.venue = [img({ in_lookbook: false })];
    expect(chip(styleReadiness(d.lb, d.sheet), 'venue')).toBe(false);
    d.lb.venue_options = [{ source: 'scene_angle', ref_id: 'a' }];
    expect(chip(styleReadiness(d.lb, d.sheet), 'venue')).toBe(true);
  });

  test('wardrobe: a saved look with every required slot filled, Body included', () => {
    let d = full(); d.sheet.wardrobe.columns[0].needed = true;
    expect(chip(styleReadiness(d.lb, d.sheet), 'wardrobe')).toBe(false);
    d = full(); d.sheet.wardrobe.state = 'none';
    expect(chip(styleReadiness(d.lb, d.sheet), 'wardrobe')).toBe(false);
  });

  test('palette: five saved colours, or none saved and piece images to take them from', () => {
    let d = full(); d.lb.palette = FIVE.slice(0, 4);
    expect(chip(styleReadiness(d.lb, d.sheet), 'palette')).toBe(false);
    d = full(); d.lb.palette = null;
    expect(chip(styleReadiness(d.lb, d.sheet), 'palette')).toBe(false);
    d.sheet.palette_sources = ['data:image/png;base64,AA'];
    expect(chip(styleReadiness(d.lb, d.sheet), 'palette')).toBe(true);
  });

  test('tagline: not empty', () => {
    const d = full(); d.lb.tagline = '';
    expect(styleReadiness(d.lb, d.sheet).missing).toEqual(['Tagline']);
  });
});
