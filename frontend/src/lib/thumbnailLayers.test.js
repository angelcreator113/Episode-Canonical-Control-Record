/**
 * The thumbnail as layers in the browser (Evoni, 2026-10-21): the layouts
 * as starting arrangements, a show's template filled with an episode's
 * words and pictures, the controls' changes, the layers list's moves, a
 * moved or turned layer's new box, and text fitting (the server's rule).
 */
import { describe, test, expect } from 'vitest';
import {
  presetLayers, fillTemplate, applyStyle, setRoleContent, layerOf, updateLayer, moveLayer, removeLayer, addText, addPicture,
  boxFromNode, fitText, fitPicture, layerName, LINE_HEIGHT, checklistRows,
} from './thumbnailLayers';

const CONTENT = {
  title: 'I Designed My Outfit', kicker: 'Styling Adventures', badge: 'EP 1',
  backgroundUrl: 'https://b.s3.amazonaws.com/bg.jpg', lalaUrl: 'https://b.s3.amazonaws.com/lala.png', jawUrl: null,
};
const STYLE = { accent: '#B8962E', textColor: '#FDF4E3', dim: 0.3 };
const roles = (spec) => spec.layers.map((l) => l.role);

describe('presetLayers', () => {
  test('Lala left: background, shade, Lala, show name, title, badge; Lala on the left, the words on the right, the badge top right', () => {
    const spec = presetLayers('lala-left', CONTENT, STYLE);
    expect(spec.version).toBe(2);
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'kicker', 'title', 'badge']);
    expect(layerOf(spec, 'lala')).toMatchObject({ x: 30, w: 560, src: CONTENT.lalaUrl, fit: 'contain' });
    expect(layerOf(spec, 'title')).toMatchObject({ x: 590, text: 'I Designed My Outfit', color: '#FDF4E3', align: 'left' });
    expect(layerOf(spec, 'shade')).toMatchObject({ side: 'left', dim: 0.3, accent: '#B8962E' });
    expect(layerOf(spec, 'badge')).toMatchObject({ x: 1054, fill: '#B8962E', text: 'EP 1' });
    expect(layerOf(spec, 'kicker')).toMatchObject({ color: '#B8962E', upper: true });
  });

  test('Lala right mirrors it; Title only has no figures and centres the words; with JustAWoman the two stand together', () => {
    const right = presetLayers('lala-right', CONTENT, STYLE);
    expect(layerOf(right, 'lala').x).toBe(1280 - 30 - 560);
    expect(layerOf(right, 'title').x).toBe(70);
    expect(layerOf(right, 'badge').x).toBe(56);
    const center = presetLayers('center', CONTENT, STYLE);
    expect(roles(center)).toEqual(['background', 'shade', 'kicker', 'title', 'badge']);
    expect(layerOf(center, 'title')).toMatchObject({ x: 110, w: 1060, align: 'center' });
    const duo = presetLayers('lala-left', { ...CONTENT, jawUrl: 'https://b.s3.amazonaws.com/jaw.jpg' }, STYLE);
    expect(roles(duo)).toEqual(['background', 'shade', 'jaw', 'lala', 'kicker', 'title', 'badge']);
    expect(layerOf(duo, 'jaw')).toMatchObject({ x: 20, w: 340 });
    expect(layerOf(duo, 'lala')).toMatchObject({ x: 210, w: 360 });
    // No badge words, no badge.
    expect(roles(presetLayers('lala-left', { ...CONTENT, badge: '' }, STYLE))).not.toContain('badge');
  });
});

describe('fillTemplate', () => {
  test('every role keeps its place and turn and takes the episode\'s words and pictures; other layers stay; a figure with no picture goes', () => {
    const template = presetLayers('lala-left', { ...CONTENT, jawUrl: 'https://b.s3.amazonaws.com/jaw-old.jpg' }, STYLE);
    const turned = updateLayer(addText(template, 'Come Style Me'), 'title', { x: 77, rotation: -8 });
    const filled = fillTemplate(turned, { title: 'Episode Two', kicker: 'S', badge: 'EP 2', backgroundUrl: 'https://b.s3.amazonaws.com/bg2.jpg', lalaUrl: 'https://b.s3.amazonaws.com/l2.png', jawUrl: null });
    expect(layerOf(filled, 'title')).toMatchObject({ text: 'Episode Two', x: 77, rotation: -8 });
    expect(layerOf(filled, 'background').src).toBe('https://b.s3.amazonaws.com/bg2.jpg');
    expect(layerOf(filled, 'lala').src).toBe('https://b.s3.amazonaws.com/l2.png');
    expect(layerOf(filled, 'jaw')).toBeNull();
    expect(filled.layers.find((l) => l.id === 'text-1').text).toBe('Come Style Me');
    expect(fillTemplate(null)).toEqual({ version: 2, layers: [] });
  });
});

