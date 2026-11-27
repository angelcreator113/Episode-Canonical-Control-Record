/**
 * The checklist at a glance and the next action it points to, in their
 * shared home (PR-02 of docs/design/2026-11-studio-home-episode-command-center.md):
 * what each returns for an episode, and that Producer Mode's Overview still
 * exports the same two functions. The values here are the ones the real
 * production checklist gives; nothing is stubbed.
 */
import { vi, describe, test, expect } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import { checklistSummary, primaryAction } from './episodeNextAction';
import * as fromShowOverview from '../components/Show/ShowOverview';
import { CHECKLIST_SECTIONS } from '../components/Episodes/EpisodeProductionChecklist';

const LIVE = CHECKLIST_SECTIONS.filter((sec) => !sec.unavailableReason);
const ITEM_IDS = LIVE.flatMap((sec) => sec.items.map((i) => i.id));
const all = (value) => Object.fromEntries(ITEM_IDS.map((id) => [id, value]));
/** Every check done except the named ones. */
const doneExcept = (...ids) => ({ ...all(true), ...Object.fromEntries(ids.map((id) => [id, false])) });
const section = (summary, id) => summary.sections.find((s) => s.id === id);

const EP = { id: 'ep-1', title: 'Wearable Experiments', script_content: 'INT. STUDIO' };
const act = (over = {}) => primaryAction({ episode: EP, showId: 'show-1', summary: checklistSummary(all(false)), producing: true, ...over });

describe('checklistSummary: the production checklist at a glance', () => {
  test('nothing done: 0 of 24, every section "Not started", in the checklist\'s own order', () => {
    const sum = checklistSummary(all(false));
    expect(sum.done).toBe(0);
    expect(sum.total).toBe(24);
    expect(sum.sections.map((s) => s.id)).toEqual(['brief', 'world', 'scene', 'wardrobe', 'lookbook', 'overlays', 'onscreen', 'social', 'intelligence']);
    expect(sum.sections.every((s) => s.state === 'needs_setup' && s.label === 'Not started')).toBe(true);
    expect(sum.sections.map((s) => s.title)).toEqual(LIVE.map((s) => s.label));
  });

  test('an empty answer counts as nothing done, and does not throw', () => {
    expect(checklistSummary({})).toEqual(checklistSummary(all(false)));
  });

  test('everything done: 24 of 24, every section "Complete", nothing left to fix', () => {
    const sum = checklistSummary(all(true));
    expect(sum.done).toBe(24);
    expect(sum.total).toBe(24);
    expect(sum.sections.every((s) => s.state === 'complete' && s.label === 'Complete' && s.first_missing === null)).toBe(true);
  });

  test('first_missing is the first REQUIRED item still open, skipping open optional ones before it', () => {
    // Wardrobe: "pieces uploaded" (optional) comes before "slots covered" (required).
    expect(section(checklistSummary(all(false)), 'wardrobe').first_missing).toBe('wardrobe_ready');
    expect(section(checklistSummary(all(false)), 'brief').first_missing).toBe('arc_position');
    expect(section(checklistSummary({ arc_position: true }), 'brief').first_missing).toBe('archetype');
    expect(section(checklistSummary({ scene_sets: true }), 'scene').first_missing).toBe('scene_plan');
  });

  test('a section with required items counts only those: optional work alone reads "0 of 1"', () => {
    expect(section(checklistSummary({ wardrobe_inventory: true }), 'wardrobe')).toMatchObject({ state: 'in_progress', label: '0 of 1', first_missing: 'wardrobe_ready' });
    expect(section(checklistSummary({ arc_position: true, narrative_purpose: true }), 'brief')).toMatchObject({ state: 'in_progress', label: '1 of 3', first_missing: 'archetype' });
  });

  test('a section is complete once its required items are done, optional ones or not', () => {
    const sum = checklistSummary({ arc_position: true, archetype: true, designed_intent: true });
    expect(section(sum, 'brief')).toMatchObject({ state: 'complete', label: 'Complete', first_missing: null });
    // The two optional brief items are still open, so they are not counted as done.
    expect(sum.done).toBe(3);
  });

  test('a section with nothing required counts all its items, and names its first open one', () => {
    expect(section(checklistSummary({ lookbook_ready: true }), 'lookbook')).toMatchObject({ state: 'in_progress', label: '1 of 2', first_missing: 'style_sheet_approved' });
    expect(section(checklistSummary({ lookbook_ready: true, style_sheet_approved: true }), 'lookbook')).toMatchObject({ state: 'complete', label: 'Complete', first_missing: null });
    expect(section(checklistSummary(all(false)), 'social').first_missing).toBe('social_checklist');
  });

  test('done counts every item, required or not, and ignores keys that are not checklist items', () => {
    expect(checklistSummary({ arc_position: true, venue_image: true, show_brain: true, not_an_item: true }).done).toBe(3);
  });
});

