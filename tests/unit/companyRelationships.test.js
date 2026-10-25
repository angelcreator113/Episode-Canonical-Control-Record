/**
 * Companies in relationships (Evoni, 2026-10-24: her Season Plan listed
 * "Lala ↔ The Column" thirteen times, then "how should we handle
 * relationships between brands?"), the pure parts:
 *   - the name matcher: "The" of "The Column" is never a first name, and a
 *     first name alone counts only written capitalised
 *   - the same stoplist in goalPerson (shared with the frontend copy) and
 *     storyRipples' reveal check
 *   - the company types: mapping any type to one, and refusing a romance
 *     or family for a company pair
 *   - companyOf, looksLikeCompany, guessKind
 *   - the type tidy-up's proposal for a company pair
 *   - a season need with a company in it, there by a deal, a representative
 *     or a confirmed relationship
 *   - Generate's answer for a company pair
 */
const { nameMatcher, classify } = require('../../src/services/seasonNeeds');
const { usableFirstName, NOT_FIRST_NAMES } = require('../../src/utils/firstNames');
const scriptRules = require('../../src/utils/scriptRuleChecks');
const { isReveal } = require('../../src/services/storyRipples');
const types = require('../../src/services/relationshipTypes');
const { companyOf, looksLikeCompany, guessKind } = require('../../src/services/companyCharacters');
const { proposalFor, knownFor } = require('../../src/services/relationshipTypeTidy');
const { cleanSeeds } = require('../../src/services/relationshipSeeds');

describe('nameMatcher: articles and titles are never a first name', () => {
  const people = [
    { id: 'lala', name: 'Lala' }, { id: 'col', name: 'The Column' }, { id: 'marcus', name: 'Marcus Hale' },
    { id: 'doc', name: 'Dr Amara Sinclair' }, { id: 'vel', name: 'Velour Atelier' },
  ];
  const match = nameMatcher(people);

  test('"The Column" never matches "the"; its full name does, any case', () => {
    expect(match('Lala walks into the launch and the room goes quiet')).toEqual(['lala']);
    expect(match('THE launch')).toEqual([]);
    expect(match('Lala pitches The Column')).toEqual(['lala', 'col']);
    expect(match('lala pitches the column')).toEqual(['lala', 'col']);
  });

  test('Lala, and Marcus by his first name, written capitalised, still match', () => {
    expect(match("Marcus's ring and Lala's lie")).toEqual(['marcus', 'lala']);
    expect(match('Marcus hides it')).toEqual(['marcus']);
  });

  test('lower-case "marcus" alone is not his first name; his full name is, any case', () => {
    expect(match('marcus hides it')).toEqual([]);
    expect(match('marcus hale hides it')).toEqual(['marcus']);
  });

  test('a title is never a first name ("Dr"), nor a short one; "Velour" is', () => {
    expect(match('Dr calls')).toEqual([]);
    expect(match('Dr Amara Sinclair calls')).toEqual(['doc']);
    expect(match('Velour sends a dress')).toEqual(['vel']);
  });

  test('her thirteen purposes with "the" name no pair with The Column', () => {
    const purposes = Array.from({ length: 13 }, (_, i) => `Lala faces the fallout at the party, part ${i + 1}`);
    expect(purposes.every((p) => !match(p).includes('col'))).toBe(true);
  });
});

describe('usableFirstName and the shared stoplist', () => {
  test('articles, titles and connectors are not first names', () => {
    expect(usableFirstName('The Column')).toBeNull();
    expect(usableFirstName('Dr. Amara Sinclair')).toBeNull();
    expect(usableFirstName('de la Cruz')).toBeNull();
    expect(usableFirstName('St James')).toBeNull();
    expect(usableFirstName('Lala')).toBeNull();
    expect(usableFirstName('Mo Reed')).toBeNull();
    expect(usableFirstName('Marcus Hale')).toBe('Marcus');
  });

  test('the script checks (shared with the frontend copy) hold the same list', () => {
    expect([...scriptRules.NOT_FIRST_NAMES].sort()).toEqual([...NOT_FIRST_NAMES].sort());
  });

  test('goalPerson never takes "the" as a guest\'s first name', () => {
    const event = { source_profile_id: 1, canon_consequences: { automation: { guest_profiles: [{ profile_id: 2, featured: true, display_name: 'The Column' }] } } };
    const profiles = [{ id: 1, display_name: 'Host Person' }, { id: 2, display_name: 'The Column' }];
    const person = scriptRules.goalPerson({ slot: 'relationship_guest', profile_id: 2 }, event, profiles);
    expect(person.names).toContain('the column');
    expect(person.names).not.toContain('the');
  });

  test('storyRipples: "the" in a post is not a reveal of The Column', () => {
    const a = { name: 'Lala', handle: 'lala', profile_id: 1 };
    const b = { name: 'The Column', handle: 'thecolumn', profile_id: 2 };
    expect(isReveal('Lala at the launch, the night of the year', { a, b, posterRole: 'outside', posterId: 9 })).toBe(false);
    expect(isReveal('Lala and The Column, finally', { a, b, posterRole: 'outside', posterId: 9 })).toBe(true);
  });
});

