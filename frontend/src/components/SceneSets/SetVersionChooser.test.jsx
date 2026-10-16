/**
 * Everyday set or event version (2026-10-16): the chooser says what the set
 * is, makes it an event version of an everyday set for an event, and makes
 * a version everyday again.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import SetVersionChooser from './SetVersionChooser';

const OPTIONS = {
  everyday_sets: [{ id: 'set-bed', name: "Lala's bedroom" }],
  events: [{ id: 'ev-gala', name: 'Spring Gala', locked: false }, { id: 'ev-old', name: 'Old party', locked: true }],
};

describe('SetVersionChooser', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: { data: OPTIONS } });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  });

  test('makes an everyday set an event version of another for an event', async () => {
    const onSaved = vi.fn(); const onToast = vi.fn();
    render(<SetVersionChooser set={{ id: 'set-gala', name: 'Bedroom – Gala', event_versions: [] }} onSaved={onSaved} onToast={onToast} />);
    expect(screen.getByTestId('set-version-now-set-gala').textContent).toMatch(/everyday set/);
    fireEvent.click(screen.getByLabelText('An event version'));
    fireEvent.change(await screen.findByLabelText('Everyday set'), { target: { value: 'set-bed' } });
    // A locked event (its episode accepted) cannot be chosen.
    expect(screen.getByRole('option', { name: /Old party/ }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'ev-gala' } });
    fireEvent.click(screen.getByTestId('set-version-save-set-gala'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-gala/version', { everyday_set_id: 'set-bed', event_id: 'ev-gala' }));
    expect(onToast).toHaveBeenCalledWith("Bedroom – Gala is Spring Gala's version of Lala's bedroom");
    expect(onSaved).toHaveBeenCalled();
  });

  test('a version says what it is; Everyday saves at once', async () => {
    const set = { id: 'set-gala', name: 'Bedroom – Gala', version_of: { id: 'set-bed', name: "Lala's bedroom" }, version_event: { id: 'ev-gala', name: 'Spring Gala' } };
    render(<SetVersionChooser set={set} />);
    expect(screen.getByTestId('set-version-now-set-gala').textContent).toBe("An event version of Lala's bedroom for Spring Gala");
    fireEvent.click(screen.getByLabelText('Everyday'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-gala/version', { everyday_set_id: null }));
  });

  test('an everyday set with versions lists them and stays everyday; a refusal shows its reason', async () => {
    const set = { id: 'set-bed', name: "Lala's bedroom", event_versions: [{ id: 'set-gala', name: 'Bedroom – Gala', event: { id: 'ev-gala', name: 'Spring Gala' } }] };
    const { unmount } = render(<SetVersionChooser set={set} />);
    expect(screen.getByTestId('set-version-list-set-bed').textContent).toBe('Event versions: Bedroom – Gala (Spring Gala)');
    expect(screen.getByLabelText('An event version').disabled).toBe(true);
    unmount();

    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: '"Room" is used by Brunch: an event version is for one event' } } });
    render(<SetVersionChooser set={{ id: 'set-x', name: 'Room', event_versions: [] }} />);
    fireEvent.click(screen.getByLabelText('An event version'));
    fireEvent.change(await screen.findByLabelText('Everyday set'), { target: { value: 'set-bed' } });
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: 'ev-gala' } });
    fireEvent.click(screen.getByTestId('set-version-save-set-x'));
    expect((await screen.findByTestId('set-version-error-set-x')).textContent).toMatch(/used by Brunch/);
  });
});
