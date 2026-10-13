/**
 * Choose the detail a cropped first look shows (Task 3034; Evoni,
 * 2026-10-12: "A deliberate detail—fabric, an accessory, part of a venue").
 * Drag a box on the image; the region goes to the server as fractions of
 * the image ({ x, y, w, h }), where the teaser is cut from the full image.
 * Works with a mouse, a finger or a pen (pointer events), and from the
 * keyboard with the preset buttons. Styles: styles/AdminPanel.css (pulse-crop-*).
 */
import React, { useRef, useState } from 'react';

export const DEFAULT_CROP = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };   // services/pulseTeasers DEFAULT_CROP
export const MIN_SIDE = 0.05;                                      // services/pulseTeasers MIN_CROP

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const round = (n) => Math.round(n * 10000) / 10000;

/** The box between two points (fractions of the image), inside the image and at least MIN_SIDE a side. */
export function rectFrom(a, b) {
  const x1 = clamp01(Math.min(a.x, b.x));
  const y1 = clamp01(Math.min(a.y, b.y));
  let w = clamp01(Math.max(a.x, b.x)) - x1;
  let h = clamp01(Math.max(a.y, b.y)) - y1;
  w = Math.max(w, MIN_SIDE);
  h = Math.max(h, MIN_SIDE);
  const x = Math.min(x1, 1 - w);
  const y = Math.min(y1, 1 - h);
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

/** A pointer event's position as fractions of the element. */
export function pointIn(el, event) {
  const box = el.getBoundingClientRect();
  if (!box.width || !box.height) return { x: 0, y: 0 };
  return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) };
}

const pct = (n) => `${Math.round(n * 100)}%`;
const PRESETS = [
  { label: 'Middle', crop: DEFAULT_CROP },
  { label: 'Top', crop: { x: 0.25, y: 0, w: 0.5, h: 0.4 } },
  { label: 'Bottom', crop: { x: 0.25, y: 0.6, w: 0.5, h: 0.4 } },
];

export default function TeaserCropBox({ imageUrl, value, onChange, label = 'the image' }) {
  const areaRef = useRef(null);
  const [start, setStart] = useState(null);
  const crop = value || DEFAULT_CROP;

  const down = (e) => {
    const p = pointIn(areaRef.current, e);
    setStart(p);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onChange(rectFrom(p, p));
  };
  const move = (e) => { if (start) onChange(rectFrom(start, pointIn(areaRef.current, e))); };
  const up = (e) => { if (start) onChange(rectFrom(start, pointIn(areaRef.current, e))); setStart(null); };

  return (
    <div className="pulse-crop" data-testid="teaser-crop">
      <p className="pulse-crop-hint">Drag a box over the detail to show: fabric, an accessory, part of a venue.</p>
      <div
        ref={areaRef}
        className="pulse-crop-area"
        data-testid="teaser-crop-area"
        role="img"
        aria-label={`Choose the detail of ${label}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setStart(null)}
      >
        <img src={imageUrl} alt="" draggable={false} />
        <span
          className="pulse-crop-box"
          data-testid="teaser-crop-box"
          style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
        />
      </div>
      <p className="pulse-crop-readout" data-testid="teaser-crop-readout">
        Detail: {pct(crop.w)} wide, {pct(crop.h)} tall, from {pct(crop.x)} across and {pct(crop.y)} down.
      </p>
      <div className="pulse-crop-presets">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="pulse-link-btn" onClick={() => onChange(p.crop)}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}
