/**
 * Lala's Career list (Task 3181): on her phone, as of the episode, on her
 * handwritten paper (goals, brands worked with, milestones); and in the
 * Season Plan, the brands with a per-brand hide (Evoni, 2026-10-14).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../phone/PhoneMapView', () => ({ default: () => null }));

import api from '../../services/api';
import ScreenContentRenderer, { CareerListRenderer, CONTENT_TYPES, careerListUrl } from '../ScreenContentRenderer';
import { CONTENT_AREA_KINDS } from '../phone/ContentAreaPicker';
import CareerBrands from './CareerBrands';

const LIST = {
  goals: [
    { id: 'g1', title: 'First cover', status: 'completed' },
    { id: 'g2', title: 'Ten thousand followers', status: 'active' },
  ],
  brands: [
    { name: 'STUDIO BY SABLE', episodes: [{ id: 'ep1', number: 1 }] },
    { name: 'Maison Belle', episodes: [{ id: 'ep2', number: 2 }, { id: 'ep4', number: 4 }] },
  ],
  milestones: [{ kind: 'goal', title: 'First cover' }],
  hidden_brands: ['Velour Magazine'],
};
let list;

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.put).mockReset();
  list = LIST;
  vi.mocked(api.get).mockImplementation(async () => ({ data: { success: true, data: list } }));
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe("Lala's Career list on the phone", () => {
  test('a registered content type, offered in the picker', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'career_list')).toMatchObject({ label: 'Career List', group: 'messages' });
    expect(CONTENT_AREA_KINDS.find((k) => k.content_type === 'career_list')).toMatchObject({ label: 'Career list' });
    expect(careerListUrl('s 1', 'ep-3')).toBe('/api/v1/shows/s%201/career-list?episode_id=ep-3');
    expect(careerListUrl('s1')).toBe('/api/v1/shows/s1/career-list');
  });

  test('as of the episode: goals (a completed one crossed off), brands worked with, milestones, on her paper', async () => {
    render(<CareerListRenderer showId="s1" episodeId="ep-3" />);
    const paper = await screen.findByTestId('phone-career-list');
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/s1/career-list?episode_id=ep-3');
    expect(paper.className).toBe('evd-paper is-phone');
    expect(screen.getAllByTestId('phone-career-goal').map((g) => [g.textContent, g.dataset.done])).toEqual([
      ['✓First cover', 'true'], ['Ten thousand followers', 'false'],
    ]);
    expect(screen.getAllByTestId('phone-career-brand').map((b) => b.textContent)).toEqual(['STUDIO BY SABLE', 'Maison Belle']);
    expect(screen.getAllByTestId('phone-career-milestone').map((m) => m.textContent)).toEqual(['★ First cover']);
    // The server leaves hidden brands out; the phone never shows them.
    expect(paper.textContent).not.toContain('Velour Magazine');
  });

  test('an empty list says so; a content area renders it with the screen show and episode', async () => {
    list = { goals: [], brands: [], milestones: [], hidden_brands: [] };
    render(<CareerListRenderer showId="s1" />);
    expect(await screen.findByText('No career list yet')).toBeTruthy();
    list = LIST;
    render(<ScreenContentRenderer showId="s1" episodeId="ep-9" zones={[{ id: 'z1', content_type: 'career_list', x: 0, y: 0, w: 50, h: 60 }]} />);
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/shows/s1/career-list?episode_id=ep-9'));
  });
});

describe('Brands worked with, in the Season Plan', () => {
  test('each brand with its episodes; Hide saves it among the hidden', async () => {
    render(<CareerBrands showId="s1" />);
    const rows = await screen.findAllByTestId('career-brand');
    expect(rows.map((r) => r.textContent)).toEqual(['STUDIO BY SABLEEpisode 1 Hide', 'Maison BelleEpisode 2, Episode 4 Hide']);
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Hide Maison Belle' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/s1/career-list/hidden-brands', { brands: ['Velour Magazine', 'Maison Belle'] }));
  });

  test('a hidden brand can be shown again', async () => {
    render(<CareerBrands showId="s1" />);
    const hidden = await screen.findByTestId('career-brands-hidden');
    fireEvent.click(within(hidden).getByRole('button', { name: 'Show Velour Magazine' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/s1/career-list/hidden-brands', { brands: [] }));
  });

  test('no brands yet says when they appear', async () => {
    list = { goals: [], brands: [], milestones: [], hidden_brands: [] };
    render(<CareerBrands showId="s1" />);
    expect((await screen.findByTestId('career-brands-none')).textContent).toMatch(/once an episode with a deal is accepted/);
  });
});
