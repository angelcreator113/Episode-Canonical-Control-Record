/**
 * The thumbnail editor's canvas (Evoni, 2026-10-21): each layer sits at its
 * centre and turns about it; a drag, a resize or a turn reports the layer's
 * new box; pressing a layer picks it; arrow keys nudge the picked one; a
 * hidden layer is not drawn; words are fitted to their box. react-konva is
 * stubbed with plain elements that keep the props Konva would get.
 */
import React from 'react';
import { vi, describe, test, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const groups = {};
vi.mock('react-konva', () => {
  const Plain = (name) => ({ children, ...props }) => (
    <div data-konva={name} data-props={JSON.stringify(Object.fromEntries(Object.entries(props).filter(([, v]) => typeof v !== 'function' && typeof v !== 'object')))}>{children}</div>
  );
  const Group = ({ children, ...props }) => {
    if (props.id) groups[props.id] = props;
    return <div data-konva="Group" data-id={props.id} onMouseDown={() => props.onMouseDown?.()}>{children}</div>;
  };
  const Transformer = React.forwardRef(() => null);
  return { Stage: Plain('Stage'), Layer: Plain('Layer'), Group, Rect: Plain('Rect'), Text: Plain('Text'), Line: Plain('Line'), Image: Plain('Image'), Transformer };
});

vi.mock('../../lib/picturePreview', () => ({
  previewUrl: (url) => Promise.resolve(url),
  previewWidth: () => 800,
  usePreview: (url) => url,
}));
import ThumbnailCanvas from './ThumbnailCanvas';
import { presetLayers, updateLayer, addShape } from '../../lib/thumbnailLayers';

beforeAll(() => {
  // jsdom has no 2D canvas: measure as half the size a character.
  HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: (s) => ({ width: String(s).length * 40 }) });
});

const SPEC = updateLayer(
  presetLayers('lala-left', { title: 'Come Style Me', kicker: 'Styling Adventures', badge: 'EP 1', lalaUrl: 'https://b.s3.amazonaws.com/l.png' }, {}),
  'lala', { rotation: -6 },
);
const node = (o) => ({ x: () => o.x, y: () => o.y, scaleX: vi.fn(() => o.sx ?? 1), scaleY: vi.fn(() => o.sy ?? 1), rotation: () => o.r ?? 0 });

