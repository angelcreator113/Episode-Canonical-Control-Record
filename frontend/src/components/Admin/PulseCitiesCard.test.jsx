/**
 * Uploads › Dream Cities (Task #2920): five city cards; an empty image spot
 * uploads and saves the URL on the city; colours save as the city's palette.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import { DREAM_CITIES } from '../../data/dreamCities';
import PulseCitiesCard from './PulseCitiesCard';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

let saved;
beforeEach(() => {
  vi.clearAllMocks();
  saved = null;
  vi.mocked(api.get).mockImplementation(async () => ({ data: saved ? { DREAM_CITIES: saved } : {} }));
  vi.mocked(api.put).mockImplementation(async (url, body) => { saved = body.data; return { data: { saved: true } }; });
});

const savedCity = (key) => saved.find((c) => c.key === key);

describe('Uploads › Dream Cities', () => {
  test('one card per city, empty spots as "+ Add"', async () => {
    render(<PulseCitiesCard />);
    for (const city of DREAM_CITIES) expect(await screen.findByTestId(`pulse-city-${city.key}`)).toBeTruthy();
    const dazzle = within(screen.getByTestId('pulse-city-dazzle_district'));
    expect(dazzle.getByTestId('city-dazzle_district-image-add').textContent).toMatch(/\+ Add image/);
    expect(dazzle.getByTestId('city-dazzle_district-bubble-add').textContent).toMatch(/\+ Add story bubble/);
    expect(dazzle.getByText("(the spec's, not saved yet)", { exact: false })).toBeTruthy();
  });

  test('an image upload saves its URL on that city only', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { url: 'https://cdn/echo.jpg' } });
    render(<PulseCitiesCard />);
    await screen.findByTestId('pulse-city-echo_park');
    const file = new File(['x'], 'echo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('city-echo_park-image-file'), { target: { files: [file] } });
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/world/dream-cities/echo_park/image?kind=image');
    expect(savedCity('echo_park').image_url).toBe('https://cdn/echo.jpg');
    expect(savedCity('dazzle_district').image_url).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId('pulse-city-echo_park').querySelector('img.pulse-city-image')?.getAttribute('src')).toBe('https://cdn/echo.jpg'));
    expect(within(screen.getByTestId('pulse-city-echo_park')).getByLabelText('Image alt text')).toBeTruthy();
  });

  test('colours: add one, save, and `color` follows the first', async () => {
    render(<PulseCitiesCard />);
    const card = within(await screen.findByTestId('pulse-city-ascent_tower'));
    fireEvent.change(card.getByLabelText('New colour'), { target: { value: '0f1e2d' } });
    fireEvent.click(card.getByRole('button', { name: /Add$/ }));
    fireEvent.change(card.getByLabelText('Colour 1'), { target: { value: '#C0C7D0' } });
    fireEvent.click(card.getByRole('button', { name: 'Save colours' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(savedCity('ascent_tower')).toMatchObject({ palette: ['#C0C7D0', '#A8D8EA', '#0F1E2D'], color: '#C0C7D0' });
  });

  test('a bad hex is refused before saving', async () => {
    render(<PulseCitiesCard />);
    const card = within(await screen.findByTestId('pulse-city-radiance_row'));
    fireEvent.change(card.getByLabelText('New colour'), { target: { value: 'pink' } });
    fireEvent.click(card.getByRole('button', { name: /Add$/ }));
    expect(card.getByRole('alert').textContent).toMatch(/six hex digits/);
    expect(api.put).not.toHaveBeenCalled();
  });
});
