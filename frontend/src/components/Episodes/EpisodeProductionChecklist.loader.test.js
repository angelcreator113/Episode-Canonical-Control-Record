/**
 * The production checklist's loader reads together and gives what it always
 * gave (PR-07 of docs/design/2026-11-studio-home-episode-command-center.md).
 *
 * The proof is a comparison. `sequentialLoader` below is a FROZEN COPY of
 * loadProductionChecks as it was on main at a597e9a6, one read after another.
 * It exists in this test file only; the app has one loader. For every
 * fixture and every failure, the loader must give the same checks, notes,
 * coverage, scene step and linked event, ask for the same addresses the same
 * number of times, and write the same console lines in the same order.
 *
 * Then: that the reads really are made together, that the answers' order of
 * arrival changes nothing, what `loaded` does for an absent, undefined, null,
 * empty and filled value, and what `read` holds.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { nextStep } from '../../utils/sceneSteps';
import { styleReadiness } from '../../lib/styleReadiness';
import { loadProductionChecks, venueImageGenerated } from './EpisodeProductionChecklist';

// ── The frozen copy (main a597e9a6). Do not edit: it is the baseline. ──────
/* eslint-disable */
async function sequentialLoader(episode, showId) {
  let planCoverage = null;
  let sceneStep = null;
  let linkedEvent = null;
  const results = {};
  const checkNotes = {};

  try {
    // ── Check Episode Brief ──
    try {
      const { data } = await api.get(`/api/v1/episode-brief/${episode.id}`);
      const brief = data.data;
      results.arc_position      = !!(brief?.arc_number && brief?.position_in_arc);
      results.archetype         = !!brief?.episode_archetype;
      results.designed_intent   = !!brief?.designed_intent;
      results.narrative_purpose = !!brief?.narrative_purpose;
      results.forward_hook      = !!brief?.forward_hook;
    } catch {
      Object.assign(results, { arc_position: false, archetype: false, designed_intent: false, narrative_purpose: false, forward_hook: false });
    }

    // ── Check Event, Venue, Invitation, Outfit ──
    try {
      if (showId) {
        // The episode's source event (Task #1906): anchor from the
        // brief, never a scan of the show's event list.
        linkedEvent = await getEpisodeAnchorEvent(episode.id);
        results.event_linked = !!linkedEvent;
        results.invitation_exists = !!linkedEvent?.invitation_asset_id;
        const auto = linkedEvent?.canon_consequences?.automation || {};
        results.venue_set = !!(linkedEvent?.venue_name || auto.venue_name || linkedEvent?.scene_set_id);
        results.venue_image = await venueImageGenerated(linkedEvent);
      } else {
        results.event_linked = false;
      }
    } catch {
      results.event_linked = false;
    }

    // ── Check Scene Sets assigned: linked to the episode, or used by the
    // scene plan or the event (checked again below, once the plan is read;
    // Evoni, 2026-10-09: the checklist did not cross out what was done) ──
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}/scene-sets`);
      const sets = data?.data || data?.sceneSets || [];
      results.scene_sets = (Array.isArray(sets) && sets.length > 0) || !!linkedEvent?.scene_set_id;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] episode scene sets read failed:', err.response?.status || err.message);
      results.scene_sets = !!linkedEvent?.scene_set_id;
    }

    // ── Check Scene Plan ──
    try {
      const { data } = await api.get(`/api/v1/episode-brief/${episode.id}/plan`);
      const plan = data?.data || [];
      // Audit GATE-01 (2026-10-03): generated means the server's coverage
      // says every canonical beat is planned once; never a row count.
      const coverage = data?.coverage || null;
      planCoverage = coverage;
      results.scene_plan        = Boolean(coverage?.complete);
      if (plan.length > 0 && !coverage) checkNotes.scene_plan = 'Beat coverage was not reported';
      else if (coverage && !coverage.complete) checkNotes.scene_plan = coverage.text;
      if (plan.some((b) => b.scene_set_id || b.sceneSet)) results.scene_sets = true;
      // L5, Q21: every planned beat has an angle with an image.
      const readiness = data?.readiness;
      results.scene_images = Boolean(readiness && readiness.total > 0 && readiness.ready === readiness.total);
      if (readiness && readiness.total > 0 && readiness.ready < readiness.total) {
        // S9 (a, c): the Scenes tab's summary.
        const n = readiness.not_ready.length;
        const beats = readiness.not_ready.map((b) => b.beat_number).join(', ');
        checkNotes.scene_images = `${readiness.ready} ready · ${n} ${n === 1 ? 'needs' : 'need'} attention: beat${n === 1 ? '' : 's'} ${beats}`;
      }
      sceneStep = nextStep(plan, readiness, coverage);
      // Locking the beats is not a checklist step (2026-10-09).
      if (sceneStep?.kind === 'lock') sceneStep = { kind: 'script', text: 'Write the script' };
    } catch (err) {
      console.error('[EpisodeProductionChecklist] plan read failed:', err.response?.status || err.message);
      results.scene_plan = results.scene_images = false;
      sceneStep = null;
    }

    // ── Check Wardrobe (audit GATE-02, 2026-10-03): the show's required
    // slots, each with a piece, not "any piece exists" ──
    try {
      const { data } = await api.get(`/api/v1/wardrobe/slot-coverage?show_id=${showId}`);
      const slotCoverage = data?.data || null;
      results.wardrobe_inventory = (slotCoverage?.inventory || 0) > 0;
      results.wardrobe_ready = Boolean(slotCoverage?.covered);
      if (slotCoverage && !slotCoverage.covered) checkNotes.wardrobe_ready = slotCoverage.text;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] wardrobe slot coverage failed:', err.response?.status || err.message);
      results.wardrobe_inventory = false;
      results.wardrobe_ready = false;
      checkNotes.wardrobe_ready = 'Wardrobe could not be read';
    }

    // ── Outfit picked: the outfit locked on the Wardrobe tab, the one the
    // script writer reads (it read the event's planned pieces only) ──
    try {
      const { data } = await api.get(`/api/v1/wardrobe/outfit/${episode.id}`);
      results.outfit_picked = (data?.items?.length || 0) > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] locked outfit read failed:', err.response?.status || err.message);
      results.outfit_picked = false;
    }

    // ── Check Character state ──
    try {
      const { data } = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
      results.character_state = !!(data?.state || data?.data);
    } catch {
      results.character_state = false;
    }

    // ── Check UI Overlays ──
    try {
      if (showId) {
        const { data } = await api.get(`/api/v1/ui-overlays/${showId}`);
        results.overlays_generated = (data?.generated_count || 0) >= 5;
      }
    } catch {
      results.overlays_generated = false;
    }

    // ── Check Social Checklist ──
    try {
      results.social_checklist = false;
      // The episode's social tasks (episode_todo_lists, the To-Do tab and the
      // script read them), or a social checklist image.
      const [tasks, assets] = await Promise.all([
        api.get(`/api/v1/episodes/${episode.id}/todo/social`).then((r) => r.data?.social_tasks || []).catch((err) => {
          console.error('[EpisodeProductionChecklist] social tasks read failed:', err.response?.status || err.message);
          return [];
        }),
        api.get(`/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${episode.id}&limit=1`).then((r) => r.data?.data || []).catch((err) => {
          console.error('[EpisodeProductionChecklist] social checklist asset read failed:', err.response?.status || err.message);
          return [];
        }),
      ]);
      results.social_checklist = tasks.length > 0 || assets.length > 0;
    } catch (err) {
      console.error('[EpisodeProductionChecklist] social checklist check failed:', err.message);
      results.social_checklist = false;
    }

    // ── Check the Overlays card: the title overlay, and overlays placed on the video ──
    // The title overlay or the framed title card, read from the episode as
    // it is now (the page's copy can predate the Overlays tab's save;
    // Evoni, 2026-10-09: "title has already been created").
    let titleRow = episode;
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}`);
      titleRow = data?.data || data?.episode || data || episode;
    } catch (err) {
      console.error('[Checklist] episode re-read failed:', err.response?.status || err.message);
    }
    results.title_overlay = !!(titleRow.title_overlay_asset_id || titleRow.title_card_asset_id || episode.title_overlay_asset_id || episode.title_card_asset_id);
    try {
      const { data } = await api.get(`/api/v1/episodes/${episode.id}/timeline/placements`);
      results.overlays_placed = (data?.data?.length || 0) > 0;
    } catch (err) {
      console.error('[Checklist] overlay placements read failed:', err.response?.status || err.message);
      results.overlays_placed = false;
    }

    // ── Check the Style Page card: ready x of 12 (the server's rule, read
    //    through lib/styleReadiness), and the style sheet's status ──
    try {
      const [lbRes, sheetRes] = await Promise.all([
        api.get(`/api/v1/episodes/${episode.id}/lookbook`),
        api.get(`/api/v1/episodes/${episode.id}/style-sheet`).catch((err) => {
          console.error('[Checklist] style sheet read failed:', err.response?.status || err.message);
          return null;
        }),
      ]);
      const lookbook = lbRes?.data?.data || {};
      const sheet = sheetRes?.data?.data || null;
      const { done, total, missing } = styleReadiness({ sheet });
      results.lookbook_ready = done >= total;
      if (!results.lookbook_ready) checkNotes.lookbook_ready = `Style sheet ready ${done} of ${total}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`;
      results.style_sheet_approved = lookbook.sheet_status === 'approved';
      if (!results.style_sheet_approved) checkNotes.style_sheet_approved = 'Draft';
    } catch (err) {
      console.error('[Checklist] Lookbook read failed:', err.response?.status || err.message);
      results.lookbook_ready = false;
      results.style_sheet_approved = false;
      checkNotes.lookbook_ready = 'The Style Page could not be read';
    }

    // ── Check Episode Title (AI-generated vs default) ──
    results.title_generated = !!(episode.title && !episode.title.startsWith('Episode ') && episode.title !== episode.description?.split(' — ')?.[0]);

    // ── Check Show Brain ──
    try {
      const { data } = await api.get('/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1');
      // The route answers { entries, count }; it read data.data, never there.
      const entries = data?.entries || data?.data || [];
      results.show_brain = Array.isArray(entries) ? entries.length > 0 : false;
    } catch {
      results.show_brain = false;
    }
  } catch (err) {
    console.error('[Checklist] Error:', err);
  }
  return { checks: results, notes: checkNotes, coverage: planCoverage, sceneStep, linkedEvent };
}

