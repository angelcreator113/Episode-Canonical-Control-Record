/**
 * The production checks three ways (done, incomplete, couldn't be checked),
 * worked out from what the real loader says it read (loadProductionChecks'
 * `read`). The loader is the real one over a mocked client; nothing in it is
 * changed. An unticked box alone never makes a check "unreadable".
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import { loadProductionChecks, CHECKLIST_SECTIONS } from '../components/Episodes/EpisodeProductionChecklist';
import { CHECK_READS, checklistReadability, checklistProgress } from './episodeShell';

const EP = 'ep-1';
const SHOW = 'show-1';
const EPISODE = { id: EP, show_id: SHOW, title: 'Episode 3', description: '' };
// The event as the episode's events read gives it (no set of its own), and one with a venue set.
const EVENT = { id: 'ev-1', name: 'Gala', link: { anchor: true } };
const EVENT_WITH_SET = { ...EVENT, scene_set_id: 'set-1' };

// Each read of the loader: a name, how to recognise its address, and an answer.
const READS = {
  brief: [(u) => u === `/api/v1/episode-brief/${EP}`, { data: { id: 'b1' } }],
  events: [(u) => u === `/api/v1/episodes/${EP}/events`, { events: [EVENT] }],
  venue: [(u) => u === '/api/v1/scene-sets/set-1', { data: { id: 'set-1', base_still_url: null } }],
  sceneSets: [(u) => u === `/api/v1/episodes/${EP}/scene-sets`, { data: [] }],
  plan: [(u) => u === `/api/v1/episode-brief/${EP}/plan`, { data: [], coverage: null, readiness: null }],
  slotCoverage: [(u) => u.startsWith('/api/v1/wardrobe/slot-coverage'), { data: { inventory: 0, covered: false, text: 'none' } }],
  outfit: [(u) => u === `/api/v1/wardrobe/outfit/${EP}`, { items: [] }],
  lalaState: [(u) => u.startsWith('/api/v1/characters/lala/state'), { state: null }],
  overlays: [(u) => u === `/api/v1/ui-overlays/${SHOW}`, { generated_count: 0 }],
  socialTasks: [(u) => u === `/api/v1/episodes/${EP}/todo/social`, { social_tasks: [] }],
  socialAssets: [(u) => u.startsWith('/api/v1/assets?asset_type=SOCIAL_CHECKLIST'), { data: [] }],
  episode: [(u) => u === `/api/v1/episodes/${EP}`, { data: EPISODE }],
  placements: [(u) => u === `/api/v1/episodes/${EP}/timeline/placements`, { data: [] }],
  lookbook: [(u) => u === `/api/v1/episodes/${EP}/lookbook`, { data: {} }],
  styleSheet: [(u) => u === `/api/v1/episodes/${EP}/style-sheet`, { data: null }],
  showBrain: [(u) => u.startsWith('/api/v1/franchise-brain/entries'), { entries: [] }],
};

/** Runs the real loader with the named reads failing, and sorts its checks three ways. */
async function sorted({ failing = [], episode = EPISODE, showId = SHOW, options } = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    const hit = Object.entries(READS).find(([, [is]]) => is(url));
    if (!hit) return Promise.reject(new Error(`no answer for ${url}`));
    if (failing.includes(hit[0])) return Promise.reject(new Error('Network Error'));
    return Promise.resolve({ data: hit[1][1] });
  });
  const result = await loadProductionChecks(episode, showId, options);
  const three = checklistReadability(result.checks, CHECKLIST_SECTIONS, result.read, { hasShow: !!showId });
  return { result, three };
}

const ALL_IDS = CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => i.id));

