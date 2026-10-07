import { describe, test, expect } from 'vitest';
import { eventLookPieces, lookAgainstEvent, shoppingListSource, eventPackagePath } from './eventLook';

describe('eventLook (Evoni, 2026-10-07)', () => {
  test("the event's pieces, from an array or a JSON string", () => {
    expect(eventLookPieces({ outfit_pieces: [{ id: 'a' }, null, { name: 'no id' }] })).toEqual([{ id: 'a' }]);
    expect(eventLookPieces({ outfit_pieces: '[{"id":"b"}]' })).toEqual([{ id: 'b' }]);
    expect(eventLookPieces({ outfit_pieces: 'not json' })).toEqual([]);
    expect(eventLookPieces(null)).toEqual([]);
  });

  test('the look on screen against the event\'s', () => {
    const pieces = [{ id: 'd' }, { id: 's' }];
    expect(lookAgainstEvent({}, []).state).toBe('none');
    expect(lookAgainstEvent({ body: { id: 'd' }, shoes: { id: 's' } }, pieces)).toEqual({ state: 'same', notWorn: [], extra: 0 });
    expect(lookAgainstEvent({ body: { id: 'd' } }, pieces)).toMatchObject({ state: 'differs', notWorn: [{ id: 's' }], extra: 0 });
    expect(lookAgainstEvent({ body: { id: 'd' }, shoes: { id: 's' }, jewelry: [{ id: 'j' }] }, pieces)).toMatchObject({ state: 'differs', extra: 1 });
  });

  test('where the list comes from, and the Event Package path', () => {
    expect(shoppingListSource([{ slot: 'dress' }])).toEqual({ fromDocument: false, version: null });
    expect(shoppingListSource([{ from_event_document: { type: 'shopping_list', version: 3 } }])).toEqual({ fromDocument: true, version: 3 });
    expect(eventPackagePath('s', { id: 'e' })).toBe('/shows/s/events/e');
    expect(eventPackagePath('s', { id: 'e', show_id: 'x' })).toBe('/shows/x/events/e');
    expect(eventPackagePath(null, { id: 'e' })).toBeNull();
  });
});