/* eslint-enable */

// ── The harness ───────────────────────────────────────────────────────────
const EP = 'ep-1';
const SHOW = 'show-1';
const SET = 'set-9';
const U = {
  brief: `/api/v1/episode-brief/${EP}`,
  events: `/api/v1/episodes/${EP}/events`,
  venue: `/api/v1/scene-sets/${SET}`,
  sceneSets: `/api/v1/episodes/${EP}/scene-sets`,
  plan: `/api/v1/episode-brief/${EP}/plan`,
  slotCoverage: `/api/v1/wardrobe/slot-coverage?show_id=${SHOW}`,
  outfit: `/api/v1/wardrobe/outfit/${EP}`,
  lalaState: `/api/v1/characters/lala/state?show_id=${SHOW}`,
  overlays: `/api/v1/ui-overlays/${SHOW}`,
  socialTasks: `/api/v1/episodes/${EP}/todo/social`,
  socialAssets: `/api/v1/assets?asset_type=SOCIAL_CHECKLIST&episode_id=${EP}&limit=1`,
  episode: `/api/v1/episodes/${EP}`,
  placements: `/api/v1/episodes/${EP}/timeline/placements`,
  lookbook: `/api/v1/episodes/${EP}/lookbook`,
  styleSheet: `/api/v1/episodes/${EP}/style-sheet`,
  showBrain: '/api/v1/franchise-brain/entries?category=franchise_law&status=active&limit=1',
};
const READS = Object.keys(U);
const EPISODE = { id: EP, show_id: SHOW, title: 'Dressed for the Opportunity', description: 'Lala is invited — and says yes' };
const EVENT = { id: 'ev-1', name: 'The Honey Table', venue_name: 'Maison Miel', scene_set_id: SET, invitation_asset_id: 'asset-1', link: { anchor: true } };
const SHEET_DONE = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((k) => [k, 'x']));

