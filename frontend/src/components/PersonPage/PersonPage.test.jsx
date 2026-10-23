/**
 * The Person tab (Evoni, 2026-10-23): one read, the six sections in order
 * with the Family section reused, section chips that jump, and a retry
 * when the read fails.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import PersonPage, { SECTIONS, sectionId } from './PersonPage';

const CHAR = { id: 'c1', display_name: 'Truthville', selected_name: 'Marcus Hale' };
const PERSON = {
  id: 'c1',
  who: { name: 'Marcus Hale', aliases: ['Truth'], role_type: 'support', summary: 'A producer.' },
  pulse: { id: 7, handle: 'truthville', follower_tier: 'micro', follower_count: '48K', link: '/pulse?profile=7' },
  lala_tie: { from: 'pulse', tie: 'aware', words: 'knows of Lala, not met' },
  relationships: [], episodes: [],
  writers: { in_cast_block: true, lala: [], family: [], family_block: null, secrecy: [] },
};

const show = () => render(<MemoryRouter><PersonPage character={CHAR} openTab={vi.fn()} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/person/c1') return { data: { success: true, person: PERSON } };
    if (url === '/api/v1/families/character/c1') return { data: { character_id: 'c1', ties: [], families: [], family_tree: null } };
    return { data: {} };
  });
});

describe('the Person tab', () => {
  test('one read; the six sections in order, Family the Family section', async () => {
    show();
    await screen.findByTestId('person-page');
    expect(api.get).toHaveBeenCalledWith('/api/v1/person/c1');
    const order = [...document.querySelectorAll('.pp-sec')].map((el) => el.id);
    expect(order).toEqual(SECTIONS.map(([k]) => sectionId(k)));
    expect(document.getElementById('person-family').querySelector('[data-testid="ch-family"]')).toBeTruthy();
    expect(screen.getByTestId('person-pulse').textContent).toContain('knows of Lala, not met');
  });

  test('the chips jump to each section', async () => {
    show();
    await screen.findByTestId('person-page');
    const nav = screen.getByRole('navigation', { name: 'Person sections' });
    const chips = [...nav.querySelectorAll('a')];
    expect(chips.map((a) => a.textContent)).toEqual(SECTIONS.map(([, l]) => l));
    const target = document.getElementById('person-episodes');
    target.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole('link', { name: 'Episodes' }));
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Episodes' }).getAttribute('aria-current')).toBe('true');
  });

  test('a failed read says so, and Try again reads again', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { data: { error: 'Character not found' } } });
    show();
    expect((await screen.findByRole('alert')).textContent).toContain('Character not found');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('person-page')).toBeTruthy());
  });
});
