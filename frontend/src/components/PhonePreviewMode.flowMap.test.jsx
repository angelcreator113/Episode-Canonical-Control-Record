/**
 * The Flow Map (Producer Mode → Lala's Phone → More → Flow Map) opens over
 * the page with Close; it used to sit at the foot of the page with no way
 * out but clicking a screen (Evoni, 2026-10-07).
 */
import React from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenFlowMap } from './PhonePreviewMode';

const SCREENS = [
  { id: 'home', name: 'Home', url: 'https://x/home.png', screen_links: [{ id: 'z1', target: 'chat' }] },
  { id: 'chat', name: 'Chat', url: 'https://x/chat.png' },
];

test('it opens as a dialog that Close, Escape and the backdrop close', () => {
  const onClose = vi.fn();
  render(<ScreenFlowMap screens={SCREENS} onClose={onClose} onSelectScreen={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: 'Flow Map' });
  expect(dialog.textContent).toContain('Tap a screen to open it.');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(dialog);
  expect(onClose).toHaveBeenCalledTimes(3);
});

test('tapping a screen selects it', () => {
  const onSelectScreen = vi.fn();
  const { container } = render(<ScreenFlowMap screens={SCREENS} onClose={() => {}} onSelectScreen={onSelectScreen} />);
  fireEvent.click(container.ownerDocument.querySelector('svg g'));
  expect(onSelectScreen).toHaveBeenCalledWith(SCREENS[0]);
});
