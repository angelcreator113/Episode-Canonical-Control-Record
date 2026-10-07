/**
 * Lala's Phone step 1 (Evoni, 2026-10-07): unsaved content areas survive a
 * re-render that passes a new but equal zones array; new saved zones still
 * replace them.
 */
import React from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), put: vi.fn() } }));
import ContentZoneEditor from './ContentZoneEditor';

const ZONE = { id: 'c1', type: 'feed', label: 'Feed', x: 0, y: 10, w: 100, h: 50, config: {} };
const props = (zones) => ({ screenUrl: 'https://img/s.png', screen: { id: 's1' }, zones, onSave: vi.fn() });

test('an unsaved removal stays through a re-render with equal zones; changed zones replace it', () => {
  const { rerender, container } = render(<ContentZoneEditor {...props([ZONE])} />);
  expect(screen.getByText('CONTENT AREAS (1)')).toBeTruthy();
  const remove = [...container.querySelectorAll('button')].find((b) => b.querySelector('svg.lucide-trash2, svg.lucide-trash-2'));
  fireEvent.click(remove);
  expect(screen.getByText('CONTENT AREAS (0)')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Save/ })).toBeTruthy();

  rerender(<ContentZoneEditor {...props([{ ...ZONE }])} />); // a new array, the same zones
  expect(screen.getByText('CONTENT AREAS (0)')).toBeTruthy();

  rerender(<ContentZoneEditor {...props([ZONE, { ...ZONE, id: 'c2' }])} />); // the saved zones changed
  expect(screen.getByText('CONTENT AREAS (2)')).toBeTruthy();
});
