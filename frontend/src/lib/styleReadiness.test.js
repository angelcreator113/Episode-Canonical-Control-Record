/**
 * Style sheet readiness, the 12 chips (Task #2876): the one rule the Style
 * Page and the Production checklist both use.
 */
import { describe, test, expect } from 'vitest';
import { READINESS_CHIPS, styleReadiness } from './styleReadiness';

const img = (extra = {}) => ({ id: Math.random().toString(36).slice(2), source: 'upload', in_lookbook: true, ...extra });
const FIVE = ['#A01428', '#B8962E', '#D4AF93', '#BB6573', '#E3D4AD'].map((hex) => ({ hex }));

// Every chip ready.
const full = () => ({
  lookbook: {
    hair_name: 'soft glam waves',
    nails_name: 'crimson almond',
    tagline: 'Dressed for the experiment.',
    images: {
      front: [img()], side: [img()], back: [img()], hero: [img()],
      hair: [img()], nails: [img()], eyes: [img()], lips: [], skin: [],
      venue: [img()], inspo: [img()],
    },
    venue_options: [],
  },
  sheet: { wardrobe: { state: 'chosen', columns: [{ key: 'body', needed: false }, { key: 'shoes', needed: false }] }, palette: FIVE },
  palette: null,
});

const chip = (r, key) => r.items.find((i) => i.key === key).ready;

describe('styleReadiness', () => {
  test('twelve chips, in order', () => {
    expect(READINESS_CHIPS.map((c) => c.label)).toEqual(['Front', 'Side', 'Back', 'Hero', 'Hair', 'Nails', 'Beauty', 'Venue', 'Inspo', 'Wardrobe', 'Palette', 'Tagline']);
    expect(styleReadiness(full())).toMatchObject({ done: 12, total: 12, missing: [] });
  });

  test('an empty lookbook with no sheet is 0 of 12', () => {
    const r = styleReadiness({ lookbook: { images: {} } });
    expect(r).toMatchObject({ done: 0, total: 12 });
    expect(r.missing).toHaveLength(12);
  });

  test('each look photo is its own chip', () => {
    for (const k of ['front', 'side', 'back', 'hero']) {
      const d = full();
      d.lookbook.images[k] = [];
      const r = styleReadiness(d);
      expect({ k, ready: chip(r, k), done: r.done }).toEqual({ k, ready: false, done: 11 });
    }
  });

  test('hair and nails need a photo AND a name', () => {
    let d = full(); d.lookbook.hair_name = '   ';
    expect(chip(styleReadiness(d), 'hair')).toBe(false);
    d = full(); d.lookbook.images.hair = [];
    expect(chip(styleReadiness(d), 'hair')).toBe(false);
    d = full(); d.lookbook.nails_name = null;
    expect(chip(styleReadiness(d), 'nails')).toBe(false);
  });

  test('beauty: any one of eyes, lips, skin', () => {
    const d = full();
    d.lookbook.images.eyes = [];
    expect(chip(styleReadiness(d), 'beauty')).toBe(false);
    d.lookbook.images.skin = [img()];
    expect(chip(styleReadiness(d), 'beauty')).toBe(true);
  });

  test('venue: one In lookbook, or the scene set image the sheet falls back to', () => {
    const d = full();
    d.lookbook.images.venue = [img({ in_lookbook: false })];
    expect(chip(styleReadiness(d), 'venue')).toBe(false);
    d.lookbook.venue_options = [{ source: 'scene_set_look', ref_id: 'l', in_lookbook: false }];
    expect(chip(styleReadiness(d), 'venue')).toBe(true);
  });

  test('inspo: her uploads count, automatic textures do not', () => {
    const d = full();
    d.lookbook.images.inspo = [img({ source: 'texture' })];
    expect(chip(styleReadiness(d), 'inspo')).toBe(false);
  });

  test('wardrobe: a saved look with every required slot filled, Body included', () => {
    let d = full();
    d.sheet.wardrobe.columns[0].needed = true; // Body needed
    expect(chip(styleReadiness(d), 'wardrobe')).toBe(false);
    d = full(); d.sheet.wardrobe.state = 'none';
    expect(chip(styleReadiness(d), 'wardrobe')).toBe(false);
    d = full(); d.sheet = null;
    expect(chip(styleReadiness(d), 'wardrobe')).toBe(false);
  });

  test('palette: five colours; the palette shown wins over the saved one', () => {
    const d = full();
    d.sheet.palette = FIVE.slice(0, 4);
    expect(chip(styleReadiness(d), 'palette')).toBe(false);
    d.palette = FIVE;
    expect(chip(styleReadiness(d), 'palette')).toBe(true);
  });

  test('tagline: not empty', () => {
    const d = full();
    d.lookbook.tagline = '  ';
    const r = styleReadiness(d);
    expect(chip(r, 'tagline')).toBe(false);
    expect(r.missing).toEqual(['Tagline']);
  });
});
