/**
 * New overlay starts from a picture (Evoni, 2026-10-07: "i need to be able
 * to upload pictures in producer mode overlays"). The dialog took only a
 * prompt and refused to add an overlay without one; now a picture is enough,
 * and it is uploaded to the new overlay.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ProductionOverlaysTab, { pictureProblem, nameFromFile } from './ProductionOverlaysTab';

const png = (name = 'lower-third_gold.png', size = 10) => {
  const f = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url.endsWith('/usage') ? { data: { data: {} } } : { data: { data: [] } }
  ));
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const openDialog = async () => {
  render(<ProductionOverlaysTab showId="show-1" />);
  fireEvent.click(await screen.findByTestId('sol-new'));
  return screen.getByRole('dialog', { name: 'New overlay' });
};

describe('picture helpers', () => {
  test('only images up to 10 MB', () => {
    expect(pictureProblem(png())).toBeNull();
    expect(pictureProblem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe('Choose an image (PNG or JPG).');
    expect(pictureProblem(png('big.png', 11 * 1024 * 1024))).toMatch(/over 10 MB/);
  });

  test('a name from the file name', () => {
    expect(nameFromFile(png('lower-third_gold.png'))).toBe('Lower third gold');
    expect(nameFromFile({ name: '.png' })).toBe('');
  });
});

describe('New overlay with a picture', () => {
  test('a picture and a name are enough: the overlay is made, then the picture uploaded to it', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => (
      url.endsWith('/types')
        ? { data: { success: true, data: { id: 'row-1', type_key: 'lower_third_gold', name: 'Lower third gold' } } }
        : { data: { success: true } }
    ));
    const dialog = await openDialog();
    const add = within(dialog).getByRole('button', { name: 'Add overlay' });
    expect(add.disabled).toBe(true);
    expect(within(dialog).getByText('Upload a picture')).toBeTruthy();

    fireEvent.change(within(dialog).getByTestId('sol-new-file'), { target: { files: [png()] } });
    expect(within(dialog).getByTestId('sol-new-preview')).toBeTruthy();
    expect(within(dialog).getByPlaceholderText(/Show title card/).value).toBe('Lower third gold');
    expect(add.disabled).toBe(false);

    fireEvent.click(add);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[0]).toEqual(['/api/v1/ui-overlays/show-1/types', {
      name: 'Lower third gold', description: '', prompt: '', category: 'production',
    }]);
    expect(api.post.mock.calls[1][0]).toBe('/api/v1/ui-overlays/show-1/upload/lower_third_gold');
    expect(api.post.mock.calls[1][1].get('image')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Lower third gold added');
  });

  test('not an image: said in the dialog, nothing chosen', async () => {
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByTestId('sol-new-file'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(within(dialog).getByTestId('sol-new-error').textContent).toBe('Choose an image (PNG or JPG).');
    expect(within(dialog).queryByTestId('sol-new-preview')).toBeNull();
  });

  test('a name already taken stays in the dialog with the picture kept', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { error: 'Overlay type "x" already exists' } } });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByTestId('sol-new-file'), { target: { files: [png()] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add overlay' }));
    expect((await within(dialog).findByTestId('sol-new-error')).textContent).toBe('There is already an overlay with that name.');
    expect(within(dialog).getByTestId('sol-new-preview')).toBeTruthy();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('a picture that fails to upload after the overlay is made says so', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url.endsWith('/types')) return { data: { success: true, data: { type_key: 'gold', name: 'Gold' } } };
      throw { response: { status: 500, data: { error: 'S3 is down' } } };
    });
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByTestId('sol-new-file'), { target: { files: [png('gold.png')] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add overlay' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe("Gold added, but the picture didn't upload: S3 is down. Use Upload on its card.");
  });
});
