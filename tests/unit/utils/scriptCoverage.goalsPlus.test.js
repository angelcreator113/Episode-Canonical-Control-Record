// ============================================================================
// Goals that tick by more of their names (Evoni, 2026-10-23): a person's
// "also known as" names (social_profiles.aliases), the brand goal by the
// brand (its Pulse account's names, else the event's brand name), and the
// line that covered the goal, returned with its beat. Pure.
// ============================================================================

const { goalPerson, personLine, eventCast } = require('../../../src/utils/scriptRuleChecks');
const { goalCovered, scriptCoverage } = require('../../../src/utils/scriptCoverage');

const beat = (n, ...lines) => ({ number: n, text: [`## BEAT: ${n} · Event Outcome`, ...lines].join('\n') });
const EVENT = {
  host: 'Celeste Rue',
  host_brand: 'Studio by Sable',
  source_profile_id: 5,
  canon_consequences: { automation: { guest_profiles: [
    { profile_id: 9, display_name: 'Truthville', handle: 'truthville' },
    { profile_id: 11, display_name: 'Dana Hale', handle: 'danahale' },
  ] } },
};
const PROFILES = [
  { id: 5, creator_name: 'Celeste Rue', display_name: 'Celeste Studio', handle: 'celesterue' },
  { id: 9, creator_name: 'Marcus Hale', display_name: 'Truthville', handle: 'mhale_styles', aliases: ['Truth', 'TV', '  '] },
  { id: 11, creator_name: 'Dana Hale', display_name: 'Dana Hale', handle: 'danahale', aliases: '["DeeDee"]' },
  { id: 40, display_name: 'Studio by Sable', handle: 'studiobysable', aliases: ['Sable', 'Studio'], full_profile: { account: 'brand' } },
];
const GUEST = { slot: 'relationship_guest', label: 'Get to know Truthville' };
const BRAND = { slot: 'relationship_brand', label: 'Co-style a moment with Studio by Sable', profile_id: 40 };
const OLD_BRAND = { slot: 'relationship_brand', label: 'Co-style a moment with Studio by Sable' };

describe('also known as', () => {
  test("a person's aliases are names of theirs; one under 3 letters is not", () => {
    const p = goalPerson(GUEST, EVENT, PROFILES);
    expect(p.names).toEqual(expect.arrayContaining(['truth', 'truthville', 'marcus hale']));
    expect(p.names).not.toContain('tv');
    expect(goalPerson({ slot: 'relationship_guest', label: 'x', profile_id: 11 }, EVENT, PROFILES).names).toContain('deedee');
  });
  test('a goal ticks when the script calls them by an alias, speaking or named', () => {
    const p = goalPerson(GUEST, EVENT, PROFILES);
    expect(goalCovered([beat(11, 'Lala: "Truth! I want to know you."')], GUEST, p)).toMatchObject({ beat: 11, as: 'Truth' });
    expect(goalCovered([beat(11, 'Truth: You must be Lala.', 'Lala: I want to know you.')], GUEST, p)?.beat).toBe(11);
    // An alias is a name like any other: the word, whole, is them.
    expect(goalCovered([beat(11, 'Lala: "The truth is I want to know you."')], GUEST, p)).toMatchObject({ beat: 11, as: 'Truth' });
  });
  test('an alias another of the event\'s people has, whole or as a first name, never counts', () => {
    const profiles = PROFILES.map((x) => (x.id === 11 ? { ...x, aliases: ['Truth'] } : x));
    const p = goalPerson(GUEST, EVENT, profiles);
    expect(p.names).not.toContain('truth');
    expect(p.shared).toContain('truth');
    expect(goalCovered([beat(11, 'Truth: I want to know you.')], GUEST, p)).toBeNull();
    const marcus = PROFILES.map((x) => (x.id === 11 ? { ...x, creator_name: 'Truth Okafor' } : x));
    expect(goalPerson(GUEST, EVENT, marcus).names).not.toContain('truth');
  });
  test('the cast reads aliases too (beat 11 knows "Truth:")', () => {
    const event = { ...EVENT, canon_consequences: { automation: { guest_profiles: [{ profile_id: 9, display_name: 'Truthville', featured: true }] } } };
    expect(eventCast(event, PROFILES).find((c) => c.name === 'Marcus Hale').aliases).toEqual(expect.arrayContaining(['Truth']));
  });
});

