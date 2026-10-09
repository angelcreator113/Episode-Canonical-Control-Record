/**
 * What is on screen in a script beat (Task #2789): UI lines read as moments
 * and find the phone screen or overlay they name.
 */
import { describe, test, expect } from 'vitest';
import { parseMoment, resolveMoment, momentLine, verbLabel, beatOnScreen, EXPECTED_ON_SCREEN } from './scriptMoments';

const SCREENS = [
  { id: 'closet', name: 'Closet', url: 'https://x/closet.png' },
  { id: 'mail_inbox', name: 'Mail Inbox', url: 'https://x/mail.png' },
];
const OVERLAYS = [
  { key: 'invitation', label: 'Invitation', image_url: 'https://x/invite.png' },
  { key: 'shopping_list_doc', label: 'Shopping list', image_url: null },
];

describe('scriptMoments', () => {
  test('a UI line is a moment with its verb and target; anything else is not', () => {
    expect(parseMoment('[UI:OPEN closet]')).toEqual({ verb: 'OPEN', target: 'closet' });
    expect(parseMoment('  [UI:scroll ClosetItems x5] ')).toEqual({ verb: 'SCROLL', target: 'ClosetItems x5' });
    expect(parseMoment('[STAT: coins +5]')).toBeNull();
    expect(parseMoment('Lala: [UI:OPEN closet]')).toBeNull();
  });

  test('a moment finds its phone screen or overlay by key or name, loosely when it must', () => {
    const on = { screens: SCREENS, overlays: OVERLAYS };
    expect(resolveMoment(parseMoment('[UI:OPEN closet]'), on)).toEqual({ kind: 'phone', name: 'Closet', url: 'https://x/closet.png' });
    expect(resolveMoment(parseMoment('[UI:CLICK MailInbox]'), on)).toMatchObject({ kind: 'phone', name: 'Mail Inbox' });
    expect(resolveMoment(parseMoment('[UI:DISPLAY shopping_list_doc]'), on)).toEqual({ kind: 'overlay', name: 'Shopping list', url: null });
    // The skeleton's names: "InviteLetterOverlay" is the invitation, "ClosetItems x5" the closet, "MailPanel" the inbox.
    expect(resolveMoment(parseMoment('[UI:DISPLAY InviteLetterOverlay]'), on)).toMatchObject({ kind: 'overlay', name: 'Invitation' });
    expect(resolveMoment(parseMoment('[UI:OPEN MailPanel]'), on)).toMatchObject({ kind: 'phone', name: 'Mail Inbox' });
    expect(resolveMoment(parseMoment('[UI:SCROLL ClosetItems x5]'), on)).toMatchObject({ kind: 'phone', name: 'Closet' });
    expect(resolveMoment(parseMoment('[UI:OPEN LoginWindow]'), on)).toBeNull();
  });

  test('the line a picker writes, and how verbs read', () => {
    expect(momentLine('display', 'invitation')).toBe('[UI:DISPLAY invitation]');
    expect(parseMoment(momentLine('OPEN', 'closet'))).toEqual({ verb: 'OPEN', target: 'closet' });
    expect([verbLabel('OPEN'), verbLabel('CLICK'), verbLabel('DISPLAY'), verbLabel('CHECK_ITEM'), verbLabel('WAVE_HAND')])
      .toEqual(['Opens', 'Taps', 'Shows', 'Checks', 'Wave hand']);
  });

  test('every canonical beat says what it puts on screen', () => {
    expect(Object.keys(EXPECTED_ON_SCREEN).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(EXPECTED_ON_SCREEN[5]).toMatchObject({ what: 'The invitation letter, opened', where: "Lala's Phone → Full Screen" });
  });
});

describe('beatOnScreen (Task #2793)', () => {
  const on = { screens: [{ id: 'closet', name: 'Closet' }, { id: 'mail', name: 'Mail' }], overlays: [{ key: 'lower_third', label: 'Lower Third' }, { key: 'invitation', label: 'Invitation' }] };
  test('overlays stay on until hidden; the phone shows one screen at a time', () => {
    const { withByLine, used } = beatOnScreen([
      '[UI:DISPLAY lower_third]', 'Lala: hi', '[UI:OPEN mail]', '[UI:DISPLAY invitation]', '[UI:OPEN closet]', '[UI:HIDE lower_third]', '[UI:CLOSE closet]',
    ], on);
    expect(withByLine).toEqual({
      0: [], 2: ['Lower Third'], 3: ['Lower Third', 'Mail'], 4: ['Lower Third', 'Invitation'], 5: ['Invitation', 'Closet'], 6: ['Invitation'],
    });
    expect(used.map((u) => [u.name, u.kind])).toEqual([['Lower Third', 'overlay'], ['Mail', 'phone'], ['Invitation', 'overlay'], ['Closet', 'phone']]);
  });
});

describe("the phone itself (Task #2797)", () => {
  const on = { screens: [{ id: 'closet', name: 'Closet' }, { id: 'mail', name: 'Mail' }], overlays: [{ key: 'lower_third', label: 'Lower Third' }], phoneFrame: 'https://x/frame.png' };
  test('[UI:SHOW phone] is the phone, with its frame', () => {
    expect(resolveMoment(parseMoment('[UI:SHOW phone]'), on)).toEqual({ kind: 'device', name: "Lala's phone", url: 'https://x/frame.png' });
    expect(resolveMoment(parseMoment("[UI:HIDE Lala's Phone]"), on)).toMatchObject({ kind: 'device' });
  });
  test('it comes up, its screens show on it, and taking it away takes them too; a screen with no phone is flagged', () => {
    const r = beatOnScreen(['[UI:OPEN mail]', '[UI:SHOW phone]', '[UI:DISPLAY lower_third]', '[UI:OPEN closet]', '[UI:HIDE phone]'], on);
    expect(r.phoneDownAt).toEqual([0]);
    expect(r.withByLine[3]).toEqual(["Lala's phone", 'Lower Third']);
    expect(r.withByLine[4]).toEqual(['Lower Third']);
    expect(r.phoneUpAtEnd).toBe(false);
  });
  test('it carries in from an earlier beat', () => {
    const r = beatOnScreen(['[UI:OPEN closet]', 'Lala: cute'], on, { phoneUp: true });
    expect(r.phoneDownAt).toEqual([]);
    expect(r.withByLine[0]).toEqual(["Lala's phone"]);
    expect(r.phoneUpAtEnd).toBe(true);
  });
});
