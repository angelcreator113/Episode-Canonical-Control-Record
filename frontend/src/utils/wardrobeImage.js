/**
 * wardrobeImage — the one place that decides which stored URL a wardrobe
 * item is drawn with (Task #1931).
 *
 * The `wardrobe` row carries several image URLs, written by different
 * paths in `wardrobeController`:
 *   - s3_url             the raw upload (every row that has an image has it)
 *   - s3_url_regenerated the AI product-shot variant (regenerate endpoint)
 *   - s3_url_processed   the background-removed cutout (process-background)
 *   - thumbnail_url      a downsized copy made from s3_url (upload / thumbnails)
 *   - primary_image_variant  not a URL: the user's pick of which variant the
 *     card shows — 'original' | 'processed' | 'regenerated', NULL = auto
 *     (model comment and migration 20260803000001).
 *
 * Precedence, first non-blank wins:
 *   1. the URL named by primary_image_variant, when that URL exists
 *   2. s3_url_regenerated
 *   3. s3_url_processed
 *   4. thumbnail_url
 *   5. s3_url
 *
 * Steps 1–3 and 5 are the chain the Wardrobe library card already uses
 * (`resolveItemImageUrl` inside WorldAdmin's wardrobe tab, which cannot be
 * imported because it is defined inside a render closure). thumbnail_url sits
 * before s3_url because it is the same picture at card size.
 *
 * Read-only: nothing here writes or rewrites a stored URL.
 */

const VARIANT_FIELDS = {
  original: 's3_url',
  processed: 's3_url_processed',
  regenerated: 's3_url_regenerated',
};

const FALLBACK_CHAIN = [
  ['regenerated', 's3_url_regenerated'],
  ['processed', 's3_url_processed'],
  ['thumbnail', 'thumbnail_url'],
  ['original', 's3_url'],
];

function present(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * @param {object|null|undefined} item a wardrobe row (or a pool/closet copy of one)
 * @returns {{ variant: string|null, url: string|null }}
 */
export function resolveWardrobeImage(item) {
  if (!item || typeof item !== 'object') return { variant: null, url: null };

  const pick = item.primary_image_variant;
  const pickField = pick ? VARIANT_FIELDS[pick] : null;
  const pickUrl = pickField ? present(item[pickField]) : null;
  if (pickUrl) return { variant: pick, url: pickUrl };

  for (const [variant, field] of FALLBACK_CHAIN) {
    const url = present(item[field]);
    if (url) return { variant, url };
  }
  return { variant: null, url: null };
}

/** The URL alone, or null when the item has no image. */
export function resolveWardrobeImageUrl(item) {
  return resolveWardrobeImage(item).url;
}
