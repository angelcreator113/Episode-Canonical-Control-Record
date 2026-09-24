import { describe, it, expect, vi } from 'vitest';
import {
  EXPECTED_VERSION_KEY, STALE_SAVE_MESSAGE, isStaleSaveError, saveErrorMessage,
  sentFieldsUnchanged, putEventVersioned, createEventSaveQueue,
} from './eventSaveVersion';

const V1 = '2026-09-24T15:00:00.123Z';
const V2 = '2026-09-24T15:05:00.000Z';
const V3 = '2026-09-24T15:06:00.000Z';
const stale = (current, currentVersion = V2) => {
  const err = new Error('409');
  err.response = { status: 409, data: { success: false, code: 'EVENT_CHANGED', error: STALE_SAVE_MESSAGE, current_updated_at: currentVersion, event: current } };
  return err;
};

describe('isStaleSaveError / saveErrorMessage', () => {
  it('recognises only the route refusal', () => {
    expect(isStaleSaveError(stale({}))).toBe(true);
    expect(isStaleSaveError({ response: { status: 409, data: { code: 'OTHER' } } })).toBe(false);
    expect(isStaleSaveError({ response: { status: 500 } })).toBe(false);
  });
  it('shows the route message for a refusal, never a raw status', () => {
    expect(saveErrorMessage(stale({}))).toBe(STALE_SAVE_MESSAGE);
    expect(saveErrorMessage({ message: 'Network Error' })).toBe('Network Error');
  });
});

describe('sentFieldsUnchanged', () => {
  it('compares only the fields being sent', () => {
    const base = { name: 'Gala', venue_name: 'Club Noir', canon_consequences: { invitation_text: 'old' } };
    const current = { name: 'Gala', venue_name: 'Club Noir', canon_consequences: { invitation_text: 'NEW' } };
    expect(sentFieldsUnchanged({ name: 'Gala Night' }, base, current)).toBe(true);
    expect(sentFieldsUnchanged({ canon_consequences: {} }, base, current)).toBe(false);
    expect(sentFieldsUnchanged({ venue_name: 'X' }, base, { ...current, venue_name: 'Rooftop' })).toBe(false);
  });
});

describe('putEventVersioned', () => {
  it('sends the version it read', async () => {
    const put = vi.fn().mockResolvedValue({ data: { success: true, event: { updated_at: V2 } } });
    await putEventVersioned(put, '/u', { name: 'A' }, { version: V1, base: {} });
    expect(put).toHaveBeenCalledWith('/u', { name: 'A', [EXPECTED_VERSION_KEY]: V1 });
  });
  it('sends no version when it has none', async () => {
    const put = vi.fn().mockResolvedValue({ data: {} });
    await putEventVersioned(put, '/u', { name: 'A' }, {});
    expect(put).toHaveBeenCalledWith('/u', { name: 'A' });
  });
  it('retries once with the current version when the sent fields are unchanged', async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(stale({ name: 'Gala', invitation_asset_id: 'new' }))
      .mockResolvedValueOnce({ data: { success: true } });
    await putEventVersioned(put, '/u', { name: 'Gala Night' }, { version: V1, base: { name: 'Gala' } });
    expect(put).toHaveBeenCalledTimes(2);
    expect(put.mock.calls[1][1]).toEqual({ name: 'Gala Night', [EXPECTED_VERSION_KEY]: V2 });
  });
  it('lets the refusal stand when a sent field changed elsewhere', async () => {
    const put = vi.fn().mockRejectedValue(stale({ name: 'Renamed in the Package' }));
    await expect(putEventVersioned(put, '/u', { name: 'Gala Night' }, { version: V1, base: { name: 'Gala' } }))
      .rejects.toSatisfy(isStaleSaveError);
    expect(put).toHaveBeenCalledTimes(1);
  });
  it('does not retry a second time', async () => {
    const put = vi.fn().mockRejectedValue(stale({ name: 'Gala' }));
    await expect(putEventVersioned(put, '/u', { name: 'X' }, { version: V1, base: { name: 'Gala' } })).rejects.toBeTruthy();
    expect(put).toHaveBeenCalledTimes(2);
  });
});

describe('createEventSaveQueue', () => {
  it('runs saves in order, each with the version the previous save returned', async () => {
    const seen = [];
    let n = 0;
    const put = vi.fn(async (_u, body) => {
      seen.push(body[EXPECTED_VERSION_KEY]);
      await new Promise((r) => setTimeout(r, 5));
      n += 1;
      return { data: { success: true, event: { updated_at: n === 1 ? V2 : V3 } } };
    });
    const q = createEventSaveQueue(put, { getBase: () => ({}) });
    q.setVersion(V1);
    await Promise.all([q.save('/u', { a: 1 }), q.save('/u', { b: 2 })]);
    expect(seen).toEqual([V1, V2]);
    expect(q.getVersion()).toBe(V3);
  });
  it('keeps going after a failed save', async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ data: { event: { updated_at: V2 } } });
    const q = createEventSaveQueue(put);
    q.setVersion(V1);
    await expect(q.save('/u', { a: 1 })).rejects.toThrow('boom');
    await q.save('/u', { b: 2 });
    expect(put.mock.calls[1][1][EXPECTED_VERSION_KEY]).toBe(V1);
    expect(q.getVersion()).toBe(V2);
  });
});
