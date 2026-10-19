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

// Beat 14's opportunity (Script page audit, 2026-10-19): ticked only when
// beat 14 delivers it as a DM or notification naming it.
describe("beat 14's opportunity", () => {
  const opp = { name: 'Sable Campaign Shoot' };
  const cover = (b, o = opp) => mustCover({ beats: b, opportunity: o }).find((i) => i.key === 'opportunity');
  test('a [UI:DM] or [UI:NOTIFY] line in beat 14 naming it ticks it, at beat 14', () => {
    expect(cover([{ number: 14, lines: ['[UI:DM Sable Reyes: The Sable campaign shoot is yours if you want it.]'] }]).beat).toBe(14);
    expect(cover([{ number: 14, lines: ['[UI:NOTIFY Sable Reyes: sable CAMPAIGN shoots, next month]'] }]).beat).toBe(14);
  });
  test('a mention in another beat, or a spoken line in beat 14, does not', () => {
    expect(cover([{ number: 11, lines: ['[UI:DM Sable Reyes: The Sable campaign shoot is yours.]'] }, { number: 14, lines: ['Me: wow'] }]).beat).toBeNull();
    expect(cover([{ number: 14, lines: ['Lala: "The Sable campaign shoot!"'] }]).beat).toBeNull();
    expect(cover([{ number: 14, lines: ['[UI:DM Sable Reyes: see you soon]'] }]).beat).toBeNull();
  });
  test('a short name is matched as a phrase, plural or not', () => {
    expect(cover([{ number: 14, lines: ['[UI:DM Marcus: Two VIPs passes for you.]'] }], { name: 'VIP' }).beat).toBe(14);
    expect(cover([{ number: 14, lines: ['[UI:NOTIFY Marcus: A seat at The Met, darling.]'] }], { name: 'The Met' }).beat).toBe(14);
    expect(cover([{ number: 14, lines: ['[UI:NOTIFY Marcus: We met at the gala.]'] }], { name: 'The Met' }).beat).toBeNull();
  });
  test('no opportunity passed, no item', () => {
    expect(mustCover({ beats: [{ number: 14, lines: [] }], opportunity: null })).toEqual([]);
  });
});
