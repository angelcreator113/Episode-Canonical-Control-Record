/**
 * Lala's Phone audit (Evoni, 2026-10-07): a failed content save cleared
 * "unsaved"; the page can now ask the editor to save before leaving, and the
 * save names the screen the areas were loaded for.
 */
import React, { createRef } from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), put: vi.fn() } }));
import ContentZoneEditor from './ContentZoneEditor';

const ZONE = { id: 'c1', content_type: '', x: 0, y: 10, w: 100, h: 50 };
const SCREEN = { id: 's1', asset_id: 'a1' };

test('a failed save stays unsaved; a good one names its screen and clears it', async () => {
  const ref = createRef();
  const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { container } = render(<ContentZoneEditor ref={ref} screenUrl="https://img/s.png" screen={SCREEN} zones={[ZONE]} onSave={onSave} />);
  const remove = [...container.querySelectorAll('button')].find((b) => b.querySelector('svg.lucide-trash2, svg.lucide-trash-2'));
  fireEvent.click(remove);
  expect(ref.current.isDirty()).toBe(true);

  let ok;
  await act(async () => { ok = await ref.current.save(); });
  expect(ok).toBe(false);
  expect(ref.current.isDirty()).toBe(true);
  expect(screen.getByRole('button', { name: /Save/ })).toBeTruthy();

  await act(async () => { ok = await ref.current.save(); });
  expect(ok).toBe(true);
  expect(onSave).toHaveBeenLastCalledWith([], SCREEN);
  expect(ref.current.isDirty()).toBe(false);
});