describe('the company types', () => {
  test('the list and its labels', () => {
    expect(types.COMPANY_TYPES).toEqual(['client_partner', 'sponsor', 'represents', 'press', 'rival_brand', 'fan']);
    expect(types.COMPANY_TYPE_LABELS.represents).toBe('Works for / represents');
    expect(types.isKnownType('rival_brand')).toBe(true);
    expect(types.isCompanyType('rival')).toBe(false);
  });

  test('the page\'s types map to company types', () => {
    const t = (raw, o) => types.normalizeCompanyType(raw, o)?.type ?? null;
    expect(t('collaborator')).toBe('client_partner');
    expect(t('Rival')).toBe('rival_brand');
    expect(t('fan')).toBe('fan');
    expect(t('mentor')).toBe('represents');
    expect(t('manager')).toBe('represents');
    expect(t('Subject turned critic')).toBe('press');
    expect(t('Brand ambassador')).toBe('sponsor');
    expect(t('sponsor')).toBe('sponsor');
  });

  test('a romance or family role has no company reading; nothing is romantic', () => {
    expect(types.normalizeCompanyType('love_interest')).toBeNull();
    expect(types.normalizeCompanyType('sister')).toBeNull();
    expect(types.normalizeCompanyType('wife')).toBeNull();
    expect(types.normalizeCompanyType('collaborator').is_romantic).toBe(false);
  });

  test('two companies: partner or rival brand only', () => {
    expect(types.normalizeCompanyType('press', { brandPair: true }).type).toBe('client_partner');
    expect(types.normalizeCompanyType('rival', { brandPair: true }).type).toBe('rival_brand');
  });

  test('companyRefusal: romance and family refused, company types not', () => {
    expect(types.companyRefusal('love_interest')).toMatch(/never in a romance/);
    expect(types.companyRefusal('friend', true)).toMatch(/never in a romance/);
    expect(types.companyRefusal('husband')).toMatch(/never in a romance/);
    expect(types.companyRefusal('mother')).toMatch(/no family/);
    expect(types.companyRefusal('family')).toMatch(/no family/);
    expect(types.companyRefusal('sponsor')).toBeNull();
    expect(types.companyRefusal('collaborator')).toBeNull();
  });
});

describe('companyOf, looksLikeCompany, guessKind', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  test('companyOf reads extra_fields.company_id, object or JSON, never brand_id', () => {
    expect(companyOf({ extra_fields: { company_id: id } })).toBe(id);
    expect(companyOf({ extra_fields: JSON.stringify({ company_id: id }) })).toBe(id);
    expect(companyOf({ extra_fields: { brand_id: id } })).toBeNull();
    expect(companyOf({ extra_fields: { company_id: 'not-an-id' } })).toBeNull();
    expect(companyOf({})).toBeNull();
  });
  test('names that read like a company', () => {
    expect(looksLikeCompany('The Column')).toBe(true);
    expect(looksLikeCompany('Velour Atelier')).toBe(true);
    expect(looksLikeCompany('Maison Co')).toBe(true);
    expect(looksLikeCompany('Marcus Hale')).toBe(false);
    expect(looksLikeCompany('Theodora Vance')).toBe(false);
  });
  test('the kind a new company would be', () => {
    expect(guessKind('The Column')).toBe('outlet');
    expect(guessKind('Gloss Magazine')).toBe('outlet');
    expect(guessKind('Glass Gallery')).toBe('venue');
    expect(guessKind('North Agency')).toBe('agency');
    expect(guessKind('Velour Atelier')).toBe('brand');
    expect(guessKind('House of Sable')).toBe('brand');
  });
});