describe('ThumbnailCanvas', () => {
  test('each layer sits at its centre and turns about it; the shade is drawn, not picked; a hidden layer is not drawn', () => {
    const spec = updateLayer(SPEC, 'badge', { visible: false });
    render(<ThumbnailCanvas spec={spec} selectedId={null} onSelect={() => {}} onChange={() => {}} />);
    const lala = spec.layers.find((l) => l.id === 'lala');
    expect(groups.lala).toMatchObject({ x: lala.x + lala.w / 2, y: lala.y + lala.h / 2, offsetX: lala.w / 2, offsetY: lala.h / 2, rotation: -6, draggable: true });
    expect(document.querySelector('[data-id="badge"]')).toBeNull();
    expect(document.querySelector('[data-id="shade"]')).toBeNull();
    expect(document.querySelectorAll('[data-konva="Group"]').length).toBeGreaterThan(4);
  });

  test('a drag reports the new place; a resize and turn report the size (scale folded in) and the turn, and reset the scale', () => {
    const onChange = vi.fn();
    render(<ThumbnailCanvas spec={SPEC} selectedId="lala" onSelect={() => {}} onChange={onChange} />);
    groups.lala.onDragEnd({ target: node({ x: 400, y: 300 }) });
    expect(onChange).toHaveBeenLastCalledWith('lala', { x: 120, y: -45, w: 560, h: 690, rotation: 0 });
    const n = node({ x: 640, y: 360, sx: 0.5, sy: 0.5, r: 15 });
    groups.lala.onTransformEnd({ target: n });
    expect(onChange).toHaveBeenLastCalledWith('lala', { x: 500, y: 188, w: 280, h: 345, rotation: 15 });
    expect(n.scaleX).toHaveBeenCalledWith(1);
    expect(n.scaleY).toHaveBeenCalledWith(1);
  });

  test('pressing a layer picks it; arrow keys nudge the picked one (Shift: ten)', () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    render(<ThumbnailCanvas spec={SPEC} selectedId="title" onSelect={onSelect} onChange={onChange} />);
    fireEvent.mouseDown(document.querySelector('[data-id="lala"]'));
    expect(onSelect).toHaveBeenCalledWith('lala');
    const title = SPEC.layers.find((l) => l.id === 'title');
    const canvas = screen.getByTestId('yts-canvas');
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('title', { x: title.x + 1, y: title.y });
    fireEvent.keyDown(canvas, { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith('title', { x: title.x, y: title.y - 10 });
    expect(canvas.getAttribute('aria-label')).toMatch(/Title is picked/);
  });

  test('a drag snaps to the canvas\'s middle and draws a guide; Alt drags freely; a locked layer does not move', () => {
    const { rerender } = render(<ThumbnailCanvas spec={SPEC} selectedId="lala" onSelect={() => {}} onChange={() => {}} />);
    const moved = { x: () => 645, y: () => 300, position: vi.fn() };
    act(() => groups.title.onDragMove({ target: moved, evt: {} }));
    expect(moved.position).toHaveBeenCalledWith({ x: 640, y: expect.any(Number) });
    expect(document.querySelectorAll('[data-konva="Line"]').length).toBeGreaterThan(0);
    const free = { x: () => 645, y: () => 300, position: vi.fn() };
    act(() => groups.title.onDragMove({ target: free, evt: { altKey: true } }));
    expect(free.position).not.toHaveBeenCalled();
    const onChange = vi.fn();
    const locked = updateLayer(SPEC, 'title', { locked: true });
    rerender(<ThumbnailCanvas spec={locked} selectedId="title" onSelect={() => {}} onChange={onChange} />);
    expect(groups.title.draggable).toBe(false);
    fireEvent.keyDown(screen.getByTestId('yts-canvas'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('yts-canvas').getAttribute('aria-label')).toMatch(/Title is picked and locked/);
  });

  test('words are fitted to their box, line by line, in the layer\'s font', () => {
    render(<ThumbnailCanvas spec={SPEC} selectedId={null} onSelect={() => {}} onChange={() => {}} />);
    const lines = [...document.querySelectorAll('[data-id="title"] [data-konva="Text"]')].map((t) => JSON.parse(t.dataset.props));
    expect(lines.map((l) => l.text).join(' ')).toBe('Come Style Me');
    expect(lines.every((l) => l.fontFamily === 'Thumb Serif' && l.fontSize <= 96)).toBe(true);
    // Each line no wider than the box at that size (40 per character at the measured size).
    const title = SPEC.layers.find((l) => l.id === 'title');
    expect(lines.every((l) => l.text.length * 40 <= title.w)).toBe(true);
  });

  test('words with an effect, a fade or a curve are one picture drawn as the server draws them, round the box', () => {
    const ctx = {
      font: '', measureText: (s) => ({ width: String(s).length * 40 }), translate: vi.fn(), rotate: vi.fn(), save: vi.fn(), restore: vi.fn(),
      fillText: vi.fn(), strokeText: vi.fn(), drawImage: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }),
    };
    const before = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => ctx;
    try {
      const spec = updateLayer(SPEC, 'title', { effect: 'glow', effectColor: '#FF0000', effectSize: 20, curve: 40 });
      render(<ThumbnailCanvas spec={spec} selectedId={null} onSelect={() => {}} onChange={() => {}} />);
      const title = document.querySelector('[data-id="title"]');
      const t = spec.layers.find((l) => l.id === 'title');
      const m = Math.ceil(t.size / 7) + 2 + 30;
      const img = JSON.parse(title.querySelector('[data-konva="Image"]').getAttribute('data-props'));
      expect(img).toMatchObject({ x: -m, y: -m, width: t.w + m * 2, height: t.h + m * 2 });
      expect(title.querySelector('[data-konva="Text"]')).toBeNull();
      // Each letter of the curved title is drawn on its own, turned.
      expect(ctx.fillText.mock.calls.map((c) => c[0]).join('')).toBe(t.text);
      expect(ctx.rotate).toHaveBeenCalledTimes(t.text.length);
    } finally {
      HTMLCanvasElement.prototype.getContext = before;
    }
  });

  test('a sticker is a box to pick and its picture, drawn as the server draws it, round the box', () => {
    const ctx = {
      font: '', measureText: (s) => ({ width: String(s).length * 40 }), translate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      closePath: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), save: vi.fn(), restore: vi.fn(), stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
    };
    const before = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = () => ctx;
    try {
      const spec = addShape(SPEC, 'burst');
      const burst = spec.layers.at(-1);
      render(<ThumbnailCanvas spec={spec} selectedId={null} onSelect={() => {}} onChange={() => {}} />);
      const node = document.querySelector(`[data-id="${burst.id}"]`);
      const m = burst.strokeWidth + 2;
      const img = JSON.parse(node.querySelector('[data-konva="Image"]').getAttribute('data-props'));
      expect(img).toMatchObject({ x: -m, y: -m, width: burst.w + m * 2, height: burst.h + m * 2 });
      expect(JSON.parse(node.querySelector('[data-konva="Rect"]').getAttribute('data-props'))).toMatchObject({ width: burst.w, height: burst.h });
      expect(ctx.fillText).toHaveBeenCalledWith('NEW', 0, expect.any(Number));
    } finally {
      HTMLCanvasElement.prototype.getContext = before;
    }
  });
});
