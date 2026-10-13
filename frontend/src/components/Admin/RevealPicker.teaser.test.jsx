/**
 * Choosing a first look (Task 3034; Evoni, 2026-10-12: cropped by default, a
 * deliberate detail; blur when concealing the reveal matters): with an image,
 * the picker offers a detail (default, with the box on the image), blurred
 * or hidden, and sends the style and region; with no image it offers one
 * first look. TeaserCropBox: the region from a drag, kept inside the image.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import RevealPicker, { choiceOf, beforeText } from './RevealPicker';
import TeaserCropBox, { rectFrom, DEFAULT_CROP, MIN_SIDE } from './TeaserCropBox';
import { PulseRevealProvider } from './PulseRevealContext';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const SHOW = 'show-1';
let reveals;
beforeEach(() => {
  vi.clearAllMocks();
  reveals = [];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/pulse-reveals?')) return { data: { reveals } };
    if (url.startsWith('/api/v1/episodes?')) return { data: { data: [{ id: 'ep2', episode_number: 2, title: 'Two' }] } };
    return { data: {} };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { reveal: { id: 'rv1', ...body, label: 'During Ep 2' } } }));
});

const inProvider = (ui) => render(<PulseRevealProvider showId={SHOW}>{ui}</PulseRevealProvider>);
const openFor = async (label) => {
  fireEvent.click(await screen.findByRole('button', { name: `Set the reveal for ${label}` }));
  await waitFor(() => expect(screen.getAllByRole('option', { name: /^Ep / })).toHaveLength(1));
  fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'ep2' } });
};

describe('helpers', () => {
  test('choiceOf: crop by default, blur or hidden from a saved reveal', () => {
    expect(choiceOf(null)).toBe('crop');
    expect(choiceOf({ mode: 'teaser' })).toBe('crop');
    expect(choiceOf({ mode: 'teaser', teaser_style: 'blur' })).toBe('blur');
    expect(choiceOf({ mode: 'hidden', teaser_style: 'blur' })).toBe('hidden');
  });

  test('beforeText says which first look', () => {
    expect(beforeText({ mode: 'teaser', teaser_style: 'crop' })).toBe('first look (a detail) before');
    expect(beforeText({ mode: 'teaser', teaser_style: 'blur' })).toBe('blurred first look before');
    expect(beforeText({ mode: 'teaser' }, false)).toBe('first look before');
    expect(beforeText({ mode: 'hidden' })).toBe('hidden before');
  });

  test('rectFrom: either drag direction, kept inside the image, never smaller than MIN_SIDE', () => {
    expect(rectFrom({ x: 0.6, y: 0.8 }, { x: 0.2, y: 0.4 })).toEqual({ x: 0.2, y: 0.4, w: 0.4, h: 0.4 });
    expect(rectFrom({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5, w: MIN_SIDE, h: MIN_SIDE });
    expect(rectFrom({ x: 0.99, y: 0.99 }, { x: 1.4, y: 1.2 })).toEqual({ x: 1 - MIN_SIDE, y: 1 - MIN_SIDE, w: MIN_SIDE, h: MIN_SIDE });
    expect(rectFrom({ x: -0.2, y: 0 }, { x: 0.3, y: 0.5 })).toEqual({ x: 0, y: 0, w: 0.3, h: 0.5 });
  });
});

describe('the picker', () => {
  test('an image: a detail by default, with the box on the image; saving sends the crop style and region', async () => {
    inProvider(<RevealPicker type="image" kind="fit" id="f1" label="the fit" imageUrl="https://cdn/fit.jpg" />);
    await openFor('the fit');
    expect(screen.getByLabelText('First look: a detail (cropped)').checked).toBe(true);
    expect(screen.getByLabelText('First look: blurred').checked).toBe(false);
    expect(screen.getByTestId('teaser-crop-area').querySelector('img').getAttribute('src')).toBe('https://cdn/fit.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-reveals', expect.objectContaining({
      item_type: 'image', image_kind: 'fit', item_id: 'f1', mode: 'teaser', teaser_style: 'crop', crop: { x: 0.25, y: 0, w: 0.5, h: 0.4 },
    })));
    await waitFor(() => expect(screen.getByTestId('reveal-image-f1').textContent).toContain('first look (a detail) before'));
  });

  test('blurred: no box, no region sent', async () => {
    inProvider(<RevealPicker type="image" kind="cover" id={SHOW} label="the cover" imageUrl="https://cdn/cover.jpg" />);
    await openFor('the cover');
    fireEvent.click(screen.getByLabelText('First look: blurred'));
    expect(screen.queryByTestId('teaser-crop')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = vi.mocked(api.put).mock.calls[0][1];
    expect(body).toMatchObject({ mode: 'teaser', teaser_style: 'blur' });
    expect(body.crop).toBeUndefined();
  });

  test('hidden sends no teaser fields; an item with no image has one first look and no box', async () => {
    inProvider(<RevealPicker type="event" id="ev1" eventId="ev1" label="the gala" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set the reveal for the gala' }));
    expect(screen.getByLabelText('First look').checked).toBe(true);
    expect(screen.queryByLabelText('First look: blurred')).toBeNull();
    expect(screen.queryByTestId('teaser-crop')).toBeNull();
    fireEvent.click(screen.getByLabelText('Hidden'));
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const body = vi.mocked(api.put).mock.calls[0][1];
    expect(body).toMatchObject({ mode: 'hidden' });
    expect(body.teaser_style).toBeUndefined();
  });

  test('a saved blurred reveal opens on blurred; a saved detail opens with its region', async () => {
    reveals = [
      { id: 'rv2', item_type: 'image', item_id: 'f2', image_kind: 'fit', moment: 'during', episode_id: 'ep2', mode: 'teaser', teaser_style: 'blur', label: 'During Ep 2' },
      { id: 'rv3', item_type: 'image', item_id: 'f3', image_kind: 'fit', moment: 'during', episode_id: 'ep2', mode: 'teaser', teaser_style: 'crop', crop: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, label: 'During Ep 2' },
    ];
    inProvider(<><RevealPicker type="image" kind="fit" id="f2" label="fit two" imageUrl="https://cdn/2.jpg" /><RevealPicker type="image" kind="fit" id="f3" label="fit three" imageUrl="https://cdn/3.jpg" /></>);
    await waitFor(() => expect(screen.getByTestId('reveal-image-f2').textContent).toContain('blurred first look before'));
    fireEvent.click(screen.getByRole('button', { name: 'Change the reveal for fit three' }));
    expect(screen.getByLabelText('First look: a detail (cropped)').checked).toBe(true);
    expect(screen.getByTestId('teaser-crop-readout').textContent).toBe('Detail: 30% wide, 40% tall, from 10% across and 20% down.');
  });
});

describe('TeaserCropBox', () => {
  test('dragging draws the region as fractions of the image', () => {
    // jsdom has no PointerEvent: a MouseEvent carries the coordinates the same way.
    if (!window.PointerEvent) {
      window.PointerEvent = class PointerEvent extends MouseEvent {
        constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
      };
    }
    const onChange = vi.fn();
    render(<TeaserCropBox imageUrl="https://cdn/x.jpg" value={DEFAULT_CROP} onChange={onChange} />);
    const area = screen.getByTestId('teaser-crop-area');
    area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 });
    fireEvent.pointerDown(area, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 120, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(area, { clientX: 120, clientY: 60, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  });

  test('the box sits where the region is', () => {
    render(<TeaserCropBox imageUrl="https://cdn/x.jpg" value={{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }} onChange={() => {}} />);
    const box = screen.getByTestId('teaser-crop-box');
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(['10%', '20%', '30%', '40%']);
  });
});
