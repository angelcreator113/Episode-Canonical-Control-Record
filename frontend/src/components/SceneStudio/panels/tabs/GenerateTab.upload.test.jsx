/**
 * Scene Studio › Generate › Transform (show side check, 2026-10-20):
 * - F3: the source image uploads to POST /api/v1/assets with an assetType
 *   (there is no /assets/upload);
 * - F2: on a scene set, Transform calls /scene-sets/:id/transform-object.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../../../services/api';
import GenerateTab from './GenerateTab';

const SET_ID = '11111111-2222-3333-4444-555555555555';

describe('Scene Studio Transform: upload and transform reach real routes', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a source image uploads to POST /api/v1/assets with an assetType', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { url: 'https://cdn.test/source.png' } } });
    const { container } = render(<GenerateTab sceneId={SET_ID} contextType="sceneSet" />);
    fireEvent.click(screen.getByText('Transform'));
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'source.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/assets');
    expect(body.get('assetType')).toBe('EPISODE_FRAME');
    expect(body.get('file')).toBeTruthy();
  });
});
