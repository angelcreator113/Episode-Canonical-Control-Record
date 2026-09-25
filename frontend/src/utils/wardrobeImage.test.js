/**
 * wardrobeImage — resolver precedence (Task #1931).
 */
import { describe, test, expect } from 'vitest';
import { resolveWardrobeImage, resolveWardrobeImageUrl } from './wardrobeImage';

const RAW = 'https://bucket.s3.amazonaws.com/wardrobe/raw.jpg';
const PROCESSED = 'https://bucket.s3.amazonaws.com/wardrobe/processed.png';
const THUMB = 'https://bucket.s3.amazonaws.com/wardrobe/raw-thumb.jpg';
const REGEN = 'https://bucket.s3.amazonaws.com/wardrobe/regen.png';

describe('resolveWardrobeImage', () => {
  test('an item with only s3_url resolves to s3_url', () => {
    expect(resolveWardrobeImage({ s3_url: RAW, primary_image_variant: null }))
      .toEqual({ variant: 'original', url: RAW });
  });

  test('s3_url_processed wins over thumbnail_url and s3_url', () => {
    expect(resolveWardrobeImageUrl({ s3_url: RAW, thumbnail_url: THUMB, s3_url_processed: PROCESSED }))
      .toBe(PROCESSED);
  });

  test('thumbnail_url wins over s3_url', () => {
    expect(resolveWardrobeImage({ s3_url: RAW, thumbnail_url: THUMB }))
      .toEqual({ variant: 'thumbnail', url: THUMB });
  });

  test('s3_url_regenerated wins over processed when no variant is picked', () => {
    expect(resolveWardrobeImageUrl({ s3_url: RAW, s3_url_processed: PROCESSED, s3_url_regenerated: REGEN }))
      .toBe(REGEN);
  });

  test('primary_image_variant is honoured first', () => {
    const item = { s3_url: RAW, thumbnail_url: THUMB, s3_url_processed: PROCESSED, s3_url_regenerated: REGEN };
    expect(resolveWardrobeImageUrl({ ...item, primary_image_variant: 'original' })).toBe(RAW);
    expect(resolveWardrobeImageUrl({ ...item, primary_image_variant: 'processed' })).toBe(PROCESSED);
    expect(resolveWardrobeImageUrl({ ...item, primary_image_variant: 'regenerated' })).toBe(REGEN);
  });

  test('a picked variant with no URL falls through to the chain', () => {
    expect(resolveWardrobeImageUrl({ s3_url: RAW, primary_image_variant: 'processed' })).toBe(RAW);
  });

  test('blank strings are treated as missing', () => {
    expect(resolveWardrobeImageUrl({ s3_url: RAW, thumbnail_url: '', s3_url_processed: '   ' })).toBe(RAW);
  });

  test('no image, or no item, resolves to null', () => {
    expect(resolveWardrobeImage({ name: 'Bare' })).toEqual({ variant: null, url: null });
    expect(resolveWardrobeImageUrl(null)).toBeNull();
    expect(resolveWardrobeImageUrl(undefined)).toBeNull();
  });
});
