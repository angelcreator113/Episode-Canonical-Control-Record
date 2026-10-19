/** Breadcrumbs: a character's page sits under The Cast, named for them (the profile audit, 2026-10-19). */
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';
import { setPageTitle, clearPageTitle } from '../lib/pageTitle';

const at = (path) => render(<MemoryRouter initialEntries={[path]}><Breadcrumbs /></MemoryRouter>);

describe('Breadcrumbs', () => {
  afterEach(() => clearPageTitle('/character/c1'));

  test('a character page: Home / The Cast / their name', () => {
    at('/character/c1');
    act(() => setPageTitle('/character/c1', 'Maren Ellis'));
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs.textContent.replace(/\s+/g, ' ')).toBe('Home/The Cast/Maren Ellis');
    expect(screen.getByRole('button', { name: 'The Cast' })).toBeTruthy();
  });

  test('before the name is known it says Character', () => {
    at('/character/c1');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain('Character');
  });

  test('another page is unchanged', () => {
    at('/shows');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent.replace(/\s+/g, ' ')).toBe('Home/Shows');
  });
});
