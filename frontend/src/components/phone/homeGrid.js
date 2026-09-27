/**
 * The home screen's icon grid, shared by the Connect editors (Task #2020):
 * 4 columns, starting 8% / 14% in, 21% / 14% apart, icons 12% × 9%. Moved
 * unchanged from the former ICON mode (IconPlacementMode, removed by Task
 * #2021), so the one Connect editor snaps to the same grid.
 */

export const HOME_GRID = {
  columns: 4,
  originX: 8,
  originY: 14,
  stepX: 21,
  stepY: 14,
  width: 12,
  height: 9,
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** The top-left of the index-th slot, filling rows left to right. */
export function getGridSlot(index) {
  const col = index % HOME_GRID.columns;
  const row = Math.floor(index / HOME_GRID.columns);
  return {
    x: HOME_GRID.originX + (col * HOME_GRID.stepX),
    y: HOME_GRID.originY + (row * HOME_GRID.stepY),
  };
}

/**
 * A zone moved to its nearest slot (6 rows), kept inside the screen. The
 * slot is chosen by the zone's centre and the zone is centred in it, so
 * zones of different sizes line up (Task #2030). For an icon-sized zone
 * (12 × 9) this is the slot's top-left, as before.
 */
export function snapZoneToGrid(zone) {
  const slotCx = HOME_GRID.originX + (HOME_GRID.width / 2);
  const slotCy = HOME_GRID.originY + (HOME_GRID.height / 2);
  const col = Math.round((zone.x + (zone.w / 2) - slotCx) / HOME_GRID.stepX);
  const row = Math.round((zone.y + (zone.h / 2) - slotCy) / HOME_GRID.stepY);
  const maxCol = HOME_GRID.columns - 1;
  const maxRow = 5;
  return {
    ...zone,
    x: clamp(slotCx + (clamp(col, 0, maxCol) * HOME_GRID.stepX) - (zone.w / 2), 0, 100 - zone.w),
    y: clamp(slotCy + (clamp(row, 0, maxRow) * HOME_GRID.stepY) - (zone.h / 2), 0, 100 - zone.h),
  };
}

/**
 * Centres along one axis for `sizes` (each zone's width, or height, in
 * order), a `step` apart, starting as near `start` as fits: the first zone's
 * near edge and the last zone's far edge stay inside 0–100. If `step` is too
 * long for them all to fit, it shrinks to fit (Task #2030).
 */
export function lineUpCentres(sizes, start, step) {
  const n = sizes.length;
  if (n === 0) return [];
  const firstHalf = sizes[0] / 2;
  const lastHalf = sizes[n - 1] / 2;
  const room = Math.max(0, 100 - firstHalf - lastHalf);
  const gap = n > 1 ? Math.min(step, room / (n - 1)) : 0;
  const from = clamp(start, firstHalf, 100 - lastHalf - (gap * (n - 1)));
  return sizes.map((_, i) => from + (gap * i));
}

/** A zone made icon-sized and put in the index-th slot (Auto Layout). */
export function normalizeIconZone(zone, index) {
  const slot = getGridSlot(index);
  return {
    ...zone,
    w: HOME_GRID.width,
    h: HOME_GRID.height,
    x: clamp(slot.x, 0, 100 - HOME_GRID.width),
    y: clamp(slot.y, 0, 100 - HOME_GRID.height),
  };
}
