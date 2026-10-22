/**
 * Smaller copies of pictures for the thumbnail editor and its folders
 * (Evoni, 2026-10-21: make it faster). Poses can be 4000px; the editor
 * draws at most a few hundred points wide. The server makes the copy
 * (GET /api/v1/youtube-thumbnails/preview, signed in, so fetched through
 * api), and each one is kept for the page's life. When a copy cannot be
 * had (not one of our pictures, the server down), the original is used.
 */
import { useEffect, useState } from 'react';
import api from '../services/api';

const WIDTHS = [400, 800, 1600];
const made = new Map(); // `${w}|${url}` -> Promise<string>

/** The preview width for a picture shown `points` wide: twice that (sharp screens), rounded up to 400, 800 or 1600. */
export const previewWidth = (points) => WIDTHS.find((w) => w >= points * 2) || WIDTHS[WIDTHS.length - 1];

// Every https picture goes through the server's copy (the server says which
// are ours: S3 and the CloudFront domain). The copy is same-site, so the
// editor can read its pixels: a CloudFront original would block the
// effects and the snapshot (audit, 2026-10-22).
const ours = (url) => /^https:\/\//i.test(String(url || ''));

/** A local address for a copy at least `pixels` wide (400, 800 or 1600), or the original address when there is none. */
export function previewUrl(url, pixels = 800) {
  if (!url || !ours(url) || typeof URL?.createObjectURL !== 'function') return Promise.resolve(url);
  const w = WIDTHS.find((x) => x >= pixels) || WIDTHS[WIDTHS.length - 1];
  const key = `${w}|${url}`;
  if (!made.has(key)) {
    made.set(key, api.get('/api/v1/youtube-thumbnails/preview', { params: { url, w }, responseType: 'blob' })
      .then((r) => URL.createObjectURL(r.data))
      .catch((err) => {
        console.error('[picturePreview] no smaller copy; using the original:', err?.message || err);
        made.delete(key);
        return url;
      }));
  }
  return made.get(key);
}

/** The address to show for a picture `points` wide: null until its copy (or, failing that, the original) is ready. */
export function usePreview(url, points = 400) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    setSrc(null);
    previewUrl(url, previewWidth(points)).then((u) => { if (live) setSrc(u); });
    return () => { live = false; };
  }, [url, points]);
  return src;
}

/** For tests: forget the copies made. */
export const forgetPreviews = () => made.clear();
