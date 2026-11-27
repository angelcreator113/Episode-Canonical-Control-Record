/**
 * Phase 2: the checklist as a command center (Evoni, 2026-11-27).
 *
 * What must hold: the four stages group the nine sections and offer a way in
 * to all seven production steps; requirements and preparation are counted
 * apart and the requirements are advisory; a check whose source could not be
 * read is said to be unreadable and offers no Fix; the beat problems
 * planReadiness reported appear once in the summary and once in Scene Plan,
 * blocking apart from advisory; an accepted episode is told so; optional rows
 * fold by Evoni's four rules, a hand-made choice survives a re-check, and the
 * summary's link reveals the folded detail.
 *
 * The real component, the real helpers; only the HTTP client and the two
 * event reads are replaced.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeAnchorEvent: vi.fn(async () => ({ id: 'ev-1', outfit_pieces: [] })) }));

import api from '../../services/api';
import EpisodeProductionChecklist from './EpisodeProductionChecklist';
import { STAGES } from '../../lib/checklistHub';

const BRIEF = { arc_number: 1, position_in_arc: 1, episode_archetype: 'Trial', designed_intent: 'pass', narrative_purpose: 'x', forward_hook: 'y' };

/** planReadiness' own shape: one entry per beat, each with its typed fix. */
const READINESS = {
  ready: 11, total: 14,
  not_ready: [
    { beat_number: 4, beat_name: 'The Arrival', text: 'No location', fix: { kind: 'locations' } },
    { beat_number: 6, beat_name: 'The Turn', text: 'Grand Hall was removed', fix: { kind: 'removed_set', scene_set_id: 'set-9' } },
    { beat_number: 11, beat_name: 'The Look', text: 'Grand Hall has no base image', fix: { kind: 'scene_set', scene_set_id: 'set-3' } },
  ],
};

const answers = ({ readiness = READINESS, brief = BRIEF, failBrain = false, failWardrobe = false } = {}) => async (url) => {
  if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
  if (url === '/api/v1/episode-brief/ep-1/plan') {
    return { data: { data: [{ beat_number: 1, scene_set_id: 's1' }], coverage: { complete: true, text: 'all 14' }, readiness } };
  }
  if (url === '/api/v1/episode-brief/ep-1/production-coverage') return { data: { success: true, data: { covered: 0, total: 0, beats: [] } } };
  if (failBrain && url.startsWith('/api/v1/franchise-brain')) throw Object.assign(new Error('nope'), { response: { status: 500 } });
  // The wardrobe slot coverage is the read "Required wardrobe slots covered"
  // is worked out from, and that item DOES have a Fix page — so failing this
  // read is what proves a Fix is withheld rather than merely absent.
  if (failWardrobe && url.startsWith('/api/v1/wardrobe/slot-coverage')) throw Object.assign(new Error('nope'), { response: { status: 500 } });
  return { data: {} };
};

const show = (props = {}) => {
  const onOpenTab = vi.fn();
  const utils = render(
    <MemoryRouter>
      <EpisodeProductionChecklist
        episode={{ id: 'ep-1', show_id: 'show-1', title: 'Gala', ...(props.episode || {}) }}
        showId="show-1" onOpenTab={onOpenTab}
        refreshing={props.refreshing || false} stale={props.stale || false}
      />
    </MemoryRouter>,
  );
  return { onOpenTab, ...utils };
};

const settled = () => waitFor(() => expect(screen.getByTestId('checklist-summary')).toBeTruthy());
// An ANSWER, not merely the block: before anything has been read the
// requirements say "— of 8", which /of 8/ also matched — so every case
// using this helper could run against a checklist that had not finished
// reading, and read fold states that were not set yet. It must see a
// number. (CI caught this on 77d2ff584; locally it passed on timing.)
const ready = () => waitFor(() => expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/\d+ of 8/));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(api.get).mockReset();
  vi.mocked(api.get).mockImplementation(answers());
});

/**
 * The fold defaults are worked out in an effect, so they land one tick
 * AFTER the answers do: until then every card is folded. ready() only says
 * the answers arrived, so a case that asserts fold state straight after it
 * can read the pre-defaults DOM — which is how CI failed on 77d2ff584,
 * d12597a09 and 7f2ead8ad (aria-expanded 'false' on every card) while every
 * local run passed on being quicker.
 *
 * Wardrobe is the signal: it is the one section here whose settled state
 * DIFFERS from the pre-defaults state, because its required slot coverage
 * is not done, so it must end up open. Nothing is weakened by waiting for
 * it — the assertions that follow are unchanged.
 */
