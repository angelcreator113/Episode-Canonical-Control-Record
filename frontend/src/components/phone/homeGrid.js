/**
 * The home screen's icon grid, shared by the Connect editors (Task #2020):
 * 4 columns, starting 8% / 14% in, 21% / 14% apart, icons 12% × 9%. Moved
 * unchanged from IconPlacementMode so the TAP editor snaps to the same grid.
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

/** A zone moved to its nearest slot (6 rows), kept inside the screen. */
export function snapZoneToGrid(zone) {
  const col = Math.round((zone.x - HOME_GRID.originX) / HOME_GRID.stepX);
  const row = Math.round((zone.y - HOME_GRID.originY) / HOME_GRID.stepY);
  const maxCol = HOME_GRID.columns - 1;
  const maxRow = 5;
  return {
    ...zone,
    x: clamp(HOME_GRID.originX + (clamp(col, 0, maxCol) * HOME_GRID.stepX), 0, 100 - zone.w),
    y: clamp(HOME_GRID.originY + (clamp(row, 0, maxRow) * HOME_GRID.stepY), 0, 100 - zone.h),
  };
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
