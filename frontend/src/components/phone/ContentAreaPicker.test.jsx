/**
 * ContentAreaPicker — Content's "Add an area" (Evoni's mockup, 2026-10-08).
 */
import React from 'react';
import { vi, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../ScreenContentRenderer', () => ({ CONTENT_TYPE_MAP: { dm_thread: { label: 'DM Thread' }, custom_text: { label: 'Custom Text' } } }));
import ContentAreaPicker, { contentAreaLabel } from './ContentAreaPicker';

afterEach(() => cleanup());

test('the summary names what each area shows', () => {
  render(<ContentAreaPicker zones={[{ id: 'a', content_type: 'feed_posts', content_config: { max_items: 1 } }, { id: 'b', content_type: 'custom_text' }, { id: 'c' }]} />);
  expect(screen.getByTestId('content-area-summary').textContent).toBe('3 areas · Latest post, Custom Text, Not set yet');
});

test('picking a kind arms it; picking it again disarms', () => {
  const onArm = vi.fn();
  const { rerender } = render(<ContentAreaPicker onArm={onArm} />);
  fireEvent.click(screen.getByTestId('content-kind-dm_thread'));
  expect(onArm).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'dm_thread', content_type: 'dm_thread' }));
  rerender(<ContentAreaPicker onArm={onArm} armedKey="dm_thread" />);
  expect(screen.getByTestId('content-kind-dm_thread').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Now drag on the phone')).toBeTruthy();
  fireEvent.click(screen.getByTestId('content-kind-dm_thread'));
  expect(onArm).toHaveBeenLastCalledWith(null);
});

test('other screens with content are links', () => {
  const onPickScreen = vi.fn();
  render(<ContentAreaPicker otherScreens={[{ screen: { id: 'acc', name: 'Accessories Page' }, count: 1 }]} onPickScreen={onPickScreen} />);
  fireEvent.click(screen.getByRole('button', { name: 'Accessories Page 1' }));
  expect(onPickScreen).toHaveBeenCalledWith({ id: 'acc', name: 'Accessories Page' });
});

test('a feed area with more than one post is not called "Latest post"', () => {
  expect(contentAreaLabel({ content_type: 'feed_posts', content_config: { max_items: 3 } })).toBe('feed_posts');
});
