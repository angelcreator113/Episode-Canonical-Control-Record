// Voice Studio (B2; Evoni, 2026-10-28): the page over the B1 services.
// What each write sends (the script revision, the take revision, the approval
// seen at the line), what each refusal tells the person, that a failed save
// carries on without uploading twice, that nothing is re-confirmed unless
// chosen and confirmed, and the empty, switched-off and read-only pages.
import { vi, beforeEach, afterEach, test, expect, describe } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import VoiceStudio from './VoiceStudio';

const EP = '22222222-2222-4222-8222-222222222222';
const BASE = `/api/v1/voice-studio/${EP}`;
const REV = 'sr1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const line = (beat, i, speaker, words, extra = {}) => ({
  beat_number: beat, line_index: i, occurrence: 1, speaker_key: speaker, speaker_written: speaker ? speaker[0].toUpperCase() + speaker.slice(1) : null,
  delivery_note: null, words, prime: false, context_hash: `ctx-${beat}-${i}`, spoken: Boolean(speaker), ...extra,
});
const approval = (id, cand, beat, i, state, extra = {}) => ({
  approval_id: id, candidate_id: cand, candidate_revision_id: `rev-${cand}`, beat_number: beat, line_index: i, state, playable: state === 'current',
  reason: null, reason_text: null, context_hash: `ctx-${beat}-${i}`, approved_by: 'evoni', words: 'Hi.', speaker: 'Lala',
  resolution: ['current', 'needs_review'].includes(state) ? { status: 'bound', line_index: i, candidates: [] } : null, ...extra,
});
const take = (id, beat, i, extra = {}) => ({
  id, label: null, source_kind: 'recorded', source_duration_ms: 3000, revision_id: `rev-${id}`, revision_no: 1, in_ms: 0, out_ms: 2000, gain_db: 0,
  fade_in_ms: 0, fade_out_ms: 0, normalise: false, association_id: beat == null ? null : `as-${id}`, beat_number: beat, line_index: i,
  audio_url: `https://bucket/${id}.wav`, binding: beat == null ? null : { status: 'bound', line_index: i }, ...extra,
});

let view;
const baseView = () => ({
  episode: { id: EP, title: 'The Gala', episode_number: 12 },
  script_revision: REV, script_seq: '7', can_edit: true,
  beats: [
    { beat_number: 1, duplicate: false, usable: true, lines: [line(1, 0, 'lala', 'Hi.'), line(1, 1, 'guest', 'Love the look!'), line(1, 2, 'justawoman', 'Right.', { prime: true, spoken: false })] },
    { beat_number: 2, duplicate: false, usable: true, lines: [line(2, 0, 'guest', 'Hello!'), line(2, 1, 'lala', 'Closet time.'), line(2, 2, 'lala', 'Okay.'), line(2, 3, 'lala', 'Okay.', { occurrence: 2 })] },
  ],
  takes: [take('t1', 1, 0), take('t2', 1, 1), take('t3', 1, 1)],
  summary: { approvals: [approval('a1', 't1', 1, 0, 'current')] },
});

const err = (status, body) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { success: false, ...body } } });
const offline = () => Object.assign(new Error('Network Error'), { response: undefined });

