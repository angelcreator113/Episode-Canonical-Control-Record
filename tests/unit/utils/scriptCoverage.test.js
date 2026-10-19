// ============================================================================
// What a generated script covers (Evoni, 2026-10-15: "is it making sure
// everything is being done within the script?"). The same key-word rule as
// the Script tab's must-cover list, plus wear cues, phone moments on the
// phone beats, and beats that did not come back. Pure.
// ============================================================================

const { scriptCoverage, beatRequirements, replaceBeatByNumber, insertBeatByNumber, PHONE_BEATS } = require('../../../src/utils/scriptCoverage');

const beat = (n, name, ...lines) => [`## BEAT: ${n} · ${name}`, ...lines].join('\n');
const PIECE = '3f2a9c1e-0000-4000-8000-000000000001';
const full = (overrides = {}) => [
  beat(1, 'Opening Ritual', 'Me: hi'), beat(2, 'Login Sequence', 'Me: login'), beat(3, 'Welcome', 'Me: welcome'),
  beat(4, 'Interruption Pulse 1', '[UI:NOTIFY Sable: You are invited]'), beat(5, 'Reveal', '[UI:OPEN Mail]'),
  beat(6, 'Strategic Reaction', 'Lala: yes'), beat(7, 'Interruption Pulse 2', '[UI:DM Kelli: hey]'),
  overrides[8] || beat(8, 'Transformation Loop', '[UI:OPEN Closet]', 'Lala: the gold slip dress', `[WEAR: ${PIECE}]`),
  beat(9, 'Reminder / Deadline', '[UI:OPEN Todo]'), beat(10, 'Event Travel', '[UI:CLICK Location]'),
  overrides[11] || beat(11, 'Event Outcome', 'Lala: I finally get to meet Marcus Reed'),
  overrides[12] || beat(12, 'Deliverable Creation', '[UI:OPEN Camera]', 'Lala: filming the TikTok outfit reveal for Sable'),
  beat(13, 'Recap Panel', '[STAT: coins +300]'), overrides[14] || beat(14, 'Cliffhanger', 'Me: and then a DM from the Marcus agency'),
].join('\n\n');
const facts = {
  deliverables: [{ description: 'TikTok outfit reveal' }],
  goals: [{ label: 'Meet Marcus Reed' }],
  forwardHook: 'A DM from the Marcus agency',
  lockedPieces: [{ id: PIECE, name: 'Gold slip dress' }],
};

describe('scriptCoverage', () => {
  test('a script that covers everything has nothing missing', () => {
    const { items, missing } = scriptCoverage(full(), facts);
    expect(missing).toEqual([]);
    // What she owes is not required on screen (Evoni, 2026-10-18).
    expect(items.find((i) => i.kind === 'deliverable')).toBeUndefined();
    expect(items.find((i) => i.kind === 'goal')).toMatchObject({ beat: 11, target: 11 });
    expect(items.find((i) => i.kind === 'hook')).toMatchObject({ beat: 14, target: 14 });
    expect(items.find((i) => i.kind === 'wear')).toMatchObject({ beat: 8, target: 8 });
    // Beat 12 is in the cutscene, not on her phone (Evoni, 2026-10-19).
    expect(PHONE_BEATS).toEqual([4, 5, 7, 8, 9, 10]);
  });

  test('names each gap and the beat it belongs in', () => {
    const script = full({
      8: beat(8, 'Transformation Loop', 'Lala: the gold slip dress'),
      12: beat(12, 'Deliverable Creation', 'Lala: a quiet moment'),
      14: beat(14, 'Cliffhanger', 'Me: bye'),
    });
    const kinds = scriptCoverage(script, facts).missing.map((m) => [m.kind, m.target]);
    expect(kinds).toEqual([['hook', 14], ['wear', 8], ['phone', 8]]);
  });

  test('a reply cut off loses its last beats, and each is missing', () => {
    const cut = full().split('## BEAT: 13')[0];
    const missing = scriptCoverage(cut, {}).missing.filter((m) => m.kind === 'beat');
    expect(missing.map((m) => m.target)).toEqual([13, 14]);
  });

  test('requirements read as instructions for the beat', () => {
    const reqs = beatRequirements([{ kind: 'wear', label: 'Gold slip dress', id: PIECE }, { kind: 'phone', label: 'CLOSET_OPEN' }]);
    expect(reqs[0]).toContain(`[WEAR: ${PIECE}]`);
    expect(reqs[1]).toContain('[UI:VERB Target]');
  });
});

