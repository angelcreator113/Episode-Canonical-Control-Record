/**
 * Production → Lookbook (spec Part 2; Task #2813): the header counters,
 * the drop zone and To sort tray with sorting, the look, hair/nails and
 * beauty slots, Venue pre-filled from the event's scene set with "In
 * lookbook" toggles and "Upload your own", and Key inspo with its two
 * automatic textures. Every write goes through the Lookbook routes.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../../services/api';
import EpisodeLookbookTab from './EpisodeLookbookTab';

const EP = 'ep-1';
const empty = () => Object.fromEntries(['unsorted', 'front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'].map((c) => [c, []]));
const photo = (id, category, extra = {}) => ({ id, category, source: 'upload', image_url: `data:image/png;base64,${id}`, in_lookbook: true, file_name: `${id}.png`, ...extra });

function lookbook(over = {}) {
  return {
    id: 'lb-1', episode_id: EP, hair_name: 'soft glam waves', nails_name: null, beauty_notes: { eyes: 'bronze smoke' },
    sheet_status: 'draft', images_in: 0, images: empty(),
    readiness: { done: 0, total: 11, missing: ['front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'] },
    event: { id: 'ev-1', name: 'Studio Session' }, scene_set: { id: 'set-1', name: 'Studio by Sable' },
    venue_options: [
      { source: 'scene_set_base', ref_id: 'set-1', label: 'Set base', image_url: 'https://cdn.example/base.jpg', in_lookbook: false },
      { source: 'scene_angle', ref_id: 'ang-1', label: 'Wide', image_url: 'https://cdn.example/wide.jpg', in_lookbook: true },
    ],
    texture_pieces: [{ id: 'w-1', name: 'Crimson Satin Ballerina Pump', image_url: 'https://cdn.example/pump.jpg' }],
    ...over,
  };
}

const renderTab = async (data = lookbook()) => {
  api.get.mockResolvedValue({ data: { data } });
  render(<EpisodeLookbookTab episode={{ id: EP }} />);
  await screen.findByTestId('episode-lookbook-tab');
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Lookbook tab', () => {
  test('header: images in, ready x of 11, and what is missing', async () => {
    const images = empty();
    images.front = [photo('f', 'front')];
    images.unsorted = [photo('u1', 'unsorted'), photo('u2', 'unsorted')];
    await renderTab(lookbook({ images, images_in: 3, readiness: { done: 1, total: 11, missing: ['side', 'back'] } }));
    expect(api.get).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook`);
    expect(screen.getByRole('heading', { name: 'Lookbook' })).toBeTruthy();
    expect(screen.getByTestId('elb-images-in').textContent).toBe('3 images in');
    expect(screen.getByTestId('elb-ready').textContent).toBe('style sheet ready (1 of 11)');
    expect(screen.getByText('Still to add: Side, Back')).toBeTruthy();
    // Without a way to open Wardrobe the preview button is off.
    expect(screen.getByRole('button', { name: 'Preview style sheet' }).disabled).toBe(true);
  });

  test('a batch of photos uploads into To sort', async () => {
    await renderTab();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    const input = screen.getByLabelText('Choose photos');
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    fireEvent.change(input, { target: { files } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe(`/api/v1/episodes/${EP}/lookbook/images`);
    expect(form.getAll('files')).toHaveLength(2);
    expect(form.get('category')).toBeNull();
  });

  test('tapping a tray photo then a spot sorts it there', async () => {
    const images = empty();
    images.unsorted = [photo('u1', 'unsorted')];
    await renderTab(lookbook({ images, images_in: 1 }));
    api.patch.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(screen.getByRole('button', { name: 'Sort u1.png' }));
    const picker = screen.getByRole('group', { name: 'Sort this photo into' });
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(
      ['Front', 'Side', 'Back', 'Hero', 'Hair', 'Nails', 'Eyes', 'Lips', 'Skin', 'Venue', 'Inspo', ' Remove']);
    fireEvent.click(within(picker).getByRole('button', { name: 'Hero' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook/images/u1`, { category: 'hero' }));
  });

  test('Lala in the look has four slots; a slot uploads into its spot and removes its photo', async () => {
    const images = empty();
    images.hero = [photo('h', 'hero')];
    await renderTab(lookbook({ images }));
    for (const s of ['front', 'side', 'back', 'hero']) expect(screen.getByTestId(`elb-slot-${s}`)).toBeTruthy();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook({ images }) } } });
    fireEvent.change(screen.getByLabelText('Add Front'), { target: { files: [new File(['x'], 'front.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].get('category')).toBe('front');
    api.delete.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Hero photo' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook/images/h`));
  });

  test('hair and nails names and beauty notes save when the field is left', async () => {
    await renderTab();
    api.put.mockResolvedValue({ data: { data: lookbook({ nails_name: 'crimson almond' }) } });
    expect(screen.getByLabelText('Hair name').value).toBe('soft glam waves');
    const nails = screen.getByLabelText('Nails name');
    fireEvent.change(nails, { target: { value: 'crimson almond' } });
    fireEvent.blur(nails);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook`, { nails_name: 'crimson almond' }));
    const lips = screen.getByLabelText('Lips notes (optional)');
    fireEvent.change(lips, { target: { value: 'crimson satin' } });
    fireEvent.blur(lips);
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(`/api/v1/episodes/${EP}/lookbook`, { beauty_notes: { eyes: 'bronze smoke', lips: 'crimson satin' } }));
    for (const s of ['hair', 'nails', 'eyes', 'lips', 'skin']) expect(screen.getByTestId(`elb-slot-${s}`)).toBeTruthy();
  });

  test("Venue shows the event's scene set images and toggles them In lookbook", async () => {
    await renderTab();
    expect(screen.getByText(/From Studio Session's scene set, Studio by Sable/)).toBeTruthy();
    const base = screen.getByRole('button', { name: /Set base, Studio by Sable/ });
    const wide = screen.getByRole('button', { name: /Wide, Studio by Sable/ });
    expect([base.getAttribute('aria-pressed'), wide.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    api.put.mockResolvedValue({ data: { data: lookbook() } });
    fireEvent.click(base);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook/venue`, { source: 'scene_set_base', ref_id: 'set-1', in_lookbook: true }));
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.change(screen.getByLabelText('Upload your own'), { target: { files: [new File(['v'], 'v.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].get('category')).toBe('venue');
  });

  test('Key inspo: two upload slots and two automatic textures', async () => {
    await renderTab();
    expect(screen.getByTestId('elb-slot-inspo-0')).toBeTruthy();
    expect(screen.getByTestId('elb-slot-inspo-1')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Texture from Crimson Satin Ballerina Pump' })).toBeTruthy();
    expect(within(screen.getByTestId('elb-texture-1')).getByText('Appears once the look has piece images')).toBeTruthy();
  });

  test('an approved sheet makes the Lookbook read-only', async () => {
    await renderTab(lookbook({ sheet_status: 'approved' }));
    expect(screen.getByText(/The style sheet is approved/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose photos' }).disabled).toBe(true);
    expect(screen.getByLabelText('Hair name').disabled).toBe(true);
  });

  test('a failed save shows its message and keeps the page', async () => {
    await renderTab();
    api.put.mockRejectedValue({ response: { data: { error: 'The tagline is longer than 200 characters.' } } });
    const hair = screen.getByLabelText('Hair name');
    fireEvent.change(hair, { target: { value: 'new' } });
    fireEvent.blur(hair);
    expect((await screen.findByRole('alert')).textContent).toBe('The tagline is longer than 200 characters.');
    expect(screen.getByTestId('episode-lookbook-tab')).toBeTruthy();
  });

  test('"Preview style sheet" opens Wardrobe, where the style sheet is', async () => {
    api.get.mockResolvedValue({ data: { data: lookbook() } });
    const onOpenTab = vi.fn();
    render(<EpisodeLookbookTab episode={{ id: EP }} onOpenTab={onOpenTab} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preview style sheet' }));
    expect(onOpenTab).toHaveBeenCalledWith('wardrobe');
  });
});