describe('primaryAction: the next action for an episode', () => {
  test('no script: Generate Script on the Script tab, whatever the checklist says', () => {
    for (const script of ['', '   ', null, undefined, 42]) {
      expect(act({ episode: { ...EP, script_content: script }, summary: checklistSummary(all(true)) })).toEqual({
        key: 'script', label: 'Generate Script', href: '/episodes/ep-1?tab=scripts', why: 'This episode has no script yet.',
      });
    }
  });

  test('a script and open checks: Continue with the first open section, at the page that fixes its first required item', () => {
    // Nothing done: the Brief is first; its first required item is set up on the scene plan page.
    expect(act()).toEqual({
      key: 'production', section: 'brief', label: `Continue: ${LIVE[0].label}`, href: '/episodes/ep-1/plan', why: '24 production checks left.',
    });
    // Only the wardrobe's required slot is open: Producer Mode's wardrobe, for this show.
    expect(act({ summary: checklistSummary(doneExcept('wardrobe_ready')) })).toEqual({
      key: 'production', section: 'wardrobe', label: `Continue: ${LIVE.find((s) => s.id === 'wardrobe').label}`,
      href: '/shows/show-1/world?tab=wardrobe-items', why: '1 production check left.',
    });
    // An event still to link: the Season page's Events tab.
    expect(act({ summary: checklistSummary(doneExcept('event_linked')) })).toMatchObject({ section: 'world', href: '/shows/show-1/season?tab=events' });
    // The Style Page, inside the episode.
    expect(act({ summary: checklistSummary(doneExcept('lookbook_ready', 'style_sheet_approved')) })).toMatchObject({ section: 'lookbook', href: '/episodes/ep-1?tab=lookbook' });
  });

  test('a section is skipped once its required items are done, even with optional ones open', () => {
    // The Brief's two optional items are open, but the Brief is complete: the next section is named.
    const a = act({ summary: checklistSummary({ arc_position: true, archetype: true, designed_intent: true }) });
    expect(a.section).toBe('world');
  });

  test('an open item with no page of its own, or a show page with no show: the episode\'s Checklist', () => {
    // "Title overlay made" gained a destination in Phase 2 (Evoni,
    // 2026-11-27): Production → Overlays, where it is actually made. So the
    // card's action is that page, not the fallback.
    expect(act({ summary: checklistSummary(doneExcept('title_overlay', 'overlays_placed')) })).toMatchObject({ section: 'onscreen', href: '/episodes/ep-1?tab=overlays' });
    // Note: after Phase 2 no REQUIRED item is without a destination, and a
    // section whose required items are all done reads complete and names no
    // section at all — so the "no page of its own" fallback is now reached
    // only through the show-less path asserted next.
    // The wardrobe page belongs to a show; without one the action stays in the episode.
    expect(act({ showId: null, summary: checklistSummary(doneExcept('wardrobe_ready')) })).toMatchObject({ section: 'wardrobe', href: '/episodes/ep-1?tab=checklist' });
  });

  test('every required item done but optional ones open: still production, at the first section that is not complete', () => {
    const requiredOnly = Object.fromEntries(LIVE.flatMap((sec) => sec.items.filter((i) => i.required).map((i) => [i.id, true])));
    const a = act({ summary: checklistSummary(requiredOnly) });
    expect(a.key).toBe('production');
    // Lookbook has nothing required and nothing done.
    expect(a.section).toBe('lookbook');
    expect(a.why).toMatch(/production checks left\.$/);
  });

  // An episode sent without its script (not an admin; 2026-11-22).
  test('without the script text, has_script decides whether there is a script', () => {
    const { script_content: _text, ...bare } = EP;
    expect(act({ episode: { ...bare, has_script: false } })).toMatchObject({ why: 'This episode has no script yet.' });
    expect(act({ episode: bare })).toMatchObject({ why: 'This episode has no script yet.' });
    expect(act({ episode: { ...bare, has_script: true }, summary: checklistSummary(all(true)) })).toEqual(act({ summary: checklistSummary(all(true)) }));
    expect(act({ episode: { ...bare, has_script: true } }).why).not.toBe('This episode has no script yet.');
  });

  test('every check done: Open Results', () => {
    expect(act({ summary: checklistSummary(all(true)) })).toEqual({
      key: 'results', label: 'Open Results', href: '/episodes/ep-1?tab=results', why: 'Every production check is done.',
    });
  });

  test('checks not known yet, or an episode that is not the one in production: the plain Open Episode', () => {
    const open = { key: 'open', label: 'Open Episode', href: '/episodes/ep-1?tab=overview', why: null };
    expect(act({ summary: null })).toEqual(open);
    expect(primaryAction({ episode: EP, showId: 'show-1' })).toEqual(open);
    expect(act({ producing: false })).toEqual(open);
    // Not in production wins over a missing script.
    expect(act({ producing: false, episode: { ...EP, script_content: '' } })).toEqual(open);
  });

  test('it only reads its arguments: the same input gives the same answer, and the summary is not changed', () => {
    const summary = checklistSummary(doneExcept('wardrobe_ready'));
    const before = JSON.stringify(summary);
    expect(act({ summary })).toEqual(act({ summary }));
    expect(JSON.stringify(summary)).toBe(before);
  });
});

describe('one definition each', () => {
  test('Producer Mode\'s Overview exports these same two functions', () => {
    expect(fromShowOverview.checklistSummary).toBe(checklistSummary);
    expect(fromShowOverview.primaryAction).toBe(primaryAction);
  });
});