/** Every read answered, every check done. */
const DONE = {
  brief: { data: { arc_number: 1, position_in_arc: 2, episode_archetype: 'Trial', designed_intent: 'slay', narrative_purpose: 'p', forward_hook: 'h' } },
  events: { events: [{ id: 'ev-0', name: 'Other' }, EVENT] },
  venue: { data: { id: SET, base_still_url: 'https://img/set.jpg' } },
  sceneSets: { data: [{ id: SET }] },
  plan: { data: [{ beat_number: 1, scene_set_id: SET }], coverage: { complete: true, text: '14 of 14' }, readiness: { total: 1, ready: 1, not_ready: [] } },
  slotCoverage: { data: { inventory: 4, covered: true, text: 'All covered' } },
  outfit: { items: [{ id: 'w1' }] },
  lalaState: { state: { coins: 100 } },
  overlays: { generated_count: 7 },
  socialTasks: { social_tasks: [{ label: 'Post a reel' }] },
  socialAssets: { data: [{ id: 'a1' }] },
  episode: { data: { id: EP, title_overlay_asset_id: 'ov-1' } },
  placements: { data: [{ id: 'p1' }] },
  lookbook: { data: { sheet_status: 'approved' } },
  styleSheet: { data: SHEET_DONE },
  showBrain: { entries: [{ id: 'law-1' }], count: 1 },
};
/** Every read answered with nothing in it. */
const EMPTY = {
  brief: { data: null }, events: { events: [] }, venue: { data: {} }, sceneSets: { data: [] }, plan: { data: [] },
  slotCoverage: { data: null }, outfit: { items: [] }, lalaState: {}, overlays: {}, socialTasks: { social_tasks: [] },
  socialAssets: { data: [] }, episode: { data: { id: EP } }, placements: { data: [] }, lookbook: { data: {} },
  styleSheet: { data: null }, showBrain: { entries: [], count: 0 },
};
const FIXTURES = {
  'everything done': DONE,
  'nothing done': EMPTY,
  'every body empty ({})': Object.fromEntries(READS.map((k) => [k, {}])),
  'every body missing (undefined)': Object.fromEntries(READS.map((k) => [k, undefined])),
  'mixed: a plan with gaps, wardrobe short, a draft style sheet': {
    ...DONE,
    plan: { data: [{ beat_number: 1 }, { beat_number: 2, sceneSet: { id: 's' } }], coverage: { complete: false, text: '2 of 14 planned' }, readiness: { total: 2, ready: 1, not_ready: [{ beat_number: 2 }] } },
    slotCoverage: { data: { inventory: 0, covered: false, text: 'Shoes and bag are missing' } },
    lookbook: { data: { sheet_status: 'draft' } },
    styleSheet: { data: { a: 'x' } },
  },
  'a plan with rows and no coverage; several beats not ready': {
    ...DONE,
    plan: { data: [{ beat_number: 1 }], readiness: { total: 3, ready: 1, not_ready: [{ beat_number: 2 }, { beat_number: 3 }] } },
  },
  'a plan that is not a list (the block stops part-way)': { ...DONE, plan: { data: { not: 'a list' }, coverage: { complete: false, text: 'odd' } } },
  'no event linked': { ...DONE, events: { events: [] } },
  'an event with no venue set (no venue read)': { ...DONE, events: { events: [{ ...EVENT, scene_set_id: null, venue_name: null }] } },
  'an event named only in its automation': { ...DONE, events: { events: [{ id: 'ev-2', canon_consequences: { automation: { venue_name: 'Club Noir' } }, link: { anchor: true } }] } },
  'the venue set has no image': { ...DONE, venue: { data: { id: SET, base_still_url: null } } },
  'scene sets under the old key; the plan supplies the set': { ...EMPTY, sceneSets: { sceneSets: [] }, plan: { data: [{ beat_number: 1, scene_set_id: 'x' }], coverage: { complete: false, text: '1 of 14' } } },
  'the event supplies the set': { ...EMPTY, events: { events: [EVENT] } },
  'the title card on the re-read episode; Show Brain under data': { ...EMPTY, episode: { episode: { id: EP, title_card_asset_id: 'card-1' } }, showBrain: { data: [{ id: 'law' }] } },
  'Lala\'s state under data; four overlays; tasks only': { ...EMPTY, lalaState: { data: { coins: 1 } }, overlays: { generated_count: 4 }, socialTasks: { social_tasks: [{ label: 'x' }] } },
};

const http = (status) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
const keyOf = (url) => READS.find((k) => U[k] === url) || url;

/** One console line as text: an Error by its message, anything else as it is. */
const line = (args) => args.map((a) => (a instanceof Error ? `Error(${a.message})` : (typeof a === 'string' ? a : JSON.stringify(a)))).join(' ');

/**
 * Runs one loader against one set of answers. `fail` maps a read to the error
 * it rejects with. Gives the result, the addresses asked for (sorted), and
 * the console lines in order.
 */
async function run(loader, { bodies = DONE, fail = {}, sync = {}, episode = EPISODE, showId = SHOW, options, raw = null } = {}) {
  const asked = [];
  const old = loader === sequentialLoader;
  const answer = raw || ((url) => {
    const k = keyOf(url);
    // `sync`: the call itself throws, before there is a request. `fail`: the request is rejected.
    if (k in sync) throw sync[k];
    if (k in fail) {
      const rejected = Promise.reject(fail[k]);
      // The frozen copy can leave one rejected read with nobody listening (the lookbook, when the
      // style sheet's call throws). A listener of the test's own keeps that from failing the run.
      // The loader in the app gets no such help: a read it left unheard would fail this file.
      if (old) rejected.catch(() => {});
      return rejected;
    }
    return Promise.resolve({ data: bodies[k] });
  });
  const client = (url) => { asked.push(keyOf(url)); return answer(url); };
  // The frozen copy is given the client plainly: a mock function hands back a promise of its own
  // making, which the listener above would not reach. The loader in the app gets the mock.
  const mock = api.get;
  if (old) api.get = client;
  else vi.mocked(api.get).mockReset().mockImplementation(client);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let result;
  try {
    result = options === undefined ? await loader(episode, showId) : await loader(episode, showId, options);
    // A line a read writes after the loader has answered (the old loader could leave one behind).
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  } finally {
    api.get = mock;
  }
  const logs = errors.mock.calls.map(line);
  errors.mockRestore();
  return { result, asked: asked.slice().sort(), logs };
}
/** The five things every caller reads, without `read`. */
const five = ({ checks, notes, coverage, sceneStep, linkedEvent }) => ({ checks, notes, coverage, sceneStep, linkedEvent });

/** The loader equals the frozen copy for these answers: result, addresses, console lines. */
async function sameAsBefore(scenario) {
  const before = await run(sequentialLoader, scenario);
  const now = await run(loadProductionChecks, scenario);
  expect(five(now.result)).toEqual(five(before.result));
  expect(Object.keys(now.result.checks)).toEqual(Object.keys(before.result.checks));
  expect(now.asked).toEqual(before.asked);
  expect(now.logs).toEqual(before.logs);
  return { before, now };
}

