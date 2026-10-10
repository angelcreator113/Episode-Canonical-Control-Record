/**
 * The landing page with the Website page's published media (Task #2822):
 * each section uses its published slot, else the bundled default; a failed
 * read keeps every default; a YouTube video loads nothing from YouTube until
 * tapped, then the privacy-enhanced embed; clips respect reduced motion;
 * the signed-in preview reads drafts through the admin list.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../services/api';
import PublicLanding from './PublicLanding';

const CDN = 'https://cdn.example.test/site-public';
const SLOTS = {
  hero: { media_type: 'image', alt_text: 'The LalaVerse at dusk', url: `${CDN}/hero/a.webp` },
  flagship_lala: { media_type: 'image', alt_text: 'Lala in crimson', url: `${CDN}/flagship_lala/b.png` },
  pillar_places: { media_type: 'image', alt_text: "Lala's home", url: `${CDN}/pillar_places/c.jpg` },
  brand_studio: { media_type: 'video_clip', alt_text: 'Behind the scenes', url: `${CDN}/brand_studio/d.mp4`, poster_url: `${CDN}/brand_studio/poster.png`, captions_url: null, duration_seconds: 20 },
  logo: { media_type: 'image', alt_text: 'Prime Studios', url: `${CDN}/logo/e.png` },
  featured_video: { media_type: 'youtube', alt_text: 'A first look', youtube_id: 'dQw4w9WgXcQ', poster_url: `${CDN}/featured_video/poster.png`, captions_url: null, duration_seconds: null },
};

let fetchSpy;
const respond = (slots) => fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ slots, updated_at: '2026-10-10T00:00:00Z' }) });
const renderAt = (path = '/', preview = false) => render(<MemoryRouter initialEntries={[path]}><PublicLanding preview={preview} /></MemoryRouter>);
const setReducedMotion = (on) => { window.matchMedia = vi.fn((q) => ({ matches: on && q.includes('reduce'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })); };

beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch'); setReducedMotion(false); });
afterEach(() => { fetchSpy.mockRestore(); vi.clearAllMocks(); });

describe('landing page: published media', () => {
  test('each section shows its published slot, in the same box as its default', async () => {
    respond(SLOTS);
    renderAt();
    expect((await screen.findByRole('img', { name: 'The LalaVerse at dusk' })).getAttribute('src')).toBe(`${CDN}/hero/a.webp`);
    expect(screen.getByRole('img', { name: 'Lala in crimson' }).getAttribute('src')).toBe(`${CDN}/flagship_lala/b.png`);
    expect(screen.getByRole('img', { name: "Lala's home" }).closest('.site-media')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Prime Studios' }).getAttribute('src')).toBe(`${CDN}/logo/e.png`);
    // The other pillars and brand cards keep their placeholders.
    expect(screen.getAllByTestId('site-media-placeholder')).toHaveLength(5);
  });

  test('a short brand clip loops muted on its own, but not for reduced motion', async () => {
    respond(SLOTS);
    const { unmount } = renderAt();
    let clip = await screen.findByTestId('site-clip');
    expect([clip.autoplay, clip.muted, clip.loop, clip.controls]).toEqual([true, true, true, false]);
    expect(clip.getAttribute('poster')).toBe(`${CDN}/brand_studio/poster.png`);
    unmount();
    setReducedMotion(true);
    renderAt();
    clip = await screen.findByTestId('site-clip');
    expect([clip.autoplay, clip.controls]).toEqual([false, true]);
  });

  test('YouTube: a local facade, nothing from YouTube until tapped, then the privacy-enhanced embed', async () => {
    respond(SLOTS);
    const { container } = renderAt();
    const facade = await screen.findByTestId('site-featured-facade');
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toMatch(/youtube\.com|ytimg|youtu\.be/);
    expect(facade.style.backgroundImage).toContain(`${CDN}/featured_video/poster.png`);
    const watch = screen.getByRole('button', { name: 'Watch Featured Video' });
    expect(watch.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Play: A first look' }));
    const frame = container.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
    expect(frame.getAttribute('title')).toBe('A first look');
  });

  test('an uploaded featured clip plays with controls and its captions, never on its own', async () => {
    respond({ featured_video: { media_type: 'video_clip', alt_text: 'Lala arrives', url: `${CDN}/featured_video/f.mp4`, poster_url: `${CDN}/featured_video/p.png`, captions_url: `${CDN}/featured_video/c.vtt`, duration_seconds: 28 } });
    renderAt();
    const box = await screen.findByTestId('site-featured-clip');
    const video = box.querySelector('video');
    expect([video.controls, video.autoplay]).toEqual([true, false]);
    expect(video.querySelector('track').getAttribute('src')).toBe(`${CDN}/featured_video/c.vtt`);
  });

  test('a failed read keeps every bundled default: Featured shows "First look coming soon"', async () => {
    fetchSpy.mockRejectedValue(new Error('offline'));
    renderAt();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.getByTestId('site-featured-fallback')).toBeTruthy();
    expect(screen.getByText('First look coming soon')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Watch Featured Video/ }).disabled).toBe(true);
    expect(screen.getAllByTestId('site-media-placeholder')).toHaveLength(8);
    expect(within(screen.getByTestId('public-site')).getByText('Prime Studios', { selector: 'a' })).toBeTruthy();
  });

  test('the footer says how YouTube videos load (for the Privacy page)', async () => {
    respond({});
    renderAt();
    expect((await screen.findByTestId('site-footer-youtube')).textContent).toMatch(/privacy-enhanced mode \(youtube-nocookie\.com\) and load only when you press play/);
  });

  test('the signed-in preview with ?drafts=1 reads the admin list, drafts included', async () => {
    api.get.mockResolvedValue({ data: { data: { storage_ready: true, slots: [
      { slot_key: 'hero', media_type: 'image', url: `${CDN}/hero/draft.png`, alt_text: 'Draft hero', status: 'draft' },
      { slot_key: 'logo', media_type: null, url: null, youtube_id: null, status: 'draft' },
    ] } } });
    renderAt('/site-preview?drafts=1', true);
    expect((await screen.findByRole('img', { name: 'Draft hero' })).getAttribute('src')).toBe(`${CDN}/hero/draft.png`);
    expect(api.get).toHaveBeenCalledWith('/api/v1/website-slots');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/drafts and published media/);
  });
});
