/**
 * The landing page's published media (Task #2822; endpoint contract in
 * docs/reads/2026-10-10-website-content-read.md §4). The page fetches
 * GET /api/v1/public/site-content once, with a plain fetch and no
 * credentials (it is public; the app's axios client is not used), and each
 * section reads its slot from SiteContentContext. A slot that is missing,
 * or a failed fetch, means the bundled default: the page never waits on it
 * and never shows an error for it.
 *
 * Preview (signed-in /site-preview?drafts=1) reads the admin list instead,
 * so drafts with media show too.
 */
import { createContext, useContext } from 'react';

export const PUBLIC_CONTENT_URL = '/api/v1/public/site-content';

export const SiteContentContext = createContext({ slots: {}, loaded: false });

/** The published slot, or null (use the bundled default). */
export function useSlot(key) {
  const { slots } = useContext(SiteContentContext);
  return (slots && slots[key]) || null;
}

/** Published slots from the public endpoint; {} on any failure. */
export async function fetchPublicSlots() {
  try {
    const res = await fetch(PUBLIC_CONTENT_URL, { credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const body = await res.json();
    return body && typeof body.slots === 'object' && body.slots ? body.slots : {};
  } catch (err) {
    console.error('[SiteContent] published media could not be read; using the built-in images:', err.message);
    return {};
  }
}

/** Admin preview: every slot with media, drafts included, in the public shape. */
export async function fetchPreviewSlots() {
  try {
    const { default: api } = await import('../../services/api');
    const res = await api.get('/api/v1/website-slots');
    const slots = {};
    for (const s of res.data?.data?.slots || []) {
      if (!s.url && !s.youtube_id) continue;
      slots[s.slot_key] = {
        media_type: s.media_type, alt_text: s.alt_text, url: s.url || undefined, youtube_id: s.youtube_id || undefined,
        poster_url: s.poster_url, captions_url: s.captions_url, duration_seconds: s.duration_seconds,
      };
    }
    return slots;
  } catch (err) {
    console.error('[SiteContent] preview slots could not be read:', err.message);
    return {};
  }
}

/** A featured_video slot as FeaturedScreening's video, or null. */
export function videoFromSlot(slot) {
  if (!slot) return null;
  if (slot.media_type === 'youtube' && slot.youtube_id) {
    return { kind: 'youtube', id: slot.youtube_id, poster: slot.poster_url || null, title: slot.alt_text || 'Featured video' };
  }
  if (slot.media_type === 'video_clip' && slot.url) {
    return { kind: 'clip', src: slot.url, poster: slot.poster_url || null, captions: slot.captions_url || null, title: slot.alt_text || 'Featured video' };
  }
  return null;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
