/**
 * Voice Studio's tabs (S1; Evoni's mockup and rulings, 2026-10-30): Needs
 * Attention opens by default; Dialogue Library shows this episode's lines,
 * approved takes and history; only working tabs are shown (no Voice
 * Settings before S3); the beat and line survive switching, and Back
 * returns to the tab before. Statuses are words, not colour alone.
 */
import { vi, beforeEach, afterEach, test, expect, describe } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import VoiceStudio from './VoiceStudio';
import { beatNeeds } from '../components/VoiceStudio/BeatList';

const EP = '44444444-4444-4444-8444-444444444444';
const BASE = `/api/v1/voice-studio/${EP}`;
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
  id, label: null, source_kind: 'recorded', source_duration_ms: 3000, revision_id: `rev-${id}`, revision_no: 1, in_ms: 0, out_ms: 2400, gain_db: 0,
  fade_in_ms: 0, fade_out_ms: 0, normalise: false, association_id: `as-${id}`, beat_number: beat, line_index: i,
  audio_url: `https://bucket/${id}.wav`, binding: { status: 'bound', line_index: i }, ...extra,
});
const VIEW = {
  episode: { id: EP, title: 'The Gala', episode_number: 12 }, script_revision: 'sr1', script_seq: '7', can_edit: true,
  beats: [
    { beat_number: 1, duplicate: false, usable: true, lines: [line(1, 0, 'lala', 'This outfit is everything!'), line(1, 1, 'guest', 'Love the look!')] },
    { beat_number: 2, duplicate: false, usable: true, lines: [line(2, 0, 'lala', 'Closet time.'), line(2, 1, 'lala', 'You can dress it up or down.')] },
  ],
  takes: [take('t1', 1, 0, { label: 'Take A' }), take('t2', 2, 0)],
  summary: { approvals: [approval('a1', 't1', 1, 0, 'current'), approval('a2', 't2', 2, 0, 'needs_review')] },
};
const HISTORY = [
  { id: 'h2', beat_number: 1, line_index: 0, approved_by: 'evoni', approved_at: '2026-10-30T10:00:00Z' },
  { id: 'h1', beat_number: 1, line_index: 0, approved_by: 'evoni', approved_at: '2026-10-29T10:00:00Z', superseded_at: '2026-10-30T10:00:00Z' },
];

const Where = () => {
  const l = useLocation();
  const navigate = useNavigate();
  return (<><div data-testid="where">{l.search}</div><button type="button" data-testid="go-back" onClick={() => navigate(-1)}>back</button></>);
};
const renderAt = (search = '') => render(
  <MemoryRouter initialEntries={[`/episodes/${EP}${search}`]}>
    <Routes><Route path="/episodes/:episodeId" element={<><VoiceStudio episodeId={EP} embedded /><Where /></>} /></Routes>
  </MemoryRouter>,
);
const where = () => new URLSearchParams(screen.getByTestId('where').textContent);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `${BASE}/studio`) return { data: { data: VIEW } };
    if (url === `${BASE}/approvals/history`) return { data: { data: HISTORY } };
    throw Object.assign(new Error('404'), { response: { status: 404, data: {} } });
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe('tabs', () => {
  test('Needs Attention opens by default; only working tabs are shown (no Voice Settings yet); the count of things to check is on it', async () => {
    renderAt('?tab=voice');
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent.replace(/\d+$/, ''))).toEqual(['Needs Attention', 'Dialogue Library']);
    expect(screen.getByTestId('vs-tab-attention').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText(/Voice Settings/)).toBeNull();
    expect(within(screen.getByTestId('vs-tab-attention')).getByLabelText('1 to check')).toBeTruthy();
    expect(screen.getByTestId('vs-line-1:0')).toBeTruthy();
    expect(screen.queryByTestId('vs-library')).toBeNull();
    // No permanent thumbnail strip.
    expect(document.querySelector('img')).toBeNull();
  });

  test('switching keeps the beat and line; Back returns to the tab before', async () => {
    renderAt('?tab=voice&beat=2&line=1');
    await screen.findByTestId('vs-detail');
    fireEvent.click(screen.getByTestId('vs-tab-library'));
    expect(where().get('vtab')).toBe('library');
    expect(where().get('beat')).toBe('2');
    expect(where().get('line')).toBe('1');
    expect(await screen.findByTestId('vs-library')).toBeTruthy();
    fireEvent.click(screen.getByTestId('go-back'));
    await waitFor(() => expect(screen.getByTestId('vs-tab-attention').getAttribute('aria-selected')).toBe('true'));
    expect(within(screen.getByTestId('vs-detail')).getByText('You can dress it up or down.')).toBeTruthy();
  });

  test('?vtab=library opens the Library directly', async () => {
    renderAt('?tab=voice&vtab=library');
    expect(await screen.findByTestId('vs-library')).toBeTruthy();
    expect(screen.getByTestId('vs-tab-library').getAttribute('aria-selected')).toBe('true');
  });
});

