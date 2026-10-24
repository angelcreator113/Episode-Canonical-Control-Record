/**
 * RelationshipEngine/AddModal and GenModal — every field is named by its
 * label (2026-10-24: primitives' Label was a plain div, so screen readers
 * read the selects as unnamed).
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import AddModal from './AddModal';
import GenModal from './GenModal';

const chars = [
  { id: 'lala', display_name: 'Lala', role_type: 'special' },
  { id: 'm', display_name: 'Truthville', selected_name: 'Marcus Hale', role_type: 'pressure' },
];

describe('labelled fields', () => {
  test('Add relationship: each select and box by its label', () => {
    render(<AddModal chars={chars} rels={[]} onAdd={vi.fn()} onClose={vi.fn()} />);
    for (const name of ['Character A', 'Character B', 'Mode', 'Status', 'Tension State']) {
      expect(screen.getByLabelText(name).tagName).toBe('SELECT');
    }
    expect(screen.getByLabelText('Relationship Type').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Situation').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Character A').querySelectorAll('option')).toHaveLength(3);
  });

  test('Generate seeds: the focus select by its label', () => {
    render(<GenModal chars={chars} genning={false} onGenerate={vi.fn()} onClose={vi.fn()} />);
    const sel = screen.getByLabelText('Focus Character (optional)');
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Any character', 'Lala', 'Marcus Hale']);
  });
});