describe('the brand goal', () => {
  test("a brand goal is the brand: its account's names and the event's brand name, whole only", () => {
    const p = goalPerson(BRAND, EVENT, PROFILES);
    expect(p).toMatchObject({ id: '40', whole: true });
    expect(p.names).toEqual(expect.arrayContaining(['studio by sable', 'studiobysable', 'sable']));
    // No first words, and no common word alone.
    expect(p.names).not.toContain('studio');
  });
  test('an older brand goal, with no profile_id, has the event\'s brand name', () => {
    const p = goalPerson(OLD_BRAND, EVENT, PROFILES);
    expect(p).toMatchObject({ id: null, names: ['studio by sable'], whole: true });
    expect(goalPerson(OLD_BRAND, { ...EVENT, host_brand: null }, PROFILES)).toBeNull();
    const auto = { canon_consequences: { automation: { host_brand: 'Velour' } } };
    expect(goalPerson({ slot: 'relationship_brand', label: 'Co-style a moment with Velour' }, auto, []).names).toEqual(['velour']);
  });
  test('it ticks when the brand is named with the rest of the goal, or speaks', () => {
    const p = goalPerson(BRAND, EVENT, PROFILES);
    expect(goalCovered([beat(11, 'Lala: "Sable, let us co-style a moment."')], BRAND, p)).toMatchObject({ beat: 11, as: 'Sable' });
    expect(goalCovered([beat(11, 'Studio by Sable: Co-style a moment with us?')], BRAND, p)?.beat).toBe(11);
    expect(goalCovered([beat(11, 'Lala: "@studiobysable wants to co-style a moment!"')], BRAND, p)?.beat).toBe(11);
  });
  test('a single common word of its name is not the brand', () => {
    const p = goalPerson(BRAND, EVENT, PROFILES);
    // "Studio" alone, spoken or said, with the rest of the goal there (as
    // written, three of its four key words are there: not enough without the brand).
    expect(goalCovered([beat(11, 'Lala: "Let us co-style a moment in the studio."')], BRAND, p)).toBeNull();
    expect(goalCovered([beat(11, 'Studio: Co-style a moment?')], BRAND, p)).toBeNull();
    expect(personLine(['Sable Reyes: hi'], p)).toEqual({ as: 'Sable', line: 'Sable Reyes: hi' });
    // A brand whose only name is a common word names nobody.
    expect(goalPerson({ slot: 'relationship_brand', label: 'Co-style a moment with The Studio' }, { host_brand: 'The Studio' }, [])).toBeNull();
  });
  test("a brand name another of the event's people has is not the brand's", () => {
    const event = { ...EVENT, host_brand: 'Celeste Studio' };
    expect(goalPerson({ slot: 'relationship_brand', label: 'Co-style a moment with Celeste Studio' }, event, PROFILES)).toBeNull();
  });
});

describe('the line that covered it', () => {
  const p = () => goalPerson(GUEST, EVENT, PROFILES);
  test("the person's line, the one with most of the goal's words", () => {
    const m = goalCovered([beat(11, 'Me: the gala is loud', 'Marcus Hale: You must be Lala.', 'Lala: "Marcus, I want to know you."')], GUEST, p());
    expect(m).toEqual({ beat: 11, line: 'Lala: "Marcus, I want to know you."', as: 'Marcus' });
  });
  test('as written: the line with the goal, and the name in it', () => {
    const m = goalCovered([beat(11, 'Me: hello', 'Lala: "I want to get to know Truthville."')], GUEST, p());
    expect(m).toEqual({ beat: 11, line: 'Lala: "I want to get to know Truthville."', as: 'Truthville' });
    expect(goalCovered([beat(11, 'Lala: "I want to get to know Truthville."')], GUEST, null)).toEqual({ beat: 11, line: 'Lala: "I want to get to know Truthville."', as: null });
  });
  test("scriptCoverage's goal item carries the line", () => {
    const script = '## BEAT: 11 · Event Outcome\nMe: so loud\nTruth: I want to know you, Lala.';
    const { items } = scriptCoverage(script, { goals: [{ ...GUEST, person: p() }, { label: 'Get to know Dana' }] });
    const goals = items.filter((i) => i.kind === 'goal');
    expect(goals[0]).toMatchObject({ beat: 11, line: 'Truth: I want to know you, Lala.' });
    expect(goals[1]).toMatchObject({ beat: null });
    expect(goals[1].line).toBeUndefined();
  });
});