describe('Needs Attention', () => {
  test('the beat list says what each beat needs, in words; choosing a beat closes the open line', async () => {
    renderAt('?tab=voice&line=0');
    const b1 = await screen.findByTestId('vs-beat-1');
    expect(b1.textContent).toContain('2 lines');
    expect(b1.textContent).toContain('1/2 approved');
    expect(screen.getByTestId('vs-beat-2').textContent).toContain('1 to check');
    fireEvent.click(screen.getByTestId('vs-beat-2'));
    expect(where().get('beat')).toBe('2');
    expect(where().get('line')).toBeNull();
    // The phone's dropdown chooses the same way.
    fireEvent.change(screen.getByTestId('vs-beat-select'), { target: { value: '1' } });
    expect(where().get('beat')).toBe('1');
  });

  test('beatNeeds: words for each case', () => {
    const b = (counts, duplicate = false) => ({ counts: { spoken: 2, approved: 0, review: 0, attention: 0, ...counts }, duplicate });
    expect(beatNeeds(b({ review: 1, attention: 2 }))).toEqual({ tone: 'warn', text: '3 to check' });
    expect(beatNeeds(b({ approved: 2 }))).toEqual({ tone: 'ok', text: 'All approved' });
    expect(beatNeeds(b({ spoken: 0 }))).toEqual({ tone: 'muted', text: 'No spoken lines' });
    expect(beatNeeds(b({ approved: 1 }))).toEqual({ tone: 'muted', text: '1/2 approved' });
    expect(beatNeeds(b({}, true))).toEqual({ tone: 'bad', text: 'Beat number used twice' });
  });

  test('the open line has a way back to the lines (the phone sheet), which closes it', async () => {
    renderAt('?tab=voice&beat=1&line=0');
    await screen.findByTestId('vs-detail');
    fireEvent.click(screen.getByRole('button', { name: /Back to the lines/ }));
    expect(where().get('line')).toBeNull();
    expect(screen.queryByTestId('vs-detail')).toBeNull();
  });
});

describe('Dialogue Library', () => {
  test('every spoken line with its approved take and history; All Episodes is shown but not offered yet', async () => {
    renderAt('?tab=voice&vtab=library');
    const lib = await screen.findByTestId('vs-library');
    expect(within(lib).getByTestId('vs-lib-count').textContent).toBe('4 lines');
    expect(screen.getByTestId('vs-scope-episode').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('vs-scope-all').disabled).toBe(true);
    expect(screen.getByTestId('vs-scope-all').textContent).toContain('coming later');
    const first = screen.getByTestId('vs-lib-line-1:0');
    expect(first.textContent).toContain('This outfit is everything!');
    expect(first.textContent).toContain('Approved take: Take A · 2.4 s');
    expect(first.textContent).toContain('Approved');
    expect(screen.getByTestId('vs-lib-line-2:0').textContent).toContain('Needs review');
    expect(screen.getByTestId('vs-lib-line-2:1').textContent).toContain('No approved take');
    fireEvent.click(await screen.findByTestId('vs-lib-history-1:0'));
    const items = within(first).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toMatch(/^Approved by evoni on .+: in force$/);
    expect(items[1]).toMatch(/^Approved by evoni on .+: replaced by a later approval$/);
  });

  test('filters: character, status and words; nothing matching says so', async () => {
    renderAt('?tab=voice&vtab=library');
    await screen.findByTestId('vs-library');
    fireEvent.change(screen.getByTestId('vs-lib-speaker'), { target: { value: 'guest' } });
    expect(screen.getByTestId('vs-lib-count').textContent).toBe('1 line');
    fireEvent.change(screen.getByTestId('vs-lib-speaker'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('vs-lib-status'), { target: { value: 'review' } });
    expect(screen.getByTestId('vs-lib-count').textContent).toBe('1 line');
    fireEvent.change(screen.getByTestId('vs-lib-status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('vs-lib-search'), { target: { value: 'DRESS' } });
    expect(screen.getByTestId('vs-lib-count').textContent).toBe('1 line');
    fireEvent.change(screen.getByTestId('vs-lib-search'), { target: { value: 'zzz' } });
    expect(screen.getByText('No lines match.')).toBeTruthy();
  });

  test('Open in Needs Attention goes to the line there (approving stays under its existing rules)', async () => {
    renderAt('?tab=voice&vtab=library');
    fireEvent.click(await screen.findByTestId('vs-lib-open-2:1'));
    expect(where().get('vtab')).toBeNull();
    expect(where().get('beat')).toBe('2');
    expect(where().get('line')).toBe('1');
    expect(within(await screen.findByTestId('vs-detail')).getByText('You can dress it up or down.')).toBeTruthy();
  });

  test('the Library offers no approve, withdraw, record or trim of its own', async () => {
    renderAt('?tab=voice&vtab=library');
    const lib = await screen.findByTestId('vs-library');
    expect(within(lib).queryByTestId('vs-approve')).toBeNull();
    expect(within(lib).queryByRole('button', { name: /Withdraw|Record|Trim/ })).toBeNull();
  });
});
