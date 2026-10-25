/**
 * Setting up a season (Evoni, 2026-10-24): the form and its split check,
 * the placement preview (move, leave out, put back, Save), the draft
 * preview (accept one, accept all, skip, what was left alone) and the
 * checklist (its steps, its actions, gone once all are done).
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import {
  SeasonSetupForm, SeasonPlacement, SeasonDraft, SeasonChecklist, setupSteps, splitProblem, splitRanges, defaultForm, formFromArc, datesProblem,
  moodProblem, MOOD_DEFAULTS, MOOD_MAX,
} from './SeasonSetup';

describe('the split', () => {
  test('three whole numbers, each at least 1, adding up to 24', () => {
    expect(splitProblem([8, 8, 8])).toBeNull();
    expect(splitProblem([6, 10, 8])).toBeNull();
    expect(splitProblem([8, 8, 7])).toBe('These add up to 23; the season has 24 episodes.');
    expect(splitProblem([0, 12, 12])).toBe('Each part needs at least one episode.');
    expect(splitProblem(['', 12, 12])).toBe('Each part takes a whole number of episodes.');
    expect(splitRanges([6, 10, 8])).toEqual(['E1–E6', 'E7–E16', 'E17–E24']);
  });
  test('defaults, and a season read back for Edit', () => {
    expect(defaultForm(1).title).toBe('Soft Luxury Ascension');
    expect(defaultForm(2)).toEqual(expect.objectContaining({ title: 'Season 2', tagline: '', split: [8, 8, 8] }));
    expect(formFromArc({ title: 'T', tagline: null, phases: [
      { title: 'A', tagline: 'a', episode_start: 1, episode_end: 6 },
      { title: 'B', episode_start: 7, episode_end: 16 },
      { title: 'C', episode_start: 17, episode_end: 24 },
    ] })).toEqual({
      title: 'T', tagline: '', logline: '', description: '', starts_on: '', ends_on: '', cover_url: null,
      phases: [
        { title: 'A', tagline: 'a', picture_url: null, emotional_arc: '', feed_tone: '' },
        { title: 'B', tagline: '', picture_url: null, emotional_arc: '', feed_tone: '' },
        { title: 'C', tagline: '', picture_url: null, emotional_arc: '', feed_tone: '' },
      ],
      split: [6, 10, 8],
    });
  });
  test("the Season page's fields read back for Edit (2026-10-25)", () => {
    const form = formFromArc({
      title: 'T', logline: 'L', description: 'D', starts_on: '2026-01-05', ends_on: '2026-03-29', cover_url: 'https://x/c.jpg',
      phases: [{ title: 'A', picture_url: 'https://x/a.jpg', episode_start: 1, episode_end: 8 }, { title: 'B', episode_start: 9, episode_end: 16 }, { title: 'C', episode_start: 17, episode_end: 24 }],
    });
    expect([form.logline, form.description, form.starts_on, form.ends_on, form.cover_url, form.phases[0].picture_url, form.phases[1].picture_url])
      .toEqual(['L', 'D', '2026-01-05', '2026-03-29', 'https://x/c.jpg', 'https://x/a.jpg', null]);
    expect(datesProblem('2026-02-01', '2026-01-31')).toBe('The season cannot end before it starts.');
    expect(datesProblem('2026-02-01', '2026-02-01')).toBeNull();
    expect(datesProblem('', '2026-02-01')).toBeNull();
  });
});

describe("each part's moods (2026-10-25)", () => {
  const ARC = {
    title: 'Velvet Ladder', phases: [
      { title: 'Arrival', emotional_arc: 'wonder → doubt', feed_behavior: { feed_tone: 'Loud and new.' }, episode_start: 1, episode_end: 6 },
      { title: 'The Climb', episode_start: 7, episode_end: 16 },
      { title: 'Crown', episode_start: 17, episode_end: 24 },
    ],
  };

  test('read back for Edit; a too-long mood is named', () => {
    const form = formFromArc(ARC);
    expect(form.phases.map((p) => [p.emotional_arc, p.feed_tone])).toEqual([['wonder → doubt', 'Loud and new.'], ['', ''], ['', '']]);
    expect(moodProblem(form.phases)).toBeNull();
    expect(moodProblem([{ emotional_arc: 'x'.repeat(MOOD_MAX.emotional_arc + 1) }])).toBe("Part 1's emotional arc is longer than 300 characters.");
    expect(moodProblem([{}, { feed_tone: 'y'.repeat(MOOD_MAX.feed_tone + 1) }])).toBe("Part 2's feed tone is longer than 500 characters.");
  });

  test('Edit season shows each part\'s moods, the default as the hint, and sends what she writes (empty for the default)', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<SeasonSetupForm mode="edit" seasonNumber={2} initial={formFromArc(ARC)} onSubmit={onSubmit} />);
    expect(screen.getByTestId('sst-part-arc-1').value).toBe('wonder → doubt');
    expect(screen.getByTestId('sst-part-tone-1').value).toBe('Loud and new.');
    expect(screen.getByTestId('sst-part-arc-2').value).toBe('');
    expect(screen.getByTestId('sst-part-arc-2').getAttribute('placeholder')).toBe(MOOD_DEFAULTS[1].emotional_arc);
    expect(screen.getByTestId('sst-part-tone-3').getAttribute('placeholder')).toBe(MOOD_DEFAULTS[2].feed_tone);
    expect(screen.getByTestId('sst-part-arc-1').getAttribute('maxlength')).toBe('300');
    expect(screen.getByTestId('sst-part-tone-1').getAttribute('maxlength')).toBe('500');
    fireEvent.change(screen.getByTestId('sst-part-arc-2'), { target: { value: '  hunger → rivalry ' } });
    fireEvent.change(screen.getByTestId('sst-part-tone-1'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const sent = onSubmit.mock.calls[0][0].phases;
    expect(sent.map((p) => [p.emotional_arc, p.feed_tone])).toEqual([['wonder → doubt', ''], ['hunger → rivalry', ''], ['', '']]);
  });

  test('a mood too long to save blocks Save and says why', () => {
    const arc = { ...ARC, phases: [{ ...ARC.phases[0], emotional_arc: 'x'.repeat(301) }, ARC.phases[1], ARC.phases[2]] };
    render(<SeasonSetupForm mode="edit" seasonNumber={2} initial={formFromArc(arc)} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('sst-missing').textContent).toBe("Part 1's emotional arc is longer than 300 characters.");
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
  });
});

describe('Set up the season form', () => {
  test('sends the title, tagline, parts and split; the line shows each part’s episodes', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(<SeasonSetupForm seasonNumber={2} onSubmit={onSubmit} />);
    expect(screen.getByRole('heading', { name: /Set up Season 2/ })).toBeTruthy();
    fireEvent.change(screen.getByTestId('sst-title'), { target: { value: 'Velvet Season' } });
    fireEvent.change(screen.getByTestId('sst-tagline'), { target: { value: 'Her own room' } });
    fireEvent.change(screen.getByTestId('sst-part-title-2'), { target: { value: 'Rooms' } });
    fireEvent.change(screen.getByTestId('sst-split-1'), { target: { value: '6' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('These add up to 22; the season has 24 episodes.');
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('sst-split-2'), { target: { value: '10' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('24 episodes: E1–E6 · E7–E16 · E17–E24');
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      title: 'Velvet Season', tagline: 'Her own room',
      logline: '', description: '', starts_on: null, ends_on: null, cover_url: null,
      phases: [
        { title: 'Foundation', tagline: 'Prove you belong', picture_url: null, emotional_arc: '', feed_tone: '' },
        { title: 'Rooms', tagline: 'Climb the ladder', picture_url: null, emotional_arc: '', feed_tone: '' },
        { title: 'Legacy', tagline: 'Become uncopyable', picture_url: null, emotional_arc: '', feed_tone: '' },
      ],
      split: [6, 10, 8],
    }));
  });

  test('a part with no episodes, or no name, cannot be sent', () => {
    render(<SeasonSetupForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByTestId('sst-split-3'), { target: { value: '0' } });
    expect(screen.getByTestId('sst-split-note').textContent).toBe('Each part needs at least one episode.');
    fireEvent.change(screen.getByTestId('sst-split-3'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('sst-part-title-3'), { target: { value: ' ' } });
    expect(screen.getByTestId('sst-missing').textContent).toBe('Part 3 needs a name.');
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
  });

  test('Edit: the server’s refusal is shown in the form, in words', async () => {
    const onSubmit = vi.fn().mockRejectedValue({ response: { data: { error: 'This split would move a started episode to another part: E7 ("The Gallery") has started in Part 2 (Rooms).' } } });
    render(<SeasonSetupForm mode="edit" seasonNumber={1} initial={{ ...defaultForm(1), split: [6, 10, 8] }} onSubmit={onSubmit} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Edit Season 1/ })).toBeTruthy();
    fireEvent.change(screen.getByTestId('sst-split-1'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('sst-split-2'), { target: { value: '8' } });
    fireEvent.click(screen.getByTestId('sst-submit'));
    expect((await screen.findByTestId('sst-error')).textContent).toContain('E7 ("The Gallery") has started in Part 2');
  });
});

describe("Edit season: the Season page's fields (2026-10-25)", () => {
  const ASSETS = [
    { id: 'a1', name: 'Rooftop dusk', media_type: 'image', s3_url_processed: 'https://cdn.example.com/rooftop.jpg', metadata: { thumbnail_url: 'https://cdn.example.com/rooftop-t.jpg' } },
    { id: 'a2', name: 'Theme song', media_type: 'audio', s3_url_raw: 'https://cdn.example.com/song.mp3' },
    { id: 'a3', name: 'Atelier', content_type: 'image/png', s3_url_raw: 'https://cdn.example.com/atelier.png' },
  ];
  const ARC_FORM = formFromArc({
    title: 'Soft Luxury Ascension', tagline: 'Lala earns her place', starts_on: '2026-01-05', ends_on: '2026-03-29', cover_url: null,
    phases: [{ title: 'Foundation', episode_start: 1, episode_end: 8 }, { title: 'Ascension', episode_start: 9, episode_end: 16 }, { title: 'Legacy', episode_start: 17, episode_end: 24 }],
  });
  const renderEdit = (onSubmit) => render(
    <MemoryRouter><SeasonSetupForm mode="edit" showId="show-1" seasonNumber={1} initial={ARC_FORM} onSubmit={onSubmit} onCancel={vi.fn()} /></MemoryRouter>,
  );

  test('logline, description, dates, a cover and a part picture chosen from Files are sent', async () => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: ASSETS } });
    const onSubmit = vi.fn().mockResolvedValue({});
    renderEdit(onSubmit);
    expect(screen.getByTestId('sst-starts-on').value).toBe('2026-01-05');
    fireEvent.change(screen.getByTestId('sst-logline'), { target: { value: 'Lala earns her place in the luxury tier.' } });
    fireEvent.change(screen.getByTestId('sst-description'), { target: { value: 'From bold fits to bigger opportunities.' } });
    fireEvent.click(screen.getByTestId('sst-picture-open-Cover'));
    const list = await screen.findByTestId('sst-picture-list-Cover');
    // Images only, from the show's files.
    expect(api.get).toHaveBeenCalledWith('/api/v1/assets?show_id=show-1');
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Use Rooftop dusk for the cover', 'Use Atelier for the cover']);
    fireEvent.click(within(list).getByLabelText('Use Rooftop dusk for the cover'));
    expect(screen.getByAltText('Cover: chosen').getAttribute('src')).toBe('https://cdn.example.com/rooftop.jpg');
    fireEvent.click(screen.getByTestId('sst-picture-open-Part 2 picture'));
    fireEvent.click(within(await screen.findByTestId('sst-picture-list-Part 2 picture')).getByLabelText('Use Atelier for the part 2 picture'));
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      logline: 'Lala earns her place in the luxury tier.', description: 'From bold fits to bigger opportunities.',
      starts_on: '2026-01-05', ends_on: '2026-03-29', cover_url: 'https://cdn.example.com/rooftop.jpg',
      phases: [
        expect.objectContaining({ title: 'Foundation', picture_url: null }),
        expect.objectContaining({ title: 'Ascension', picture_url: 'https://cdn.example.com/atelier.png' }),
        expect.objectContaining({ title: 'Legacy', picture_url: null }),
      ],
    })));
  });

  test('an end before the start cannot be sent; Remove clears a picture', async () => {
    vi.mocked(api.get).mockReset().mockResolvedValue({ data: { data: ASSETS } });
    const onSubmit = vi.fn().mockResolvedValue({});
    renderEdit(onSubmit);
    fireEvent.change(screen.getByTestId('sst-ends-on'), { target: { value: '2026-01-01' } });
    expect(screen.getByTestId('sst-missing').textContent).toBe('The season cannot end before it starts.');
    expect(screen.getByTestId('sst-submit').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('sst-ends-on'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('sst-picture-open-Cover'));
    fireEvent.click(within(await screen.findByTestId('sst-picture-list-Cover')).getByLabelText('Use Atelier for the cover'));
    fireEvent.click(screen.getByLabelText('Remove the cover'));
    fireEvent.click(screen.getByTestId('sst-submit'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cover_url: null, ends_on: null })));
  });

  test('Files that could not be read say so', async () => {
    vi.mocked(api.get).mockReset().mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'Assets are down' } } }));
    renderEdit(vi.fn());
    fireEvent.click(screen.getByTestId('sst-picture-open-Cover'));
    expect((await screen.findByRole('alert')).textContent).toBe('Assets are down');
  });
});

const PREVIEW = {
  season_number: 1,
  open_slots: [1, 2, 3, 4, 5].map((n) => ({ id: `s${n}`, slot_number: n, label: `S1 · E${n}`, phase: 1 })),
  items: [
    { slot_id: 's1', label: 'S1 · E1', kind: 'episode', episode: { id: 'ep1', title: 'First Made' }, event: { id: 'evA', name: 'The Brunch', event_date: '2026-01-01' }, why: 'Episode 1, in episode order' },
    { slot_id: 's2', label: 'S1 · E2', kind: 'event', episode: null, event: { id: 'ev1', name: 'Early Dated', event_date: '2026-11-02' }, why: 'Dated 2026-11-02, in date order' },
    { slot_id: 's3', label: 'S1 · E3', kind: 'event', episode: null, event: { id: 'ev2', name: 'Undated Gala', event_date: null }, why: 'Undated; Fits the planned pressure (High)' },
  ],
  left_over: [{ kind: 'event', event: { id: 'ev9', name: 'Too Many' } }],
};

describe('Use your events and episodes', () => {
  test('lists each slot’s episode or event and why; move, leave out, put back; Save sends the list', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: PREVIEW }), post: vi.fn().mockResolvedValue({ data: { placed: 2, episodes: 1, events: 1 } }) };
    const onSaved = vi.fn();
    render(<SeasonPlacement showId="show-1" api={api} onSaved={onSaved} onClose={vi.fn()} />);
    const first = within(await screen.findByTestId('sst-place-ep:ep1'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/placement');
    expect(first.getByText('First Made')).toBeTruthy();
    expect(first.getByText(/with The Brunch · 2026-01-01/)).toBeTruthy();
    expect(first.getByText('Episode 1, in episode order')).toBeTruthy();
    expect(screen.getByText(/no date/)).toBeTruthy();
    expect(screen.getByTestId('sst-left-over').textContent).toContain('Too Many');
    expect(api.post).not.toHaveBeenCalled();

    // Move "Early Dated" to E5: E1 and E3 are taken, so they are not offered.
    const move = screen.getByTestId('sst-move-ev:ev1');
    expect([...move.options].map((o) => o.textContent)).toEqual(['S1 · E2', 'S1 · E4', 'S1 · E5']);
    fireEvent.change(move, { target: { value: 's5' } });
    // Leave "Undated Gala" out, then put it back: it takes the first free slot.
    fireEvent.click(screen.getByTestId('sst-remove-ev:ev2'));
    expect(screen.queryByTestId('sst-place-ev:ev2')).toBeNull();
    fireEvent.click(within(screen.getByTestId('sst-removed')).getByRole('button', { name: 'Put Undated Gala back' }));
    expect(screen.getByTestId('sst-move-ev:ev2').value).toBe('s2');
    fireEvent.click(screen.getByTestId('sst-remove-ev:ev2'));

    fireEvent.click(screen.getByTestId('sst-place-save'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/placement', { items: [
      { slot_id: 's1', episode_id: 'ep1' },
      { slot_id: 's5', event_id: 'ev1' },
    ] }));
    expect(onSaved).toHaveBeenCalledWith('1 episode placed · 1 event pencilled');
  });

  test('a refused Save says why and keeps the list', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: PREVIEW }), post: vi.fn().mockRejectedValue({ response: { data: { error: '"Undated Gala" has started an episode or is archived' } } }) };
    render(<SeasonPlacement showId="show-1" api={api} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByTestId('sst-place-save'));
    expect(await screen.findByText(/has started an episode or is archived/)).toBeTruthy();
    expect(screen.getByTestId('sst-place-ev:ev2')).toBeTruthy();
  });

  test('nothing to place', async () => {
    const api = { get: vi.fn().mockResolvedValue({ data: { items: [], open_slots: [], left_over: [] } }), post: vi.fn() };
    render(<SeasonPlacement showId="show-1" api={api} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect((await screen.findByTestId('sst-place-empty')).textContent).toContain('Nothing to place');
    expect(screen.queryByTestId('sst-place-save')).toBeNull();
  });
});

const DRAFTS = {
  drafts: [
    { slot_id: 's2', slot_number: 2, phase: 1, story_purpose: 'Lala finds the invitation', desired_pressure: 'High', story_thread_id: 't1', story_thread_title: 'Who sent it?' },
    { slot_id: 's5', slot_number: 5, phase: 1, story_purpose: 'The gala aftermath', desired_pressure: 'Low', story_thread_id: null, story_thread_title: null, current_purpose: 'old' },
    { slot_id: 's6', slot_number: 6, phase: 1, story_purpose: 'A quiet week', desired_pressure: null, story_thread_id: null },
  ],
  skipped: [{ slot_number: 1, reason: 'started' }, { slot_number: 3, reason: 'edited' }],
  dropped_threads: 1,
};
const PHASES = [{ phase: 1, title: 'Doors' }, { phase: 2, title: 'Rooms' }, { phase: 3, title: 'Keys' }];

describe('Draft the season', () => {
  test('one call for the season or a part; the preview; accept one, skip one, accept the rest', async () => {
    const api = {
      post: vi.fn(async (url, body) => {
        if (url.endsWith('/season/draft')) return { data: DRAFTS };
        return { data: { saved: body.drafts.map((d) => Number(d.slot_id.slice(1))), skipped: [] } };
      }),
    };
    const onSaved = vi.fn();
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={onSaved} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-scope-2'));
    expect(screen.getByTestId('sst-draft-go').textContent).toContain('Draft Part 2: Rooms');
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    await screen.findByTestId('sst-drafts');
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft', { phase: 2 });
    const e2 = within(screen.getByTestId('sst-draft-2'));
    expect(e2.getByText('Lala finds the invitation')).toBeTruthy();
    expect(e2.getByText('High pressure')).toBeTruthy();
    expect(e2.getByText('Thread: Who sent it?')).toBeTruthy();
    expect(within(screen.getByTestId('sst-draft-5')).getByText('Replaces an earlier draft')).toBeTruthy();
    expect(screen.getByTestId('sst-not-offered').textContent).toBe('Left alone: E1 (started), E3 (yours). 1 thread the AI named is not one of yours, so it was left off.');

    fireEvent.click(screen.getByRole('button', { name: 'Accept the draft for E2' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft/accept', {
      drafts: [{ slot_id: 's2', story_purpose: 'Lala finds the invitation', desired_pressure: 'High', story_thread_id: 't1' }],
    }));
    await waitFor(() => expect(screen.queryByTestId('sst-draft-2')).toBeNull());
    expect(screen.getByTestId('sst-draft-note').textContent).toBe('Saved E2.');
    fireEvent.click(screen.getByRole('button', { name: 'Skip the draft for E6' }));
    expect(screen.queryByTestId('sst-draft-6')).toBeNull();
    expect(screen.queryByTestId('sst-accept-all')).toBeNull(); // one left
    fireEvent.click(screen.getByRole('button', { name: 'Accept the draft for E5' }));
    await waitFor(() => expect(screen.getByText('Every draft is accepted or skipped.')).toBeTruthy());
    expect(onSaved).toHaveBeenCalledTimes(2);
  });

  test('Accept all sends every draft at once and says what was not saved', async () => {
    const api = {
      post: vi.fn(async (url) => (url.endsWith('/season/draft') ? { data: DRAFTS } : { data: { saved: [2, 6], skipped: [{ slot_number: 5, reason: 'edited' }] } })),
    };
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    expect(api.post).toHaveBeenCalledWith('/api/v1/world/show-1/season/draft', {});
    fireEvent.click(await screen.findByTestId('sst-accept-all'));
    await waitFor(() => expect(api.post.mock.calls[1][1].drafts.map((d) => d.slot_id)).toEqual(['s2', 's5', 's6']));
    expect((await screen.findByTestId('sst-draft-note')).textContent).toBe('Saved E2, E6. Not saved: E5 (you edited it since).');
  });

  test('a refusal (budget, nothing to draft) is shown in the page', async () => {
    const api = { post: vi.fn().mockRejectedValue({ response: { data: { error: 'AI daily budget exceeded. Nothing was drafted.' } } }) };
    render(<SeasonDraft showId="show-1" api={api} phases={PHASES} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('sst-draft-go'));
    expect((await screen.findByTestId('sst-draft-note')).textContent).toBe('AI daily budget exceeded. Nothing was drafted.');
  });
});

const slot = (n, extra = {}) => ({ id: `s${n}`, slot_number: n, locked: false, event: null, intention: {}, ...extra });
const roadmapWith = (slots, extra = {}) => ({ phases: [{ phase: 1, slots }], unslotted_episodes: [], available_events: [], ...extra });

describe('The setup checklist', () => {
  test('the steps from the season, its goals and threads', () => {
    const steps = setupSteps({
      roadmap: roadmapWith([slot(1, { locked: true }), slot(2, { intention: { story_purpose: 'x' } }), slot(3)], {
        unslotted_episodes: [{ id: 'e' }, { id: 'f' }], available_events: [{ id: 'v' }],
      }),
      goals: [{ status: 'completed' }],
      threads: [],
    });
    expect(steps.map((s) => [s.key, s.done, s.detail])).toEqual([
      ['setup', true, '3 slots in 3 parts'],
      ['place', false, '2 episodes not in a slot · 1 event not pencilled'],
      ['goals', false, 'No goal is active for this season'],
      ['threads', false, 'No story threads yet'],
      ['draft', false, '1 open slot with no purpose yet'],
    ]);
    // Events with no free slot left do not hold the step open.
    const full = setupSteps({ roadmap: roadmapWith([slot(1, { event: { id: 'v1' }, intention: { story_purpose: 'x' } })], { available_events: [{ id: 'v2' }] }), goals: [], threads: [] });
    expect(full.find((s) => s.key === 'place').done).toBe(true);
  });

  test('each step has its action; partly done shows the count', () => {
    const steps = setupSteps({ roadmap: roadmapWith([slot(1)]), goals: [{ status: 'active' }], threads: [] });
    const actions = { place: { label: 'Place them', onClick: vi.fn() }, threads: { label: 'Add a thread', onClick: vi.fn() } };
    render(<SeasonChecklist steps={steps} actions={actions} />);
    expect(screen.getByTestId('sst-check-count').textContent).toBe('3 of 5 done');
    expect(screen.getByTestId('sst-step-goals').className).toContain('is-done');
    fireEvent.click(screen.getByTestId('sst-step-action-threads'));
    expect(actions.threads.onClick).toHaveBeenCalled();
  });

  test('folds away once every step is done', () => {
    const steps = setupSteps({
      roadmap: roadmapWith([slot(1, { intention: { story_purpose: 'x' } })]),
      goals: [{ status: 'paused' }], threads: [{ id: 't' }],
    });
    const { container } = render(<SeasonChecklist steps={steps} />);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(container.innerHTML).toBe('');
  });
});