describe('putting a beat in its place', () => {
  const script = `[EVENT: gala]\n\n${beat(1, 'Opening Ritual', 'a')}\n\n${beat(3, 'Welcome', 'c')}`;
  test('replaces a beat by its number, leaving the rest as it is', () => {
    expect(replaceBeatByNumber(script, 3, beat(3, 'Welcome', 'C!'))).toBe(`[EVENT: gala]\n\n${beat(1, 'Opening Ritual', 'a')}\n\n${beat(3, 'Welcome', 'C!')}`);
    expect(replaceBeatByNumber(script, 7, beat(7, 'X', 'x'))).toBe(script);
  });
  test('inserts a missing beat after the last one numbered below it', () => {
    expect(insertBeatByNumber(script, 2, beat(2, 'Login Sequence', 'b'))).toBe(`[EVENT: gala]\n\n${beat(1, 'Opening Ritual', 'a')}\n\n${beat(2, 'Login Sequence', 'b')}\n\n${beat(3, 'Welcome', 'c')}`);
    expect(insertBeatByNumber(script, 1, beat(1, 'Opening Ritual', 'again'))).toBe(script);
  });
});

// Script tab re-audit (2026-10-15): a script with Windows line ends is read
// beat by beat, not as 14 missing beats.
test('Windows line ends do not hide the beats', () => {
  const crlf = Array.from({ length: 14 }, (_, i) => `## BEAT: ${i + 1}\r\nMe: hi`).join('\r\n\r\n');
  expect(scriptCoverage(crlf).missing.filter((g) => g.kind === 'beat')).toEqual([]);
});

// Beat 14's opportunity, checked for real (Script page audit, 2026-10-19):
// there only when beat 14 has a [UI:DM …] or [UI:NOTIFY …] line naming it.
describe("scriptCoverage: beat 14's opportunity", () => {
  const opp = { opportunity: { name: 'Sable Campaign Shoot', from: 'Sable Reyes' } };
  const at = (script) => scriptCoverage(script, opp).items.find((i) => i.kind === 'opportunity').beat;
  test('a DM or notification in beat 14 naming it covers it', () => {
    expect(at(full({ 14: beat(14, 'Cliffhanger', '[UI:DM Sable Reyes: The Sable campaign shoot is yours.]') }))).toBe(14);
    expect(at(full({ 14: beat(14, 'Cliffhanger', '[UI:NOTIFY Sable Reyes: Sable campaign shoots, next month?]') }))).toBe(14);
  });
  test('named in another beat, or spoken in beat 14, it is not delivered', () => {
    expect(at(full({ 11: beat(11, 'Event Outcome', '[UI:DM Sable Reyes: The Sable campaign shoot is yours.]') }))).toBeNull();
    expect(at(full({ 14: beat(14, 'Cliffhanger', 'Lala: the Sable campaign shoot!') }))).toBeNull();
  });
  test('the hook is told through the invitation, not a second ending', () => {
    const { missing } = scriptCoverage(full({ 14: beat(14, 'Cliffhanger', 'Me: bye') }), { ...opp, forwardHook: 'A second invitation arrives' });
    const hook = missing.find((g) => g.kind === 'hook');
    expect(hook.via).toBe('invitation');
    expect(beatRequirements([hook])).toEqual(['Tell the forward hook through the invitation the beat ends on: "A second invitation arrives".']);
    const alone = scriptCoverage(full({ 14: beat(14, 'Cliffhanger', 'Me: bye') }), { forwardHook: 'A second invitation arrives' }).missing.find((g) => g.kind === 'hook');
    expect(beatRequirements([alone])).toEqual(['End on the forward hook: "A second invitation arrives".']);
  });
});
