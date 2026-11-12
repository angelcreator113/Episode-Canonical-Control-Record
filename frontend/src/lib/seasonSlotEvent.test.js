/**
 * One reader for "the event a slot shows" (Evoni, 2026-11-12): the
 * calendar, the plan sheet, the season's event list and the slot neighbours
 * agree with the Roadmap. Episode 1's shape: a started slot that stores no
 * event, whose episode's event the server derives.
 */
import { describe, test, expect } from 'vitest';
import { slotEvent, slotEventNote, NO_PRIMARY_EVENT, NEEDS_REVIEW } from './seasonSlotEvent';
import { slotEvents, slotPicture } from './seasonPage';
import { seasonPlanSheet } from './seasonPlanSheet';
import { calendarItems } from './seasonCalendar';

const view = (over = {}) => ({ event: null, source: 'none', pencilled_event: null, needs_review: false, review_reasons: [], pencil_disagrees: false, ...over });
const E1 = { id: 'ev-1', name: 'Studio Session' };
const episodeOne = { id: 's1', slot_number: 1, phase: 1, state: 'in_production', episode: { id: 'ep-1', title: 'Wearable Experiments' }, event: null, intention: {}, event_view: view({ event: E1, source: 'episode' }) };
const pencilled = { id: 's2', slot_number: 2, phase: 1, state: 'event_ready', episode: null, event: { id: 'ev-2', name: 'Charity Gala' }, intention: {}, event_view: view({ event: { id: 'ev-2', name: 'Charity Gala' }, source: 'pencil', pencilled_event: { id: 'ev-2', name: 'Charity Gala' } }) };
const open = { id: 's3', slot_number: 3, phase: 1, state: 'needs_event', episode: null, event: null, intention: {}, event_view: view() };
const roadmap = { season_number: 1, phases: [{ phase: 1, title: 'Foundation', episode_start: 1, episode_end: 3, slots: [episodeOne, pencilled, open] }], specials: [] };
const events = [{ id: 'ev-1', name: 'Studio Session', event_date: '2027-03-01', invitation_url: 'https://example.invalid/inv.png' }, { id: 'ev-2', name: 'Charity Gala', event_date: '2027-03-08' }];

describe('slotEvent', () => {
  test('a started slot: its episode\'s event, though the slot stores none; an empty slot: its pencil; an open slot: none', () => {
    expect(slotEvent(episodeOne)).toEqual(E1);
    expect(episodeOne.event).toBeNull(); // the raw pencil is still sent as it is
    expect(slotEvent(pencilled)).toEqual({ id: 'ev-2', name: 'Charity Gala' });
    expect(slotEvent(open)).toBeNull();
    expect(slotEvent(null)).toBeNull();
  });
  test('a server that does not derive is read as before: the slot\'s own event', () => {
    expect(slotEvent({ episode: { id: 'ep' }, event: { id: 'ev-x', name: 'X' } })).toEqual({ id: 'ev-x', name: 'X' });
    expect(slotEvent({ episode: { id: 'ep' }, event: null })).toBeNull();
    expect(slotEventNote({ episode: { id: 'ep' }, event: null })).toMatchObject({ label: 'Event not linked to this season slot' });
    expect(slotEventNote({ episode: { id: 'ep' }, event: { id: 'ev-x' } })).toBeNull();
  });
  test('a started slot with a primary event that needs nothing said says nothing; an empty slot never has a note', () => {
    expect(slotEventNote(episodeOne)).toBeNull();
    expect(slotEventNote(pencilled)).toBeNull();
    expect(slotEventNote(open)).toBeNull();
  });
  test('no primary event, a review, and a pencil that disagrees', () => {
    const started = { episode: { id: 'ep-1' }, event: null };
    expect(slotEventNote({ ...started, event_view: view() })).toMatchObject({ label: NO_PRIMARY_EVENT, reasons: null });
    expect(slotEventNote({ ...started, event_view: view({ event: E1, needs_review: true, review_reasons: ['primary_linked_elsewhere'] }) }))
      .toMatchObject({ label: NEEDS_REVIEW, reasons: "the event's own link points at another episode" });
    expect(slotEventNote({ ...started, event: { id: 'ev-old', name: 'Old' }, event_view: view({ event: E1, pencil_disagrees: true, pencilled_event: { id: 'ev-old', name: 'Old' } }) }))
      .toMatchObject({ label: NEEDS_REVIEW, reasons: 'this slot was pencilled for "Old", which is not the episode\'s event (kept as planning history)' });
    // No primary at all, with a pencil kept: the missing primary is said first, and the pencil is never the event.
    const noPrimary = { ...started, event: { id: 'ev-old', name: 'Old' }, event_view: view({ pencilled_event: { id: 'ev-old', name: 'Old' }, pencil_disagrees: true, needs_review: true, review_reasons: ['pencil_without_primary'] }) };
    expect(slotEvent(noPrimary)).toBeNull();
    expect(slotEventNote(noPrimary)).toMatchObject({ label: NEEDS_REVIEW, reasons: 'the episode has no primary event linked; this slot was pencilled for "Old" before it started (kept as planning history, not the episode\'s event)' });
  });
});

describe('the screens that show a slot\'s event agree', () => {
  test('the season\'s events and the count: Episode 1\'s event is counted, in slot order', () => {
    expect(slotEvents(roadmap, events).map((x) => [x.slot.slot_number, x.event.id])).toEqual([[1, 'ev-1'], [2, 'ev-2']]);
  });
  test('the slot card\'s picture uses the episode\'s event\'s invitation', () => {
    expect(slotPicture(episodeOne, { episodes: [], events })).toBe('https://example.invalid/inv.png');
  });
  test('the plan sheet names Episode 1\'s event on its row and lists it once', () => {
    const sheet = seasonPlanSheet({ arc: { season_number: 1 }, roadmap, events });
    const text = JSON.stringify(sheet);
    expect(text).toContain('Studio Session');
    expect(text).toContain('Charity Gala');
    expect((text.match(/"name":"Studio Session"/g) || []).length).toBe(1);
  });
  test('the calendar shows Episode 1\'s in-world event on its day', () => {
    const { items } = { items: calendarItems({ roadmap, events }).items || calendarItems({ roadmap, events }) };
    const list = Array.isArray(items) ? items : [];
    expect(list.filter((i) => i.kind === 'event').map((i) => [i.key, i.date, i.slot_number])).toEqual(expect.arrayContaining([['event-ev-1', '2027-03-01', 1], ['event-ev-2', '2027-03-08', 2]]));
  });
});
