/**
 * Lala's Phone audit (Evoni, 2026-10-07): the Navigate action's screen list
 * was blank; the tap-area panel passed {id, name}, the row reads {key, label}.
 */
import React from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionRow from './ActionRow';

const SCREENS = [{ key: 'dms', label: 'DMs' }, { key: 'feed', label: 'Feed' }];

test('Navigate lists the screens by name and saves the screen key', () => {
  const onChange = vi.fn();
  render(<ActionRow action={{ type: 'navigate', target: '' }} screenOptions={SCREENS} onChange={onChange} onRemove={() => {}} />);
  expect(screen.getByRole('option', { name: 'DMs' })).toBeTruthy();
  const select = screen.getAllByRole('combobox')[1];
  fireEvent.change(select, { target: { value: 'feed' } });
  expect(onChange).toHaveBeenCalledWith({ type: 'navigate', target: 'feed' });
});
