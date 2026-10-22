/**
 * Production › Files (Evoni, 2026-10-22): one drop zone (photos to Style
 * photos › To sort, videos pointed to Footage), then Poses, Style photos and
 * Footage as tabs with their counts.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EpisodeFilesTab from './EpisodeFilesTab';
import { STYLE_FOLDERS } from '../../lib/stylePhotoFolders';

const EP = 'ep-1';
const lbPhoto = (id, category) => ({ id, category, source: 'upload', image_url: `data:image/png;base64,${id}`, in_lookbook: true, file_name: `${id}.png` });
const lookbook = (images = {}) => ({ id: 'lb', episode_id: EP, images: { ...Object.fromEntries(STYLE_FOLDERS.map((f) => [f.key, []])), ...images } });
const pose = (id, character_key, p) => ({ id, character_key, pose: p, status: 'ready', is_default: true, final_url: `https://x/${id}.png`, original_url: `https://x/${id}.jpg`, steps: {} });

function routes({ poses = [pose('p1', 'lala', 'front')], lb = lookbook({ unsorted: [lbPhoto('u1', 'unsorted')], hero: [lbPhoto('h1', 'hero')] }), clips = [] } = {}) {
  api.get.mockImplementation(async (url) => {
    if (url === `/api/v1/episode-poses/${EP}`) return { data: { data: poses } };
    if (url === `/api/v1/episodes/${EP}/lookbook`) return { data: { data: lb } };
    if (url.startsWith(`/api/v1/episode-clips/${EP}`)) return { data: { data: clips } };
    return { data: { data: [] } };
  });
}
const tab = (key) => screen.getByTestId(`eft-tab-${key}`);
const panel = (key) => document.getElementById(`eft-panel-${key}`);

beforeEach(() => { vi.clearAllMocks(); });

describe('Production › Files', () => {
  test('three tabs with their counts; Poses shows first, the others are hidden until picked', async () => {
    routes();
    render(<EpisodeFilesTab episode={{ id: EP }} />);
    await waitFor(() => expect(tab('style').textContent).toBe('Style photos2'));
    expect(tab('poses').textContent).toBe('Poses1');
    expect(tab('footage').textContent).toBe('Footage0');
    expect(tab('poses').getAttribute('aria-selected')).toBe('true');
    expect(panel('poses').hidden).toBe(false);
    expect(panel('style').hidden).toBe(true);
    fireEvent.click(tab('style'));
    expect(panel('style').hidden).toBe(false);
    expect(panel('poses').hidden).toBe(true);
    expect(within(panel('style')).getByTestId('esph-photo-u1')).toBeTruthy();
  });

  test('photos dropped at the top land in To sort, and the Style photos tab opens with a note', async () => {
    routes();
    render(<EpisodeFilesTab episode={{ id: EP }} />);
    await waitFor(() => expect(tab('style').textContent).toBe('Style photos2'));
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    fireEvent.drop(screen.getByTestId('eft-drop'), { dataTransfer: { files } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe(`/api/v1/episodes/${EP}/lookbook/images`);
    expect(api.post.mock.calls[0][1].get('category')).toBeNull();
    expect(api.post.mock.calls[0][1].getAll('files')).toHaveLength(2);
    expect((await screen.findByTestId('eft-message')).textContent).toMatch(/^2 photos are in To sort/);
    expect(tab('style').getAttribute('aria-selected')).toBe('true');
    // Style photos is read again.
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u === `/api/v1/episodes/${EP}/lookbook`).length).toBe(2));
  });

  test('a video dropped at the top is pointed to Footage, not uploaded', async () => {
    routes();
    render(<EpisodeFilesTab episode={{ id: EP }} />);
    await screen.findByTestId('esph');
    fireEvent.change(screen.getByTestId('eft-input'), { target: { files: [new File(['v'], 'take.mp4', { type: 'video/mp4' })] } });
    expect((await screen.findByTestId('eft-message')).textContent).toBe('A video goes in Footage: drop it on who is on camera.');
    expect(api.post).not.toHaveBeenCalled();
    expect(tab('footage').getAttribute('aria-selected')).toBe('true');
  });

  test('a Style photo filed as a pose: Poses is read again', async () => {
    routes();
    render(<EpisodeFilesTab episode={{ id: EP }} />);
    await waitFor(() => expect(tab('style').textContent).toBe('Style photos2'));
    fireEvent.click(tab('style'));
    api.post.mockResolvedValue({ data: { data: { id: 'p2' } } });
    const card = within(panel('style')).getByTestId('esph-photo-u1');
    fireEvent.click(within(card).getByRole('button', { name: 'Photo options' }));
    fireEvent.change(within(card).getByLabelText('File as'), { target: { value: 'pose:justawoman:side' } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/episode-poses/${EP}/from-lookbook`, { image_id: 'u1', character_key: 'justawoman', pose: 'side' }));
    await waitFor(() => expect(api.get.mock.calls.filter(([u]) => u === `/api/v1/episode-poses/${EP}`).length).toBe(2));
  });

  test('its stylesheet is tokens only', () => {
    const css = readFileSync(resolve(__dirname, 'EpisodeFilesTab.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });
});
