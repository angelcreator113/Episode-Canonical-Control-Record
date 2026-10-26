import { describe, test, expect, vi, beforeEach } from 'vitest';
import { makeScreen, addTapZone, fillZone } from './episodePhoneBuild';

const fakeApi = () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() });
const fail = (status, error) => Object.assign(new Error(error), { response: { status, data: { error } } });

let api;
beforeEach(() => {
  api = fakeApi();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('makeScreen', () => {
  test('a screen the phone has no type for: the type, then its picture; Undo takes the type (and so the picture) out', async () => {
    api.post.mockImplementation(async (url) => (url.endsWith('/types')
      ? { data: { data: { id: 't-uuid', type_key: 'bank' } } }
      : { data: { data: { asset_id: 'a-bank' } } }));
    const r = await makeScreen(api, 's-1', { name: 'Bank', screen: null, beats: [8] }, { episodeNumber: 3 });
    expect(api.post.mock.calls.map((c) => c[0])).toEqual(['/api/v1/ui-overlays/s-1/types', '/api/v1/ui-overlays/s-1/generate/bank']);
    expect(api.post.mock.calls[0][1]).toEqual({ name: 'Bank', category: 'phone', description: 'Named in the script (Episode 3, beat 8).' });
    expect(r.error).toBeNull();
    expect(r.items.map((i) => i.label)).toEqual(['Bank: new screen with its picture']);
    await r.items[0].undo();
    expect(api.delete).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/types/t-uuid');
  });

  test('a screen named in the Hub with no picture: only the picture, and Undo deletes that picture', async () => {
    api.post.mockResolvedValue({ data: { data: { asset_id: 'a-closet' } } });
    const r = await makeScreen(api, 's-1', { name: 'Closet', screen: { id: 'closet' }, beats: [8] });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/ui-overlays/s-1/generate/closet');
    await r.items[0].undo();
    expect(api.delete).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/asset/a-closet');
  });

  test('the picture failing keeps the new type, for review, and says what failed; out of budget stops', async () => {
    api.post.mockImplementation(async (url) => {
      if (url.endsWith('/types')) return { data: { data: { id: 't-uuid', type_key: 'bank' } } };
      throw fail(429, 'Image budget reached');
    });
    const r = await makeScreen(api, 's-1', { name: 'Bank', screen: null, beats: [8] });
    expect(r.items.map((i) => i.label)).toEqual(['Bank: new screen']);
    expect(r.error).toBe('Bank: the picture could not be made (Image budget reached)');
    expect(r.stop).toBe(true);
  });
});

describe('addTapZone', () => {
  const need = { name: 'Invitation', screen: { id: 'invitation' } };
  const from = { name: 'Mail', asset_id: 'a-mail' };

  test("keeps only the proposed zone that opens the screen, adds it to the screen's zones; Undo removes just it", async () => {
    api.post.mockResolvedValue({ data: { proposal: { zones: [
      { id: 'ai-1', label: 'Inbox', target: '' },
      { id: 'ai-2', label: 'Invite', target: '', actions: [{ type: 'navigate', target: 'invitation' }] },
      { id: 'ai-3', label: 'Invite again', target: 'invitation' },
    ] } } });
    api.get.mockResolvedValue({ data: { screen_links: [{ id: 'old' }] } });
    const r = await addTapZone(api, 's-1', 'ep-1', need, from);
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/ui-overlays/s-1/ai/add-zones');
    expect(api.post.mock.calls[0][1]).toMatchObject({ asset_id: 'a-mail', episode_id: 'ep-1' });
    expect(api.post.mock.calls[0][1].prompt_hint).toMatch(/opens the "Invitation" screen \(id invitation\)/);
    expect(api.put).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/screen-links/a-mail', { screen_links: [{ id: 'old' }, expect.objectContaining({ id: 'ai-2' })] });
    expect(r.items[0].label).toBe('Tap zone "Invite" on Mail → Invitation');
    api.get.mockResolvedValue({ data: { screen_links: [{ id: 'old' }, { id: 'ai-2' }, { id: 'later' }] } });
    await r.items[0].undo();
    expect(api.put).toHaveBeenLastCalledWith('/api/v1/ui-overlays/s-1/screen-links/a-mail', { screen_links: [{ id: 'old' }, { id: 'later' }] });
  });

  test('no zone that opens it, or nowhere to put it, is a failure that saves nothing', async () => {
    api.post.mockResolvedValue({ data: { proposal: { zones: [{ id: 'ai-1', target: 'mail' }] } } });
    expect((await addTapZone(api, 's-1', 'ep-1', need, from)).error).toBe('Invitation: the AI proposed no tap zone on Mail that opens it');
    expect((await addTapZone(api, 's-1', 'ep-1', need, { name: 'Closet' })).error).toMatch(/Closet has no picture/);
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe('fillZone', () => {
  const screen = { name: 'Invitation', asset_id: 'a-inv' };
  test("merges the AI's settings into the zone; Undo puts the empty zone back", async () => {
    api.post.mockResolvedValue({ data: { proposal: { content_config: { event_id: 'e1' }, content_preview: 'The gala invite' } } });
    api.get.mockResolvedValue({ data: { content_zones: [{ id: 'cz1', content_type: 'event_invite' }, { id: 'cz2', content_type: 'custom_text', content_config: { text: 'hi' } }] } });
    const r = await fillZone(api, 's-1', 'ep-1', screen, { id: 'cz1', content_type: 'event_invite' });
    expect(api.post).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/ai/fill-content-zone', { asset_id: 'a-inv', zone_id: 'cz1', episode_id: 'ep-1' });
    expect(api.put.mock.calls[0][1].content_zones[0]).toEqual({ id: 'cz1', content_type: 'event_invite', content_config: { event_id: 'e1' } });
    expect(r.items[0].label).toBe('Invitation: event_invite zone filled (The gala invite)');
    api.get.mockResolvedValue({ data: { content_zones: [{ id: 'cz1', content_type: 'event_invite', content_config: { event_id: 'e1' } }] } });
    await r.items[0].undo();
    expect(api.put).toHaveBeenLastCalledWith('/api/v1/ui-overlays/s-1/content-zones/a-inv', { content_zones: [{ id: 'cz1', content_type: 'event_invite' }] });
  });

  test('a failed AI call says so and writes nothing', async () => {
    api.post.mockRejectedValue(fail(500, 'boom'));
    const r = await fillZone(api, 's-1', 'ep-1', screen, { id: 'cz1', content_type: 'event_invite' });
    expect(r).toMatchObject({ items: [], error: 'Invitation: the event_invite zone was not filled (boom)', stop: false });
    expect(api.put).not.toHaveBeenCalled();
  });
});
