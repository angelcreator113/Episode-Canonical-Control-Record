/**
 * Element Helper Functions
 * Utility functions for managing canvas elements
 */

import { ELEMENT_Z_INDEX } from '../constants';

/**
 * Get all elements sorted by render order (background → primary → overlay)
 */
export function getAllElements(selectedScenes, selectedAssets, selectedWardrobes) {
  const elements = [];
  
  // Add scenes
  selectedScenes.forEach(item => {
    elements.push({
      id: `scene-${item.scene.id}`,
      type: 'scene',
      role: item.role,
      data: item.scene,
      zIndex: ELEMENT_Z_INDEX[item.role] || 1,
      thumbnail: item.scene.libraryScene?.thumbnail_url || item.scene.thumbnail_url || item.scene.image_url
    });
  });
  
  // Add assets
  selectedAssets.forEach(item => {
    elements.push({
      id: `asset-${item.asset.id}`,
      type: 'asset',
      role: item.role,
      data: item.asset,
      zIndex: ELEMENT_Z_INDEX[item.role] || 1,
      thumbnail: item.asset.s3_url_processed || item.asset.s3_url_raw || item.asset.thumbnail_url || item.asset.url
    });
  });
  
  // Add wardrobe
  selectedWardrobes.forEach(item => {
    elements.push({
      id: `wardrobe-${item.wardrobe.id}`,
      type: 'wardrobe',
      role: item.role,
      data: item.wardrobe,
      zIndex: ELEMENT_Z_INDEX[item.role] || 2,
      thumbnail: item.wardrobe.image_url || item.wardrobe.thumbnail_url
    });
  });
  
  // Sort by z-index
  return elements.sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * Get canvas dimensions for a format
 * 
 * ARCHITECTURE NOTE - Canvas vs Template Sizing:
 * ================================================
 * 1. TEMPLATES store TRUE resolution (e.g., YouTube = 1920×1080)
 * 2. CANVAS displays scaled-down version for comfortable editing
 * 3. ZOOM multiplies the canvas size (50%, 100%, 200%)
 * 4. EXPORT renders at TRUE template resolution (not canvas size)
 * 
 * Why? The canvas container is FIXED in viewport. Templates inside
 * are scaled to fit. When you export/render, it uses template dimensions.
 * 
 * Think of it like Photoshop: the canvas view zooms, but the image 
 * resolution stays constant.
 */
export function getCanvasDimensions(format) {
  if (!format) return { width: 800, height: 600 };
  
  // Scale down large formats for editing comfort
  const width = format.width > 1920 ? format.width / 2 : format.width;
  const height = format.height > 1080 ? format.height / 2 : format.height;
  
  return { width, height };
}

/**
 * Calculate snap position for drag/resize
 */
export function calculateSnapPosition(value, snapPoints, threshold) {
  for (const point of snapPoints) {
    if (Math.abs(value - point) < threshold) {
      return point;
    }
  }
  return value;
}

/**
 * Generate snap guides for current element
 */
export function generateSnapGuides(elements, currentElementId, canvasWidth, canvasHeight, threshold) {
  const vertical = [0, canvasWidth / 2, canvasWidth];
  const horizontal = [0, canvasHeight / 2, canvasHeight];
  
  elements.forEach(el => {
    if (el.id === currentElementId) return;
    const transform = el.transform || {};
    if (transform.visible === false) return;
    
    // Add element boundaries
    vertical.push(transform.x, transform.x + transform.width);
    horizontal.push(transform.y, transform.y + transform.height);
  });
  
  return { vertical: [...new Set(vertical)], horizontal: [...new Set(horizontal)] };
}

/**
 * Check if element is background or primary (full canvas)
 */
export function isFullCanvasElement(role) {
  return role === 'background' || role === 'primary';
}