/** A small seeded generator, so the random failure sets are the same on every run. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('the frozen copy is the old loader', () => {
  test('it reads one at a time, and the loader in the app does not', async () => {
    // Held answers: the old loader has asked for one address, the new one for all it can.
    const held = () => new Promise(() => {});
    vi.mocked(api.get).mockReset().mockImplementation(held);
    sequentialLoader(EPISODE, SHOW);
    await Promise.resolve();
    expect(vi.mocked(api.get).mock.calls.map(([u]) => keyOf(u))).toEqual(['brief']);
    vi.mocked(api.get).mockReset().mockImplementation(held);
    loadProductionChecks(EPISODE, SHOW);
    await Promise.resolve();
    expect(vi.mocked(api.get).mock.calls).toHaveLength(15);
  });
});

describe('the same as before: every fixture', () => {
  for (const [name, bodies] of Object.entries(FIXTURES)) {
    test(name, async () => { await sameAsBefore({ bodies }); });
    test(`${name}, with no show`, async () => {
      for (const showId of [null, undefined, '']) await sameAsBefore({ bodies, showId });
    });
  }

  test('the counts: sixteen reads with an event that has a set, fifteen without, twelve with no show', async () => {
    const full = await sameAsBefore({ bodies: DONE });
    expect(full.now.asked).toEqual(READS.slice().sort());
    expect(full.now.asked).toHaveLength(16);
    const noSet = await sameAsBefore({ bodies: FIXTURES['an event with no venue set (no venue read)'] });
    expect(noSet.now.asked).toEqual(READS.filter((k) => k !== 'venue').sort());
    const noShow = await sameAsBefore({ bodies: DONE, showId: null });
    // No events, venue or overlays read; the wardrobe and Lala reads are still made, for "show_id=null".
    expect(noShow.now.asked).toHaveLength(13);
    expect(noShow.now.asked.filter((k) => READS.includes(k))).toEqual(READS.filter((k) => !['events', 'venue', 'overlays', 'slotCoverage', 'lalaState'].includes(k)).sort());
    expect(noShow.now.asked).toContain('/api/v1/wardrobe/slot-coverage?show_id=null');
    expect(noShow.now.asked).toContain('/api/v1/characters/lala/state?show_id=null');
  });

  test('no address is asked for twice', async () => {
    const { now } = await sameAsBefore({ bodies: DONE });
    expect(new Set(now.asked).size).toBe(now.asked.length);
  });
});

describe('the same as before: every failure', () => {
  for (const k of READS) {
    test(`${k} fails alone (a server error, a network error, a refusal)`, async () => {
      for (const error of [http(500), new Error('Network Error'), http(403), http(404)]) {
        for (const bodies of [DONE, EMPTY]) await sameAsBefore({ bodies, fail: { [k]: error } });
      }
    });
  }

  test('every read fails', async () => {
    const fail = Object.fromEntries(READS.map((k) => [k, http(503)]));
    const { now } = await sameAsBefore({ bodies: DONE, fail });
    // Only the check that needs no read is left: the title is not a default one.
    expect(Object.entries(now.result.checks).filter(([, done]) => done).map(([id]) => id)).toEqual(['title_generated']);
    await sameAsBefore({ bodies: DONE, fail, showId: null });
  });

  test('every pair of reads failing together', async () => {
    for (let i = 0; i < READS.length; i += 1) {
      for (let j = i + 1; j < READS.length; j += 1) {
        await sameAsBefore({ bodies: DONE, fail: { [READS[i]]: http(500), [READS[j]]: new Error('Network Error') } });
      }
    }
  });

  test('four hundred random sets of failures, over three fixtures', async () => {
    const random = seeded(20261118);
    const sets = Object.values(FIXTURES);
    for (let n = 0; n < 400; n += 1) {
      const fail = {};
      for (const k of READS) if (random() < 0.3) fail[k] = random() < 0.5 ? http(500) : new Error('Network Error');
      await sameAsBefore({ bodies: sets[n % 3 === 0 ? 0 : (n % 3 === 1 ? 4 : 1)], fail });
    }
  });

  test('the cross-read rules: the plan and the event still settle "scene sets assigned"', async () => {
    // The plan names a set after the scene-sets read said none.
    let out = await sameAsBefore({ bodies: { ...EMPTY, plan: { data: [{ beat_number: 1, scene_set_id: 'x' }], coverage: null } } });
    expect(out.now.result.checks.scene_sets).toBe(true);
    // The scene-sets read fails; the event's own set counts.
    out = await sameAsBefore({ bodies: { ...EMPTY, events: { events: [EVENT] } }, fail: { sceneSets: http(500) } });
    expect(out.now.result.checks.scene_sets).toBe(true);
    // It fails and there is no event: open.
    out = await sameAsBefore({ bodies: EMPTY, fail: { sceneSets: http(500) } });
    expect(out.now.result.checks.scene_sets).toBe(false);
    // The events read fails: the event's set cannot count, and the venue is not asked for.
    out = await sameAsBefore({ bodies: DONE, fail: { events: http(500), sceneSets: http(500) } });
    expect(out.now.result.checks.scene_sets).toBe(true); // the plan names one
    expect(out.now.asked).not.toContain('venue');
    expect(out.now.result.linkedEvent).toBeNull();
    expect('invitation_exists' in out.now.result.checks).toBe(false);
  });

  test('the venue read fails: one console line, not two, and the same one as before', async () => {
    const { now } = await sameAsBefore({ bodies: DONE, fail: { venue: http(500) } });
    expect(now.logs.filter((l) => l.includes('venue set read failed'))).toEqual(['[EpisodeProductionChecklist] venue set read failed: 500']);
    expect(now.result.checks.venue_image).toBe(false);
  });

  test('the console lines come in the checklist\'s order, whatever fails', async () => {
    // Every read fails but the event's, so the venue's set is asked for and fails too.
    const fail = Object.fromEntries(READS.filter((k) => k !== 'events').map((k) => [k, http(500)]));
    const { now } = await sameAsBefore({ bodies: DONE, fail });
    const order = ['venue set read failed', 'episode scene sets read failed', 'plan read failed', 'wardrobe slot coverage failed', 'locked outfit read failed', 'social tasks read failed', 'social checklist asset read failed', 'episode re-read failed', 'overlay placements read failed', 'style sheet read failed', 'Lookbook read failed'];
    expect(now.logs.map((l) => order.find((o) => l.includes(o)))).toEqual(order);
  });

  test('a client that answers nothing at all, or throws before asking', async () => {
    // What a bare mock does: api.get returns undefined, not a promise.
    const none = await sameAsBefore({ raw: () => undefined }).catch((err) => err);
    // The two differ in one place only, set out in the next test; everything else is the same.
    expect(none).toBeInstanceOf(Error);
    const thrown = await run(loadProductionChecks, { raw: () => { throw new Error('offline'); } });
    const thrownBefore = await run(sequentialLoader, { raw: () => { throw new Error('offline'); } });
    expect(five(thrown.result)).toEqual(five(thrownBefore.result));
    expect(thrown.logs).toEqual(thrownBefore.logs);
  });

  test('a client that returns no promise: the same result and console lines; one more address is asked for', async () => {
    const now = await run(loadProductionChecks, { raw: () => undefined });
    const before = await run(sequentialLoader, { raw: () => undefined });
    expect(five(now.result)).toEqual(five(before.result));
    expect(now.logs).toEqual(before.logs);
    // Before, the social pair stopped at its first call; now every read is started.
    expect(before.asked).not.toContain('socialAssets');
    expect(now.asked.filter((k) => !before.asked.includes(k))).toEqual(['socialAssets']);
  });

  test('an episode that is not an episode: it still does not reject, and says what it said', async () => {
    for (const episode of [null, undefined, {}, { id: EP, title: 42 }]) {
      const now = await run(loadProductionChecks, { episode });
      const before = await run(sequentialLoader, { episode });
      expect(five(now.result)).toEqual(five(before.result));
      expect(now.logs).toEqual(before.logs);
      // Known and documented: where the old loader stopped part-way, the new one has already asked for the rest.
      for (const k of before.asked) expect(now.asked).toContain(k);
    }
  });
});

describe('the reads are made together', () => {
  /** A client whose answers are held until released, in any order. */
  function heldClient(bodies = DONE, fail = {}) {
    const waiting = [];
    vi.mocked(api.get).mockReset().mockImplementation((url) => new Promise((resolve, reject) => {
      const k = keyOf(url);
      waiting.push({ k, release: () => (k in fail ? reject(fail[k]) : resolve({ data: bodies[k] })) });
    }));
    const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };
    return {
      waiting,
      flush,
      /** Releases everything, taking the next answer by `pick` each time, until nothing is waiting. */
      async releaseAll(pick) {
        await flush();
        while (waiting.length) {
          const [next] = waiting.splice(pick(waiting.length), 1);
          next.release();
          await flush();
        }
      },
    };
  }

  test('fifteen reads are out before any answer; the venue waits for the event alone', async () => {
    const client = heldClient();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const done = loadProductionChecks(EPISODE, SHOW);
    await client.flush();
    expect(client.waiting.map((w) => w.k).sort()).toEqual(READS.filter((k) => k !== 'venue').sort());
    // The event answers: now, and only now, the venue's set is asked for.
    client.waiting.splice(client.waiting.findIndex((w) => w.k === 'events'), 1)[0].release();
    await client.flush();
    expect(client.waiting.map((w) => w.k)).toContain('venue');
    expect(client.waiting).toHaveLength(15);
    await client.releaseAll(() => 0);
    const result = await done;
    expect(five(result)).toEqual(five((await run(sequentialLoader, {})).result));
    expect(errors).not.toHaveBeenCalled();
  });

  test('nothing is decided or logged until every read has answered', async () => {
    const client = heldClient(DONE, { plan: http(500), outfit: http(500) });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let settled = false;
    const done = loadProductionChecks(EPISODE, SHOW).then((r) => { settled = true; return r; });
    await client.flush();
    // Release all but one, failures included: no line yet, and no result.
    while (client.waiting.length > 1) { client.waiting.shift().release(); await client.flush(); }
    expect(errors).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    await client.releaseAll(() => 0);
    await done;
    expect(errors.mock.calls.map(line)).toEqual(['[EpisodeProductionChecklist] plan read failed: 500', '[EpisodeProductionChecklist] locked outfit read failed: 500']);
  });

  test('the order the answers arrive in changes nothing: forward, reverse, and thirty shuffles', async () => {
    const random = seeded(7);
    const picks = [() => 0, (n) => n - 1, ...Array.from({ length: 30 }, () => (n) => Math.floor(random() * n))];
    for (const [bodies, fail] of [[DONE, {}], [FIXTURES['mixed: a plan with gaps, wardrobe short, a draft style sheet'], {}], [DONE, Object.fromEntries(READS.map((k) => [k, http(500)]))], [EMPTY, { sceneSets: http(500), styleSheet: http(500), socialAssets: new Error('Network Error'), lookbook: http(500) }]]) {
      const expected = await run(loadProductionChecks, { bodies, fail });
      const old = await run(sequentialLoader, { bodies, fail });
      expect(five(expected.result)).toEqual(five(old.result));
      expect(expected.logs).toEqual(old.logs);
      for (const pick of picks) {
        const client = heldClient(bodies, fail);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const done = loadProductionChecks(EPISODE, SHOW);
        await client.releaseAll(pick);
        const result = await done;
        expect(result).toEqual(expected.result);
        expect(errors.mock.calls.map(line)).toEqual(expected.logs);
        expect(vi.mocked(api.get).mock.calls.map(([u]) => keyOf(u)).sort()).toEqual(expected.asked);
        errors.mockRestore();
      }
    }
  });

  test('nothing is added around the reads: one call each, no second try after a failure', async () => {
    const { now } = await sameAsBefore({ bodies: DONE, fail: Object.fromEntries(READS.map((k) => [k, http(500)])) });
    expect(new Set(now.asked).size).toBe(now.asked.length);
    // A second call asks again: nothing was kept from the first.
    const first = await run(loadProductionChecks, {});
    const second = await run(loadProductionChecks, {});
    expect(second.asked).toEqual(first.asked);
    expect(second.asked).toHaveLength(16);
  });
});

