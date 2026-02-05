/**
 * Geometry & Math Utilities for Scene Composer
 * 
 * This module contains all drag/resize math to keep CanvasStage readable.
 * 80% of future bugs get avoided by centralizing this logic.
 */

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Snap a value to the nearest snap increment
 * @param {number} value - Value to snap
 * @param {number} snapIncrement - Snap grid size (e.g., 10)
 * @param {boolean} enabled - Whether snapping is enabled
 * @returns {number} Snapped value
 */
export function snapValue(value, snapIncrement = 10, enabled = true) {
  if (!enabled) return value;
  return Math.round(value / snapIncrement) * snapIncrement;
}

/**
 * Snap a rectangle to nearby guides
 * @param {object} rect - Rectangle with x, y, width, height
 * @param {array} guides - Array of guide objects { type: 'horizontal'|'vertical', position: number }
 * @param {number} threshold - Distance threshold for snapping (default 5px)
 * @returns {object} Snapped rectangle and active guides
 */
export function snapRectToGuides(rect, guides = [], threshold = 5) {
  if (!guides || guides.length === 0) {
    return { rect, activeGuides: [] };
  }

  let snappedRect = { ...rect };
  const activeGuides = [];

  // Snap to vertical guides (affects x position)
  const verticalGuides = guides.filter(g => g.type === 'vertical');
  for (const guide of verticalGuides) {
    // Check left edge
    if (Math.abs(rect.x - guide.position) < threshold) {
      snappedRect.x = guide.position;
      activeGuides.push(guide);
      break;
    }
    // Check center
    const centerX = rect.x + rect.width / 2;
    if (Math.abs(centerX - guide.position) < threshold) {
      snappedRect.x = guide.position - rect.width / 2;
      activeGuides.push(guide);
      break;
    }
    // Check right edge
    const rightX = rect.x + rect.width;
    if (Math.abs(rightX - guide.position) < threshold) {
      snappedRect.x = guide.position - rect.width;
      activeGuides.push(guide);
      break;
    }
  }

  // Snap to horizontal guides (affects y position)
  const horizontalGuides = guides.filter(g => g.type === 'horizontal');
  for (const guide of horizontalGuides) {
    // Check top edge
    if (Math.abs(rect.y - guide.position) < threshold) {
      snappedRect.y = guide.position;
      activeGuides.push(guide);
      break;
    }
    // Check center
    const centerY = rect.y + rect.height / 2;
    if (Math.abs(centerY - guide.position) < threshold) {
      snappedRect.y = guide.position - rect.height / 2;
      activeGuides.push(guide);
      break;
    }
    // Check bottom edge
    const bottomY = rect.y + rect.height;
    if (Math.abs(bottomY - guide.position) < threshold) {
      snappedRect.y = guide.position - rect.height;
      activeGuides.push(guide);
      break;
    }
  }

  return { rect: snappedRect, activeGuides };
}

/**
 * Get the appropriate cursor style for a resize handle
 * @param {string} handle - Handle position: 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'
 * @returns {string} CSS cursor value
 */
export function getResizeHandleCursor(handle) {
  const cursors = {
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
    nw: 'nwse-resize'
  };
  return cursors[handle] || 'default';
}

/**
 * Apply resize delta to a rectangle based on handle position
 * @param {object} rect - Original rectangle { x, y, width, height }
 * @param {string} handle - Handle position: 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'
 * @param {number} dx - X delta
 * @param {number} dy - Y delta
 * @param {boolean} keepAspect - Whether to maintain aspect ratio (Shift key)
 * @param {number} minWidth - Minimum width constraint (default 20)
 * @param {number} minHeight - Minimum height constraint (default 20)
 * @returns {object} New rectangle { x, y, width, height }
 */
