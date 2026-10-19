/**
 * "THIS EPISODE MUST COVER" (Task #2884): only the episode's own data (the
 * event's deliverables and goals, the brief's forward hook), ticked when a
 * beat mentions it, with that beat's number.
 */
import { describe, test, expect } from 'vitest';
import { mustCover, mentionedIn, keyWords } from './episodeScript';

const beats = [
  { number: 1, lines: ['Prime: "Hi besties."'] },
  { number: 11, lines: ['Lala: "I have to follow up with the Sable studio team."'] },
  { number: 12, lines: ['(Lala films the Instagram reel for the brand.)'] },
];
const event = { canon_consequences: { automation: { relationship_goals: [{ label: 'Follow up with STUDIO BY SABLE' }, { label: '' }] } } };

describe('must cover', () => {
  // What she owes is not on the list (Evoni, 2026-10-18): deliverables are
  // not always shown in the show; beat 12 is The Fashion Challenge.
  test('goals and the hook, each with the beat that mentions it; deliverables are not listed', () => {
    const items = mustCover({
      beats,
      deliverables: [{ id: 'd1', description: 'Instagram reel for the brand' }, { id: 'd2', platform: 'TikTok', deliverable_type: 'video' }],
      event,
      brief: { forward_hook: '  A second invitation arrives.  ' },
    });
    expect(items.map((i) => [i.source, i.label, i.beat])).toEqual([
      ['Goal', 'Follow up with STUDIO BY SABLE', 11],
      ['Forward hook', 'A second invitation arrives.', null],
    ]);
  });
  test('nothing in the data, nothing listed; unread deliverables are none', () => {
    expect(mustCover({ beats, deliverables: null, event: null, brief: null })).toEqual([]);
    expect(mustCover()).toEqual([]);
  });
  test('a shared name alone does not tick an item', () => {
    const b = [{ number: 4, lines: ['Lala: "A message from STUDIO BY SABLE."'] }];
    expect(mentionedIn(b, 'Instagram reel for STUDIO BY SABLE')).toBeNull();
    expect(mentionedIn(b, 'Follow up with STUDIO BY SABLE')).toBeNull();
  });

  test('a mention needs most key words in one beat', () => {
    expect(keyWords('The Instagram reel for the brand')).toEqual(['instagram', 'reel', 'brand']);
    expect(mentionedIn(beats, 'Instagram reel')).toBe(12);
    expect(mentionedIn(beats, 'Instagram story about shoes')).toBeNull();
    expect(mentionedIn(beats, 'the and for')).toBeNull();
  });
});
