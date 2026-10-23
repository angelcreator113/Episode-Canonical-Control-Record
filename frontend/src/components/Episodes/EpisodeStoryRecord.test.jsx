/**
 * What changed (EpisodeStoryRecord; Evoni, 2026-10-23): the record read
 * from the finished script, in sections (goals, relationships, follow-ups,
 * plot threads, secrets; twists only when there are some). Each row can be
 * kept, edited in place or dropped; Save sends the edits, then applies,
 * and says what it wrote and who must be linked to the registry first.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import EpisodeStoryRecord from './EpisodeStoryRecord';

const BASE = '/api/v1/book-from-show/episodes/ep-1/record';
const CAST = [
  { id: 'lala', name: 'Lala', linked: true, is_lala: true, secrets: [] },
  { id: 'c1', name: 'Marcus Hale', linked: true, secrets: [{ id: 's1', text: 'He sent the invitation', state: 'hidden', known_by: [] }, { id: 's2', text: 'He knows her sister', state: 'hidden', known_by: [] }] },
  { id: 'profile:9', name: 'Studio Bystable', linked: false, secrets: [] },
];
const RECORD = {
  id: 'r1', episode_id: 'ep-1', status: 'draft', what_happened: 'Lala met Truthville at the studio night.', applied: {},
  characters: [{ character_id: 'c1', name: 'Marcus Hale', knew: '', learned: 'Her name', changed: '' }],
  goals: [{ key: 'g-key-1', slot: 'relationship_guest', label: 'Get to know Truthville', covered: true, beat: 11, note: 'They talk', keep: true }],
  relationships: [
    { key: 'r-key-1', a: 'lala', b: 'c1', type: 'love_interest', is_romantic: true, stage_before: 'strangers', stage_after: 'acquaintances', evidence_beat: 11, note: 'Flirting', keep: true },
    { key: 'r-key-2', a: 'lala', b: 'profile:9', type: 'collaborator', is_romantic: false, stage_before: null, stage_after: 'acquaintances', evidence_beat: 9, note: '', keep: true },
  ],
  follow_ups: [{ key: 'f-key-1', person: 'profile:9', name: 'Studio Bystable', text: 'Follow up with Studio Bystable about the collab', due_hint: 'next episode', keep: true }],
  threads: [{ key: 't-key-1', thread_id: null, title: 'Who sent the second invitation?', note: 'A second envelope', action: 'new', keep: true }],
  secrets: [{ secret_id: 's1', character_id: 'c1', text: 'He sent the invitation', what: 'hinted', how: 'A glance', keep: true }],
  twists: [],
};
const DATA = (record = RECORD) => ({ data: { record, cast: CAST, threads: [], goals: [] } });
const renderCard = (props = {}) => render(<MemoryRouter><EpisodeStoryRecord episodeId="ep-1" {...props} /></MemoryRouter>);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(DATA());
});

describe('What changed', () => {
  test('none yet: read the finished script', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA(null));
    vi.mocked(api.post).mockResolvedValue(DATA());
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /Read the finished script/ }));
    expect(await screen.findByText('Read the whole script. Look each row over, then Save.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(`${BASE}/draft`, {}, { timeout: 180000 });
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  test('readOnOpen reads it at once when there is none; never without it', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA(null));
    vi.mocked(api.post).mockResolvedValue(DATA());
    const plain = renderCard();
    await screen.findByRole('button', { name: /Read the finished script/ });
    expect(api.post).not.toHaveBeenCalled();
    plain.unmount();
    renderCard({ readOnOpen: true });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/draft`, {}, { timeout: 180000 }));
    expect(await screen.findByTestId('wc-relationships-0')).toBeTruthy();
  });

  test('the sections, each row with its facts; twists only when there are some', async () => {
    renderCard();
    const goal = within(await screen.findByTestId('wc-goals-0'));
    expect(goal.getByText('Get to know Truthville')).toBeTruthy();
    expect(goal.getByText('Covered in beat 11')).toBeTruthy();
    const romance = within(screen.getByTestId('wc-relationships-0'));
    expect(romance.getByText('Love interest')).toBeTruthy();
    expect(romance.getByText('Strangers → acquaintances')).toBeTruthy();
    expect(romance.getByText('Beat 11')).toBeTruthy();
    expect(within(screen.getByTestId('wc-relationships-1')).getByText(/Studio Bystable is not in the registry yet/)).toBeTruthy();
    const follow = within(screen.getByTestId('wc-follow-ups-0'));
    expect(follow.getByText('Follow up with Studio Bystable about the collab')).toBeTruthy();
    expect(follow.getByText('Due: next episode')).toBeTruthy();
    expect(within(screen.getByTestId('wc-threads-0')).getByText('New')).toBeTruthy();
    expect(within(screen.getByTestId('wc-secrets-0')).getByText('Marcus Hale: He sent the invitation')).toBeTruthy();
    expect(screen.queryByTestId('wc-twists')).toBeNull();
    expect(screen.getByTestId('wc-save').textContent).toContain('Save 6 ticked');
  });

  test('untick, edit and drop; Save sends the edits, then applies', async () => {
    vi.mocked(api.put).mockImplementation((url, b) => Promise.resolve(DATA({ ...RECORD, ...b })));
    vi.mocked(api.post).mockResolvedValue({ data: { ...DATA({ ...RECORD, status: 'approved' }).data, result: {
      written: [{ kind: 'relationship', text: 'New relationship: Lala and Marcus Hale (love interest), strangers to acquaintances' }],
      skipped: [{ kind: 'relationship', reason: 'not_linked', name: 'Studio Bystable', profile_id: 9 }],
    } } });
    renderCard();
    // Untick the thread.
    fireEvent.click(await screen.findByLabelText('Keep: Who sent the second invitation?'));
    expect(screen.getByTestId('wc-threads-0').className).toContain('is-off');
    // Edit the romance: a later stage and a new note.
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Lala and Marcus Hale' }));
    const romance = within(screen.getByTestId('wc-relationships-0'));
    fireEvent.change(romance.getByLabelText('After'), { target: { value: 'friends' } });
    fireEvent.change(romance.getByLabelText('What changed'), { target: { value: 'He asks for her number' } });
    expect(romance.getByText('Strangers → friends')).toBeTruthy();
    // Drop the follow-up.
    fireEvent.click(screen.getByRole('button', { name: 'Drop: Follow up with Studio Bystable about the collab' }));
    expect(screen.queryByTestId('wc-follow-ups-0')).toBeNull();

    fireEvent.click(screen.getByTestId('wc-save'));
    const result = await screen.findByTestId('wc-result');
    const sent = vi.mocked(api.put).mock.calls[0][1];
    expect(api.put).toHaveBeenCalledWith(BASE, expect.any(Object));
    expect(sent.threads).toEqual([{ key: 't-key-1', thread_id: null, title: 'Who sent the second invitation?', note: 'A second envelope', action: 'new', keep: false }]);
    expect(sent.relationships[0]).toMatchObject({ key: 'r-key-1', a: 'lala', b: 'c1', stage_after: 'friends', note: 'He asks for her number', is_romantic: true, keep: true });
    expect(sent.follow_ups).toEqual([]);
    expect(sent.goals).toEqual([{ key: 'g-key-1', slot: 'relationship_guest', covered: true, beat: 11, note: 'They talk', keep: true }]);
    expect(api.post).toHaveBeenCalledWith(`${BASE}/approve`);
    expect(within(result).getByText('New relationship: Lala and Marcus Hale (love interest), strangers to acquaintances')).toBeTruthy();
    expect(within(result).getByText(/Link Studio Bystable to the registry first/)).toBeTruthy();
    expect(within(result).getByRole('link', { name: 'Open the Character Registry' }).getAttribute('href')).toBe('/character-registry');
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  test('Save with no edits applies at once; nothing new says so', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...DATA({ ...RECORD, status: 'approved' }).data, result: { written: [], skipped: [] } } });
    renderCard();
    fireEvent.click(await screen.findByTestId('wc-save'));
    expect(await screen.findByText(/Nothing new to write/)).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });

  test('a saved item says Saved; twists show when there are some', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA({ ...RECORD, applied: { relationships: { 'r-key-1': { relationship_id: 'x' } } }, twists: [{ title: 'Truthville is her sister’s ex' }] }));
    renderCard();
    expect(await within(await screen.findByTestId('wc-relationships-0')).findByText('Saved')).toBeTruthy();
    expect(within(screen.getByTestId('wc-twists')).getByText('Truthville is her sister’s ex')).toBeTruthy();
  });

  test('read it again asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: /Read it again/ }));
    expect(confirm).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  test('a failure says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Say what happened before approving it.' } } });
    renderCard();
    fireEvent.click(await screen.findByTestId('wc-save'));
    expect(await screen.findByText('Say what happened before approving it.')).toBeTruthy();
    expect(screen.queryByTestId('wc-result')).toBeNull();
  });
});
