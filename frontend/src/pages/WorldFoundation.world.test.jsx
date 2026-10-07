/**
 * The World tab after the per-tab fix (2026-10-04): two sub-tabs (The Map,
 * Locations); the Loop, how the world's layers connect, is a fold-out intro
 * above the map instead of a third tab of explanatory text, and a ?sub=loop
 * link lands on the map; the Locations tab is the doorway to the Property
 * Manager, which had none.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { data: {}, locations: [], events: [] } })), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import WorldFoundation from './WorldFoundation';

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><WorldFoundation embedded /></MemoryRouter>);

beforeEach(() => { window.localStorage.clear(); });

describe('World tab', () => {
  test('two sub-tabs; the Loop is a fold-out above the map, closed until opened', async () => {
    window.history.pushState({}, '', '/universe?tab=world');
    renderAt('/universe?tab=world');
    expect(screen.getByText('The Map')).toBeTruthy();
    expect(screen.getByText('Locations')).toBeTruthy();
    expect(screen.queryByText('The Loop')).toBeNull();
    const loop = screen.getByTestId('world-loop');
    expect(loop.tagName).toBe('DETAILS');
    expect(loop.open).toBe(false);
    expect(loop.textContent).toContain('How the world connects: the Loop');
    expect(loop.textContent).toContain('THE LOOP');
    fireEvent.click(screen.getByText('How the world connects: the Loop'));
    expect(loop.open).toBe(true);
  });

  test('in the hub the map keeps the illustrated map but not the old city, school and company cards', () => {
    window.history.pushState({}, '', '/universe?tab=world');
    renderAt('/universe?tab=world');
    expect(screen.getByTestId('dream-city-explorer')).toBeTruthy();
    expect(screen.queryByText('DREAM CITIES')).toBeNull();
    expect(screen.queryByText('UNIVERSITIES')).toBeNull();
    expect(screen.queryByText('CORPORATIONS')).toBeNull();
    expect(screen.getByText('Upload Map Image')).toBeTruthy();
  });

  test('a ?sub=loop link lands on the map', () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=loop');
    renderAt('/universe?tab=world&sub=loop');
    expect(screen.getByTestId('world-loop')).toBeTruthy();
    expect(screen.queryByText('Search locations...')).toBeNull();
  });

  test('the Locations tab is the doorway to the Property Manager', () => {
    window.history.pushState({}, '', '/universe?tab=world&sub=locations');
    renderAt('/universe?tab=world&sub=locations');
    const link = screen.getByRole('link', { name: 'Properties & rooms →' });
    expect(link.getAttribute('href')).toBe('/property-manager');
    expect(screen.getByPlaceholderText('Search locations...')).toBeTruthy();
  });
});
