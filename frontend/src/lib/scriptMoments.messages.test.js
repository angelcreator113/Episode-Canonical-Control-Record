/**
 * Notifications, DMs and Lala's posts in the script (Task #2885), and who
 * they can be from or with: the episode's own people.
 */
import { describe, test, expect } from 'vitest';
import { parseMoment, resolveMoment, messageOf, messageLine, hasPhoneMoment } from './scriptMoments';
import { scriptPeople } from './episodeScript';

describe('script messages', () => {
  test('a Notification, a DM and a Post read as who and the words', () => {
    expect(messageOf(parseMoment('[UI:NOTIFY STUDIO BY SABLE: You are invited]'))).toEqual({ kind: 'notify', name: 'Notification from STUDIO BY SABLE', who: 'STUDIO BY SABLE', text: 'You are invited', url: null });
    expect(messageOf(parseMoment('[UI:DM Marcus: See you there]'))).toMatchObject({ kind: 'dm', name: 'DM with Marcus', who: 'Marcus', text: 'See you there' });
    // A post is Lala's; a colon in it is part of the words.
    expect(messageOf(parseMoment('[UI:POST Tonight: statement look.]'))).toMatchObject({ kind: 'post', name: 'Lala posts', who: null, text: 'Tonight: statement look.' });
    expect(messageOf(parseMoment('[UI:OPEN Closet]'))).toBeNull();
  });

  test('resolveMoment reads a message before any screen', () => {
    expect(resolveMoment(parseMoment('[UI:POST Studio night.]'), { screens: [], overlays: [] })).toMatchObject({ kind: 'post', text: 'Studio night.' });
  });

  test('messageLine writes the line, and nothing without words', () => {
    expect(messageLine('notify', 'STUDIO BY SABLE', 'You are invited')).toBe('[UI:NOTIFY STUDIO BY SABLE: You are invited]');
    expect(messageLine('dm', 'Mar:cus', '  See   you [there] ')).toBe('[UI:DM Marcus: See you there]');
    expect(messageLine('dm', '', 'Hi')).toBe('[UI:DM Hi]');
    expect(messageLine('post', 'ignored', 'Studio night.')).toBe('[UI:POST Studio night.]');
    expect(messageLine('post', null, '   ')).toBeNull();
    expect(messageLine('nope', null, 'x')).toBeNull();
  });

  test('a message is a phone moment', () => {
    expect(hasPhoneMoment(['[UI:DM Marcus: Hi]'], { screens: [], overlays: [] })).toBe(true);
  });
});

describe('scriptPeople', () => {
  test("the event's host, its guests featured first, then who speaks; each once", () => {
    const event = { host_brand: 'STUDIO BY SABLE', canon_consequences: { automation: { guest_profiles: [{ handle: 'quiet_one' }, { display_name: 'Marcus', featured: true }, null] } } };
    const beats = [{ lines: ['Lala: "Hi."', 'Marcus: "Hey."', 'Prime: "Okay."'] }];
    const people = scriptPeople({ event, beats });
    expect(people).toEqual(['STUDIO BY SABLE', 'Marcus', 'quiet_one', 'Prime']);
    expect(people.filter((p) => p === 'Marcus')).toHaveLength(1);
    expect(people).not.toContain('Lala');
  });

  test('no event and no speakers: nobody to offer', () => {
    expect(scriptPeople({ event: null, beats: [{ lines: ['(She waits.)'] }] })).toEqual([]);
  });
});
