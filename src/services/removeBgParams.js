'use strict';

/**
 * Helper: append remove.bg form-data params that vary by clothing category.
 *
 * Clothing categories (dress, top, bottom, outerwear, shoes, bag) benefit from
 * `type=product` — remove.bg's product-trained model handles hangers,
 * mannequins, and fabric edges more cleanly than the generic `auto` model —
 * and `crop=true`, which tight-crops the output to the subject so grid cards
 * render at consistent framing.
 *
 * Small/irregular items (jewelry, accessory, perfume) skip these flags: the
 * product model can over-crop thin chains, earrings, and bottle caps, and
 * `crop=true` sometimes trims intentional negative space around them.
 */

const CLOTHING_CATEGORIES = new Set([
  'dress', 'top', 'bottom', 'shoes', 'outerwear', 'bag',
  'skirt', 'pants', 'jacket', 'coat', 'shirt', 'blouse',
  'dresses', 'tops', 'bottoms', // plural variants seen in the data
]);

function isClothingCategory(category) {
  if (!category) return false;
  return CLOTHING_CATEGORIES.has(String(category).toLowerCase().trim());
}

/**
 * Append remove.bg params to a FormData instance.
 * @param {FormData} formData
 * @param {string|null} category - wardrobe clothing_category
 */
function applyRemoveBgParams(formData, category) {
  formData.append('size', 'auto');
  if (isClothingCategory(category)) {
    formData.append('type', 'product');
    formData.append('crop', 'true');
  }
}

module.exports = { applyRemoveBgParams, isClothingCategory };