describe('loaded: what the caller already holds', () => {
  const brief = DONE.brief.data;
  const sceneSets = DONE.sceneSets.data;
  const lalaState = DONE.lalaState.state;
  /** The four, as the old loader read them from the server. */
  const all = { brief, linkedEvent: EVENT, sceneSets, lalaState };
  const READ_FOR = { brief: 'brief', linkedEvent: 'events', sceneSets: 'sceneSets', lalaState: 'lalaState' };

  test('absent, an empty options, no options, undefined: everything is read, as before', async () => {
    const plain = await run(loadProductionChecks, {});
    for (const options of [{}, { loaded: {} }, { loaded: null }, { loaded: undefined }, null, { loaded: { brief: undefined, linkedEvent: undefined, sceneSets: undefined, lalaState: undefined } }]) {
      const out = await run(loadProductionChecks, { options });
      expect(out.result).toEqual(plain.result);
      expect(out.asked).toEqual(plain.asked);
      expect(out.result.read.supplied).toEqual([]);
    }
  });

  for (const key of Object.keys(READ_FOR)) {
    test(`${key} given: its read is not made, and the result is what reading the same thing gave`, async () => {
      const before = await run(sequentialLoader, {});
      const out = await run(loadProductionChecks, { options: { loaded: { [key]: all[key] } } });
      expect(five(out.result)).toEqual(five(before.result));
      expect(out.asked).toEqual(before.asked.filter((k) => k !== READ_FOR[key]));
      expect(out.result.read.supplied).toEqual([key]);
      expect(out.result.read[key]).toBe(all[key]);
    });

    test(`${key} given as null: taken as "there is none", and not read`, async () => {
      const noneBodies = { ...DONE, brief: key === 'brief' ? { data: null } : DONE.brief, events: key === 'linkedEvent' ? { events: [] } : DONE.events, sceneSets: key === 'sceneSets' ? { data: [] } : DONE.sceneSets, lalaState: key === 'lalaState' ? {} : DONE.lalaState };
      const before = await run(sequentialLoader, { bodies: noneBodies });
      const out = await run(loadProductionChecks, { options: { loaded: { [key]: null } } });
      expect(five(out.result)).toEqual(five(before.result));
      expect(out.asked).not.toContain(READ_FOR[key]);
      expect(out.result.read.supplied).toEqual([key]);
      // "None" is said, not left out.
      expect(key in out.result.read).toBe(true);
      expect(out.result.read[key]).toEqual(key === 'sceneSets' ? [] : null);
    });
  }

  test('an empty list of scene sets is "none linked"; the plan and the event can still settle it', async () => {
    const out = await run(loadProductionChecks, { bodies: { ...EMPTY, events: { events: [EVENT] } }, options: { loaded: { sceneSets: [] } } });
    expect(out.asked).not.toContain('sceneSets');
    expect(out.result.checks.scene_sets).toBe(true); // the event's own set
    const none = await run(loadProductionChecks, { bodies: EMPTY, options: { loaded: { sceneSets: [] } } });
    expect(none.result.checks.scene_sets).toBe(false);
    expect(none.result.read.sceneSets).toEqual([]);
  });

  test('all four given: four reads fewer, the same result', async () => {
    const before = await run(sequentialLoader, {});
    const out = await run(loadProductionChecks, { options: { loaded: all } });
    expect(five(out.result)).toEqual(five(before.result));
    expect(out.asked).toEqual(before.asked.filter((k) => !Object.values(READ_FOR).includes(k)));
    expect(out.asked).toHaveLength(12);
    expect(out.result.read.supplied).toEqual(['brief', 'linkedEvent', 'sceneSets', 'lalaState']);
    // The venue's image is still looked up, from the event that was given.
    expect(out.asked).toContain('venue');
    expect(out.result.linkedEvent).toBe(EVENT);
  });

  test('a linked event given as null: no event, and its venue is not asked for', async () => {
    const out = await run(loadProductionChecks, { options: { loaded: { linkedEvent: null } } });
    expect(out.asked).not.toContain('events');
    expect(out.asked).not.toContain('venue');
    expect(out.result.checks).toMatchObject({ event_linked: false, invitation_exists: false, venue_set: false, venue_image: false });
    expect(out.result.linkedEvent).toBeNull();
  });

  test('with no show no event is looked for, given or not (the rule that was there first)', async () => {
    const before = await run(sequentialLoader, { showId: null });
    const out = await run(loadProductionChecks, { showId: null, options: { loaded: { linkedEvent: EVENT } } });
    expect(five(out.result)).toEqual(five(before.result));
    expect(out.asked).toEqual(before.asked);
    expect(out.result.read.supplied).toEqual([]);
    expect('linkedEvent' in out.result.read).toBe(false);
    expect(out.result.linkedEvent).toBeNull();
  });

  test('a read that would have failed is not made when its answer is given', async () => {
    const fail = { brief: http(500), events: http(500), sceneSets: http(500), lalaState: http(500) };
    const good = await run(sequentialLoader, {});
    const out = await run(loadProductionChecks, { fail, options: { loaded: all } });
    expect(five(out.result)).toEqual(five(good.result));
    expect(out.logs).toEqual([]);
  });

  test('what `read` gave can be handed back as `loaded`: the same result, four reads fewer', async () => {
    for (const bodies of [DONE, EMPTY, FIXTURES['mixed: a plan with gaps, wardrobe short, a draft style sheet'], FIXTURES['no event linked']]) {
      const first = await run(loadProductionChecks, { bodies });
      const again = await run(loadProductionChecks, { bodies, options: { loaded: first.result.read } });
      expect(five(again.result)).toEqual(five(first.result));
      expect(again.asked).toEqual(first.asked.filter((k) => !['brief', 'events', 'sceneSets', 'lalaState'].includes(k)));
      // The other keys of `read`, and `supplied`, are not things `loaded` takes: their reads are still made.
      expect(again.asked).toContain('plan');
      expect(again.result.read.supplied).toEqual(['brief', 'linkedEvent', 'sceneSets', 'lalaState']);
    }
  });

  test('`supplied` in `loaded` is ignored: it is a description, not data', async () => {
    const plain = await run(loadProductionChecks, {});
    const out = await run(loadProductionChecks, { options: { loaded: { supplied: ['brief', 'plan'], plan: { beats: [] }, episode: {} } } });
    expect(out.result).toEqual(plain.result);
    expect(out.asked).toEqual(plain.asked);
  });
});

