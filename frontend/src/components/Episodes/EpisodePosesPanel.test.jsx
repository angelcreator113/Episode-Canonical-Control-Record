/**
 * Files › Character poses (Evoni, 2026-10-20): Lala and JustAWoman, four
 * poses each. Photos land under their character and pose, the default
 * first; upload sends the character and pose; a ready photo shows before
 * and after; star, move, reprocess and delete call the API; the panel
 * checks back while a photo is processing.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';

vi.mock('../../lib/episodePosesApi', async () => {
  const actual = await vi.importActual('../../lib/episodePosesApi');
  return {
    ...actual,
    episodePosesApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), reprocess: vi.fn(), remove: vi.fn() },
  };
});

import { episodePosesApi, anyProcessing, photosFor, stepsNote, isPhoto } from '../../lib/episodePosesApi';
import EpisodePosesPanel from './EpisodePosesPanel';

const PHOTOS = [
  { id: 'p1', character_key: 'lala', pose: 'front', is_default: false, status: 'ready', created_at: '2026-10-20T10:00:00Z', original_filename: 'old.jpg', original_url: 'https://x/p1.jpg', enhanced_url: 'https://x/p1-e.jpg', final_url: 'https://x/p1.png', steps: { upscale: 'not needed' } },
  { id: 'p2', character_key: 'lala', pose: 'front', is_default: true, status: 'ready', created_at: '2026-10-20T09:00:00Z', original_filename: 'best.jpg', original_url: 'https://x/p2.jpg', final_url: 'https://x/p2.png', steps: { upscale: 'x2' } },
  { id: 'p3', character_key: 'justawoman', pose: 'glamour', is_default: true, status: 'failed', error: 'Background removal is not set up on the server (REMOVEBG_API_KEY).', original_url: 'https://x/p3.jpg', steps: {} },
];

const pose = (character, key) => screen.getByTestId(`epp-${character}-${key}`);

describe('pose helpers', () => {
  test('processing, the order within a pose, what processing did, and which files are photos', () => {
    expect(anyProcessing([{ status: 'ready' }, { status: 'queued' }])).toBe(true);
    expect(anyProcessing([{ status: 'ready' }, { status: 'failed' }])).toBe(false);
    expect(photosFor(PHOTOS, 'lala', 'front').map((p) => p.id)).toEqual(['p2', 'p1']);
    expect(photosFor(PHOTOS, 'lala', 'back')).toEqual([]);
    expect(stepsNote({ upscale: 'x4' })).toBe('Upscaled x4');
    expect(stepsNote({ upscale: 'skipped: upscaling is not set up on the server' })).toBe('Not upscaled: upscaling is not set up on the server');
    expect(stepsNote({ upscale: 'not needed' })).toBeNull();
    expect(stepsNote(null)).toBeNull();
    expect(isPhoto(new File(['x'], 'a.JPG', { type: '' }))).toBe(true);
    expect(isPhoto(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBe(true);
    expect(isPhoto(new File(['x'], 'a.heic', { type: 'image/heic' }))).toBe(false);
    expect(isPhoto(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBe(false);
  });
});

describe('EpisodePosesPanel', () => {
  beforeEach(() => {
    Object.values(episodePosesApi).forEach((fn) => fn.mockReset());
    episodePosesApi.list.mockResolvedValue(PHOTOS);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  test('two characters, four poses each; photos under their pose, the default first', async () => {
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    await screen.findByTestId('epp-photo-p1');
    for (const c of ['lala', 'justawoman']) {
      for (const p of ['front', 'back', 'side', 'glamour']) expect(pose(c, p)).toBeTruthy();
    }
    const front = within(pose('lala', 'front')).getAllByRole('listitem').filter((li) => li.dataset.testid);
    expect(front.map((li) => li.dataset.testid)).toEqual(['epp-photo-p2', 'epp-photo-p1']);
    expect(within(pose('lala', 'front')).getByText('2 photos')).toBeTruthy();
    expect(screen.getByText('3 photos')).toBeTruthy();
    expect(within(screen.getByTestId('epp-photo-p2')).getByText('Upscaled x2')).toBeTruthy();
  });

  test('a ready photo shows the cut-out, and Before shows the enhanced photo', async () => {
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    const card = await screen.findByTestId('epp-photo-p1');
    expect(within(card).getByRole('img').getAttribute('src')).toBe('https://x/p1.png');
    fireEvent.click(within(card).getByRole('button', { name: 'Before' }));
    expect(within(card).getByRole('img').getAttribute('src')).toBe('https://x/p1-e.jpg');
  });

  test('a failed photo says why and offers Retry', async () => {
    episodePosesApi.reprocess.mockResolvedValue({ ...PHOTOS[2], status: 'queued', error: null });
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    const card = await screen.findByTestId('epp-photo-p3');
    expect(within(card).getByText(/REMOVEBG_API_KEY/)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Before' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(episodePosesApi.reprocess).toHaveBeenCalledWith('ep-1', 'p3'));
    await waitFor(() => expect(within(screen.getByTestId('epp-photo-p3')).getByTestId('epp-status').textContent).toMatch(/Waiting/));
  });

  test('dropping photos on a pose uploads each with its character and pose; other files are skipped with a note', async () => {
    episodePosesApi.list.mockResolvedValue([]);
    episodePosesApi.upload.mockImplementation(async (ep, file, { characterKey, pose: p }) => ({
      id: `new-${file.name}`, character_key: characterKey, pose: p, is_default: true, status: 'ready', original_url: 'https://x/n.jpg', final_url: 'https://x/n.png', steps: {},
    }));
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    await screen.findByTestId('epp-justawoman-side');
    const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const b = new File(['b'], 'b.png', { type: 'image/png' });
    const clip = new File(['c'], 'c.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByTestId('epp-input-justawoman-side'), { target: { files: [a, b, clip] } });
    await waitFor(() => expect(episodePosesApi.upload).toHaveBeenCalledTimes(2));
    expect(episodePosesApi.upload.mock.calls[0].slice(0, 3)).toEqual(['ep-1', a, { characterKey: 'justawoman', pose: 'side' }]);
    expect(await within(pose('justawoman', 'side')).findByTestId('epp-photo-new-b.png')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/One file was skipped: use JPG, PNG or WebP/);
  });

  test('a refused upload stays on the pose with the server\'s reason', async () => {
    episodePosesApi.list.mockResolvedValue([]);
    episodePosesApi.upload.mockRejectedValue({ response: { status: 400, data: { error: 'That file is not a photo we can read. Use JPG, PNG or WebP.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    await screen.findByTestId('epp-lala-back');
    fireEvent.change(screen.getByTestId('epp-input-lala-back'), { target: { files: [new File(['x'], 'odd.jpg', { type: 'image/jpeg' })] } });
    expect(await within(pose('lala', 'back')).findByText(/not a photo we can read/)).toBeTruthy();
  });

  test('starring and moving update the photo, then reload the list (one default per pose)', async () => {
    episodePosesApi.update.mockResolvedValue({});
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    const card = await screen.findByTestId('epp-photo-p1');
    expect(within(screen.getByTestId('epp-photo-p2')).getByRole('button', { name: 'The default for this pose' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(card).getByRole('button', { name: 'Make this the default for this pose' }));
    await waitFor(() => expect(episodePosesApi.update).toHaveBeenCalledWith('ep-1', 'p1', { is_default: true }));
    await waitFor(() => expect(episodePosesApi.list).toHaveBeenCalledTimes(2));
    fireEvent.change(within(screen.getByTestId('epp-photo-p1')).getByLabelText('Which pose this is'), { target: { value: 'side' } });
    await waitFor(() => expect(episodePosesApi.update).toHaveBeenCalledWith('ep-1', 'p1', { pose: 'side' }));
    await waitFor(() => expect(episodePosesApi.list).toHaveBeenCalledTimes(3));
  });

  test('delete asks first, then removes the photo', async () => {
    episodePosesApi.remove.mockResolvedValue(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    const card = await screen.findByTestId('epp-photo-p1');
    fireEvent.click(within(card).getByRole('button', { name: 'Delete this photo' }));
    expect(episodePosesApi.remove).not.toHaveBeenCalled();
    fireEvent.click(within(card).getByRole('button', { name: 'Delete this photo' }));
    await waitFor(() => expect(episodePosesApi.remove).toHaveBeenCalledWith('ep-1', 'p1'));
    await waitFor(() => expect(screen.queryByTestId('epp-photo-p1')).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  test('while a photo is processing it checks back, and stops once it is ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const processing = { ...PHOTOS[0], status: 'processing', final_url: null };
    episodePosesApi.list.mockResolvedValueOnce([processing]).mockResolvedValueOnce([{ ...PHOTOS[0] }]);
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    expect(await within(await screen.findByTestId('epp-photo-p1')).findByText('Removing background…')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(3100); });
    await waitFor(() => expect(within(screen.getByTestId('epp-photo-p1')).getByText('Ready')).toBeTruthy());
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(episodePosesApi.list).toHaveBeenCalledTimes(2);
  });

  test('a failed load says so', async () => {
    episodePosesApi.list.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodePosesPanel episode={{ id: 'ep-1' }} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not load the photos/);
  });
});
