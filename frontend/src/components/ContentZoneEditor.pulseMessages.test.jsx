/**
 * Lala's Messages zone settings: one conversation by the other one's handle
 * (an @ dropped), saved in the zone's content_config; and a max items count.
 */
import React, { createRef } from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), put: vi.fn() } }));
import ContentZoneEditor from './ContentZoneEditor';

const ZONE = { id: 'c1', content_type: 'pulse_messages', content_config: {}, x: 0, y: 10, w: 100, h: 50 };
const SCREEN = { id: 's1', asset_id: 'a1' };

test("a Lala's Messages area takes a conversation's handle and a max items count, saved with the zone", async () => {
  const ref = createRef();
  const onSave = vi.fn().mockResolvedValue(true);
  render(<ContentZoneEditor ref={ref} screenUrl="https://img/s.png" screen={SCREEN} zones={[ZONE]} onSave={onSave} />);
  // The area's row in the list (the canvas names it too).
  fireEvent.click(screen.getAllByText("💌 Lala's Messages").find((el) => el.tagName === 'SPAN'));
  fireEvent.change(screen.getByLabelText('CONVERSATION WITH (HANDLE)'), { target: { value: '@marcus.k' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 5'), { target: { value: '4' } });
  await act(async () => { await ref.current.save(); });
  expect(onSave.mock.calls[0][0][0].content_config).toEqual({ handle: 'marcus.k', max_items: 4 });
});