const foldsSettled = async () => {
  await ready();
  await waitFor(() => expect(screen.getByTestId('ckh-fold-wardrobe').getAttribute('aria-expanded')).toBe('true'));
};

describe('the four stages', () => {
  test('group all nine sections, each exactly once, and name all seven steps', async () => {
    show();
    await settled();
    const sections = STAGES.flatMap((s) => s.sections);
    expect(sections).toHaveLength(9);
    expect(new Set(sections).size).toBe(9);
    const steps = STAGES.flatMap((s) => s.steps);
    expect(steps).toHaveLength(7);
    expect(new Set(steps).size).toBe(7);
    for (const stage of STAGES) expect(screen.getByTestId(`ckh-stage-${stage.key}`)).toBeTruthy();
    for (const id of sections) expect(screen.getByTestId(`checklist-section-${id}`)).toBeTruthy();
  });

  test('Intelligence sits in Plan, and every step has a way in — including the four with no section', async () => {
    const plan = STAGES.find((s) => s.key === 'plan');
    expect(plan.sections).toContain('intelligence');
    show();
    await settled();
    // Files, Edit, Thumbnail and Review have no checklist section; each is
    // still reachable from its stage.
    for (const key of ['files', 'edit', 'thumbnail', 'publish']) {
      expect(screen.getByTestId(`ckh-stage-step-${key}`)).toBeTruthy();
    }
    expect(within(screen.getByTestId('ckh-stage-produce')).getByTestId('ckh-stage-step-files')).toBeTruthy();
  });

  test('a step mark navigates by its own existing destination and claims no status', async () => {
    const { onOpenTab } = show();
    await settled();
    const files = screen.getByTestId('ckh-stage-step-files');
    // No tick and no current-step claim here: the production strip owns that.
    expect(files.className).not.toMatch(/is-done|is-current/);
    expect(files.getAttribute('aria-current')).toBeNull();
    fireEvent.click(within(files).getByRole('button'));
    expect(onOpenTab).toHaveBeenCalledWith('files');
  });
});

describe('the summary', () => {
  test('counts requirements and preparation apart, and says requirements do not stop production', async () => {
    show();
    await ready();
    expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/of 8/);
    expect(screen.getByTestId('ckh-kind-preparation').textContent).toMatch(/of 16/);
    expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/do not stop you continuing production/);
    // 8 + 16 = the 24 items, and the headline count agrees with them.
    const headline = screen.getByTestId('checklist-count').textContent;
    expect(headline).toMatch(/of 24/);
  });

  test('a check whose source could not be read is unreadable, not missing, and its Fix is withheld', async () => {
    vi.mocked(api.get).mockImplementation(answers({ failWardrobe: true }));
    show();
    await ready();
    await waitFor(() => expect(screen.getByTestId('ckh-kind-unreadable')).toBeTruthy());
    // "Required wardrobe slots covered" has a Fix page (the show's wardrobe),
    // so a button WOULD be offered if this were simply unticked.
    const row = screen.getByTestId('ckh-item-wardrobe_ready');
    expect(within(row).getByTestId('check-unreadable-wardrobe_ready').textContent).toMatch(/couldn't be checked/);
    expect(within(row).queryByRole('button')).toBeNull();
    // and a readable, unticked item in the same card still offers its Fix
    expect(within(screen.getByTestId('ckh-item-outfit_picked')).getByRole('button')).toBeTruthy();
    // it is counted as unreadable, never as a missing requirement
    expect(screen.getByTestId('ckh-kind-unreadable').textContent).toMatch(/Not missing work/);
  });

  test('refreshing and stale are shown, and neither reads as a fresh answer', async () => {
    const { unmount } = show({ refreshing: true });
    await settled();
    expect(screen.getByTestId('checklist-summary').getAttribute('data-currency')).toBe('updating');
    unmount();
    show({ stale: true });
    await settled();
    expect(screen.getByTestId('checklist-summary').getAttribute('data-currency')).toBe('stale');
  });

  test('the suggested next action comes from the Overview authority, and the step is not named here', async () => {
    show();
    await ready();
    const pair = screen.getByTestId('ckh-next-pair');
    expect(within(pair).getByTestId('ckh-recommended')).toBeTruthy();
    // productionSteps' current step needs the clips and thumbnail this tab
    // does not read, so no current step is claimed here at all.
    expect(within(pair).queryByTestId('ckh-current-step')).toBeNull();
  });
});

