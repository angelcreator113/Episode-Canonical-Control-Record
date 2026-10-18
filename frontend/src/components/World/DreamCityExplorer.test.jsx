/**
 * The World tab's city explorer (the mock, 2026-10-06): pick a city, see
 * its venues, schools and companies; "+ Add" starts a location there.
 * One map (2026-10-08): the picker is the map passed in as renderMap
 * (the illustrated DREAM map), plus a row of city chips for a phone.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DreamCityExplorer from './DreamCityExplorer';
import { DREAM_CITIES, UNIVERSITIES, CORPORATIONS } from '../../data/dreamCities';

const LOCATIONS = [
  { id: 1, name: "STUDIO BY SABLE's Studio", location_type: 'venue', city: 'Echo Park', events: [{ id: 'e1', name: 'Wearable Experiments Studio Session' }] },
  { id: 2, name: 'Atelier Row', location_type: 'venue', city: 'Dazzle District', events: [] },
];
const renderIt = (props = {}) => render(
  <DreamCityExplorer cities={DREAM_CITIES} universities={UNIVERSITIES} corporations={CORPORATIONS} locations={LOCATIONS} loading={false} onAddVenue={vi.fn()} onOpenLocations={vi.fn()} {...props} />,
);

describe('DreamCityExplorer', () => {
  test('five city chips, the first chosen, each with its count of places', () => {
    renderIt();
    const buttons = screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.hasAttribute('aria-pressed'));
    expect(buttons.map((b) => b.querySelector('.dce-name').textContent)).toEqual(DREAM_CITIES.map((c) => c.name));
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].textContent).toContain('1 place');
    expect(screen.getByTestId('dce-city').textContent).toContain('Dazzle District');
    expect(screen.getByTestId('dce-companies').textContent).toContain('The Dazzle Academy');
    const unplaced = screen.getByTestId('dce-unplaced').textContent;
    expect(unplaced).toContain('Not placed in a city yet');
    CORPORATIONS.forEach((c) => expect(unplaced).toContain(c.name));
  });

  test('picking a city shows its venues and the events that use them', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Echo Park/ }));
    expect(screen.getByRole('button', { name: /Echo Park/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dce-city').textContent).toContain('Known for music studios');
    expect(screen.getByTestId('dce-venues').textContent).toContain("STUDIO BY SABLE's Studio");
    expect(screen.getByTestId('dce-venues').textContent).toContain('Used by Wearable Experiments Studio Session');
    expect(screen.getByTestId('dce-companies').textContent).toContain('No school or company is placed in Echo Park yet.');
  });

  test('a city with no places says so; "+ Add" starts a location in it', () => {
    const onAddVenue = vi.fn();
    renderIt({ onAddVenue });
    fireEvent.click(screen.getByRole('button', { name: /Radiance Row/ }));
    expect(screen.getByTestId('dce-venues-empty').textContent).toContain('No places in Radiance Row yet');
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(onAddVenue).toHaveBeenCalledWith('Radiance Row');
  });

  test('the map passed in is the picker: it is told the chosen city and can change it', () => {
    const renderMap = vi.fn((key, pick) => (
      <div data-testid="the-map" data-city={key}>
        <span role="button" tabIndex={0} onClick={() => pick('echo_park')}>Map: Echo Park</span>
      </div>
    ));
    renderIt({ renderMap });
    expect(screen.getByTestId('the-map').getAttribute('data-city')).toBe('dazzle_district');
    expect(document.querySelector('.dce-bubble')).toBeNull();
    fireEvent.click(screen.getByText('Map: Echo Park'));
    expect(screen.getByTestId('the-map').getAttribute('data-city')).toBe('echo_park');
    expect(screen.getByTestId('dce-city').textContent).toContain('Echo Park');
    expect(screen.getByTestId('dce-venues').textContent).toContain("STUDIO BY SABLE's Studio");
  });
  test('Edit changes a city\'s words: the form starts from them, Save sends them, and no Edit without a save', async () => {
    const onSaveCity = vi.fn().mockResolvedValue();
    renderIt({ onSaveCity });
    fireEvent.click(screen.getByRole('button', { name: /Echo Park/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const form = screen.getByTestId('dce-city-form');
    const echo = DREAM_CITIES.find((c) => c.key === 'echo_park');
    expect(screen.getByLabelText('Its energy').value).toBe(echo.energy);
    expect(screen.getByLabelText('Big events (commas between)').value).toBe(echo.majorEvents.join(', '));
    expect(form.textContent).toContain('write Echo Park from these words');
    fireEvent.change(screen.getByLabelText('Its culture'), { target: { value: ' Karaoke capital. ' } });
    fireEvent.change(screen.getByLabelText('Big events (commas between)'), { target: { value: 'Neon Nights, , Open Mic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByTestId('dce-city-form')).toBeNull());
    expect(onSaveCity).toHaveBeenCalledWith('echo_park', expect.objectContaining({ culture: 'Karaoke capital.', energy: echo.energy, majorEvents: ['Neon Nights', 'Open Mic'] }));
  });

  test('a failed save keeps the form and says so; without onSaveCity there is no Edit', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderIt({ onSaveCity: vi.fn().mockRejectedValue(new Error('no')) });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('could not be saved');
    expect(screen.getByTestId('dce-city-form')).toBeTruthy();
    err.mockRestore();
    unmount();
    renderIt();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});