export function applyResizeDelta(
  rect,
  handle,
  dx,
  dy,
  keepAspect = false,
  minWidth = 20,
  minHeight = 20
) {
  const { x, y, width, height } = rect;
  let newRect = { x, y, width, height };
  const aspectRatio = width / height;

  switch (handle) {
    case 'n':
      // Resize top edge
      newRect.y = y + dy;
      newRect.height = height - dy;
      if (keepAspect) {
        const adjustedWidth = newRect.height * aspectRatio;
        newRect.x = x + (width - adjustedWidth) / 2;
        newRect.width = adjustedWidth;
      }
      break;

    case 'ne':
      // Resize top-right corner
      newRect.y = y + dy;
      newRect.height = height - dy;
      newRect.width = width + dx;
      if (keepAspect) {
        // Prioritize width change
        newRect.height = newRect.width / aspectRatio;
        newRect.y = y + height - newRect.height;
      }
      break;

    case 'e':
      // Resize right edge
      newRect.width = width + dx;
      if (keepAspect) {
        const adjustedHeight = newRect.width / aspectRatio;
        newRect.y = y + (height - adjustedHeight) / 2;
        newRect.height = adjustedHeight;
      }
      break;

    case 'se':
      // Resize bottom-right corner
      newRect.width = width + dx;
      newRect.height = height + dy;
      if (keepAspect) {
        // Prioritize width change
        newRect.height = newRect.width / aspectRatio;
      }
      break;

    case 's':
      // Resize bottom edge
      newRect.height = height + dy;
      if (keepAspect) {
        const adjustedWidth = newRect.height * aspectRatio;
        newRect.x = x + (width - adjustedWidth) / 2;
        newRect.width = adjustedWidth;
      }
      break;

    case 'sw':
      // Resize bottom-left corner
      newRect.x = x + dx;
      newRect.width = width - dx;
      newRect.height = height + dy;
      if (keepAspect) {
        // Prioritize width change
        newRect.height = newRect.width / aspectRatio;
      }
      break;

    case 'w':
      // Resize left edge
      newRect.x = x + dx;
      newRect.width = width - dx;
      if (keepAspect) {
        const adjustedHeight = newRect.width / aspectRatio;
        newRect.y = y + (height - adjustedHeight) / 2;
        newRect.height = adjustedHeight;
      }
      break;

    case 'nw':
      // Resize top-left corner
      newRect.x = x + dx;
      newRect.y = y + dy;
      newRect.width = width - dx;
      newRect.height = height - dy;
      if (keepAspect) {
        // Prioritize width change
        newRect.height = newRect.width / aspectRatio;
        newRect.y = y + height - newRect.height;
      }
      break;

    default:
      return rect;
  }

  // Apply minimum size constraints
  if (newRect.width < minWidth) {
    // Restore width and adjust x if needed
    if (handle.includes('w')) {
      newRect.x = x + width - minWidth;
    }
    newRect.width = minWidth;
    if (keepAspect) {
      newRect.height = minWidth / aspectRatio;
      if (handle.includes('n')) {
        newRect.y = y + height - newRect.height;
      }
    }
  }

  if (newRect.height < minHeight) {
    // Restore height and adjust y if needed
    if (handle.includes('n')) {
      newRect.y = y + height - minHeight;
    }
    newRect.height = minHeight;
    if (keepAspect) {
      newRect.width = minHeight * aspectRatio;
      if (handle.includes('w')) {
        newRect.x = x + width - newRect.width;
      }
    }
  }

  return newRect;
}

/**
 * Calculate bounding box for multiple elements
 * @param {array} elements - Array of elements with bounds { x, y, width, height }
 * @returns {object|null} Bounding box or null if no elements
 */
export function getBoundingBox(elements) {
  if (!elements || elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Check if a point is inside a rectangle
 * @param {object} point - Point { x, y }
 * @param {object} rect - Rectangle { x, y, width, height }
 * @returns {boolean} True if point is inside rectangle
 */
export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles intersect
 * @param {object} rect1 - First rectangle { x, y, width, height }
 * @param {object} rect2 - Second rectangle { x, y, width, height }
 * @returns {boolean} True if rectangles intersect
 */
export function rectsIntersect(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Convert percentage-based dimensions to pixels
 * @param {object} rect - Rectangle with percentage values { x, y, width, height } (0-100)
 * @param {number} containerWidth - Container width in pixels
 * @param {number} containerHeight - Container height in pixels
 * @returns {object} Rectangle in pixels
 */
export function percentToPixels(rect, containerWidth, containerHeight) {
  return {
    x: (rect.x / 100) * containerWidth,
    y: (rect.y / 100) * containerHeight,
    width: (rect.width / 100) * containerWidth,
    height: (rect.height / 100) * containerHeight
  };
}

/**
 * Convert pixel-based dimensions to percentages
 * @param {object} rect - Rectangle in pixels { x, y, width, height }
 * @param {number} containerWidth - Container width in pixels
 * @param {number} containerHeight - Container height in pixels
 * @returns {object} Rectangle in percentages (0-100)
 */
export function pixelsToPercent(rect, containerWidth, containerHeight) {
  return {
    x: (rect.x / containerWidth) * 100,
    y: (rect.y / containerHeight) * 100,
    width: (rect.width / containerWidth) * 100,
    height: (rect.height / containerHeight) * 100
  };
}
