/**
 * "THIS EPISODE MUST COVER" (Task #2884): only the episode's own data (the
 * event's deliverables and goals, the brief's forward hook), ticked when a
 * beat mentions it, with that beat's number.
 */
import { describe, test, expect } from 'vitest';
import { mustCover, mentionedIn, keyWords, quoteParts } from './episodeScript';

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

// A goal covered by its person (Evoni, 2026-10-23): the rest of the goal's
// words and the person by any name of theirs, or speaking, in one beat.
describe('must cover: a goal by its person', () => {
  const event = { canon_consequences: { automation: {
    relationship_goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville' }, { slot: 'relationship_brand', label: 'Co-style a moment with Velour' }],
    guest_profiles: [{ profile_id: 9, display_name: 'Truthville', handle: 'truthville' }, { profile_id: 11, display_name: 'Dana Hale' }],
  } } };
  const profiles = [{ id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'mhale_styles' }];
  const goal = (...lines) => mustCover({ beats: [{ number: 11, lines }], event, profiles })[0];
  test('her real name, first name or handle ticks it, and says who', () => {
    expect(goal('Lala: "I want to know you, Marcus Hale."')).toMatchObject({ beat: 11, slot: 'relationship_guest', who: { name: 'Truthville', as: 'Marcus Hale' } });
    expect(goal('Lala: "Marcus! I want to know you."').who).toEqual({ name: 'Truthville', as: 'Marcus' });
    expect(goal('Lala: "@mhale_styles, I want to know you."').beat).toBe(11);
  });
  test('speaking is being there', () => {
    expect(goal('Marcus Hale: You must be Lala.', 'Lala: I want to know you.')).toMatchObject({ beat: 11, who: { as: 'Marcus Hale' } });
  });
  test('the goal as written still ticks it, with no who', () => {
    const g = goal('Lala: "I want to get to know Truthville."');
    expect(g.beat).toBe(11);
    expect(g.who).toBeUndefined();
  });
  test('a shared surname, the person without the rest, or no profile read, does not', () => {
    expect(goal('Lala: "Hale, I want to know you."').beat).toBeNull();
    expect(goal('Marcus Hale: Hello.').beat).toBeNull();
    expect(mustCover({ beats: [{ number: 11, lines: ['Marcus Hale: I want to know you.'] }], event })[0].beat).toBeNull();
  });
  test('a brand goal is read as written only', () => {
    const items = mustCover({ beats: [{ number: 11, lines: ['Marcus Hale: let us co-style a moment'] }], event, profiles });
    expect(items[1]).toMatchObject({ slot: 'relationship_brand', beat: null });
  });
});

// Episode 1 feeds Episode 2 (Evoni, 2026-10-23): what Lala owes from an
// earlier episode is on the list, after the goals, matched like one.
describe('carried follow-ups', () => {
  const carried = [
    { slot: 'follow_up_f1', label: 'Follow up with Studio Bystable about the collab', task_source: 'goal', follow_up_id: 'f1' },
    { slot: 'follow_up_f2', label: 'Send Marcus the lookbook', task_source: 'goal', follow_up_id: 'f2' },
    { slot: 'plain', label: 'Not carried', task_source: 'goal' },
  ];
  const at = (line) => [{ number: 3, lines: [line] }];
  test('each one is listed as a follow-up with its slot; covered when the script says it', () => {
    const items = mustCover({ beats: at('Lala: "Time to follow up with Studio Bystable about the collab."'), carried });
    const owed = items.filter((i) => i.source === 'Follow-up');
    expect(owed).toEqual([
      { key: 'carried-f1', label: 'Follow up with Studio Bystable about the collab', source: 'Follow-up', slot: 'follow_up_f1', beat: 3 },
      { key: 'carried-f2', label: 'Send Marcus the lookbook', source: 'Follow-up', slot: 'follow_up_f2', beat: null },
    ]);
  });
  test('none carried, none listed', () => {
    expect(mustCover({ beats: at('Lala: hi'), carried: [] }).some((i) => i.source === 'Follow-up')).toBe(false);
    expect(mustCover({ beats: at('Lala: hi') }).some((i) => i.source === 'Follow-up')).toBe(false);
  });
});

// The line that covered a goal (Evoni, 2026-10-23): returned with the beat,
// quoted on the tab with the name it was matched by emphasised.
describe('must cover: the line', () => {
  const event = { host_brand: 'Studio by Sable', canon_consequences: { automation: {
    relationship_goals: [{ slot: 'relationship_guest', label: 'Get to know Truthville', profile_id: 9 }, { slot: 'relationship_brand', label: 'Co-style a moment with Studio by Sable', profile_id: 40 }],
    guest_profiles: [{ profile_id: 9, display_name: 'Truthville' }],
  } } };
  const profiles = [{ id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', aliases: ['Truth'] }, { id: 40, display_name: 'Studio by Sable', aliases: ['Sable', 'Studio'] }];
  const cover = (...lines) => mustCover({ beats: [{ number: 11, lines }], event, profiles });
  test('a covered goal has its line and the name to emphasise', () => {
    const [g] = cover('Me: so loud', 'Lala: "Truth, I want to know you."');
    expect(g).toMatchObject({ beat: 11, line: 'Lala: "Truth, I want to know you."', mark: 'Truth', who: { name: 'Truthville', as: 'Truth' } });
    const [lit] = cover('Lala: "I want to get to know Truthville."');
    expect(lit).toMatchObject({ beat: 11, line: 'Lala: "I want to get to know Truthville."', mark: 'Truthville' });
    expect(cover('Me: nobody')[0].line).toBeUndefined();
  });
  test('the brand goal ticks by the brand, never by a common word of its name', () => {
    expect(cover('Lala: "Sable! Co-style a moment?"')[1]).toMatchObject({ beat: 11, mark: 'Sable' });
    expect(cover('Lala: "Let us co-style a moment in the studio."')[1].beat).toBeNull();
    expect(cover('Studio: co-style a moment?')[1].beat).toBeNull();
  });
  test('quoteParts: the whole line when short, Markdown bold let go', () => {
    expect(quoteParts('**Truth**: hi there', 'Truth')).toEqual({ before: '', mark: 'Truth', after: ': hi there' });
    expect(quoteParts('Lala: no name here', 'Truth')).toEqual({ before: 'Lala: no name here', mark: null, after: '' });
    expect(quoteParts('', 'x')).toBeNull();
    expect(quoteParts(null)).toBeNull();
  });
  test('quoteParts: a long line is cut to about 140 characters around the name', () => {
    const line = `${'a'.repeat(200)} Truth ${'b'.repeat(200)}`;
    const q = quoteParts(line, 'Truth');
    expect(q.mark).toBe('Truth');
    expect(q.before.startsWith('…')).toBe(true);
    expect(q.after.endsWith('…')).toBe(true);
    expect((q.before + q.mark + q.after).length).toBeLessThanOrEqual(142);
    const start = quoteParts(`Truth ${'b'.repeat(300)}`, 'Truth');
    expect(start.before).toBe('');
    expect(start.after.endsWith('…')).toBe(true);
    const none = quoteParts('c'.repeat(300));
    expect(none.before.length).toBe(141);
  });
});
