// ============================================================================
// A relationship goal is covered when its person is really there (Evoni,
// 2026-10-23: "Get to know Truthville" never ticked when the script named
// her by her real name). goalPerson finds who the goal is about; goalCovered
// ticks the goal when it is mentioned as written, or when the rest of its
// words are and the person is named by any of their names or speaks. Pure.
// ============================================================================

const { goalPerson, personIn } = require('../../../src/utils/scriptRuleChecks');
const { goalCovered, scriptCoverage } = require('../../../src/utils/scriptCoverage');

const beat = (n, ...lines) => ({ number: n, text: [`## BEAT: ${n} · Event Outcome`, ...lines].join('\n') });
const EVENT = {
  host: 'Celeste Rue',
  source_profile_id: 5,
  canon_consequences: { automation: { guest_profiles: [
    { handle: '' },
    { profile_id: 9, display_name: 'Truthville', handle: 'truthville' },
    { profile_id: 11, display_name: 'Dana Hale', handle: 'danahale' },
  ] } },
};
const PROFILES = [
  { id: 5, creator_name: 'Celeste Rue', display_name: 'Celeste Studio', handle: 'celesterue' },
  { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'mhale_styles' },
  { id: 11, creator_name: 'Dana Hale', display_name: 'Dana Hale', handle: 'danahale' },
];
const GUEST = { slot: 'relationship_guest', label: 'Get to know Truthville' };
const truthville = () => goalPerson(GUEST, EVENT, PROFILES);
const covered = (...lines) => goalCovered([beat(3, 'Me: hi'), beat(11, ...lines)], GUEST, truthville());

describe('goalPerson', () => {
  test('a guest goal is the first named guest, with every name of theirs and the first name', () => {
    const p = truthville();
    expect(p.id).toBe('9');
    expect(p.names).toEqual(['marcus hale', 'truthville', 'mhale_styles', 'marcus']);
    expect(p.shown).toEqual(['Marcus Hale', 'Truthville', 'mhale_styles', 'Marcus']);
    expect(p.names).not.toContain('hale');
  });
  test('a host goal is the source profile, else automation.host_profile_id; the event names it too', () => {
    const host = { slot: 'relationship_host', label: 'Follow up with Celeste Rue after the event' };
    expect(goalPerson(host, EVENT, PROFILES).id).toBe('5');
    const auto = { host: 'Celeste Rue', canon_consequences: JSON.stringify({ automation: { host_profile_id: 5, host_handle: 'cel' } }) };
    expect(goalPerson(host, auto, PROFILES).names).toEqual(expect.arrayContaining(['celeste rue', 'cel', 'celeste']));
  });
  test("the goal's own profile_id wins; a brand goal, or nobody known, is null", () => {
    expect(goalPerson({ ...GUEST, profile_id: 11 }, EVENT, PROFILES).id).toBe('11');
    expect(goalPerson({ slot: 'relationship_brand', label: 'Co-style a moment with Velour', profile_id: 5 }, EVENT, PROFILES)).toBeNull();
    expect(goalPerson(GUEST, {}, PROFILES)).toBeNull();
    expect(goalPerson({ slot: 'relationship', label: 'Meet someone' }, EVENT, PROFILES)).toBeNull();
  });
  test("a first name another of the event's people has is not theirs", () => {
    const event = { ...EVENT, canon_consequences: { automation: { guest_profiles: [...EVENT.canon_consequences.automation.guest_profiles, { profile_id: 12, display_name: 'Marcus Reed' }] } } };
    const p = goalPerson(GUEST, event, PROFILES);
    expect(p.names).not.toContain('marcus');
    expect(p.shared).toEqual(['marcus']);
    expect(personIn(['Marcus: hi'], p)).toBeNull();
    expect(personIn(['Marcus Hale: hi'], p)).toBe('Marcus Hale');
  });
});

describe('goalCovered', () => {
  test('her real name, her first name, her handle or her display name, with the rest of the goal', () => {
    expect(covered('Lala: "I have wanted to know you forever, Marcus Hale."')).toBe(11);
    expect(covered('Lala: "Marcus, I want to know everything."')).toBe(11);
    expect(covered('Lala: "So you are @mhale_styles! I want to know you."')).toBe(11);
    const stylist = { slot: 'relationship_guest', label: 'Get to know the stylist', profile_id: 9 };
    expect(goalCovered([beat(11, 'Lala: "Truthville, I want to know the stylist."')], stylist, goalPerson(stylist, EVENT, PROFILES))).toBe(11);
  });
  test('speaking is being there', () => {
    expect(covered('Marcus Hale: You must be Lala.', 'Lala: I have wanted to know you.')).toBe(11);
    expect(covered('**Marcus** (smiling): So you know my work?')).toBe(11);
  });
  test('the goal as written still covers it, with or without a person', () => {
    expect(goalCovered([beat(11, 'Lala: "I want to get to know Truthville."')], GUEST, null)).toBe(11);
    expect(covered('Lala: "I want to get to know Truthville."')).toBe(11);
  });
  test('a shared surname alone, or the person without the rest of the goal, is not covered', () => {
    expect(covered('Lala: "Hale, I want to know you."')).toBeNull();
    expect(covered('Me: the Hale family is here', 'Lala: I want to know them')).toBeNull();
    expect(covered('Marcus Hale: Hello.')).toBeNull();
  });
  test('a brand goal is read as written only', () => {
    const brand = { slot: 'relationship_brand', label: 'Co-style a moment with Velour' };
    expect(goalPerson(brand, EVENT, PROFILES)).toBeNull();
    expect(goalCovered([beat(11, 'Lala: "Let us co-style a moment, Velour."')], brand, null)).toBe(11);
    expect(goalCovered([beat(11, 'Celeste Rue: Co-style with me?')], brand, null)).toBeNull();
  });
  test('scriptCoverage ticks a goal by its person', () => {
    const script = '## BEAT: 11 · Event Outcome\nMarcus Hale: I want to know you, Lala.';
    const { items } = scriptCoverage(script, { goals: [{ ...GUEST, person: truthville() }, { label: 'Get to know Truthville' }] });
    expect(items.filter((i) => i.kind === 'goal').map((i) => i.beat)).toEqual([11, null]);
  });
});
