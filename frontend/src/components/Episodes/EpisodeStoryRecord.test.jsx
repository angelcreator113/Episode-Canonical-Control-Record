/**
 * The Episode Story Record (stage C): drafted from the episode, edited,
 * approved; secrets and people chosen from the episode's cast; a redraft
 * asks first; saving an approved record puts it back to draft.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import EpisodeStoryRecord from './EpisodeStoryRecord';

const BASE = '/api/v1/book-from-show/episodes/ep-1/record';
const CAST = [
  { id: 'c1', name: 'Maren', secrets: [{ id: 's1', text: 'She sold the ring', state: 'hidden', known_by: [] }, { id: 's2', text: 'She owes rent', state: 'hidden', known_by: [] }] },
  { id: 'c2', name: 'Mo', secrets: [] },
];
const RECORD = {
  id: 'r1', episode_id: 'ep-1', status: 'draft', what_happened: 'Lala walked the gala.',
  characters: [{ character_id: 'c1', name: 'Maren', knew: 'The room was unfinished', learned: '', changed: 'Guarded' }],
  secrets: [{ secret_id: 's1', character_id: 'c1', text: 'She sold the ring', what: 'hinted', how: 'She hides her hand' }],
  threads: [{ thread_id: null, title: 'Will Mo tell?', note: 'He saw it' }],
};
const DATA = (record = RECORD) => ({ data: { record, cast: CAST, threads: [] } });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(DATA());
});

describe('Episode Story Record', () => {
  test('none yet: draft it from the episode', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA(null));
    vi.mocked(api.post).mockResolvedValue(DATA());
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Draft the record/ }));
    expect(await screen.findByText('Drafted. Look it over, then approve it.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(`${BASE}/draft`, {}, { timeout: 180000 });
    expect(screen.getByLabelText('What happened').value).toBe('Lala walked the gala.');
    expect(screen.getByText('Draft')).toBeTruthy();
  });

  test('the draft: people, secrets and what is left open', async () => {
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    const maren = within(await screen.findByTestId('esr-person-c1'));
    expect(maren.getByLabelText('Knew').value).toBe('The room was unfinished');
    expect(maren.getByLabelText('Changed').value).toBe('Guarded');
    const ring = within(screen.getByTestId('esr-secret-s1'));
    expect(ring.getByText('Maren: She sold the ring')).toBeTruthy();
    expect(ring.getByLabelText('The audience').value).toBe('hinted');
    expect(within(screen.getByTestId('esr-thread-0')).getByLabelText('The question').value).toBe('Will Mo tell?');
    expect(screen.getByRole('button', { name: /Approve/ })).toBeTruthy();
  });

  test('edits save as a draft; then approve', async () => {
    vi.mocked(api.put).mockImplementation((url, body) => Promise.resolve(DATA({ ...RECORD, ...body, secrets: body.secrets.map((s) => ({ ...s, character_id: 'c1', text: s.secret_id === 's1' ? 'She sold the ring' : 'She owes rent' })), characters: body.characters.map((c) => ({ ...c, name: c.character_id === 'c1' ? 'Maren' : 'Mo' })) })));
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    await screen.findByTestId('esr-person-c1');
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Add a secret'), { target: { value: 's2' } });
    fireEvent.change(within(screen.getByTestId('esr-secret-s1')).getByLabelText('The audience'), { target: { value: 'revealed' } });
    fireEvent.change(screen.getByLabelText('Add someone'), { target: { value: 'c2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Saved as a draft.');
    const sent = vi.mocked(api.put).mock.calls[0][1];
    expect(sent.secrets).toEqual([{ secret_id: 's1', what: 'revealed', how: 'She hides her hand' }, { secret_id: 's2', what: 'hinted', how: '' }]);
    expect(sent.characters.map((c) => c.character_id)).toEqual(['c1', 'c2']);

    vi.mocked(api.post).mockResolvedValue(DATA({ ...RECORD, status: 'approved' }));
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    expect(await screen.findByText('Approved. The short story and chapter writers now read it.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(`${BASE}/approve`);
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve$/ })).toBeNull();
  });

  test('an approved record, edited, says it goes back to draft; undo puts it back', async () => {
    vi.mocked(api.get).mockResolvedValue(DATA({ ...RECORD, status: 'approved' }));
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    fireEvent.change(await screen.findByLabelText('What happened'), { target: { value: 'Changed.' } });
    expect(screen.getByText(/puts it back to draft/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
    expect(screen.getByLabelText('What happened').value).toBe('Lala walked the gala.');
  });

  test('a redraft asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Redraft/ }));
    expect(confirm).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    vi.mocked(api.post).mockResolvedValue(DATA());
    fireEvent.click(screen.getByRole('button', { name: /Redraft/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/draft`, {}, { timeout: 180000 }));
    confirm.mockRestore();
  });

  test('a failure says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Say what happened before approving it.' } } });
    render(<EpisodeStoryRecord episodeId="ep-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Approve/ }));
    expect(await screen.findByText('Say what happened before approving it.')).toBeTruthy();
  });
});
