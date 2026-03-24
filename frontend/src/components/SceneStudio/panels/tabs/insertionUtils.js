/**
 * Smart insertion sizing for Scene Studio objects.
 * Computes a sensible default size based on object type and source dimensions.
 * Preserves aspect ratio. Centers on canvas.
 */

// Target width as % of canvas width, by asset role
const SIZE_TARGETS = {
  'decor':       0.25,  // 22-28%
  'prop':        0.25,
  'overlay':     0.22,
  'frame':       0.20,  // 18-24%
  'wall_art':    0.20,
  'character':   0.30,  // 28-35%
  'furniture':   0.32,
  'background':  0.40,
  'ai_generated': 0.25,
  'video':       0.35,  // 30-40%
  'default':     0.25,
};

/**
 * Compute insertion size and position for an object.
 *
 * @param {object} params
 * @param {number} params.srcWidth - Source asset width (pixels)
 * @param {number} params.srcHeight - Source asset height (pixels)
 * @param {number} params.canvasWidth - Canvas width
 * @param {number} params.canvasHeight - Canvas height
 * @param {string} [params.assetRole] - Asset role (decor, character, etc.)
 * @param {string} [params.objectType] - Object type (image, video, text, shape)
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function computeInsertionRect({
  srcWidth = 400,
  srcHeight = 400,
  canvasWidth = 1920,
  canvasHeight = 1080,
  assetRole = 'default',
  objectType = 'image',
}) {
  // For shapes and text, use preset dimensions
  if (objectType === 'shape' || objectType === 'text') {
    return {
      x: canvasWidth / 2 - srcWidth / 2,
      y: canvasHeight / 2 - srcHeight / 2,
      width: srcWidth,
      height: srcHeight,
    };
  }

  const aspect = srcWidth / srcHeight;

  // Determine target percentage
  let sizeKey = assetRole || 'default';
  if (objectType === 'video') sizeKey = 'video';
  const targetPct = SIZE_TARGETS[sizeKey] || SIZE_TARGETS.default;

  let w = canvasWidth * targetPct;
  let h = w / aspect;

  // Clamp height to 40% of canvas
  const maxH = canvasHeight * 0.40;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }

  // Clamp width to 50% of canvas
  const maxW = canvasWidth * 0.50;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }

  // Minimum size
  w = Math.max(60, w);
  h = Math.max(60, h);

  return {
    x: Math.round(canvasWidth / 2 - w / 2),
    y: Math.round(canvasHeight / 2 - h / 2),
    width: Math.round(w),
    height: Math.round(h),
  };
}