describe('read: what the checks used', () => {
  const KEYS = ['brief', 'linkedEvent', 'venueSetHasImage', 'sceneSets', 'plan', 'slotCoverage', 'outfit', 'lalaState', 'overlays', 'socialTasks', 'socialAssets', 'episode', 'placements', 'lookbook', 'styleSheet', 'showBrain'];

  test('the sixteen keys, and `supplied`, when everything answers', async () => {
    const { result } = await run(loadProductionChecks, {});
    expect(Object.keys(result.read).sort()).toEqual([...KEYS, 'supplied'].sort());
    expect(result.read).toMatchObject({
      brief: DONE.brief.data,
      linkedEvent: EVENT,
      venueSetHasImage: true,
      sceneSets: DONE.sceneSets.data,
      plan: { beats: DONE.plan.data, coverage: DONE.plan.coverage, readiness: DONE.plan.readiness },
      slotCoverage: DONE.slotCoverage.data,
      outfit: DONE.outfit.items,
      lalaState: DONE.lalaState.state,
      overlays: DONE.overlays,
      socialTasks: DONE.socialTasks.social_tasks,
      socialAssets: DONE.socialAssets.data,
      episode: DONE.episode.data,
      placements: DONE.placements.data,
      lookbook: DONE.lookbook.data,
      styleSheet: SHEET_DONE,
      showBrain: DONE.showBrain.entries,
      supplied: [],
    });
  });

  test('an answer with nothing in it is still there, as null or []', async () => {
    const { result } = await run(loadProductionChecks, { bodies: EMPTY });
    expect(Object.keys(result.read).sort()).toEqual([...KEYS, 'supplied'].sort());
    expect(result.read).toMatchObject({
      brief: null, linkedEvent: null, venueSetHasImage: false, sceneSets: [], slotCoverage: null, outfit: [],
      lalaState: null, socialTasks: [], socialAssets: [], placements: [], lookbook: {}, styleSheet: null, showBrain: [],
    });
    expect(result.read.plan).toEqual({ beats: [], coverage: null, readiness: null });
  });

  for (const k of READS) {
    test(`${k} fails: its key is left out, and the others are there`, async () => {
      const { result } = await run(loadProductionChecks, { fail: { [k]: http(500) } });
      // The Style Page block needs the lookbook: without it nothing of the block is recorded.
      const gone = { events: ['linkedEvent', 'venueSetHasImage'], venue: [], lookbook: ['lookbook', 'styleSheet'] }[k] || [k];
      for (const key of gone) expect(key in result.read).toBe(false);
      // The venue read reports "no image" when it fails (its own rule), so its key stays, as false.
      if (k === 'venue') expect(result.read.venueSetHasImage).toBe(false);
      const stay = KEYS.filter((key) => !gone.includes(key));
      for (const key of stay) expect(key in result.read).toBe(true);
    });
  }

  test('every read fails: only what needs no read is left', async () => {
    const { result } = await run(loadProductionChecks, { fail: Object.fromEntries(READS.map((k) => [k, http(500)])) });
    expect(result.read).toEqual({ supplied: [] });
  });

  test('a read that is not made has no key: no show, and an event with no set still says "no image"', async () => {
    const noShow = await run(loadProductionChecks, { showId: null });
    for (const key of ['linkedEvent', 'venueSetHasImage', 'overlays']) expect(key in noShow.result.read).toBe(false);
    const noSet = await run(loadProductionChecks, { bodies: FIXTURES['an event with no venue set (no venue read)'] });
    expect(noSet.asked).not.toContain('venue');
    expect(noSet.result.read.venueSetHasImage).toBe(false);
  });

  test('`supplied` names only what was given, and the given values are the ones in `read`', async () => {
    const given = { brief: { arc_number: 9, position_in_arc: 9 }, lalaState: { coins: 5 } };
    const { result } = await run(loadProductionChecks, { options: { loaded: given } });
    expect(result.read.supplied).toEqual(['brief', 'lalaState']);
    expect(result.read.brief).toBe(given.brief);
    expect(result.read.lalaState).toBe(given.lalaState);
    expect(result.read.sceneSets).toEqual(DONE.sceneSets.data);
    expect(result.checks.arc_position).toBe(true);
    expect(result.checks.archetype).toBe(false);
  });

  test('the five fields every caller reads are there, named as they were', async () => {
    const { result } = await run(loadProductionChecks, {});
    expect(Object.keys(result)).toEqual(['checks', 'notes', 'coverage', 'sceneStep', 'linkedEvent', 'read']);
  });
});

