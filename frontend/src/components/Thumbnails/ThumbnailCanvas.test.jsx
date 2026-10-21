/**
 * The thumbnail editor's canvas (Evoni, 2026-10-21): each layer sits at its
 * centre and turns about it; a drag, a resize or a turn reports the layer's
 * new box; pressing a layer picks it; arrow keys nudge the picked one; a
 * hidden layer is not drawn; words are fitted to their box. react-konva is
 * stubbed with plain elements that keep the props Konva would get.
 */
import React from 'react';
import { vi, describe, test, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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
  return { Stage: Plain('Stage'), Layer: Plain('Layer'), Group, Rect: Plain('Rect'), Text: Plain('Text'), Image: Plain('Image'), Transformer };
});

import ThumbnailCanvas from './ThumbnailCanvas';
import { presetLayers, updateLayer } from '../../lib/thumbnailLayers';

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

  test('words are fitted to their box, line by line, in the layer\'s font', () => {
    render(<ThumbnailCanvas spec={SPEC} selectedId={null} onSelect={() => {}} onChange={() => {}} />);
    const lines = [...document.querySelectorAll('[data-id="title"] [data-konva="Text"]')].map((t) => JSON.parse(t.dataset.props));
    expect(lines.map((l) => l.text).join(' ')).toBe('Come Style Me');
    expect(lines.every((l) => l.fontFamily === 'Thumb Serif' && l.fontSize <= 96)).toBe(true);
    // Each line no wider than the box at that size (40 per character at the measured size).
    const title = SPEC.layers.find((l) => l.id === 'title');
    expect(lines.every((l) => l.text.length * 40 <= title.w)).toBe(true);
  });
});
