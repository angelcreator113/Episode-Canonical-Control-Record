/**
 * What is on screen in a script beat (Task #2789): UI lines read as moments
 * and find the phone screen or overlay they name.
 */
import { describe, test, expect } from 'vitest';
import { parseMoment, resolveMoment, momentLine, verbLabel, beatOnScreen, phoneIcons, EXPECTED_ON_SCREEN } from './scriptMoments';

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

describe("the phone's icons (Task #2801)", () => {
  const screens = [
    { id: 'home', name: 'Home', is_home: true, screen_links: [
      { id: 'z1', label: 'Mail', target: 'mail', icon_overlay_id: 'mail_icon' },
      { id: 'z2', label: 'Closet', target: 'closet', icon_url: 'https://x/closet-icon.png' },
      { id: 'z3', label: 'Home', target: 'home', persistent: true },
    ] },
    { id: 'mail', name: 'Mail', screen_links: [
      { id: 'z4', label: 'Letter', actions: [{ type: 'navigate', target: 'letter' }] },
    ] },
    { id: 'letter', name: 'Invitation Letter', screen_links: [] },
    { id: 'closet', name: 'Closet' },
  ];
  const art = [{ id: 'mail_icon', name: 'Mail', category: 'phone_icon', url: 'https://x/mail-icon.png' }];
  const icons = phoneIcons(screens, art);

  test('every icon, the screen it sits on, what it opens, and the taps from home', () => {
    expect(icons.map((i) => [i.key, i.name, i.onName, i.opensName, i.path, i.url])).toEqual([
      ['mail_icon', 'Mail', 'Home', 'Mail', ['mail_icon'], 'https://x/mail-icon.png'],
      ['closet', 'Closet', 'Home', 'Closet', ['closet'], 'https://x/closet-icon.png'],
      ['home', 'Home', 'Every screen', 'Home', ['home'], null],
      ['letter', 'Letter', 'Mail', 'Invitation Letter', ['mail_icon', 'letter'], null],
    ]);
  });

  test('a tap finds the icon; opening by name still finds the screen', () => {
    const on = { screens, icons };
    expect(resolveMoment(parseMoment('[UI:CLICK mail_icon]'), on)).toEqual({ kind: 'icon', name: 'Mail', url: 'https://x/mail-icon.png', opens: 'Mail', on: 'Home' });
    expect(resolveMoment(parseMoment('[UI:CLICK MailIcon]'), on)).toMatchObject({ kind: 'icon', name: 'Mail' });
    expect(resolveMoment(parseMoment('[UI:TAP Letter]'), on)).toMatchObject({ kind: 'icon', opens: 'Invitation Letter', on: 'Mail' });
    expect(resolveMoment(parseMoment('[UI:OPEN mail]'), on)).toMatchObject({ kind: 'phone', name: 'Mail' });
  });

  test('tapping icons changes the screen on the phone, one at a time', () => {
    const r = beatOnScreen(['[UI:SHOW phone]', '[UI:CLICK mail_icon]', '[UI:CLICK letter]', 'Lala: oh!'], { screens, icons });
    expect(r.withByLine[1]).toEqual(["Lala's phone"]);
    expect(r.withByLine[2]).toEqual(["Lala's phone"]);
    expect(r.phoneDownAt).toEqual([]);
    expect(beatOnScreen(['[UI:CLICK mail_icon]'], { screens, icons }).phoneDownAt).toEqual([0]);
  });

  test('no home screen: each icon is its own one tap', () => {
    expect(phoneIcons([{ id: 'mail', name: 'Mail', screen_links: [{ label: 'Letter', target: 'letter' }] }]).map((i) => i.path)).toEqual([['letter']]);
  });
});
