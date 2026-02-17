/**
 * useSnapEngine - Snap-to-grid and alignment guide logic
 * 
 * Provides snap points at center, thirds, edges
 * Returns active guide lines for visual rendering
 */

import { useState, useCallback, useRef } from 'react';

const SNAP_THRESHOLD = 2.0; // % distance to trigger snap

// Default snap lines (in percentage)
const SNAP_LINES_X = [0, 10, 25, 33.33, 50, 66.67, 75, 90, 100];
const SNAP_LINES_Y = [0, 10, 25, 33.33, 50, 66.67, 75, 90, 100];

export default function useSnapEngine({ enabled = true } = {}) {
  const [activeGuides, setActiveGuides] = useState({ x: [], y: [] });
  const lastSnapRef = useRef({ x: null, y: null });

  /**
   * Given a raw position { x, y } in %, snap to nearest grid lines.
   * Returns { snappedX, snappedY, guides: { x: [...], y: [...] } }
   */
  const snapPosition = useCallback((rawX, rawY) => {
    if (!enabled) {
      return { snappedX: rawX, snappedY: rawY, guides: { x: [], y: [] } };
    }

    let snappedX = rawX;
    let snappedY = rawY;
    const guides = { x: [], y: [] };

    // Find nearest X snap
    let minDistX = Infinity;
    for (const line of SNAP_LINES_X) {
      const dist = Math.abs(rawX - line);
      if (dist < SNAP_THRESHOLD && dist < minDistX) {
        snappedX = line;
        minDistX = dist;
        guides.x = [line];
      }
    }

    // Find nearest Y snap
    let minDistY = Infinity;
    for (const line of SNAP_LINES_Y) {
      const dist = Math.abs(rawY - line);
      if (dist < SNAP_THRESHOLD && dist < minDistY) {
        snappedY = line;
        minDistY = dist;
        guides.y = [line];
      }
    }

    lastSnapRef.current = { x: guides.x[0] ?? null, y: guides.y[0] ?? null };
    setActiveGuides(guides);

    return { snappedX, snappedY, guides };
  }, [enabled]);

  const clearGuides = useCallback(() => {
    setActiveGuides({ x: [], y: [] });
    lastSnapRef.current = { x: null, y: null };
  }, []);

  return { activeGuides, snapPosition, clearGuides };
}
