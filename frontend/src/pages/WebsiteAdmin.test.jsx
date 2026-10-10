/**
 * The Website page (Task #2822): counts and "View the site"; the storage
 * note; each slot card's preview, status pill, alt text, Upload/Replace,
 * Publish/Unpublish and Preview on site; the featured video's YouTube or
 * clip switch, poster and captions; the brand cards with "Use an approved
 * style sheet instead"; the logo from Show Settings; admins only.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/Episodes/EpisodeStyleSheetPanel', () => ({
  styleSheetApi: { get: vi.fn() },
  sheetToPng: vi.fn(async () => new Blob(['jpg'], { type: 'image/jpeg' })),
}));
vi.mock('../components/Episodes/StyleSheetTemplate', async () => {
  const React = await import('react');
  return { default: React.forwardRef((props, ref) => React.createElement('div', { ref, 'data-testid': 'sheet-capture' })) };
});

import api from '../services/api';
import { styleSheetApi, sheetToPng } from '../components/Episodes/EpisodeStyleSheetPanel';
import WebsiteAdmin, { slotStatus } from './WebsiteAdmin';

const KEYS = ['hero', 'flagship_lala', 'pillar_fashion', 'pillar_characters', 'pillar_places', 'featured_video', 'brand_world', 'brand_books', 'brand_studio', 'brand_fashion', 'logo'];
const MEDIA = { featured_video: ['youtube', 'video_clip'], brand_studio: ['image', 'video_clip'] };
const blank = (k) => ({ slot_key: k, allowed_media: MEDIA[k] || ['image'], media_type: null, url: null, youtube_id: null, poster_url: null, captions_url: null, alt_text: null, has_speech: false, status: 'draft' });
const list = (over = {}, storage = true) => ({ storage_ready: storage, slots: KEYS.map((k) => ({ ...blank(k), ...(over[k] || {}) })) });

const renderPage = async (data = list()) => {
  api.get.mockImplementation(async (url) => (url === '/api/v1/website-slots' ? { data: { data: data } } : { data: { data: [] } }));
  render(<MemoryRouter><WebsiteAdmin /></MemoryRouter>);
  await screen.findByTestId('website-admin');
};
const card = (k) => within(screen.getByTestId(`wsa-slot-${k}`));

beforeEach(() => { vi.clearAllMocks(); });

describe('Website page', () => {
  test('header counts, View the site, and the note about Published and built-in images', async () => {
    await renderPage(list({
      hero: { media_type: 'image', url: 'https://cdn/x.png', alt_text: 'Map', status: 'published' },
      flagship_lala: { media_type: 'image', url: 'https://cdn/y.png', status: 'draft' },
    }));
    expect(api.get).toHaveBeenCalledWith('/api/v1/website-slots');
    expect(screen.getByTestId('wsa-counts').textContent).toBe('1 published · 1 draft · 9 using default');
    expect(screen.getByRole('link', { name: 'View the site' }).getAttribute('href')).toBe('/site-preview');
    expect(screen.getByText('Only Published items appear on the site. Empty spots use the built-in images.')).toBeTruthy();
    expect(screen.queryByTestId('wsa-storage-off')).toBeNull();
  });

  test('the sections and their slots, with the four brand cards named', async () => {
    await renderPage();
    for (const h of ['Hero', 'Flagship and world', 'Featured production', 'Inside Prime Studios', 'Brand']) expect(screen.getByRole('heading', { level: 2, name: h })).toBeTruthy();
    for (const t of ['A World of Its Own', 'The Book Series', 'Made in Our Own Studio', 'Fashion as Storytelling']) expect(screen.getByRole('heading', { level: 3, name: t })).toBeTruthy();
    for (const k of KEYS) expect(screen.getByTestId(`wsa-slot-${k}`)).toBeTruthy();
  });

  test('status pills: Published, Draft, Default (a built-in exists) and Empty', async () => {
    expect(slotStatus({ slot_key: 'hero', url: 'u', status: 'published' })).toBe('Published');
    expect(slotStatus({ slot_key: 'featured_video', youtube_id: 'x', status: 'draft' })).toBe('Draft');
    expect(slotStatus({ slot_key: 'logo' })).toBe('Default');
    expect(slotStatus({ slot_key: 'brand_books' })).toBe('Empty');
    await renderPage();
    expect(screen.getByTestId('wsa-status-hero').textContent).toBe('Default');
    expect(screen.getByTestId('wsa-status-pillar_fashion').textContent).toBe('Empty');
  });

  test('alt text saves on leaving the field; Upload sends the file; Publish and Unpublish', async () => {
    await renderPage(list({ hero: { media_type: 'image', url: 'https://cdn/x.png', status: 'draft' }, logo: { media_type: 'image', url: 'https://cdn/l.png', alt_text: 'Logo', status: 'published' } }));
    api.patch.mockResolvedValue({ data: { data: {} } });
    const alt = card('hero').getByLabelText('Alt text (required to publish)');
    fireEvent.change(alt, { target: { value: 'The LalaVerse map' } });
    fireEvent.blur(alt);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/website-slots/hero', { alt_text: 'The LalaVerse map' }));

    api.post.mockResolvedValue({ data: { data: {} } });
    fireEvent.change(card('pillar_places').getByLabelText('Upload'), { target: { files: [new File(['x'], 'p.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/website-slots/pillar_places/media');
    expect(api.post.mock.calls[0][1].get('file').name).toBe('p.png');

    fireEvent.click(card('hero').getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/website-slots/hero/publish'));
    fireEvent.click(card('logo').getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/website-slots/logo/unpublish'));
    // Nothing to publish yet: the button waits for media.
    expect(card('brand_books').getByRole('button', { name: 'Publish' }).disabled).toBe(true);
    expect(card('hero').getByRole('link', { name: 'Preview on site' }).getAttribute('href')).toBe('/site-preview?drafts=1#site-main');
  });

  test('a refused action shows the server\'s words (e.g. alt text required)', async () => {
    await renderPage(list({ hero: { media_type: 'image', url: 'https://cdn/x.png', status: 'draft' } }));
    api.post.mockRejectedValue({ response: { data: { error: 'Add alt text before publishing.' } } });
    fireEvent.click(card('hero').getByRole('button', { name: 'Publish' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Add alt text before publishing.');
  });

  test('uploads are off until the public storage is set up; YouTube still works', async () => {
    await renderPage(list({}, false));
    expect(screen.getByTestId('wsa-storage-off').textContent).toMatch(/Uploads are off until the public site storage is set up/);
    expect(card('hero').getByRole('button', { name: 'Upload' }).disabled).toBe(true);
    api.put.mockResolvedValue({ data: { data: {} } });
    fireEvent.change(card('featured_video').getByLabelText('YouTube link (youtube.com or youtu.be)'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(card('featured_video').getByRole('button', { name: 'Use this video' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/website-slots/featured_video/youtube', { url: 'https://youtu.be/dQw4w9WgXcQ' }));
  });

  test('featured video: the YouTube / clip switch, poster frame, captions and speech', async () => {
    await renderPage(list({ featured_video: { media_type: 'video_clip', url: 'https://cdn/f.mp4', status: 'draft', has_speech: false } }));
    const c = card('featured_video');
    expect(c.getByRole('radio', { name: 'Upload a clip (30s max)' }).getAttribute('aria-checked')).toBe('true');
    expect(c.getByRole('button', { name: 'Replace clip' })).toBeTruthy();
    api.post.mockResolvedValue({ data: { data: {} } });
    fireEvent.change(c.getByLabelText('Upload poster frame'), { target: { files: [new File(['p'], 'p.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post.mock.calls[0][0]).toBe('/api/v1/website-slots/featured_video/poster'));
    fireEvent.change(c.getByLabelText('Upload captions (.vtt)'), { target: { files: [new File(['WEBVTT'], 'c.vtt', { type: 'text/vtt' })] } });
    await waitFor(() => expect(api.post.mock.calls[1][0]).toBe('/api/v1/website-slots/featured_video/captions'));
    api.patch.mockResolvedValue({ data: { data: {} } });
    fireEvent.click(c.getByLabelText(/Someone speaks in this clip/));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/website-slots/featured_video', { has_speech: true }));
    fireEvent.click(c.getByRole('radio', { name: 'YouTube link' }));
    expect(c.getByLabelText('YouTube link (youtube.com or youtu.be)')).toBeTruthy();
  });

  test('Fashion as Storytelling can use an approved style sheet instead (drawn, then uploaded)', async () => {
    await renderPage();
    api.get.mockImplementation(async (url) => (url === '/api/v1/episodes'
      ? { data: { data: [{ id: 'ep-1', episode_number: 1, title: 'Wearable Experiments' }] } }
      : { data: { data: list() } }));
    fireEvent.click(card('brand_fashion').getByRole('button', { name: 'Use an approved style sheet instead' }));
    const select = await card('brand_fashion').findByLabelText('Episode whose approved style sheet to use');
    fireEvent.change(select, { target: { value: 'ep-1' } });
    styleSheetApi.get.mockResolvedValue({ status: 'approved', episode: { number: 1 } });
    api.post.mockResolvedValue({ data: { data: {} } });
    fireEvent.click(card('brand_fashion').getByRole('button', { name: 'Use this style sheet' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(styleSheetApi.get).toHaveBeenCalledWith('ep-1');
    expect(sheetToPng.mock.calls[0].slice(1)).toEqual(['image/jpeg', 0.9]);
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/website-slots/brand_fashion/media');
    expect(api.post.mock.calls[0][1].get('file').type).toBe('image/jpeg');
  });

  test('a draft style sheet is refused with a reason', async () => {
    await renderPage();
    api.get.mockImplementation(async (url) => (url === '/api/v1/episodes'
      ? { data: { data: [{ id: 'ep-1', episode_number: 1, title: 'Gala' }] } } : { data: { data: list() } }));
    fireEvent.click(card('brand_fashion').getByRole('button', { name: 'Use an approved style sheet instead' }));
    fireEvent.change(await card('brand_fashion').findByLabelText('Episode whose approved style sheet to use'), { target: { value: 'ep-1' } });
    styleSheetApi.get.mockResolvedValue({ status: 'draft' });
    fireEvent.click(card('brand_fashion').getByRole('button', { name: 'Use this style sheet' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/not approved yet/);
    expect(api.post).not.toHaveBeenCalled();
  });

  test("the logo from Show Settings: choose the show, then the server copies its logo in as a draft", async () => {
    await renderPage();
    api.get.mockImplementation(async (url) => (url === '/api/v1/shows'
      ? { data: { data: [{ id: 'show-1', name: 'Styling Adventures with Lala' }, { id: 'show-2', name: 'Before Lala' }] } }
      : { data: { data: list() } }));
    api.post.mockResolvedValue({ data: { data: { slot_key: 'logo' } } });
    fireEvent.click(card('logo').getByRole('button', { name: 'Use the logo from Show Settings' }));
    const select = await card('logo').findByLabelText('Show whose logo to use');
    expect(card('logo').getByRole('button', { name: "Use this show's logo" }).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'show-1' } });
    fireEvent.click(card('logo').getByRole('button', { name: "Use this show's logo" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/website-slots/logo/from-show', { show_id: 'show-1' }));
    expect(card('logo').getByText(/A copy, saved as a draft/)).toBeTruthy();
  });

  test("one show is chosen for you; a show with no logo says so", async () => {
    await renderPage();
    api.get.mockImplementation(async (url) => (url === '/api/v1/shows'
      ? { data: { data: [{ id: 'show-1', name: 'Styling Adventures with Lala' }] } }
      : { data: { data: list() } }));
    api.post.mockRejectedValue({ response: { status: 400, data: { error: 'That show has no logo yet. Add one in Show Settings.' } } });
    fireEvent.click(card('logo').getByRole('button', { name: 'Use the logo from Show Settings' }));
    await waitFor(() => expect(card('logo').getByLabelText('Show whose logo to use').value).toBe('show-1'));
    fireEvent.click(card('logo').getByRole('button', { name: "Use this show's logo" }));
    expect((await screen.findByRole('alert')).textContent).toBe('That show has no logo yet. Add one in Show Settings.');
  });

  test('the logo action is off until the public site storage is set up', async () => {
    await renderPage(list({}, false));
    expect(card('logo').getByRole('button', { name: 'Use the logo from Show Settings' }).disabled).toBe(true);
  });

  test('a non-admin is told the page is for admins', async () => {
    api.get.mockRejectedValue({ response: { status: 403, data: { error: 'Forbidden' } } });
    render(<MemoryRouter><WebsiteAdmin /></MemoryRouter>);
    expect((await screen.findByRole('alert')).textContent).toBe('The Website page is for admins.');
  });
});