describe('read does not offer what could not be used', () => {
  const has = (result, key) => key in result.read;

  test('a plan the block could not work through is not recorded, though its read answered', async () => {
    const bodies = FIXTURES['a plan that is not a list (the block stops part-way)'];
    const { before, now } = await sameAsBefore({ bodies });
    // The old loader treated it as a failed read: the check is open and the line says so.
    expect(now.result.checks.scene_plan).toBe(false);
    expect(before.logs.some((l) => l.includes('plan read failed'))).toBe(true);
    expect(has(now.result, 'plan')).toBe(false);
    // A plan whose readiness cannot be read through is the same.
    const odd = await sameAsBefore({ bodies: { ...DONE, plan: { data: [{ beat_number: 1 }], readiness: { total: 2, ready: 1 } } } });
    expect(odd.now.logs.some((l) => l.includes('plan read failed'))).toBe(true);
    expect(has(odd.now.result, 'plan')).toBe(false);
  });

  test('an answer with no body at all is a failed read: no key', async () => {
    // The response itself is missing (not { data: … }), for each read in turn.
    for (const k of READS) {
      const raw = (url) => Promise.resolve(keyOf(url) === k ? undefined : { data: DONE[keyOf(url)] });
      const now = await run(loadProductionChecks, { raw });
      const before = await run(sequentialLoader, { raw });
      expect(five(now.result)).toEqual(five(before.result));
      expect(now.logs).toEqual(before.logs);
      const KEY = { events: 'linkedEvent', venue: null, socialTasks: 'socialTasks', socialAssets: 'socialAssets' }[k];
      const key = KEY === undefined ? k : KEY;
      // The lookbook and the style sheet are read through `?.`, as before: a missing response is "nothing there", not a failure.
      if (key && !['lookbook', 'styleSheet', 'linkedEvent'].includes(key)) expect(has(now.result, key)).toBe(false);
    }
  });

  test('a body that answers but holds nothing is "none", exactly as the checks read it', async () => {
    // { data: undefined } for every read: the checks say "nothing there"; `read` says the same and no more.
    const { now } = await sameAsBefore({ bodies: FIXTURES['every body missing (undefined)'] });
    expect(has(now.result, 'brief')).toBe(false); // the brief's body is needed: without it the block fails
    expect(now.result.read).toMatchObject({ linkedEvent: null, sceneSets: [], slotCoverage: null, outfit: null, lalaState: null, socialTasks: [], socialAssets: [], placements: null, lookbook: {}, styleSheet: null, showBrain: [] });
    expect(now.result.read.plan).toEqual({ beats: [], coverage: null, readiness: null });
  });

  test('the Style Page: nothing of the block is recorded when the lookbook fails; the sheet alone failing leaves the lookbook', async () => {
    const noLookbook = await sameAsBefore({ fail: { lookbook: http(500) } });
    expect(has(noLookbook.now.result, 'lookbook')).toBe(false);
    expect(has(noLookbook.now.result, 'styleSheet')).toBe(false);
    const noSheet = await sameAsBefore({ fail: { styleSheet: http(500) } });
    expect(has(noSheet.now.result, 'lookbook')).toBe(true);
    expect(has(noSheet.now.result, 'styleSheet')).toBe(false);
  });

  test('whatever is recorded gives the same checks when handed back', async () => {
    for (const bodies of Object.values(FIXTURES)) {
      const first = await run(loadProductionChecks, { bodies });
      const again = await run(loadProductionChecks, { bodies, options: { loaded: first.result.read } });
      expect(five(again.result)).toEqual(five(first.result));
    }
  });

  test('a failed read handed back is still read: an absent key is never taken as "none"', async () => {
    const fail = { brief: http(500), sceneSets: http(500), lalaState: http(500), events: http(500) };
    const first = await run(loadProductionChecks, { fail });
    for (const key of ['brief', 'linkedEvent', 'sceneSets', 'lalaState']) expect(has(first.result, key)).toBe(false);
    const again = await run(loadProductionChecks, { options: { loaded: first.result.read } });
    // The reads are made again, and this time answer.
    expect(again.asked).toEqual(READS.slice().sort());
    expect(five(again.result)).toEqual(five((await run(sequentialLoader, {})).result));
  });
});

