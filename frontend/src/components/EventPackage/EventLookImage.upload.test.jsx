/**
 * "Upload this look" (Evoni, 2026-10-15: each venue has its everyday look,
 * then each event's look, which can be her own image as well as generated).
 * The upload sits beside "Generate this look" in the Scene Sets panel; with
 * several sets at the venue she chooses one first (answer 3).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EventLookImage from './EventLookImage';

const BASE = '/api/v1/world/show-1/events/ev-1/look';
const SET = { id: 'set-1', name: 'Glasshouse Hall', base_still_url: 'https://x/everyday.jpg', generation_status: 'complete' };
const FILE = new File(['img'], 'gala.png', { type: 'image/png' });

let lookState;
const renderIt = (props = {}) => {
  const onToast = vi.fn();
  const onSaved = vi.fn();
  render(
    <MemoryRouter>
      <EventLookImage showId="show-1" eventId="ev-1" onToast={onToast} onSaved={onSaved} pollMs={5} canGenerate {...props} />
    </MemoryRouter>,
  );
  return { onToast, onSaved };
};
const uploads = () => vi.mocked(api.post).mock.calls.filter(([url]) => url === `${BASE}/upload`);
const pick = async (file = FILE) => {
  await screen.findByTestId('upload-this-look');
  fireEvent.change(screen.getByTestId('upload-this-look-input'), { target: { files: [file] } });
};

describe('EventLookImage: Upload this look', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    lookState = { scene_set: SET, approved_base: { scene_set_id: 'set-1', image_url: SET.base_still_url }, look: null, editable: true };
    vi.mocked(api.get).mockImplementation(async () => ({ data: { success: true, data: lookState } }));
  });

  test('the chosen image is sent, the look shows as uploaded, and the event reloads', async () => {
    vi.mocked(api.post).mockImplementation(async () => {
      lookState = { ...lookState, look: { id: 'look-1', status: 'complete', source: 'uploaded', image_url: 'https://x/gala.png' } };
      return { data: { success: true, data: { scene_set_id: 'set-1' } } };
    });
    const { onToast, onSaved } = renderIt();
    await pick();

    await waitFor(() => expect(uploads()).toHaveLength(1));
    const form = uploads()[0][1];
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('image').name).toBe('gala.png');
    expect(form.get('scene_set_id')).toBeNull();
    expect((await screen.findByTestId('event-look-thumb')).getAttribute('src')).toBe('https://x/gala.png');
    expect(screen.getByTestId('event-look-uploaded').textContent).toBe('Uploaded');
    expect(onSaved).toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith('The look is uploaded');
  });

  test('several sets at the venue: she chooses one, and the same image goes to it', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce({ response: { data: { code: 'CHOOSE_SET', options: [{ id: 'set-a', name: 'Hall A' }, { id: 'set-b', name: 'Hall B' }] } } })
      .mockResolvedValueOnce({ data: { success: true, data: { scene_set_id: 'set-b' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderIt();
    await pick();

    fireEvent.click(await screen.findByTestId('event-look-choose-set-b'));
    await waitFor(() => expect(uploads()).toHaveLength(2));
    expect(uploads()[1][1].get('scene_set_id')).toBe('set-b');
    expect(uploads()[1][1].get('image').name).toBe('gala.png');
    expect(vi.mocked(api.post).mock.calls.filter(([url]) => url === `${BASE}/brief`)).toHaveLength(0);
  });

  test('a refusal is shown', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Only JPEG, PNG, and WebP images are allowed' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { onToast } = renderIt();
    await pick();
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Only JPEG, PNG, and WebP images are allowed', 'error'));
  });

  test('outside the Scene Sets panel, or with the Place locked, there is no upload', async () => {
    lookState = { ...lookState, editable: false };
    renderIt();
    await screen.findByTestId('event-look-locked');
    expect(screen.queryByTestId('upload-this-look')).toBeNull();
  });
});
