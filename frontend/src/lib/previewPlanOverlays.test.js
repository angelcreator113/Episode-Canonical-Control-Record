/**
 * Still pictures in the working preview (Gate 2b PR 1b): framePlan keeps the
 * overlay layers layersAt already returns, resolves each through the
 * pictures the editor read, and says plainly when it cannot.
 */
import { describe, test, expect } from 'vitest';
import { mediaIndex, buildTimeline, LANES } from './editorModel';
import { framePlan } from './previewPlan';

const IMAGE = { id: 'img-1', url: 'https://cdn/title.png', width: 1920, height: 1080, name: 'Episode title' };
const media = (over = {}) => mediaIndex({
  rawClips: [{ id: 'r2', performer: 'lala', label: 'Lala walk', url_raw: 'https://cdn/r2.mp4' }],
  sceneSets: [{ id: 'set1', name: 'Closet', angles: [{ id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' }] }],
  images: [IMAGE], ...over,
});

const item = (id, values, { offset = 0, duration = 2000 } = {}) => ({
  id, kind: 'overlay', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: offset, values, duration_ms: duration,
});
const BOX = { x: 100, y: 50, w: 600, h: 400, opacity: 0.5 };
const edit = (items) => ({
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [{ id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: 0, source_out_ms: 6000, source_duration_ms: null, duration_ms: 6000 }],
  segments: [], pip: { id: 'p', default_layout: null, default_visible: false, use_cutout: false },
  visibility: [], items, audioItems: [], lineTimes: {}, voiceTakes: {},
});

describe('framePlan draws a still picture', () => {
  test('its box, opacity, fit and layer, with the picture the editor resolved', () => {
    const f = framePlan(edit([item('o1', { asset_id: 'img-1', layout: BOX, fit: 'cover', layer: 2 })]), 500, media());
    expect(f.overlays).toEqual([{
      item_id: 'o1', asset_id: 'img-1', layout: { x: 100, y: 50, w: 600, h: 400 }, opacity: 0.5,
      fit: 'cover', layer: 2, url: 'https://cdn/title.png', name: 'Episode title', unresolved: false, unread: false,
    }]);
    // Opacity belongs to the layer, never to the box the image is drawn in.
    expect(f.overlays[0].layout.opacity).toBeUndefined();
  });

  test('only while it shows, and in layer order', () => {
    const e = edit([
      item('late', { asset_id: 'img-1', layout: BOX, fit: 'contain', layer: 9 }),
      item('early', { asset_id: 'img-1', layout: BOX, fit: 'contain', layer: 1 }),
    ]);
    expect(framePlan(e, 500, media()).overlays.map((o) => o.item_id)).toEqual(['early', 'late']);
    expect(framePlan(e, 2500, media()).overlays).toEqual([]);     // past its length
  });

  test('a picture the episode may not draw is unresolved, not a failed read', () => {
    const f = framePlan(edit([item('o1', { asset_id: 'gone', layout: BOX, fit: 'contain', layer: 0 })]), 500, media());
    expect(f.overlays[0]).toMatchObject({ url: null, unresolved: true, unread: false });
  });

  test('a graphics list that could not be read says THAT, and is not called missing', () => {
    const f = framePlan(edit([item('o1', { asset_id: 'img-1', layout: BOX, fit: 'contain', layer: 0 })]), 500, media({ images: [], imagesRead: false }));
    expect(f.overlays[0]).toMatchObject({ url: null, unresolved: false, unread: true });
  });

  test('an edit with no pictures is the frame it always was', () => {
    const f = framePlan(edit([]), 500, media());
    expect(f.overlays).toEqual([]);
    expect(f.scene).toMatchObject({ kind: 'image', url: 'https://cdn/a1.jpg' });
  });
});

describe('the Overlays lane', () => {
  test('a picture is a block on it, named after the picture, with its times', () => {
    const model = buildTimeline(edit([item('o1', { asset_id: 'img-1', layout: BOX, fit: 'contain', layer: 0 }, { offset: 1000, duration: 2000 })]), media());
    expect(model.blocks.overlays).toHaveLength(1);
    expect(model.blocks.overlays[0]).toMatchObject({ lane: 'overlays', kind: 'overlay', start: 1000, end: 3000, label: 'Episode title', missing: false });
  });

  test('a picture the episode may not draw is marked on its block; an unread list is not', () => {
    const e = edit([item('o1', { asset_id: 'gone', layout: BOX, fit: 'contain', layer: 0 })]);
    expect(buildTimeline(e, media()).blocks.overlays[0].missing).toBe(true);
    expect(buildTimeline(e, media({ images: [], imagesRead: false })).blocks.overlays[0].missing).toBe(false);
  });

  test('the lane no longer says the kind is unbuilt, and says what it can and cannot do', () => {
    const lane = LANES.find((l) => l.key === 'overlays');
    expect(lane.pending).toBeUndefined();
    expect(lane.note).toBe('Static graphics supported · Animated widgets and interactive phone behavior not yet available');
  });
});
