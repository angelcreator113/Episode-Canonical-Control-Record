/**
 * Lala's Messages on her Phone (The Pulse spec §3 "Lala's DMs … can appear on
 * Lala's Phone"): her conversations as of the beat's story order (or a zone's
 * own, or the present), approved messages only; one conversation as bubbles
 * when the zone names the other one's handle.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { PulseMessagesRenderer, CONTENT_TYPES, pulseMessagesUrl } from './ScreenContentRenderer';

const LALA = 1;
const DATA = {
  success: true, at: 17, profile_id: LALA,
  threads: [
    { id: 't1', profiles: [{ id: LALA, handle: 'lala', display_name: 'Lala' }, { id: 7, handle: 'marcus.k', display_name: 'Marcus' }],
      messages: [{ id: 'm1', sender_profile_id: LALA, text: 'u up?' }, { id: 'm2', sender_profile_id: 7, text: 'lol yes. that dj tho' }] },
    { id: 't2', profiles: [{ id: 9, handle: 'nia' }, { id: LALA, handle: 'lala', display_name: 'Lala' }],
      messages: [{ id: 'm3', sender_profile_id: LALA, text: 'who styled you??' }] },
    { id: 't3', profiles: [{ id: LALA, handle: 'lala' }, { id: 11, handle: 'quiet' }], messages: [] },
  ],
};

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockResolvedValue({ data: DATA });
});

describe("Lala's Messages zone", () => {
  test('is a registered messages zone type', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'pulse_messages')).toMatchObject({ label: "Lala's Messages", group: 'messages' });
  });

  test("lists her conversations at the beat's story order, the last message each, from her side", async () => {
    render(<PulseMessagesRenderer showId="show-1" storyAt={17} />);
    const zone = await screen.findByTestId('pulse-messages-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-dms?show_id=show-1&at=17&profile_id=lala');
    expect(zone.textContent).toContain('Messages · After Ep 1');
    // A conversation with nothing said yet at this moment is left out.
    expect(screen.getAllByTestId('pulse-messages-row').map((r) => r.textContent)).toEqual(['Marcuslol yes. that dj tho', '@niaYou: who styled you??']);
  });

  test("a zone's handle shows that conversation as bubbles, hers on her side", async () => {
    render(<PulseMessagesRenderer showId="show-1" storyAt={17} config={{ handle: '@Marcus.K' }} />);
    const zone = await screen.findByTestId('pulse-messages-zone');
    expect(zone.textContent).toContain('Marcus · After Ep 1');
    const bubbles = screen.getAllByTestId('pulse-messages-bubble');
    expect(bubbles.map((b) => [b.textContent, b.dataset.mine])).toEqual([['u up?', 'true'], ['lol yes. that dj tho', 'false']]);
  });

  test("a zone's own order wins; without a beat it reads the present; nothing yet says so", async () => {
    render(<PulseMessagesRenderer showId="show-1" storyAt={17} config={{ at: 27 }} />);
    await screen.findByTestId('pulse-messages-zone');
    expect(api.get).toHaveBeenLastCalledWith(pulseMessagesUrl('show-1', 27));
    expect(api.get.mock.calls[0][0]).toBe('/api/v1/pulse-dms?show_id=show-1&at=27&profile_id=lala');
    vi.mocked(api.get).mockResolvedValue({ data: { threads: [], profile_id: null } });
    render(<PulseMessagesRenderer showId="show-1" />);
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/pulse-dms?show_id=show-1&at=present&profile_id=lala'));
    expect(await screen.findByText('No messages yet')).toBeTruthy();
  });

  test('ScreenContentRenderer passes the beat order through', async () => {
    render(<div style={{ position: 'relative' }}><ScreenContentRenderer showId="show-1" storyAt={35}
      zones={[{ id: 'z1', x: 0, y: 10, w: 100, h: 80, content_type: 'pulse_messages', content_config: {} }]} /></div>);
    await screen.findByTestId('pulse-messages-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-dms?show_id=show-1&at=35&profile_id=lala');
  });
});
