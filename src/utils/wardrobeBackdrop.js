'use strict';

/**
 * A wardrobe piece's backdrop for drawings made on the server (Task #3151):
 * the pastel of its game slot under a soft studio glow, as Producer Mode's
 * closet shows every piece (frontend/src/styles/wardrobe-backdrop.css,
 * .wa-wd-backdrop.bd-<slot>; lib/closetGrouping backdropFor). The server
 * can't read CSS variables, so the slot colours are the design tokens'
 * values (frontend/src/styles/design-tokens.css); a test pins them to the
 * CSS so the two can't drift.
 */

// The CSS: radial-gradient(ellipse 70% 60% at 50% 45%, var(--surface-card) 0%, var(--bd) 72%).
const GLOW = '#ffffff'; // --surface-card
const SLOT_BACKDROP = Object.freeze({
  body: '#ECE6F7', // --lala-lavender-soft
  top: '#F4EFE4', // --lala-parchment-2
  bottom: '#EAF5F3', // --primary-subtle
  shoes: '#FBEFF3', // --accent-subtle
  accessories: '#d1fae5', // --success-bg
  jewelry: '#fef3c7', // --warning-bg
  perfume: '#F7E4DC', // --danger-bg
  outerwear: '#dbeafe', // --info-bg
  other: '#F4EFE4', // the default --bd, --lala-parchment-2
});

// The style sheet's WARDROBE BREAKDOWN columns that hold a piece, by slot
// (styleSheetService COLUMNS; a bag is the Accessories slot). Hair and nails
// are Lookbook photos, not pieces: they keep their frame.
const SHEET_COLUMN_SLOT = Object.freeze({
  body: 'body', shoes: 'shoes', bag: 'accessories', jewelry: 'jewelry', perfume: 'perfume',
});

/** The slot's backdrop colour; 'other' for an unknown slot. */
function backdropColor(slot) {
  return SLOT_BACKDROP[slot] || SLOT_BACKDROP.other;
}

/**
 * Paint a piece's backdrop into a box on a canvas context: the slot colour,
 * then the white glow from the centre (an ellipse 70% x 60% of the box, at
 * 50% / 45%, fading out by 72%, as the CSS). Clips to the box (rounded by
 * `radius`) and restores the context.
 */
function paintBackdrop(ctx, slot, x, y, w, h, { radius = 0 } = {}) {
  ctx.save();
  ctx.beginPath();
  if (radius > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = backdropColor(slot);
  ctx.fillRect(x, y, w, h);
  const rx = 0.7 * w;
  const ry = 0.6 * h;
  ctx.translate(x + 0.5 * w, y + 0.45 * h);
  ctx.scale(rx, ry);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  glow.addColorStop(0, GLOW);
  glow.addColorStop(0.72, `${backdropColor(slot)}00`);
  glow.addColorStop(1, `${backdropColor(slot)}00`);
  ctx.fillStyle = glow;
  // In the scaled space the box spans about x ±0.72 and y -0.75 to 0.92;
  // the clip keeps the fill inside it.
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}

module.exports = { SLOT_BACKDROP, SHEET_COLUMN_SLOT, GLOW, backdropColor, paintBackdrop };