const renderAt = (search = '') => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}/voice${search}`]}>
    <Routes><Route path="/episodes/:episodeId/voice" element={<VoiceStudio />} /></Routes>
  </MemoryRouter>,
);
const posted = (suffix) => vi.mocked(api.post).mock.calls.filter(([url]) => url === `${BASE}${suffix}`);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  view = baseView();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `${BASE}/studio`) return { data: { data: view } };
    throw err(404, {});
  });
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Voice Studio page', () => {
  test('lines by beat and character, each with its state; Prime and unspoken lines take no take', async () => {
    renderAt('?beat=1');
    expect((await screen.findByTestId('vs-counts')).textContent).toContain('1/6 spoken lines approved');
    expect((screen.getByTestId('vs-line-1:0')).textContent).toContain('Approved');
    expect((screen.getByTestId('vs-line-1:1')).textContent).toContain('Takes, none approved (2)');
    expect((screen.getByTestId('vs-line-1:2')).textContent).toContain("Prime's take");
    fireEvent.click(screen.getByRole('button', { name: 'Guest' }));
    expect(screen.queryByTestId('vs-line-1:0')).toBeNull();
    expect(screen.getByTestId('vs-line-1:1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('vs-line-1:1'));
    expect(within(screen.getByTestId('vs-detail')).getByText('Love the look!')).toBeTruthy();
  });

  test('approving sends the take\'s latest revision, the script revision and the approval seen at the line', async () => {
    renderAt('?beat=1&line=0');
    const detail = await screen.findByTestId('vs-detail');
    // t1 is approved here; only another take offers "Approve instead", sending a1 as the one it replaces.
    view = { ...view, takes: [...view.takes, take('t4', 1, 0)] };
    fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
    await waitFor(() => expect(screen.getByTestId('vs-take-t4')).toBeTruthy());
    expect(within(screen.getByTestId('vs-take-t1')).queryByTestId('vs-approve')).toBeNull();
    fireEvent.click(within(screen.getByTestId('vs-take-t4')).getByTestId('vs-approve'));
    await waitFor(() => expect(posted('/candidates/t4/approve')).toHaveLength(1));
    expect(posted('/candidates/t4/approve')[0][1]).toEqual({ candidate_revision_id: 'rev-t4', script_revision: REV, expected_approval_id: 'a1' });
    expect(detail).toBeTruthy();
  });

  test('a line with no approval sends expected_approval_id null', async () => {
    renderAt('?beat=1&line=1');
    fireEvent.click(within(await screen.findByTestId('vs-take-t2')).getByTestId('vs-approve'));
    await waitFor(() => expect(posted('/candidates/t2/approve')).toHaveLength(1));
    expect(posted('/candidates/t2/approve')[0][1].expected_approval_id).toBeNull();
  });

  test('a script saved since the page loaded: refused, said plainly, Reload reads it again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(err(409, { code: 'SCRIPT_CHANGED', error: 'The script changed since this page read it. Nothing was saved.' }));
    renderAt('?beat=1&line=1');
    fireEvent.click(within(await screen.findByTestId('vs-take-t2')).getByTestId('vs-approve'));
    const banner = await screen.findByTestId('vs-banner');
    expect((banner).textContent).toContain('The script was saved since this page loaded, so nothing was changed.');
    const before = vi.mocked(api.get).mock.calls.length;
    fireEvent.click(within(banner).getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBe(before + 1));
  });

  test('another approval made meanwhile: refused, never merged', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(err(409, { code: 'APPROVAL_CHANGED', error: 'x' }));
    renderAt('?beat=1&line=1');
    fireEvent.click(within(await screen.findByTestId('vs-take-t3')).getByTestId('vs-approve'));
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('Another approval was made for this line since this page loaded, so nothing was changed.');
    expect(posted('/candidates/t3/approve')).toHaveLength(1);
  });

  test('a failed save carries on from where it stopped: the audio is never uploaded twice', async () => {
    let takeCalls = 0;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/sources`) return { data: { data: { source: { id: 'src-1' } } } };
      if (url === `${BASE}/candidates`) { takeCalls += 1; if (takeCalls === 1) throw offline(); return { data: { data: { candidate: { id: 'c-new' } } } }; }
      return { data: { data: {} } };
    });
    renderAt('?beat=1&line=1');
    const file = new File(['RIFF'], 'guest.wav', { type: 'audio/wav' });
    fireEvent.change(await screen.findByTestId('vs-file'), { target: { files: [file] } });
    expect((await screen.findByTestId('vs-banner')).textContent).toContain("Couldn't reach the server");
    expect((screen.getByTestId('vs-banner')).textContent).toContain('The audio is saved; only making it a take is left.');
    fireEvent.click(screen.getByTestId('vs-retry'));
    await waitFor(() => expect(posted('/candidates/c-new/associate')).toHaveLength(1));
    expect(posted('/sources')).toHaveLength(1);
    expect(posted('/candidates')).toHaveLength(2);
    expect(posted('/candidates/c-new/associate')[0][1]).toEqual({ script_revision: REV, beat_number: 1, line_index: 1 });
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('Take saved for this line.');
  });

  test('a refused file is not offered again', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(err(400, { code: 'NO_AUDIO', error: 'That file has no audio in it' }));
    renderAt('?beat=1&line=1');
    fireEvent.change(await screen.findByTestId('vs-file'), { target: { files: [new File(['x'], 'x.wav')] } });
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('That file has no audio in it. Nothing was saved; choose another file or record the line.');
    expect(screen.queryByTestId('vs-retry')).toBeNull();
  });

  test('a tie refused because the script changed: the take is kept untied, never tied to another line', async () => {
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/sources`) return { data: { data: { source: { id: 'src-1' } } } };
      if (url === `${BASE}/candidates`) return { data: { data: { candidate: { id: 'c-new' } } } };
      if (url.endsWith('/associate')) throw err(409, { code: 'SCRIPT_CHANGED', error: 'x' });
      return { data: { data: {} } };
    });
    renderAt('?beat=1&line=1');
    fireEvent.change(await screen.findByTestId('vs-file'), { target: { files: [new File(['x'], 'g.wav')] } });
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('The take was saved, but not tied to this line');
    expect(posted('/candidates/c-new/associate')).toHaveLength(1);
  });

  test('a retry after the line changed does not tie the take to the line now there', async () => {
    let first = true;
    vi.mocked(api.post).mockImplementation(async (url) => {
      if (url === `${BASE}/sources`) { if (first) { first = false; throw offline(); } return { data: { data: { source: { id: 'src-1' } } } }; }
      if (url === `${BASE}/candidates`) return { data: { data: { candidate: { id: 'c-new' } } } };
      return { data: { data: {} } };
    });
    renderAt('?beat=1&line=1');
    fireEvent.change(await screen.findByTestId('vs-file'), { target: { files: [new File(['x'], 'g.wav')] } });
    await screen.findByTestId('vs-retry');
    // The script was edited: another line is at this place now.
    view = { ...view, beats: [{ ...view.beats[0], lines: view.beats[0].lines.map((l, i) => (i === 1 ? line(1, 1, 'guest', 'Something else.', { context_hash: 'ctx-other' }) : l)) }, view.beats[1]] };
    fireEvent.click(screen.getByRole('button', { name: /^Reload$/ }));
    await waitFor(() => expect((screen.getByTestId('vs-detail')).textContent).toContain('Something else.'));
    fireEvent.click(screen.getByTestId('vs-retry'));
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('this line changed since it was recorded');
    expect(posted('/candidates/c-new/associate')).toHaveLength(0);
  });

  test('re-confirm: nothing is pre-checked; only what is chosen and confirmed is sent, with the line context shown', async () => {
    view.summary.approvals = [approval('r1', 't1', 1, 0, 'needs_review', { reason_text: 'The script was saved since this take was approved.' }), approval('r2', 't2', 1, 1, 'needs_review')];
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmed: ['r2'], refused: [] } } });
    renderAt('?beat=1');
    const panel = await screen.findByTestId('vs-review');
    const boxes = within(panel).getAllByRole('checkbox');
    expect(boxes.filter((b) => b.checked)).toHaveLength(0);
    expect((within(panel).getByTestId('vs-reconfirm')).disabled).toBe(true);
    fireEvent.click(boxes[1]);
    fireEvent.click(within(panel).getByTestId('vs-reconfirm'));
    expect((within(panel).getByRole('alertdialog')).textContent).toContain("as of the script's save #7");
    expect(posted('/reconfirm')).toHaveLength(0);
    fireEvent.click(within(panel).getByTestId('vs-reconfirm-confirm'));
    await waitFor(() => expect(posted('/reconfirm')).toHaveLength(1));
    expect(posted('/reconfirm')[0][1]).toEqual({ script_revision: REV, items: [{ approval_id: 'r2', context_hash: 'ctx-1-1' }] });
  });

  test('re-confirm answers are shown as they come: the refused ones are listed', async () => {
    view.summary.approvals = [approval('r1', 't1', 1, 0, 'needs_review')];
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmed: [], refused: [{ approval_id: 'r1', reason: 'words_changed', reason_text: 'The words of this line changed since the take was tied to it.' }] } } });
    renderAt('?beat=1');
    const panel = await screen.findByTestId('vs-review');
    fireEvent.click(within(panel).getByRole('checkbox'));
    fireEvent.click(within(panel).getByTestId('vs-reconfirm'));
    fireEvent.click(within(panel).getByTestId('vs-reconfirm-confirm'));
    expect((await screen.findByTestId('vs-banner')).textContent).toContain('0 takes re-confirmed; 1 not');
  });

  test('moved and ambiguous wait for a person: confirming sends the chosen line and the approval at it', async () => {
    view.summary.approvals = [
      approval('m1', 't9', 2, 0, 'moved', { words: 'Closet time.', resolution: { status: 'moved', line_index: 1, candidates: [1] } }),
      approval('d1', 't8', 2, 3, 'ambiguous', { words: 'Okay.', resolution: { status: 'ambiguous', candidates: [2, 3] } }),
      approval('x1', 't7', 2, 2, 'current'),
    ];
    renderAt('?beat=2');
    const list = await screen.findByTestId('vs-attention');
    expect(within(screen.getByTestId('vs-attention-moved')).getByText(/Moved/)).toBeTruthy();
    fireEvent.click(within(list).getByRole('button', { name: /Confirm line 2/ }));
    await waitFor(() => expect(posted('/approvals/m1/resolve')).toHaveLength(1));
    expect(posted('/approvals/m1/resolve')[0][1]).toEqual({ script_revision: REV, line_index: 1, expected_approval_id: null });
    fireEvent.click(within(screen.getByTestId('vs-attention-ambiguous')).getByRole('button', { name: /Pick line 3/ }));
    await waitFor(() => expect(posted('/approvals/d1/resolve')).toHaveLength(1));
    // Line 3 (index 2) holds x1 in force: the server refuses if that changed.
    expect(posted('/approvals/d1/resolve')[0][1]).toEqual({ script_revision: REV, line_index: 2, expected_approval_id: 'x1' });
  });

  test('a take whose line changed is listed with why, and only a person ties it again', async () => {
    view.takes = [take('tm', 2, 0, { words: 'Closet time.', speaker_written: 'Lala', binding: { status: 'moved', line_index: 1, reason: 'moved', reason_text: 'The line moved within the beat.' } })];
    renderAt('?beat=2&line=1');
    const drifted = await screen.findByTestId('vs-drifted');
    expect((drifted).textContent).toContain('The line moved within the beat.');
    expect(within(screen.getByTestId('vs-detail')).queryByTestId('vs-take-tm')).toBeNull();
    fireEvent.click(within(drifted).getByRole('button', { name: 'Tie to line 2' }));
    await waitFor(() => expect(posted('/candidates/tm/associate')).toHaveLength(1));
    expect(posted('/candidates/tm/associate')[0][1]).toEqual({ script_revision: REV, beat_number: 2, line_index: 1 });
  });

  test('withdrawing asks first, then sends only the revoke', async () => {
    renderAt('?beat=1&line=0');
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw approval' }));
    expect(posted('/approvals/a1/revoke')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(posted('/approvals/a1/revoke')).toHaveLength(1));
  });

  test('a withdrawn approval stays withdrawn: the line says so and offers approving afresh', async () => {
    view.summary.approvals = [approval('w1', 't1', 1, 0, 'revoked', { revoked_by: 'evoni' })];
    renderAt('?beat=1&line=0');
    expect((await screen.findByTestId('vs-state')).textContent).toContain('the last approval was withdrawn by evoni. It stays withdrawn');
    expect((screen.getByTestId('vs-line-1:0')).textContent).toContain('Takes, none approved');
    expect((within(screen.getByTestId('vs-take-t1')).getByTestId('vs-approve')).textContent).toContain('Approve');
  });

  test('outdated: the approved take offers approving its new version; trimming warns first', async () => {
    view.summary.approvals = [approval('o1', 't1', 1, 0, 'outdated_take', { reason_text: 'The take was re-trimmed or re-gained after it was approved.' })];
    renderAt('?beat=1&line=0');
    const row = await screen.findByTestId('vs-take-t1');
    expect((within(row).getByTestId('vs-approve')).textContent).toContain('Approve this version');
    fireEvent.click(within(row).getByRole('button', { name: /Trim and level/ }));
    expect((within(row).getByTestId('vs-trim')).textContent).toContain('makes that approval outdated');
  });

  test('read only for a non-admin: no record, upload, approve or withdraw', async () => {
    view.can_edit = false;
    renderAt('?beat=1&line=1');
    expect((await screen.findByTestId('vs-counts')).textContent).toContain('Read only');
    expect(screen.queryByTestId('vs-capture')).toBeNull();
    expect(screen.queryByTestId('vs-approve')).toBeNull();
  });

  test('a beat numbered twice cannot be tied', async () => {
    view.beats[1].duplicate = true;
    view.beats[1].usable = false;
    renderAt('?beat=2&line=1');
    expect(await screen.findByText(/The script has two beats numbered 2/)).toBeTruthy();
    expect(screen.queryByTestId('vs-capture')).toBeNull();
  });

  test('empty script, switched off and an unreachable server each say what to do', async () => {
    view.beats = [];
    const first = renderAt();
    expect((await screen.findByTestId('vs-empty')).textContent).toContain('no script lines yet');
    first.unmount();
    vi.mocked(api.get).mockRejectedValueOnce(err(404, { code: 'VOICE_STUDIO_OFF', error: 'Voice Studio is not switched on' }));
    const off = renderAt();
    expect((await screen.findByTestId('vs-load-error')).textContent).toContain("Voice Studio isn't switched on yet");
    off.unmount();
    vi.mocked(api.get).mockRejectedValueOnce(err(403, { code: 'AUTH_GROUP_REQUIRED', error: 'Forbidden' }));
    const notAdmin = renderAt();
    expect((await screen.findByTestId('vs-load-error')).textContent).toContain('Voice Studio is for admins only');
    notAdmin.unmount();
    vi.mocked(api.get).mockRejectedValueOnce(offline());
    renderAt();
    expect((await screen.findByTestId('vs-load-error')).textContent).toContain("Couldn't reach the server");
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
  });
});
