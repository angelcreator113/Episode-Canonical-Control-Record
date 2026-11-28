/**
 * The monitor draws a still picture (Gate 2b PR 1b): over everything, at
 * the box, fit and opacity the edit gives it, with opacity applied once,
 * and obeying the Overlays lane's hidden and locked switches.
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditorPreview from './EditorPreview';

const overlay = (over = {}) => ({
  item_id: 'o1', asset_id: 'img-1', layout: { x: 100, y: 50, w: 960, h: 540 }, opacity: 0.5,
  fit: 'contain', layer: 0, url: 'https://cdn/title.png', name: 'Episode title',
  unresolved: false, unread: false, ...over,
});
const frame = (over = {}) => ({
  t: 500, beat: 1, scene: null, performers: [], pip: null, captions: [], overlays: [overlay()],
  mode: 'gameplay', prime_missing: false, scene_gap: false, ...over,
});
const draw = (props = {}) => render(
  <EditorPreview
    frame={frame(props.frame)} duration={6000} selectedId={props.selectedId ?? null} onSelect={props.onSelect || (() => {})}
    hidden={props.hidden || {}} locked={props.locked || {}} editable={props.editable ?? true}
    playing={false} rate={1} onToggle={() => {}} volume={1} onVolume={() => {}} muted={false} onMute={() => {}}
    sounds={[]} failedVideo={{}} onVideoFailed={() => {}} onPrevEdit={() => {}} onNextEdit={() => {}}
  />,
);

const box = () => screen.getByTestId('preview-overlay-o1');

describe('a still picture on the monitor', () => {
  test('is drawn with its picture, its fit and its box', () => {
    draw();
    const img = box().querySelector('img');
    expect(img.getAttribute('src')).toBe('https://cdn/title.png');
    expect(img.style.objectFit).toBe('contain');
    expect(box().style.left).toBe('5.208333333333334%');    // 100 of 1920
    expect(box().style.width).toBe('50%');                   // 960 of 1920
  });

  test('cover is drawn as cover', () => {
    draw({ frame: { overlays: [overlay({ fit: 'cover' })] } });
    expect(box().querySelector('img').style.objectFit).toBe('cover');
  });

  test('opacity is applied once: on the box, never again on the image', () => {
    draw();
    expect(box().style.opacity).toBe('0.5');
    expect(box().querySelector('img').style.opacity).toBe('');
  });

  test('it is the last layer, over the caption and over Prime', () => {
    draw({ frame: {
      pip: { segment_id: 's1', url: 'https://cdn/prime.webm', layout: { x: 1300, y: 700, w: 540, h: 304 }, opacity: 1, name: 'Prime' },
      captions: [{ item_id: 'c1', text: 'Hello', style_key: 'caption', layout: { x: 0, y: 900, w: 1920, h: 110 }, opacity: 1 }],
    } });
    const monitor = screen.getByTestId('editor-monitor');
    const order = [...monitor.children].map((el) => el.getAttribute('data-testid')).filter(Boolean);
    expect(order.indexOf('preview-overlay-o1')).toBeGreaterThan(order.indexOf('preview-pip'));
    expect(order.indexOf('preview-overlay-o1')).toBeGreaterThan(order.indexOf('preview-caption-c1'));
  });

  test('a picture the episode may not draw says so; an unread list says something else', () => {
    draw({ frame: { overlays: [overlay({ url: null, unresolved: true })] } });
    expect(box().textContent).toBe('The graphic is missing');
    screen.unmount?.();
    draw({ frame: { overlays: [overlay({ url: null, unresolved: false, unread: true })] } });
    expect(screen.getAllByTestId('preview-overlay-o1').pop().textContent).toBe('The graphics could not be read');
  });

  test('hiding the Overlays lane takes it off the monitor', () => {
    draw({ hidden: { overlays: true } });
    expect(screen.queryByTestId('preview-overlay-o1')).toBeNull();
  });

  test('locking the lane leaves it visible and selectable, but not arrangeable', () => {
    const onSelect = vi.fn();
    draw({ locked: { overlays: true }, selectedId: 'o1', onSelect });
    expect(box()).toBeTruthy();
    // No drag handles while the lane is locked (an arrangeable box has eight).
    expect(box().querySelectorAll('[data-testid^="overlay-handle"]')).toHaveLength(0);
    fireEvent.click(box().querySelector('.tle-monitor-pip-hit'));
    expect(onSelect).toHaveBeenCalledWith('o1');
  });

  test('unlocked and selected, it has the same handles as Prime', () => {
    draw({ selectedId: 'o1' });
    expect(box().querySelectorAll('[data-testid^="overlay-handle"]').length).toBeGreaterThan(0);
  });
});