describe('the type tidy-up for a company pair', () => {
  const row = (fields) => ({ id: 'r1', a_name: 'Lala', b_name: 'The Column', confirmed: true, is_romantic: false, situation: null, a_company: false, b_company: true, ...fields });
  test('a type that is not a company type is proposed one, never romantic', () => {
    expect(knownFor(row({ relationship_type: 'collaborator' }))).toBe(false);
    expect(knownFor(row({ relationship_type: 'press' }))).toBe(true);
    const p = proposalFor(row({ relationship_type: 'collaborator', is_romantic: true }));
    expect(p).toMatchObject({ proposed_type: 'client_partner', proposed_is_romantic: false, company: true, brand_pair: false });
    expect(proposalFor(row({ relationship_type: 'Rival' })).proposed_type).toBe('rival_brand');
    expect(proposalFor(row({ relationship_type: 'manager' })).proposed_type).toBe('represents');
  });
  test('its situation guess is a company type too', () => {
    const p = proposalFor(row({ relationship_type: 'mirror image', situation: 'The Column reviews every look she wears.' }));
    expect(p).toMatchObject({ proposed_type: 'press', proposed_from: 'situation' });
  });
  test('two companies: partner or rival brand', () => {
    expect(knownFor(row({ relationship_type: 'press', a_company: true }))).toBe(false);
    expect(proposalFor(row({ relationship_type: 'fan', a_company: true })).proposed_type).toBe('client_partner');
  });
  test('a pair of people keeps its own reading', () => {
    expect(proposalFor({ id: 'r2', relationship_type: 'Rival', is_romantic: false }).proposed_type).toBe('rival');
  });
});

describe('a season need with a company in it', () => {
  const company = { id: 'co1', slug: 'the_column', name: 'The Column', kind: 'outlet' };
  const needs = [{ key: 'n1', kind: 'purpose', a: 'lala', b: 'col', slot: { slot_number: 3 } }];
  const names = new Map([['lala', 'Lala'], ['col', 'The Column']]);
  const facts = (over = {}) => ({ byCharacter: new Map([['col', company]]), deals: new Map(), reps: new Set(), ...over });

  test('missing with no deal, representative or relationship, with its company', () => {
    const [n] = classify(needs, [], names, facts()).needs;
    expect(n).toMatchObject({ state: 'missing', company: { slug: 'the_column', side: 'b', both: false }, there_by: null });
  });
  test('there by a deal with the company', () => {
    const [n] = classify(needs, [], names, facts({ deals: new Map([['co1', { id: 'd1', name: 'Cover story' }]]) })).needs;
    expect(n).toMatchObject({ state: 'there', there_by: 'deal', deal: { name: 'Cover story' } });
  });
  test('there when the other side represents it', () => {
    const [n] = classify(needs, [], names, facts({ reps: new Set(['co1|lala']) })).needs;
    expect(n).toMatchObject({ state: 'there', there_by: 'representative' });
  });
  test('there by a confirmed relationship; a seed alone is a seed', () => {
    const confirmed = [{ id: 'r1', character_id_a: 'lala', character_id_b: 'col', relationship_type: 'press', confirmed: true }];
    expect(classify(needs, confirmed, names, facts()).needs[0]).toMatchObject({ state: 'there', there_by: 'relationship' });
    const seed = [{ id: 'r2', character_id_a: 'lala', character_id_b: 'col', relationship_type: 'press', confirmed: false }];
    expect(classify(needs, seed, names, facts()).needs[0]).toMatchObject({ state: 'seed', there_by: null });
  });
  test('two people, neither a company, are unaffected', () => {
    const [n] = classify([{ key: 'n2', kind: 'purpose', a: 'lala', b: 'rep', slot: null }], [], new Map([['lala', 'Lala'], ['rep', 'Rep']]), facts({ reps: new Set(['co1|rep']) })).needs;
    expect(n.state).toBe('missing');
    expect(n.company).toBeUndefined();
  });
});

describe("Generate's answer for a company pair", () => {
  const A = '11111111-1111-4111-8111-111111111111';
  const C = '33333333-3333-4333-8333-333333333333';
  const characters = [{ id: A, display_name: 'Lala' }, { id: C, display_name: 'The Column', company: { id: 'co1', name: 'The Column' } }];
  const ctx = { confirmed: [], records: [], threads: [], twists: [] };
  const index = { live: new Set(), blocked: new Map(), heldTypes: new Set() };
  const run = (seeds, kind = 'any') => cleanSeeds({ seeds }, { characters, ctx, aim: { kind, focus_character_id: null }, index });

  test('a company type is kept; the page\'s type is mapped to one', () => {
    const { seeds } = run([{ a: A, b: C, relationship_type: 'collaborator' }]);
    expect(seeds[0]).toMatchObject({ relationship_type: 'client_partner', is_romantic: false, family_role: null });
  });
  test('a romance or a family role with a company is skipped', () => {
    const { seeds, skipped } = run([
      { a: A, b: C, relationship_type: 'love_interest', is_romantic: true },
      { a: C, b: A, relationship_type: 'sister' },
    ]);
    expect(seeds).toEqual([]);
    expect(skipped.map((x) => x.code)).toEqual(['company_type', 'company_type']);
  });
});
