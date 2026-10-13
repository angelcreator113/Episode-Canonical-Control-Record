/**
 * The composer's photos (Task 3089; Evoni, 2026-10-13: "Up to four photos.
 * One is the default; multiple photos become a swipeable carousel. Support
 * upload, reorder, remove, and alt text. Uploading shouldn't trigger AI
 * generation."). Pure helpers over a list of { file, preview, alt }; the
 * Composer keeps the list and POSTs it to /api/v1/feed-posts/:id/photos
 * after the draft is saved.
 */

export const MAX_PHOTOS = 4;
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_ALT = 300;

/** Adds image files up to MAX_PHOTOS: { list, refused } (refused: files left out, wrong type or over the limit). */
export function addPhotos(list, files, preview = (f) => URL.createObjectURL(f)) {
  const next = [...list];
  let refused = 0;
  for (const file of Array.from(files || [])) {
    if (!PHOTO_TYPES.includes(file.type) || next.length >= MAX_PHOTOS) { refused += 1; continue; }
    next.push({ file, preview: preview(file), alt: '' });
  }
  return { list: next, refused };
}

/** Moves photo i one place earlier (-1) or later (+1); unchanged at the ends. */
export function movePhoto(list, i, dir) {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removePhoto = (list, i) => list.filter((_, k) => k !== i);

export const setAlt = (list, i, alt) => list.map((p, k) => (k === i ? { ...p, alt: String(alt).slice(0, MAX_ALT) } : p));

/** The upload: each file as `photos`, in order, and their alt texts as one JSON list `alts`. */
export function photosFormData(list) {
  const fd = new FormData();
  list.forEach((p) => fd.append('photos', p.file));
  fd.append('alts', JSON.stringify(list.map((p) => String(p.alt || '').trim())));
  return fd;
}