describe('the beats that need attention', () => {
  test('blocking and advisory are separated, counted apart, and read from one list', async () => {
    show();
    await ready();
    const blocking = screen.getByTestId('ckh-problems-blocking');
    expect(blocking.textContent).toMatch(/2 beats need a usable location/);
    expect(blocking.textContent).toMatch(/beats 4, 6/);
    // The wording never claims filming is blocked.
    expect(blocking.textContent).not.toMatch(/can't be filmed|cannot be filmed/i);
    const advisory = screen.getByTestId('ckh-problems-advisory');
    expect(advisory.textContent).toMatch(/1 beat is waiting on a picture/);
    expect(advisory.textContent).toMatch(/beat 11/);
    // The same three, once each, inside Scene Plan.
    const rows = within(screen.getByTestId('ckh-scene-beats')).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(screen.getByTestId('ckh-beat-4').textContent).toMatch(/No location/);
    expect(screen.getByTestId('ckh-beat-6').textContent).toMatch(/was removed/);
    expect(screen.getByTestId('ckh-beat-11').textContent).toMatch(/no base image/);
    expect(screen.getByTestId('ckh-beat-11').className).toMatch(/is-advisory/);
    expect(screen.getByTestId('ckh-beat-4').className).toMatch(/is-blocking/);
  });

  test('each typed fix goes where that kind of work is done', async () => {
    const { onOpenTab } = show();
    await ready();
    fireEvent.click(within(screen.getByTestId('ckh-beat-4')).getByRole('button', { name: 'Beat Plan' }));
    expect(onOpenTab).toHaveBeenCalledWith('beatplan');
    fireEvent.click(within(screen.getByTestId('ckh-beat-6')).getByRole('button', { name: 'Move my beats' }));
    expect(onOpenTab).toHaveBeenCalledWith('scenes');
    // the image problem opens Scene Sets, carrying the way back
    const link = within(screen.getByTestId('ckh-beat-11')).getByRole('link');
    expect(link.getAttribute('href')).toMatch(/from=/);
  });

  test('nothing is shown when planReadiness reported nothing', async () => {
    vi.mocked(api.get).mockImplementation(answers({ readiness: { ready: 14, total: 14, not_ready: [] } }));
    show();
    await ready();
    expect(screen.queryByTestId('ckh-beat-problems')).toBeNull();
    expect(screen.queryByTestId('ckh-scene-beats')).toBeNull();
  });
});

describe('an accepted episode', () => {
  test('is told so, and keeps every way of looking around', async () => {
    show({ episode: { evaluation_status: 'accepted' } });
    await settled();
    expect(screen.getByTestId('ckh-frozen-notice').textContent).toMatch(/accepted/);
    // Navigation is untouched: the stage steps and the cards' links remain.
    expect(screen.getByTestId('ckh-stage-step-files')).toBeTruthy();
  });

  test('an episode that is not accepted says nothing', async () => {
    show();
    await settled();
    expect(screen.queryByTestId('ckh-frozen-notice')).toBeNull();
  });
});

describe('folding', () => {
  test('a section with requirements outstanding starts open; one with them all done starts folded', async () => {
    show();
    await foldsSettled();
    // Episode Brief: its three required items are done from BRIEF, so its
    // two optional rows fold.
    expect(screen.getByTestId('ckh-fold-brief').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('ckh-optional-brief').hasAttribute('hidden')).toBe(true);
    // Event & Venue: its one requirement is done too — the anchor event is
    // read here — so it folds as well, although two of its three optional
    // rows are still outstanding. Rule 2 does not wait for optional work.
    // (This case previously asserted the opposite on a premise that was not
    // true of the fixture, and passed only because outstanding optional work
    // was wrongly holding every section open.)
    expect(screen.getByTestId('ckh-fold-world').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('ckh-optional-world').hasAttribute('hidden')).toBe(true);
    // Wardrobe: its required slot coverage is NOT done, so it stays in sight.
    expect(screen.getByTestId('ckh-fold-wardrobe').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('ckh-optional-wardrobe').hasAttribute('hidden')).toBe(false);
  });

  test('required rows are never inside the fold', async () => {
    show();
    await foldsSettled();
    const brief = screen.getByTestId('checklist-section-brief');
    const folded = screen.getByTestId('ckh-optional-brief');
    // the three required rows are in the card but not in the folded region
    for (const id of ['arc_position', 'archetype', 'designed_intent']) {
      expect(within(brief).getByTestId(`ckh-item-${id}`)).toBeTruthy();
      expect(folded.querySelector(`[data-testid="ckh-item-${id}"]`)).toBeNull();
    }
    // and the two optional ones are
    for (const id of ['narrative_purpose', 'forward_hook']) {
      expect(folded.querySelector(`[data-testid="ckh-item-${id}"]`)).toBeTruthy();
    }
  });

  test('a hand-made choice survives a re-check', async () => {
    show();
    await foldsSettled();
    fireEvent.click(screen.getByTestId('ckh-fold-brief'));
    expect(screen.getByTestId('ckh-fold-brief').getAttribute('aria-expanded')).toBe('true');
    // Check again: the default is not recomputed over her choice.
    await act(async () => { fireEvent.click(screen.getByLabelText('Check again')); });
    await foldsSettled();
    expect(screen.getByTestId('ckh-fold-brief').getAttribute('aria-expanded')).toBe('true');
  });

  test('the counts stay visible whether a section is folded or open', async () => {
    show();
    await foldsSettled();
    const counts = screen.getByTestId('ckh-card-counts-brief').textContent;
    expect(counts).toMatch(/3 of 3 required/);
    expect(counts).toMatch(/optional/);
    fireEvent.click(screen.getByTestId('ckh-fold-brief'));
    expect(screen.getByTestId('ckh-card-counts-brief').textContent).toBe(counts);
  });

  test('the summary link reveals the Scene Plan detail even when it was folded', async () => {
    show();
    await foldsSettled();
    // Scene Plan's optional row may be folded; the link must open it.
    fireEvent.click(screen.getByTestId('ckh-fold-scene'));
    const beforeState = screen.getByTestId('ckh-fold-scene').getAttribute('aria-expanded');
    fireEvent.click(screen.getByTestId('ckh-problems-blocking-open'));
    const after = screen.getByTestId('ckh-fold-scene').getAttribute('aria-expanded');
    expect(after).toBe('true');
    expect([beforeState, after]).toContain('true');
    // and the rows themselves are present and not hidden
    expect(screen.getByTestId('ckh-optional-scene').hasAttribute('hidden')).toBe(false);
  });
});
/**
 * Found by running the real app (2026-11-27): arriving at the tab while the
 * page is re-reading showed "0 of 24" and "Requirements 0 of 8" under an
 * "updating" marker — no answer presented as no progress. The totals are
 * fixed, so the dash is the honest stand-in until something has been read.
 */
describe('counts with no answer behind them', () => {
  test('before anything is read the score is a dash, not a zero', async () => {
    let release;
    const held = new Promise((res) => { release = res; });
    const serve = answers();
    vi.mocked(api.get).mockImplementation(async (url) => { await held; return serve(url); });
    show({ refreshing: true });
    await settled();
    const summary = screen.getByTestId('checklist-summary');
    expect(summary.getAttribute('data-currency')).toBe('updating');
    // The count says nothing is known yet, and says so in words.
    expect(screen.getByTestId('checklist-count').textContent).toBe('— of 24');
    expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/— of 8/);
    expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/still checking/i);
    expect(screen.getByTestId('checklist-count').textContent).not.toMatch(/\b0 of\b/);
    // The bar claims no position either.
    const bar = summary.querySelector('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBeNull();
    release();
    // Once the answers land, the real numbers appear.
    await ready();
    expect(screen.getByTestId('ckh-kind-required').textContent).toMatch(/\d+ of 8/);
    expect(screen.getByTestId('checklist-count').textContent).toMatch(/^\d+ of 24$/);
  });
});
