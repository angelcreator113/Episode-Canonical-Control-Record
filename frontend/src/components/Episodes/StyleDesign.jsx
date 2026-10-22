/**
 * One of the Style Page's five designs (Evoni's Canva deck, 2026-10-22),
 * laid out in HTML from the same description the server draws
 * (src/services/styleSheetDesigns.js, sent in GET /style-sheet's
 * `designs`): every frame, caption and line at its place on the 960 x 1440
 * page. The values (`photos`, `fields`, `palette`) come with it, so this
 * component and the download always agree.
 *
 * With `edit` = { isSelected(spot), onSelect(spot) } each photo frame is
 * a button: tapping one opens its spot in the panel.
 */
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { COLUMN_BACKDROP } from './StyleSheetTemplate';
import '../../styles/wardrobe-backdrop.css';
import './StyleDesign.css';

export const DESIGN_WIDTH = 960;
export const DESIGN_HEIGHT = 1440;
const PIECE_SPOTS = new Set(['body', 'shoes', 'bag', 'jewelry', 'hair', 'perfume', 'nails']);
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Gelasio:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;700&display=swap';

// The designs' lettering (Gelasio for the deck's Georgia, DM Sans for its
// Aptos; the server draws with the same two), loaded once.
function useDesignFonts() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.querySelector('link[data-style-design-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.dataset.styleDesignFonts = 'true';
    document.head.appendChild(link);
  }, []);
}

/** The value at a dotted path of the sheet ("wardrobe.columns.2.image"). */
export function atPath(obj, path) {
  if (!path) return null;
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj) ?? null;
}

/** The design values GET /style-sheet sends, with each photo spot's picture read from the sheet. */
export function designValues(sheet) {
  const v = sheet?.design_values || {};
  const photos = Object.fromEntries(Object.entries(v.photo_paths || {}).map(([spot, p]) => [spot, atPath(sheet, p)]));
  return { photos, fields: v.fields || {}, palette: v.palette || [] };
}

const box = (el) => ({ left: el.x, top: el.y, width: el.w, height: el.h });
const textStyle = (el) => ({
  ...box(el),
  fontSize: el.size,
  color: el.color,
  fontFamily: el.font === 'serif' ? "'Gelasio', Georgia, serif" : "'DM Sans', sans-serif",
  fontWeight: el.bold ? 700 : 400,
  fontStyle: el.italic ? 'italic' : 'normal',
  textAlign: el.align,
  justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
});

/**
 * A line of design text, shrunk to its box (to 60% at most) as the server
 * does (styleSheetRenderService.designText): one line where the box holds
 * one, wrapped where it holds more.
 */
function DesignText({ el, value }) {
  const ref = useRef(null);
  const oneLine = Math.floor(el.h / (el.size * 0.8 * 1.25)) <= 1;
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let size = el.size;
    box.style.fontSize = `${size}px`;
    const over = () => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1;
    while (over() && size > el.size * 0.6) {
      size -= 0.5;
      box.style.fontSize = `${size}px`;
    }
  }, [el, value]);
  return (
    <div ref={ref} className={`sd-text${value ? '' : ' is-placeholder'}${oneLine ? ' is-one-line' : ''}`} style={textStyle(el)}>
      <span>{value || el.placeholder || ''}</span>
    </div>
  );
}

export default function StyleDesign({ design, values, edit = null }) {
  useDesignFonts();
  const photos = values?.photos || {};
  const fields = values?.fields || {};
  const palette = values?.palette || [];
  return (
    <div className="sd-page" style={{ background: design.background }} data-testid={`style-design-${design.key}`} aria-label={design.name} role={edit ? 'group' : 'img'}>
      {design.elements.map((el, i) => {
        const key = `${el.kind}-${i}`;
        if (el.kind === 'photo') {
          const src = photos[el.spot];
          const piece = PIECE_SPOTS.has(el.spot);
          const inner = src ? (
            <img className={piece ? 'sd-piece' : 'sd-photo'} src={src} alt="" />
          ) : (
            <span className="sd-empty">
              <svg className="sd-diagonal" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="100" y2="100" /></svg>
              <span className="sd-add">ADD PHOTO</span>
              <span className="sd-label">{el.label}</span>
            </span>
          );
          // A piece sits on its closet backdrop, as on the sheet and in the download.
          const backdrop = src && piece && COLUMN_BACKDROP[el.spot] ? ` wa-wd-backdrop bd-${COLUMN_BACKDROP[el.spot]}` : '';
          const style = { ...box(el), borderRadius: el.radius, ...(backdrop ? {} : { background: el.fill }) };
          if (!edit) return <div key={key} className={`sd-frame${backdrop}`} style={style}>{inner}</div>;
          const selected = Boolean(edit.isSelected && edit.isSelected(el.spot));
          return (
            <button key={key} type="button" className={`sd-frame sd-tap${selected ? ' is-selected' : ''}${backdrop}`} style={style}
              aria-pressed={selected} aria-label={`${src ? 'Edit' : 'Add'} ${el.label.toLowerCase()}`} data-spot={el.spot}
              onClick={() => edit.onSelect(el.spot)}>
              {inner}
            </button>
          );
        }
        if (el.kind === 'box') {
          return <div key={key} className="sd-box" style={{ ...box(el), background: el.fill || '#FFFFFF', borderColor: el.stroke || undefined, borderRadius: el.radius }} />;
        }
        if (el.kind === 'swatch') {
          return <div key={key} className="sd-swatch" style={{ ...box(el), background: palette[el.index] || el.fill }} />;
        }
        if (el.kind === 'rule') {
          return <div key={key} className="sd-rule" style={{ left: el.x, top: el.y, width: el.w, borderTopColor: el.color, borderTopWidth: el.width }} />;
        }
        return <DesignText key={key} el={el} value={el.field ? fields[el.field] : el.text} />;
      })}
    </div>
  );
}
