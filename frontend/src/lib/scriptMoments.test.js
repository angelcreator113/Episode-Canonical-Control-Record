/**
 * What is on screen in a script beat (Task #2789): UI lines read as moments
 * and find the phone screen or overlay they name.
 */
import { describe, test, expect } from 'vitest';
import { parseMoment, resolveMoment, momentLine, verbLabel, beatOnScreen, phoneIcons, EXPECTED_ON_SCREEN, closetBeat, hasPhoneMoment, beatSpeakers, phoneCheck } from './scriptMoments';

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

describe("the script's closet beat (Task #2880)", () => {
  const S = (...beats) => beats.join('\n');
  test('the beat whose lines open the closet', () => {
    expect(closetBeat(S('## BEAT: 1 · Opening Ritual', 'Prime: "Hi."', '## BEAT: 8 · Transformation Loop', '[UI:OPEN ClosetCategory Outfit]'))).toBe(8);
    expect(closetBeat(S('## BEAT: 1 · Opening Ritual', '## BEAT: 9 · Reminder', '[UI:OPEN closet]'))).toBe(9);
  });
  test('else the canonical closet beat, when the script has it', () => {
    expect(closetBeat(S('## BEAT: 1 · Opening Ritual', '## BEAT: 8 · Transformation Loop', 'Prime: "Getting ready."'))).toBe(8);
  });
  test('no beat at all when the script has none', () => {
    expect(closetBeat('')).toBeNull();
    expect(closetBeat(null)).toBeNull();
    expect(closetBeat('Prime: "No headers here."\n[UI:OPEN closet]')).toBeNull();
    expect(closetBeat(S('## BEAT: 1 · Opening Ritual', '## BEAT: 2 · Login', '[UI:OPEN MailIcon]'))).toBeNull();
  });
  test("a canonical beat's name is its number; any other name is numbered by its place", () => {
    // Script tab audit (2026-10-15): the skeleton's TRANSFORMATION is beat 8.
    expect(closetBeat(S('## BEAT: OPENING', 'x', '## BEAT: TRANSFORMATION', '[UI:OPEN ClosetCategory Outfit]'))).toBe(8);
    expect(closetBeat(S('## BEAT: OPENING', 'x', '## BEAT: Getting ready', '[UI:OPEN ClosetCategory Outfit]'))).toBe(2);
  });
});

describe('the Script tab beat list (Task #2881)', () => {
  const on = { screens: [{ id: 'mail', name: 'Mail' }], overlays: [{ key: 'invite', label: 'Invitation' }] };
  test('a phone moment: the phone itself, or one of its screens', () => {
    expect(hasPhoneMoment(['[UI:SHOW phone]'], on)).toBe(true);
    expect(hasPhoneMoment(['Prime: "Hi."', '[UI:OPEN Mail]'], on)).toBe(true);
    expect(hasPhoneMoment(['[UI:DISPLAY Invitation]'], on)).toBe(false);
    expect(hasPhoneMoment(['Prime: "No moment."'], on)).toBe(false);
    expect(hasPhoneMoment(['[UI:OPEN Unknown]'], on)).toBe(false);
  });
  test('who speaks, in order; Me is Prime; UI lines and narration are no one', () => {
    expect(beatSpeakers(['Me: "Hi."', '[UI:OPEN Mail]', 'Lala: "Hey."', 'Prime: "Again."', '(She smiles.)', 'A narration line.'])).toEqual(['Prime', 'Lala']);
    expect(beatSpeakers([])).toEqual([]);
  });
});

describe("the open beat's phone check (Task #2884)", () => {
  const screens = [
    { id: 'home', name: 'Home', is_home: true, screen_links: [{ label: 'Mail', target: 'mail' }] },
    { id: 'mail', name: 'Mail', screen_links: [{ label: 'Reply', target: 'reply' }] },
    { id: 'reply', name: 'Reply' },
  ];
  const on = { screens, icons: phoneIcons(screens), overlays: [{ key: 'invite', label: 'Invitation', image_url: null }, { key: 'title', label: 'Show Title', image_url: 'https://x/t.png' }] };
  test('taps that follow the phone are real paths', () => {
    const r = phoneCheck(['[UI:CLICK Mail]', 'Lala: "A message."', '[UI:CLICK Reply]'], on);
    expect(r.moments).toBe(2);
    expect(r.taps.map((t) => [t.name, t.ok])).toEqual([['Mail', true], ['Reply', true]]);
    expect(r.missing).toEqual([]);
  });
  test('a tap on an icon that is not on the screen showing says where it is', () => {
    const r = phoneCheck(['[UI:CLICK Reply]'], on);
    expect(r.taps).toEqual([{ i: 0, name: 'Reply', ok: false, why: 'Reply is on Mail, but the phone shows Home' }]);
  });
  test('opening a screen by name moves the phone there', () => {
    expect(phoneCheck(['[UI:OPEN Mail]', '[UI:CLICK Reply]'], on).taps[0].ok).toBe(true);
  });
  test('what is not made yet: an unknown tap, an unknown screen, an overlay with no picture', () => {
    const r = phoneCheck(['[UI:CLICK Wallet]', '[UI:OPEN Closet]', '[UI:DISPLAY Invitation]', '[UI:DISPLAY Show Title]', '[UI:HIDE Something]'], on);
    expect(r.missing.map((m) => m.name)).toEqual(['Wallet', 'Closet', 'Invitation']);
    expect(phoneCheck(['Prime: "No moments."'], on).moments).toBe(0);
  });
});

describe('phoneCheck carries the screen between beats (Script tab audit, 2026-10-15)', () => {
  const on = {
    screens: [{ id: 'home', name: 'Home', is_home: true }, { id: 'closet', name: 'Closet' }],
    icons: [{ key: 'shoes', name: 'Shoes', on: 'closet', onName: 'Closet', opens: null }],
  };
  test('a beat that opens the closet ends there, and the next beat starts there', () => {
    const first = phoneCheck(['[UI:OPEN Closet]'], on);
    expect(first.endAt).toBe('closet');
    expect(phoneCheck(['[UI:CLICK Shoes]'], on).taps[0].ok).toBe(false);
    expect(phoneCheck(['[UI:CLICK Shoes]'], on, { startAt: first.endAt }).taps[0].ok).toBe(true);
  });
});

// Script tab re-audit (2026-10-15): a lowercase [ui:] line is a moment too.
test('a lowercase ui line is a moment', () => {
  expect(parseMoment('[ui:OPEN closet]')).toEqual({ verb: 'OPEN', target: 'closet' });
});

// Re-audit 2 (2026-10-15): who speaks, by the tab's own rule.
test('beatSpeakers reads speakers as the tab does', () => {
  expect(beatSpeakers(['LALA: hi', 'Note: x', 'Lala (V.O.): y', 'Mary Jane: z', 'Location: the gala', 'Me: go'])).toEqual(['Lala', 'Mary Jane', 'Prime']);
});

