/**
 * Visual Memory phase 4 (CaptionSuggestions): the caption's reading, their
 * pictures ranked with why, a recommendation that guides but never restricts
 * (Use, Edit, Generate new and Upload always offered), "Include {name}" for an
 * optional person, a cost check before generating when a fitting picture
 * exists, and what she chose recorded. A made picture is a private draft:
 * Approve (with who may see it), and Attach puts it with the post's pictures;
 * nothing goes on the post by itself.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CaptionSuggestions from './CaptionSuggestions';
import { madeFromLine } from '../MediaVariations/MakeVariation';

const reading = { subject: 'a candle', activity: '', mood: 'calm', setting: 'home kitchen', person_in_frame: 'no', objects: ['candle'], avoid: [] };
const kitchenEdit = { change: { kind: 'object', text: 'add candle' }, locks: ['face', 'wardrobe', 'location'] };
const kitchen = { id: 'k-1', url: 'https://img/k.jpg', caption: 'Home kitchen', status: 'approved', visibility: 'internal', score: 4, ready: false, why: ['set in the home kitchen'], pictured: false, edit: kitchenEdit };
const dough = { id: 'd-1', url: 'https://img/d.jpg', caption: 'Dough rising', status: 'approved', visibility: 'internal', score: 12, ready: false, why: ['shows dough'], pictured: false, edit: { change: { kind: 'framing', text: 'closer on dough' }, locks: ['face', 'wardrobe', 'location', 'props'] } };
const made = { id: 'n-1', url: 'https://img/new.jpg', caption: 'a candle', status: 'draft', visibility: 'private' };
const person = (extra = {}) => ({ name: 'Maren', in_frame: 'no', included: false, portraits: 1, ...extra });
const plan = (extra = {}) => ({
  recommended: 'create', use: null, edit: null, actions: ['use', 'edit', 'create', 'upload'], create_note: null,
  create: { action: 'create', references: [{ kind: 'place', asset_id: 'k-1' }], blocked: null }, person: person(), ...extra,
});
const suggestions = (p, { ranked = [kitchen], r = reading } = {}) => ({ data: { success: true, cached: true, fallback: false, reading: r, ranked, plan: p, poster: { id: 'm-1', name: 'Maren' } } });
const lastRun = () => api.post.mock.calls.filter(([u]) => u.endsWith('/suggestions/run')).pop()?.[1];

describe('CaptionSuggestions', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('the recommended edit, with the change editable and the rest kept', async () => {
    const edit = { action: 'edit', asset_id: 'k-1', ...kitchenEdit };
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions(plan({ recommended: 'edit', edit })))
      .mockResolvedValueOnce({ data: { success: true, action: 'edit', asset: { ...made, parent_asset_id: 'k-1' }, review: { reasons: ['Check the place still reads as their kitchen.'] }, sources: [{ role: 'parent', caption: 'Home kitchen' }] } });
    const onMade = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={vi.fn()} onMade={onMade} />);
    expect((await screen.findByTestId('cs-reading')).textContent).toContain('a candle · calm · home kitchen · no one in it');
    expect(screen.getByTestId('cs-recommend').textContent).toMatch(/Recommended: Edit this picture.*Add candle, keeping the face, wardrobe and place/);
    expect(screen.getByTestId('cs-edit').className).toContain('is-recommended');
    fireEvent.click(screen.getByTestId('cs-edit'));
    const input = screen.getByLabelText(/What to change on/);
    expect(input.value).toBe('add candle');
    fireEvent.change(input, { target: { value: 'add a tall white candle' } });
    fireEvent.click(screen.getByTestId('cs-edit-run'));
    await waitFor(() => expect(lastRun()).toEqual({ choice: { action: 'edit', asset_id: 'k-1', change: { kind: 'object', text: 'add a tall white candle' }, locks: ['face', 'wardrobe', 'location'], include_person: false } }));
    expect((await screen.findByTestId('cs-made')).textContent).toContain('Check the place still reads as their kitchen.');
    expect(screen.getByTestId('cs-made-from').textContent).toBe('Made from the original "Home kitchen".');
    expect(onMade).toHaveBeenCalled();
  });

  test('all four choices are offered when a picture fits; Use records the choice, and generating asks first with the cost', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions(plan({ recommended: 'use', use: { action: 'use', asset_id: 'd-1', ready: false }, create_note: 'A fitting picture already exists; generating costs about $0.20.' }), { ranked: [dough, kitchen] }))
      .mockResolvedValueOnce({ data: { success: true, recorded: true } })
      .mockResolvedValueOnce({ data: { success: true, action: 'create', asset: made, review: { reasons: [] } } });
    const onUse = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={onUse} />);
    for (const id of ['cs-use', 'cs-edit', 'cs-create', 'cs-upload']) expect((await screen.findByTestId(id)).disabled).toBe(false);
    expect(screen.getByTestId('cs-use').className).toContain('is-recommended');

    // Any ranked picture can be used, not only the recommended one.
    fireEvent.click(screen.getByRole('button', { name: 'Suggested: Home kitchen' }));
    fireEvent.click(screen.getByTestId('cs-use'));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ id: 'k-1' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/post-media/posts/p-1/suggestions/choice', { action: 'use', asset_id: 'k-1' }));

    fireEvent.click(screen.getByTestId('cs-create'));
    expect(screen.getByTestId('cs-create-confirm').textContent).toContain('A fitting picture already exists; generating costs about $0.20.');
    expect(lastRun()).toBeUndefined();
    fireEvent.click(screen.getByTestId('cs-create-anyway'));
    await waitFor(() => expect(lastRun()).toEqual({ choice: { action: 'create', include_person: false } }));
  });

  test('a new picture is approved with its visibility, and attached only on her click', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions(plan()))
      .mockResolvedValueOnce({ data: { success: true, action: 'create', asset: made, review: { reasons: ['Check it fits the caption.'] }, sources: [{ role: 'place', caption: 'Home kitchen' }] } });
    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true } });
    const onUse = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={onUse} />);
    expect((await screen.findByTestId('cs-recommend')).textContent).toMatch(/A new picture from 1 approved reference/);
    fireEvent.click(screen.getByTestId('cs-create'));
    await waitFor(() => expect(lastRun()).toEqual({ choice: { action: 'create', include_person: false } }));
    expect((await screen.findByTestId('cs-made-from')).textContent).toBe('Made from the place picture "Home kitchen".');
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Who may see it'), { target: { value: 'public' } });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/media/n-1', { status: 'approved', visibility: 'public' }));
    fireEvent.click(await screen.findByTestId('cs-attach'));
    expect(onUse).toHaveBeenCalledWith({ ...made, status: 'approved', visibility: 'public' });
  });

  test('Include Maren puts them in a new picture, and is refused plainly with no approved portrait', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions(plan({ person: person({ in_frame: 'optional' }) }), { r: { ...reading, person_in_frame: 'optional' } }))
      .mockResolvedValueOnce({ data: { success: true, action: 'create', asset: made, review: { reasons: [] } } });
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    const toggle = await screen.findByLabelText(/Include Maren/);
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByTestId('cs-create'));
    await waitFor(() => expect(lastRun()).toEqual({ choice: { action: 'create', include_person: true } }));

    vi.mocked(api.post).mockResolvedValueOnce(suggestions(plan({ person: person({ in_frame: 'optional', portraits: 0 }) })));
    render(<CaptionSuggestions postId="p-2" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByLabelText(/Include Maren/)).toHaveLength(2));
    fireEvent.click(screen.getAllByLabelText(/Include Maren/)[1]);
    expect(screen.getAllByTestId('cs-create')[1].disabled).toBe(true);
    expect(screen.getByText(/no approved portrait of Maren yet/)).toBeTruthy();
  });

  test('Upload goes to their library approved for the studio, onto the post, and is recorded', async () => {
    const asset = { id: 'u-1', url: 'https://img/u.jpg', caption: 'a candle', status: 'approved', visibility: 'internal' };
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions(plan()))
      .mockResolvedValueOnce({ data: { success: true, asset } })
      .mockResolvedValueOnce({ data: { success: true, recorded: true } });
    const onUse = vi.fn();
    const onMade = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={onUse} onMade={onMade} />);
    const file = new File(['x'], 'candle.png', { type: 'image/png' });
    fireEvent.change(await screen.findByTestId('cs-upload-file'), { target: { files: [file] } });
    await waitFor(() => expect(onUse).toHaveBeenCalledWith(asset));
    const [url, form] = api.post.mock.calls[1];
    expect(url).toBe('/api/v1/media');
    expect(form.get('status')).toBe('approved');
    expect(form.get('visibility')).toBe('internal');
    expect(JSON.parse(form.get('links'))).toEqual([{ entity_type: 'character', entity_id: 'm-1', role: 'owner' }]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/post-media/posts/p-1/suggestions/choice', { action: 'upload', result_asset_id: 'u-1' }));
    expect(onMade).toHaveBeenCalled();
  });

  test('a budget refusal is said plainly', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429, data: { error: 'Daily image budget reached. Nothing was made; try again when the budget resets.' } } });
    render(<CaptionSuggestions postId="p-2" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was made');
  });

  test('with the AI unreachable it reads from the caption and says so', async () => {
    const down = suggestions(plan());
    down.data = { ...down.data, cached: false, fallback: true, ai_unavailable: true };
    vi.mocked(api.post).mockResolvedValueOnce(down);
    render(<CaptionSuggestions postId="p-3" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    expect((await screen.findByTestId('cs-fallback')).textContent).toContain('the AI could not be reached');
  });

  test('"Made from" names the place, the portrait and the original', () => {
    expect(madeFromLine([{ role: 'place', caption: 'Home kitchen' }, { role: 'portrait', character_name: 'Maren' }, { role: 'parent' }]))
      .toBe('the place picture "Home kitchen", the portrait of Maren, the original');
  });
});
