import { describe, test, expect } from 'vitest';
import { phoneNeeds, scriptBeats, screenNameFor, buildPlan, beatsLabel, isEmptyZone } from './episodePhoneNeeds';
import { PHONE, SCRIPT } from './episodePhoneNeeds.testutil';


const byName = (needs, name) => needs.find((n) => n.name === name);

describe('scriptBeats', () => {
  test('numbers headed beats by their label, and splits an unheaded script by place', () => {
    expect(scriptBeats(SCRIPT).map((b) => b.number)).toEqual([4, 5, 8, 12]);
    expect(scriptBeats('a\nb\n[UI:OPEN Mail]').map((b) => b.lines)).toEqual([['a'], ['b'], ['[UI:OPEN Mail]']]);
    expect(scriptBeats('')).toEqual([]);
    expect(scriptBeats(null)).toEqual([]);
  });
});

describe('phoneNeeds', () => {
  const read = phoneNeeds(SCRIPT, PHONE);

  test('lists each screen the script needs, with its beats, in the order the script reaches them', () => {
    expect(read.hasScript).toBe(true);
    expect(read.needs.map((n) => n.name)).toEqual(['Mail', 'Invitation', 'Closet', 'Bank']);
    expect(byName(read.needs, 'Mail').beats).toEqual([4, 5]);
    expect(byName(read.needs, 'Invitation').beats).toEqual([5]);
  });

  test('each status: exists, no tap zone to reach it, content zone empty, no picture, missing', () => {
    expect(byName(read.needs, 'Mail').status).toBe('ok');
    const inv = byName(read.needs, 'Invitation');
    expect(inv.issues).toEqual(['unreachable', 'empty']);
    expect(inv.emptyZones.map((z) => z.id)).toEqual(['cz1']);
    expect(byName(read.needs, 'Closet').issues).toEqual(['unmade', 'unreachable']);
    const bank = byName(read.needs, 'Bank');
    expect(bank.status).toBe('missing');
    expect(bank.screen).toBeNull();
  });

  test('a tap zone to a screen goes on the screen the phone shows just before the script opens it', () => {
    expect(byName(read.needs, 'Invitation').fromScreen.name).toBe('Mail');
    expect(byName(read.needs, 'Closet').from).toBe('mail');
    // Bank is opened from the Closet, the screen before it.
    expect(byName(read.needs, 'Bank').from).toBe('closet');
  });

  test('the path problems are the taps the phone check flags', () => {
    expect(read.problems).toEqual([{ beat: 5, text: 'Mail is on Homepage, but the phone shows Invitation' }]);
  });

  test('overlays, messages and the cutscene are not phone screens to make', () => {
    expect(read.needs.find((n) => /HUD|Camera|Bestie/.test(n.name))).toBeUndefined();
  });

  test('the Start button is not a screen; a tap on something that is not an icon is a path problem, not a screen to make', () => {
    const r = phoneNeeds('## BEAT: 1\n[UI:CLICK Start]\n## BEAT: 6\n[UI:CLICK VoiceIcon]', PHONE);
    expect(r.needs).toEqual([]);
    expect(r.problems).toEqual([{ beat: 6, text: 'VoiceIcon is not an icon on the phone' }]);
  });

  test('an icon that opens no screen is a path problem', () => {
    const phone = [{ ...PHONE[0], screen_links: [{ id: 'z-x', label: 'Wallet', target: '' }] }];
    const r = phoneNeeds('## BEAT: 3\n[UI:CLICK Wallet]', phone);
    expect(r.problems).toEqual([{ beat: 3, text: 'Wallet opens no screen' }]);
  });

  test('no script, and a script with no phone screen', () => {
    expect(phoneNeeds('', PHONE)).toMatchObject({ hasScript: false, needs: [], problems: [] });
    expect(phoneNeeds('## BEAT: 1\nLALA: Hello.', PHONE)).toMatchObject({ hasScript: true, needs: [] });
  });
});

describe('helpers', () => {
  test('a new screen is named without the generic words', () => {
    expect(screenNameFor('InviteLetterOverlay')).toBe('Invite');
    expect(screenNameFor('Bank Page')).toBe('Bank');
    expect(screenNameFor('closet x3')).toBe('Closet');
  });
  test('beat labels', () => {
    expect(beatsLabel([5])).toBe('beat 5');
    expect(beatsLabel([5, 8])).toBe('beats 5 and 8');
    expect(beatsLabel([2, 5, 8])).toBe('beats 2, 5 and 8');
  });
  test('an empty content zone has a kind and no settings', () => {
    expect(isEmptyZone({ content_type: 'dm_thread' })).toBe(true);
    expect(isEmptyZone({ content_type: 'dm_thread', content_config: {} })).toBe(true);
    expect(isEmptyZone({ content_type: 'dm_thread', content_config: { thread_id: 't' } })).toBe(false);
    expect(isEmptyZone({ id: 'z' })).toBe(false);
  });
});

describe('buildPlan', () => {
  test('makes, then reaches (a made screen counts), then fills; the AI calls it may spend', () => {
    const plan = buildPlan(phoneNeeds(SCRIPT, PHONE).needs);
    expect(plan.make.map((n) => n.name)).toEqual(['Closet', 'Bank']);
    expect(plan.reach.map((n) => n.name)).toEqual(['Invitation', 'Closet', 'Bank']);
    expect(plan.fill.map((f) => f.zone.id)).toEqual(['cz1']);
    expect(plan.calls).toEqual({ pictures: 2, zones: 3, fills: 1 });
    expect(plan.total).toBe(6);
  });
  test('nothing to do', () => {
    expect(buildPlan(phoneNeeds('## BEAT: 4\n[UI:CLICK Mail]', PHONE).needs).total).toBe(0);
  });
});