describe('the controls and the layers list', () => {
  test('setRoleContent: words and pictures; a figure that is not there yet is added below the words; a badge is added', () => {
    let spec = presetLayers('center', { ...CONTENT, badge: '' }, STYLE);
    spec = setRoleContent(spec, 'title', 'New title');
    expect(layerOf(spec, 'title').text).toBe('New title');
    spec = setRoleContent(spec, 'lala', 'https://b.s3.amazonaws.com/l.png', 'center');
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'kicker', 'title']);
    expect(layerOf(spec, 'lala')).toMatchObject({ x: 30, w: 560 });
    spec = setRoleContent(spec, 'badge', 'EP 9');
    expect(layerOf(spec, 'badge')).toMatchObject({ text: 'EP 9', fill: '#B8962E' });
    expect(setRoleContent(spec, 'jaw', null)).toBe(spec);
    spec = setRoleContent(spec, 'background', null);
    expect(layerOf(spec, 'background').src).toBeNull();
  });

  test('applyStyle: the accent goes to the shade, the badge and the show name; the title colour; the dim', () => {
    const spec = applyStyle(presetLayers('lala-left', CONTENT, STYLE), { accent: '#A46EE0', textColor: '#FFFFFF', dim: 0.5 });
    expect(layerOf(spec, 'shade')).toMatchObject({ accent: '#A46EE0', dim: 0.5 });
    expect(layerOf(spec, 'badge').fill).toBe('#A46EE0');
    expect(layerOf(spec, 'kicker').color).toBe('#A46EE0');
    expect(layerOf(spec, 'title').color).toBe('#FFFFFF');
  });

  test('move up and down, remove, add words and pictures with their own ids, and each layer\'s name', () => {
    let spec = presetLayers('lala-left', CONTENT, STYLE);
    spec = moveLayer(spec, 'lala', 'up');
    expect(roles(spec).slice(2, 4)).toEqual(['kicker', 'lala']);
    expect(moveLayer(spec, 'background', 'down')).toBe(spec);
    spec = removeLayer(spec, 'kicker');
    expect(roles(spec)).not.toContain('kicker');
    spec = addPicture(addPicture(spec, 'https://b.s3.amazonaws.com/d.png', 'Sweater dress'), 'https://b.s3.amazonaws.com/b.png');
    expect(spec.layers.slice(-2).map((l) => l.id)).toEqual(['picture-1', 'picture-2']);
    expect(layerName(spec.layers.at(-2))).toBe('Sweater dress');
    expect(layerName(spec.layers.at(-1))).toBe('Picture');
    expect(layerName(layerOf(spec, 'title'))).toBe('Title');
    expect(layerName(addText(spec, 'Come Style Me').layers.at(-1))).toBe('Come Style Me');
  });
});

describe('boxFromNode', () => {
  test('a dragged layer: its centre gives its box; a resized one folds the scale into its size; the turn stays in -180..180', () => {
    const layer = { x: 100, y: 100, w: 200, h: 100 };
    expect(boxFromNode({ x: 400, y: 300 }, layer)).toEqual({ x: 300, y: 250, w: 200, h: 100, rotation: 0 });
    expect(boxFromNode({ x: 200, y: 150, scaleX: 1.5, scaleY: 0.5, rotation: 270 }, layer)).toEqual({ x: 50, y: 125, w: 300, h: 50, rotation: -90 });
    expect(boxFromNode({ x: 0, y: 0, scaleX: 0.01 }, layer).w).toBe(10);
  });
});

describe('fitText and fitPicture (as the server draws)', () => {
  const measure = (s, size) => s.length * size * 0.5;
  test('the server\'s fitting: the largest size whose lines fit the box', () => {
    expect(fitText('Come Style Me', { w: 400, h: 200, size: 80 }, measure)).toEqual({ size: 80, lines: ['Come Style', 'Me'] });
    const small = fitText('I Designed My Outfit for a Fashion Studio Experiment', { w: 600, h: 120, size: 90 }, measure);
    expect(small.lines.length * small.size * LINE_HEIGHT).toBeLessThanOrEqual(120);
  });
  test('cover fills the box, cropped from the centre; contain stands on the bottom, centred across', () => {
    expect(fitPicture(1600, 900, { w: 1280, h: 720, fit: 'cover' })).toEqual({ crop: { x: 0, y: 0, width: 1600, height: 900 }, x: 0, y: 0, w: 1280, h: 720 });
    expect(fitPicture(1000, 1000, { w: 1280, h: 720, fit: 'cover' }).crop).toEqual({ x: 0, y: 218.75, width: 1000, height: 562.5 });
    expect(fitPicture(300, 600, { w: 600, h: 600, fit: 'contain' })).toEqual({ crop: null, x: 150, y: 0, w: 300, h: 600 });
    expect(fitPicture(600, 300, { w: 600, h: 600, fit: 'contain' })).toEqual({ crop: null, x: 0, y: 300, w: 600, h: 300 });
  });
});

