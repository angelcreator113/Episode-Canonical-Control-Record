/**
 * lib/eventFlow (Evoni, 2026-10-25: the Event Package's header and how you
 * move through it): the stages, the setup list, the blocked reasons, the
 * way back for each origin, the slot neighbours and the season panel lines.
 */
import { describe, test, expect } from 'vitest';
import { computeEventPackageReadiness } from '../utils/eventReadinessSections';
import {
  eventStages, setupSections, blockedReasons, andList, parseFrom, fromParam, packageHref, returnLink,
  slotNeighbours, neighbourHref, slotOf, goalGains, goalGainText, releaseLine,
} from './eventFlow';

// An event with every gate set: organizer, name, category, format, date, venue, invitation.
const READY = {
  id: 'ev-1', name: 'Fabric and Form', category: 'arts_entertainment', format: 'gala', event_date: '2026-11-12',
  host_brand: 'Studio by Sable', venue_location_id: 'loc-1', invitation_asset_id: 'asset-1', canon_consequences: { automation: {} },
};
const without = (...keys) => { const e = { ...READY }; for (const k of keys) delete e[k]; return e; };
const stagesOf = (event, extra = {}) => eventStages({ event, readiness: computeEventPackageReadiness(event), ...extra });
const states = (r) => Object.fromEntries(r.stages.map((s) => [s.key, s.state]));