describe('the two pairs, when one or both fail', () => {
  const PAIRS = [['socialTasks', 'socialAssets'], ['lookbook', 'styleSheet']];
  const WAYS = { answers: null, 'is rejected': 'fail', 'throws before asking': 'sync' };
  const line1 = (logs, text) => logs.filter((l) => l.includes(text));

  for (const [first, second] of PAIRS) {
    for (const [a, aWay] of Object.entries(WAYS)) {
      for (const [b, bWay] of Object.entries(WAYS)) {
        if (!aWay && !bWay) continue;
        test(`${first} ${a}, ${second} ${b}: the same result and the same console lines`, async () => {
          for (const bodies of [DONE, EMPTY]) {
            const scenario = { bodies, fail: {}, sync: {} };
            if (aWay) scenario[aWay][first] = aWay === 'sync' ? new TypeError(`${first} threw`) : http(500);
            if (bWay) scenario[bWay][second] = bWay === 'sync' ? new TypeError(`${second} threw`) : new Error('Network Error');
            const before = await run(sequentialLoader, scenario);
            const now = await run(loadProductionChecks, scenario);
            expect(five(now.result)).toEqual(five(before.result));
            expect(now.logs).toEqual(before.logs);
            // Every address the old loader asked for is asked for; where the old one stopped at a
            // throw, the new one has also asked for the other of the pair.
            for (const k of before.asked) expect(now.asked).toContain(k);
            expect(now.asked.filter((k) => !before.asked.includes(k)).every((k) => k === second)).toBe(true);
            // Neither of the pair is offered for reuse unless its block finished with it.
            if (aWay) expect(first in now.result.read).toBe(false);
            if (bWay) expect(second in now.result.read).toBe(false);
          }
        });
      }
    }
  }

  test('both of the social pair rejected: both lines, tasks first, and the check is open', async () => {
    const { now } = await sameAsBefore({ fail: { socialTasks: http(500), socialAssets: http(503) } });
    expect(now.logs).toEqual(['[EpisodeProductionChecklist] social tasks read failed: 500', '[EpisodeProductionChecklist] social checklist asset read failed: 503']);
    expect(now.result.checks.social_checklist).toBe(false);
  });

  test('both of the Style Page pair rejected: the sheet\'s line, then the lookbook\'s, and the note', async () => {
    const { now } = await sameAsBefore({ fail: { lookbook: http(500), styleSheet: http(404) } });
    expect(now.logs).toEqual(['[Checklist] style sheet read failed: 404', '[Checklist] Lookbook read failed: 500']);
    expect(now.result.checks).toMatchObject({ lookbook_ready: false, style_sheet_approved: false });
    expect(now.result.notes.lookbook_ready).toBe('The Style Page could not be read');
  });

  test('both of a pair throw before asking: one line for the pair, as before', async () => {
    const social = await run(loadProductionChecks, { sync: { socialTasks: new TypeError('a'), socialAssets: new TypeError('b') } });
    expect(line1(social.logs, 'social')).toEqual(['[EpisodeProductionChecklist] social checklist check failed: a']);
    const style = await run(loadProductionChecks, { sync: { lookbook: new TypeError('c'), styleSheet: new TypeError('d') } });
    expect(style.logs).toEqual(['[Checklist] Lookbook read failed: c']);
  });

  test('the assets call throws while the tasks read is failing: the pair\'s line, then the tasks\' line', async () => {
    const scenario = { fail: { socialTasks: http(500) }, sync: { socialAssets: new TypeError('assets threw') } };
    const before = await run(sequentialLoader, scenario);
    const now = await run(loadProductionChecks, scenario);
    expect(before.logs).toEqual(['[EpisodeProductionChecklist] social checklist check failed: assets threw', '[EpisodeProductionChecklist] social tasks read failed: 500']);
    expect(now.logs).toEqual(before.logs);
  });
});

describe('a rejected read is always listened to', () => {
  // The harness gives the loader no safety net (see `run`): a rejected read it started and never
  // listened to is an unhandled rejection, which fails this file.
  test('two hundred random mixes of rejected reads and calls that throw', async () => {
    const random = seeded(99);
    for (let n = 0; n < 200; n += 1) {
      const fail = {};
      const sync = {};
      for (const k of READS) {
        const r = random();
        if (r < 0.3) fail[k] = http(500);
        else if (r < 0.4) sync[k] = new TypeError(`${k} threw`);
      }
      const now = await run(loadProductionChecks, { fail, sync });
      expect(typeof now.result.checks).toBe('object');
    }
    // Long enough for a rejection nobody listened to to be reported.
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
});