describe('Come Style Me (Evoni, 2026-10-21)', () => {
  const ALL = {
    ...CONTENT,
    outfitUrl: 'https://b.s3.amazonaws.com/back.png',
    checklist: ['Sweater dress', 'Accessories', 'Hair', 'Vibe'].map((text) => ({ text, checked: true })),
    edition: 'Sweater Dress Edition',
    pieces: [1, 2, 3, 4, 5].map((n) => ({ url: `https://b.s3.amazonaws.com/p${n}.png`, label: `Piece ${n}` })),
    logoUrl: 'https://b.s3.amazonaws.com/logo.png',
  };

  test('every layer: the scene set, the outfit behind Lala, four photo cards, the checklist, the headline, the show\'s name, the edition, the ribbon, the logo', () => {
    const spec = presetLayers('come-style-me', ALL, STYLE);
    expect(roles(spec)).toEqual(['background', 'shade', 'outfit', 'lala', 'piece-1', 'piece-2', 'piece-3', 'piece-4', 'checklist', 'headline', 'kicker', 'edition', 'badge', 'logo']);
    expect(layerOf(spec, 'piece-1')).toMatchObject({ frame: 'polaroid', name: 'Piece 1', rotation: -4 });
    expect(layerOf(spec, 'piece-2').rotation).toBe(4);
    expect(layerOf(spec, 'checklist')).toMatchObject({ kind: 'checklist', font: 'hand', items: ALL.checklist });
    expect(layerOf(spec, 'headline')).toMatchObject({ text: 'Come Style Me', font: 'script', rotation: -6 });
    expect(layerOf(spec, 'badge').text).toBe('EPISODE 1');
    expect(layerOf(spec, 'edition')).toMatchObject({ text: 'Sweater Dress Edition', bg: '#F4ECDD', upper: true });
  });

  test('only the core when the episode has nothing else: scene set, Lala, checklist, headline (and the show\'s name)', () => {
    const spec = presetLayers('come-style-me', { kicker: 'Styling Adventures', backgroundUrl: CONTENT.backgroundUrl, lalaUrl: CONTENT.lalaUrl, checklist: ALL.checklist }, STYLE);
    expect(roles(spec)).toEqual(['background', 'shade', 'lala', 'checklist', 'headline', 'kicker']);
  });

  test('its template fills each episode: the episode\'s pieces, edition, checklist and ribbon; a piece or edition it has none for goes; the headline stays', () => {
    const template = updateLayer(presetLayers('come-style-me', ALL, STYLE), 'headline', { text: 'Style Me Again', x: 600 });
    const next = fillTemplate(template, {
      ...CONTENT, badge: 'EP 2', checklist: [{ text: 'Gown', checked: false }], edition: null,
      pieces: [{ url: 'https://b.s3.amazonaws.com/q1.png', label: 'Clutch' }], outfitUrl: null, logoUrl: null,
    });
    expect(roles(next)).toEqual(['background', 'shade', 'lala', 'piece-1', 'checklist', 'headline', 'kicker', 'badge']);
    expect(layerOf(next, 'piece-1')).toMatchObject({ src: 'https://b.s3.amazonaws.com/q1.png', name: 'Clutch', frame: 'polaroid' });
    expect(layerOf(next, 'checklist').items).toEqual([{ text: 'Gown', checked: false }]);
    expect(layerOf(next, 'headline')).toMatchObject({ text: 'Style Me Again', x: 600 });
    expect(layerOf(next, 'badge').text).toBe('EPISODE 2');
  });

  test('the checklist\'s rows: one words size for all, the box beside them', () => {
    const measure = (s, size) => s.length * size * 0.5;
    const rows = checklistRows({ w: 300, h: 200, items: [{ text: 'Sweater dress' }, { text: 'Hair' }] }, measure);
    expect(rows).toMatchObject({ rowH: 100, box: 60, textX: 90 });
    expect('Sweater dress'.length * rows.size * 0.5).toBeLessThanOrEqual(210);
  });
});