describe('eventStages', () => {
  test('Idea: a gate of setting up is missing; the next step names what moves it on', () => {
    const r = stagesOf(without('host_brand', 'venue_location_id'));
    expect(r.current).toBe('idea');
    expect(states(r)).toEqual({ idea: 'current', setup: 'todo', invited: 'todo', ready: 'todo', episode: 'todo', done: 'todo' });
    expect(r.next.key).toBe('setup');
    expect(r.next.hint).toBe('Set up once the organizer is chosen and the venue is chosen');
  });

  test('Set up: organizer, basics and venue set, no invitation yet', () => {
    const r = stagesOf(without('invitation_asset_id'));
    expect(r.current).toBe('setup');
    expect(r.next.hint).toBe('Invited once the invitation is made');
    expect(r.stages.find((s) => s.key === 'ready').hint).toBe('Ready once the invitation is made');
  });

  test('an invitation made before the venue does not skip Set up', () => {
    const r = stagesOf(without('venue_location_id'));
    expect(r.current).toBe('idea');
    expect(states(r).invited).toBe('todo');
  });

  test('Invited: the invitation is made, a deal price still missing holds Ready', () => {
    const event = { ...READY, deal_type: 'brand_partnership', deal_components: ['partnership_base'] };
    const r = stagesOf(event);
    expect(r.current).toBe('invited');
    expect(r.next.key).toBe('ready');
    expect(r.next.hint).toBe('Ready once deal prices are set');
  });

  test('Ready: every gate set; next is Start Episode', () => {
    const r = stagesOf(READY);
    expect(r.current).toBe('ready');
    expect(r.next.hint).toBe('In an episode once you press Start Episode');
  });

  test('In an episode, then Done once the episode is accepted', () => {
    const used = { ...READY, used_in_episode_id: 'ep-1' };
    const r = stagesOf(used, { used: true, episode: { evaluation_status: 'draft' } });
    expect(r.current).toBe('episode');
    expect(states(r)).toMatchObject({ idea: 'done', setup: 'done', invited: 'done', ready: 'done', episode: 'current', done: 'todo' });
    expect(r.next.hint).toBe('Done once its episode is accepted');
    const done = stagesOf(used, { used: true, episode: { evaluation_status: 'accepted' } });
    expect(done.current).toBe('done');
    expect(done.next).toBeNull();
  });

  test('andList joins with commas and "and"', () => {
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b'])).toBe('a and b');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('setupSections', () => {
  test('one entry per section with a gate missing, worded as the Season card words it, with where it jumps', () => {
    const r = computeEventPackageReadiness(without('host_brand', 'category', 'format', 'venue_location_id', 'invitation_asset_id'));
    const list = setupSections(r);
    expect(list.map((s) => [s.key, s.label, s.anchor])).toEqual([
      ['organizer', 'Organizer', 'people'],
      ['identity', 'Event identity: category, format', 'identity'],
      ['place', 'Place: venue', 'place'],
      ['invitation', 'Invitation', 'invitation'],
    ]);
    expect(list.every((s) => !s.done)).toBe(true);
    expect(list[1].first).toMatchObject({ section: 'identity', key: 'category' });
  });

  test('an entry filled in since stays, ticked, under the words it had', () => {
    const r = computeEventPackageReadiness(without('invitation_asset_id'));
    const list = setupSections(r, { place: 'Place: venue', invitation: 'Invitation' });
    expect(list.map((s) => [s.key, s.done])).toEqual([['place', true], ['invitation', false]]);
    expect(list[0].label).toBe('Place: venue');
    expect(list[0].first).toBeNull();
  });

  test('a missing deal price jumps to Deal & Money', () => {
    const r = computeEventPackageReadiness({ ...READY, deal_type: 'brand_partnership', deal_components: ['partnership_base'] });
    expect(setupSections(r).map((s) => [s.key, s.anchor])).toEqual([['stakes', 'deal']]);
  });
});

describe('blockedReasons', () => {
  test('Start Episode names what it needs and the first step', () => {
    const r = computeEventPackageReadiness(without('venue_location_id', 'invitation_asset_id'));
    const { start } = blockedReasons({ readiness: r });
    expect(start.text).toBe('Start Episode needs 2 things first: venue and invitation');
    expect(start.action.label).toBe('Choose the venue');
    expect(start.action.target).toMatchObject({ section: 'place', key: 'venue' });
  });

  test('one thing, a deal price', () => {
    const r = computeEventPackageReadiness({ ...READY, deal_type: 'brand_partnership', deal_components: ['partnership_base'] });
    const { start } = blockedReasons({ readiness: r });
    expect(start.text).toBe('Start Episode needs one thing first: deal prices');
    expect(start.action.label).toBe('Set deal prices');
  });

  test('ready: no reason, unless the money check is running; a used event has none', () => {
    const r = computeEventPackageReadiness(READY);
    expect(blockedReasons({ readiness: r }).start).toBeNull();
    expect(blockedReasons({ readiness: r, moneyPending: true }).start).toEqual({ text: 'Start Episode waits while Lala’s money is checked', action: null });
    expect(blockedReasons({ readiness: computeEventPackageReadiness(without('venue_location_id')), used: true }).start).toBeNull();
  });

  test('the invitation waits for an organizer', () => {
    expect(blockedReasons({ hasOrganizer: false, hasInvitation: false }).invitation)
      .toEqual({ text: 'The invitation needs an organizer first: it names them', action: { label: 'Pick one', target: 'organizer' } });
    expect(blockedReasons({ hasOrganizer: true }).invitation).toBeNull();
    expect(blockedReasons({ hasOrganizer: false, hasInvitation: true }).invitation).toBeNull();
  });

  test('Propose terms: a deal type first, then a paid part; none once priced or locked', () => {
    expect(blockedReasons({ plan: { known: false, cash: false } }).propose)
      .toEqual({ text: 'Deal prices need a deal type first', action: { label: 'Pick one', target: 'deal' } });
    expect(blockedReasons({ plan: { known: true, cash: false } }).propose.text).toBe('Proposing terms needs a paid part in the deal');
    expect(blockedReasons({ plan: { known: true, cash: true } }).propose).toBeNull();
    expect(blockedReasons({ plan: { known: false, cash: false }, termsLocked: true }).propose).toBeNull();
  });
});

describe('where she came from', () => {
  test('parseFrom and fromParam round-trip each origin; anything else is none', () => {
    for (const v of ['roadmap:5', 'roadmap', 'events:unplaced', 'events:in-season', 'events:all', 'events', 'producer']) {
      expect(fromParam(parseFrom(v))).toBe(v);
    }
    expect(parseFrom('events:nope')).toEqual({ kind: 'events', show: null });
    expect(parseFrom('https://x')).toBeNull();
    expect(parseFrom(null)).toBeNull();
  });

  test('packageHref carries the origin, never anything it cannot read', () => {
    expect(packageHref('show-1', 'ev-2', { kind: 'roadmap', slot: 4 })).toBe('/shows/show-1/events/ev-2?from=roadmap:4');
    expect(packageHref('show-1', 'ev-2', 'events:unplaced')).toBe('/shows/show-1/events/ev-2?from=events:unplaced');
    expect(packageHref('show-1', 'ev-2', 'javascript:alert(1)')).toBe('/shows/show-1/events/ev-2');
    expect(packageHref('show-1', 'ev-2')).toBe('/shows/show-1/events/ev-2');
  });

  test('returnLink: each origin, restoring its slot or filter', () => {
    expect(returnLink(parseFrom('roadmap:5'), { showId: 'show-1' })).toEqual({ href: '/shows/show-1/season?tab=roadmap&slot=5', label: 'Back to E5 on the Roadmap', done: false });
    expect(returnLink(parseFrom('events:unplaced'), { showId: 'show-1' })).toMatchObject({ href: '/shows/show-1/season?tab=events&show=unplaced', label: 'Back to Not placed yet' });
    expect(returnLink(parseFrom('events:in-season'), { showId: 'show-1' }).label).toBe('Back to In this season');
    expect(returnLink(parseFrom('events:all'), { showId: 'show-1' }).label).toBe('Back to All events');
    expect(returnLink(parseFrom('producer'), { showId: 'show-1' })).toMatchObject({ href: '/shows/show-1/world?tab=overview', label: 'Back to Producer Mode' });
    expect(returnLink(null, { showId: 'show-1' })).toMatchObject({ href: '/shows/show-1/season?tab=events', label: 'Events' });
  });

  test('done: "Done · back to …"', () => {
    expect(returnLink(parseFrom('roadmap:5'), { showId: 'show-1', done: true }).label).toBe('Done · back to E5 on the Roadmap');
    expect(returnLink(parseFrom('events:unplaced'), { showId: 'show-1', done: true }).label).toBe('Done · back to Not placed yet');
  });
});

describe('slot order', () => {
  const ROADMAP = {
    phases: [
      { phase: 1, slots: [
        { slot_number: 3, event: { id: 'ev-3', name: 'Gallery Night' }, episode: null },
        { slot_number: 1, event: null, episode: { id: 'ep-1', title: 'Pilot' } },
        { slot_number: 4, event: null, episode: null },
        { slot_number: 5, event: { id: 'ev-1', name: 'Fabric and Form' }, episode: null },
      ] },
      { phase: 2, slots: [
        { slot_number: 6, event: null, episode: null },
        { slot_number: 7, event: { id: 'ev-7', name: 'Runway' }, episode: { id: 'ep-7' } },
      ] },
    ],
  };

  test('the nearest filled slot each way, skipping open ones', () => {
    const { prev, next } = slotNeighbours(ROADMAP, 5);
    expect(prev).toEqual({ slot_number: 3, code: 'E3', name: 'Gallery Night', eventId: 'ev-3', episodeId: null });
    expect(next).toMatchObject({ code: 'E7', eventId: 'ev-7', episodeId: null });
  });

  test('a slot with only an episode opens the episode; the ends have no neighbour', () => {
    const { prev, next } = slotNeighbours(ROADMAP, 3);
    expect(prev).toMatchObject({ code: 'E1', eventId: null, episodeId: 'ep-1' });
    expect(neighbourHref('show-1', prev, 'roadmap:5')).toBe('/episodes/ep-1');
    expect(neighbourHref('show-1', next, 'roadmap:5')).toBe('/shows/show-1/events/ev-1?from=roadmap:5');
    expect(slotNeighbours(ROADMAP, 7).next).toBeNull();
    expect(slotNeighbours(ROADMAP, null)).toEqual({ prev: null, next: null });
    expect(slotNeighbours(null, 5)).toEqual({ prev: null, next: null });
  });

  test('slotOf finds the slot by number', () => {
    expect(slotOf(ROADMAP, 5).event.id).toBe('ev-1');
    expect(slotOf(ROADMAP, 9)).toBeNull();
    expect(slotOf(ROADMAP, null)).toBeNull();
  });
});

describe('the season panel lines', () => {
  const COVERAGE = {
    goals: [
      { id: 'g1', title: 'Earn 3,000 Prime Coins', metric_label: 'Coins', movers: [{ event_id: 'ev-1', gain: 600, done: false }, { event_id: 'ev-3', gain: 900 }] },
      { id: 'g2', title: 'Break Into Luxury', metric_label: 'Reputation', movers: [{ event_id: 'ev-1', gain: 0 }] },
    ],
    event: { moves: [{ goal_id: 'g1', title: 'Earn 3,000 Prime Coins' }, { goal_id: 'g2', title: 'Break Into Luxury' }] },
  };

  test('goalGains: what this event adds, by goal; none without a counted reward', () => {
    expect(goalGains(COVERAGE, 'ev-1')).toEqual({ g1: { text: '+600 coins', done: false } });
    expect(goalGains(null, 'ev-1')).toEqual({});
  });

  test('goalGainText: "+600 coins toward Earn 3,000 Prime Coins; moves Break Into Luxury"', () => {
    expect(goalGainText(COVERAGE, 'ev-1')).toBe('+600 coins toward Earn 3,000 Prime Coins; moves Break Into Luxury');
    expect(goalGainText({ event: { moves: [] } }, 'ev-1')).toBeNull();
  });

  test('releaseLine: a schedule date, a preview, none', () => {
    expect(releaseLine({ text: 'Sun, Nov 29', source: 'schedule' })).toBe('Releases Sun, Nov 29');
    expect(releaseLine({ text: 'Would be Sun, Nov 29', source: 'preview' })).toBe('Would release Sun, Nov 29 once releasing starts');
    expect(releaseLine(null)).toBeNull();
  });
});
