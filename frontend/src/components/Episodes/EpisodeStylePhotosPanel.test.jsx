/**
 * Files › Style photos (Evoni, 2026-10-22: "i dont want the uploads in the
 * style page move them to the files tab"): one folder per Style Page spot,
 * To sort first; upload into To sort or straight into a folder, move a photo
 * to another folder, delete it. Every write is a Lookbook route.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EpisodeStylePhotosPanel from './EpisodeStylePhotosPanel';
import { STYLE_FOLDERS } from '../../lib/stylePhotoFolders';

const EP = 'ep-1';
const LB_URL = `/api/v1/episodes/${EP}/lookbook`;
const photo = (id, category, extra = {}) => ({ id, category, source: 'upload', image_url: `data:image/png;base64,${id}`, in_lookbook: true, file_name: `${id}.png`, ...extra });
function lookbook(images = {}) {
  return { id: 'lb-1', episode_id: EP, images: { ...Object.fromEntries(STYLE_FOLDERS.map((f) => [f.key, []])), ...images } };
}
const renderPanel = async (lb = lookbook()) => {
  api.get.mockResolvedValue({ data: { data: lb } });
  render(<EpisodeStylePhotosPanel episode={{ id: EP }} />);
  await screen.findByTestId('esph-unsorted');
};
const folder = (key) => within(screen.getByTestId(`esph-${key}`));

beforeEach(() => { vi.clearAllMocks(); });

describe('Files › Style photos', () => {
  test('a folder per Style Page spot, To sort first; only her own photos (not the scene set\'s)', async () => {
    await renderPanel(lookbook({
      unsorted: [photo('u1', 'unsorted')], hero: [photo('h1', 'hero')],
      venue: [photo('v1', 'venue'), photo('s1', 'venue', { source: 'scene_angle' })],
    }));
    expect(api.get).toHaveBeenCalledWith(LB_URL);
    expect(screen.getByRole('heading', { level: 2, name: 'Style photos' })).toBeTruthy();
    // Folders with photos (and To sort) in full; the empty ones as small chips (2026-10-22).
    const titles = [...screen.getByTestId('esph').querySelectorAll('.esph-folder .epp-pose-title')].map((h) => h.textContent);
    expect(titles).toEqual(['To sort', 'Hero', 'Venue']);
    const chips = [...within(screen.getByTestId('esph-empty')).getAllByRole('button')].map((b) => b.getAttribute('aria-label'));
    expect(chips).toEqual(STYLE_FOLDERS.filter((f) => !['unsorted', 'hero', 'venue'].includes(f.key)).map((f) => `Add ${f.label}`));
    expect(folder('hero').getByAltText('h1.png')).toBeTruthy();
    expect(folder('venue').getByAltText('v1.png')).toBeTruthy();
    expect(folder('venue').queryByAltText('s1.png')).toBeNull();
    expect(screen.getByText('3 photos')).toBeTruthy();
  });

  test('photos upload to To sort, or straight into a folder (a one-photo folder takes one)', async () => {
    await renderPanel();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook({ unsorted: [photo('u2', 'unsorted')] }) } } });
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    fireEvent.change(screen.getByTestId('esph-input-unsorted'), { target: { files } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe(`${LB_URL}/images`);
    expect(api.post.mock.calls[0][1].get('category')).toBeNull();
    expect(api.post.mock.calls[0][1].getAll('files')).toHaveLength(2);
    await waitFor(() => expect(folder('unsorted').getByAltText('u2.png')).toBeTruthy());

    fireEvent.change(screen.getByTestId('esph-input-hero'), { target: { files } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][1].get('category')).toBe('hero');
    expect(api.post.mock.calls[1][1].getAll('files')).toHaveLength(1);
  });

  test('a file that is not PNG, JPEG or WebP is skipped and said so', async () => {
    await renderPanel();
    fireEvent.change(screen.getByTestId('esph-input-unsorted'), { target: { files: [new File(['a'], 'a.gif', { type: 'image/gif' })] } });
    expect((await screen.findByRole('alert')).textContent).toContain('One file was skipped');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('Inspiration holds two: full, it offers no upload', async () => {
    await renderPanel(lookbook({ inspo: [photo('i1', 'inspo'), photo('i2', 'inspo')] }));
    expect(screen.queryByTestId('esph-input-inspo')).toBeNull();
    expect(folder('inspo').getByText(/up to 2/)).toBeTruthy();
  });

  test('a photo moves to another folder, or is deleted', async () => {
    await renderPanel(lookbook({ unsorted: [photo('u1', 'unsorted')] }));
    api.patch.mockResolvedValue({ data: { data: { lookbook: lookbook({ hero: [photo('u1', 'hero')] }) } } });
    fireEvent.click(folder('unsorted').getByRole('button', { name: 'Photo options' }));
    fireEvent.change(folder('unsorted').getByLabelText('File as'), { target: { value: 'hero' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${LB_URL}/images/u1`, { category: 'hero' }));
    await waitFor(() => expect(folder('hero').getByAltText('u1.png')).toBeTruthy());

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.delete.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(folder('hero').getByRole('button', { name: 'Photo options' }));
    fireEvent.click(folder('hero').getByRole('button', { name: 'Delete this photo' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`${LB_URL}/images/u1`));
  });

  test('a photo is filed as a character pose: it leaves Style photos and the Files tab is told', async () => {
    await renderPanel(lookbook({ unsorted: [photo('u1', 'unsorted')] }));
    api.post.mockResolvedValue({ data: { data: { id: 'pose-1' } } });
    api.get.mockResolvedValue({ data: { data: lookbook() } });
    fireEvent.click(folder('unsorted').getByRole('button', { name: 'Photo options' }));
    fireEvent.change(folder('unsorted').getByLabelText('File as'), { target: { value: 'pose:lala:back' } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episode-poses/ep-1/from-lookbook', { image_id: 'u1', character_key: 'lala', pose: 'back' }));
    expect((await screen.findByTestId('esph-note')).textContent).toBe('Filed as Lala · Back in Character poses. It is being processed there.');
    await waitFor(() => expect(folder('unsorted').queryByAltText('u1.png')).toBeNull());
  });

  test('a failed read shows its message', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Episode not found' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeStylePhotosPanel episode={{ id: EP }} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Episode not found');
  });

  test('its stylesheet is tokens only', () => {
    const css = readFileSync(resolve(__dirname, 'EpisodeStylePhotosPanel.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });
});