describe('checklistReadability: done, incomplete, couldn\'t be checked', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  test('every checklist item has an entry, and every entry is a checklist item', () => {
    expect(Object.keys(CHECK_READS).sort()).toEqual([...ALL_IDS].sort());
  });

  test('every read answers with nothing: nothing is unreadable; empty is incomplete', async () => {
    const { result, three } = await sorted();
    expect(three.unreadable).toBe(0);
    expect(three.unreadableIds).toEqual([]);
    const progress = checklistProgress(result.checks, CHECKLIST_SECTIONS);
    expect(three.done).toBe(progress.done);
    expect(three.incomplete).toBe(progress.left);
    expect(three.done + three.incomplete + three.unreadable).toBe(three.total);
  });

  // The read that fails, and exactly the checks that become unreadable.
  test.each([
    ['brief', ['arc_position', 'archetype', 'designed_intent', 'narrative_purpose', 'forward_hook']],
    ['events', ['event_linked', 'venue_set', 'venue_image', 'invitation_exists', 'scene_sets']],
    ['sceneSets', ['scene_sets']],
    ['plan', ['scene_sets', 'scene_plan', 'scene_images']],
    ['slotCoverage', ['wardrobe_inventory', 'wardrobe_ready']],
    ['outfit', ['outfit_picked']],
    ['lalaState', ['character_state']],
    ['overlays', ['overlays_generated']],
    ['socialTasks', ['social_checklist']],
    ['socialAssets', ['social_checklist']],
    ['episode', ['title_overlay']],
    ['placements', ['overlays_placed']],
    ['lookbook', ['lookbook_ready', 'style_sheet_approved']],
    ['styleSheet', ['lookbook_ready']],
    ['showBrain', ['show_brain']],
  ])('the %s read fails: %j cannot be checked, and nothing else', async (name, ids) => {
    const { result, three } = await sorted({ failing: [name] });
    expect([...three.unreadableIds].sort()).toEqual([...ids].sort());
    // The loader's own results are what they always were: unticked.
    for (const id of ids) expect(result.checks[id]).toBeFalsy();
    expect(three.done + three.incomplete + three.unreadable).toBe(three.total);
    expect(three.done).toBe(checklistProgress(result.checks, CHECKLIST_SECTIONS).done);
  });

  test('several reads fail at once: each one\'s checks, counted once', async () => {
    const { three } = await sorted({ failing: ['brief', 'plan', 'showBrain'] });
    expect([...three.unreadableIds].sort()).toEqual(['arc_position', 'archetype', 'designed_intent', 'forward_hook', 'narrative_purpose', 'scene_images', 'scene_plan', 'scene_sets', 'show_brain'].sort());
  });

  test('every read fails: only the check that needs no read is left as incomplete', async () => {
    const { three } = await sorted({ failing: Object.keys(READS) });
    const readable = ALL_IDS.filter((id) => !three.unreadableIds.includes(id));
    expect(readable).toEqual(['title_generated']);
  });

  test('a ticked check is done even when one of its reads failed', async () => {
    // Scene sets come from the event's own set although the scene-sets read failed.
    const { result, three } = await sorted({ failing: ['sceneSets'], options: { loaded: { linkedEvent: EVENT_WITH_SET } } });
    expect(result.checks.scene_sets).toBe(true);
    expect(three.unreadableIds).not.toContain('scene_sets');
  });

  test('the venue set\'s read fails: "Venue image generated" stays incomplete, not unreadable (the known limit)', async () => {
    const { result, three } = await sorted({ failing: ['venue'], options: { loaded: { linkedEvent: EVENT_WITH_SET } } });
    expect(api.get).toHaveBeenCalledWith('/api/v1/scene-sets/set-1');
    expect(result.checks.venue_image).toBe(false);
    expect(result.read.venueSetHasImage).toBe(false);
    expect(three.unreadableIds).toEqual([]);
  });

  test('an episode with no show: the show\'s reads that were not made, or could not answer, are not failures', async () => {
    const { result, three } = await sorted({ showId: null, episode: { ...EPISODE, show_id: null }, failing: ['slotCoverage', 'lalaState'] });
    expect('linkedEvent' in result.read).toBe(false);
    expect('overlays' in result.read).toBe(false);
    expect(three.unreadableIds).toEqual([]);
    // A read that is not about the show still counts when it fails.
    const again = await sorted({ showId: null, episode: { ...EPISODE, show_id: null }, failing: ['slotCoverage', 'lalaState', 'plan'] });
    expect([...again.three.unreadableIds].sort()).toEqual(['scene_images', 'scene_plan', 'scene_sets']);
  });

  test('what the page handed over counts as read', async () => {
    const { three } = await sorted({ failing: ['brief', 'sceneSets', 'events'], options: { loaded: { brief: { id: 'b1' }, sceneSets: [], linkedEvent: null } } });
    expect(three.unreadableIds).toEqual([]);
  });

  test('with no `read`, nothing is said: null, never a count taken from unticked boxes', () => {
    const checks = { arc_position: true };
    expect(checklistReadability(checks, CHECKLIST_SECTIONS, null)).toBeNull();
    expect(checklistReadability(checks, CHECKLIST_SECTIONS, undefined)).toBeNull();
    expect(checklistReadability(null, CHECKLIST_SECTIONS, {})).toBeNull();
  });

  test('an item this file does not know is incomplete, not unreadable', () => {
    const sections = [{ items: [{ id: 'brand_new_check' }] }];
    expect(checklistReadability({}, sections, { supplied: [] })).toMatchObject({ done: 0, incomplete: 1, unreadable: 0 });
  });
});
