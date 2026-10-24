/**
 * Heritage tags (Evoni, 2026-10-24): the matching key, the clean list, and
 * the exact-match-only reading of ethnicity text, in the shared module and
 * in the migration's frozen copy (they must agree).
 */
const { STARTER_TAGS, heritageKey, normalizeTags, tagsOf, sharedKeys, tagsFromEthnicity } = require('../../../src/utils/heritageTags');
const migration = require('../../../src/migrations/20261024210000-add-heritage-tags-to-registry-characters');
const { bloodShape, computeFlags } = require('../../../src/services/familyHeritage');

describe('heritage tags', () => {
  test('the key is the words lowercased and trimmed', () => {
    expect(heritageKey('  Puerto   Rican ')).toBe('puerto rican');
    expect(heritageKey(null)).toBe('');
  });

  test('a clean list: trimmed, one per key, starter spelling kept, own tags as typed', () => {
    expect(normalizeTags([' korean', 'Korean', 'black', '', 7, 'Gullah Geechee'])).toEqual(['Korean', 'Black', 'Gullah Geechee']);
    expect(normalizeTags('Black, Korean')).toEqual(['Black', 'Korean']);
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(Array(20).fill(0).map((_, i) => `tag ${i}`))).toHaveLength(12);
  });

  test('tagsOf reads stored JSON text too; sharedKeys compares by key', () => {
    expect(tagsOf('["Black","Korean"]')).toEqual(['Black', 'Korean']);
    expect(tagsOf(null)).toEqual([]);
    expect(sharedKeys(['Black', 'Korean'], ['korean'])).toEqual(['korean']);
    expect(sharedKeys(['Black'], ['Korean'])).toEqual([]);
  });

  test.each([
    ['Black', ['Black']],
    ['korean', ['Korean']],
    ['Black and Korean', ['Black', 'Korean']],
    ['Black / Korean', ['Black', 'Korean']],
    ['Puerto Rican, Dominican', ['Puerto Rican', 'Dominican']],
    ['Black.', ['Black']],
    ['Mixed-race', []],
    ['Mixed', []],
    ['Korean-ish', []],
    ['Black American from Ohio', []],
    ['Black and something else', []],
    ['', []],
    [null, []],
  ])('ethnicity %p → %p (exact matches only), the same in the migration', (text, tags) => {
    expect(tagsFromEthnicity(text)).toEqual(tags);
    expect(migration.exactTags(text)).toEqual(tags);
  });

  test('the starter list has no "mixed" tag: mixed heritage is more than one tag', () => {
    expect(STARTER_TAGS.map(heritageKey).some((k) => k.includes('mixed'))).toBe(false);
  });
});

describe('the gentle check, without a database', () => {
  const tie = (id, a, b, role, f = {}) => ({ id, character_id_a: a, character_id_b: b, family_role: role, reverse_family_role: null, family_kind: 'blood', is_blood_relation: true, heritage_ok: null, ...f });
  const people = (o) => new Map(Object.entries(o).map(([id, [name, tags]]) => [id, { id, name, heritage_tags: tags, ethnicity: null }]));

  test('only plain blood roles count', () => {
    expect(bloodShape(tie('1', 'm', 'c', 'mother'))).toEqual({ type: 'parent', parent: 'm', child: 'c' });
    expect(bloodShape(tie('1', 'c', 'm', 'son'))).toEqual({ type: 'parent', parent: 'm', child: 'c' });
    expect(bloodShape(tie('1', 'm', 'c', 'stepmother', { family_kind: 'step' }))).toBeNull();
    expect(bloodShape(tie('1', 'm', 'c', 'mother', { family_kind: 'adoptive' }))).toBeNull();
    expect(bloodShape(tie('1', 'a', 'b', 'half-sister'))).toBeNull();
    expect(bloodShape(tie('1', 'a', 'b', 'sister', { family_kind: null, is_blood_relation: true }))).toEqual({ type: 'sibling', a: 'a', b: 'b' });
    expect(bloodShape(tie('1', 'a', 'b', 'sister', { family_kind: null, is_blood_relation: false }))).toBeNull();
  });

  test('a child sharing with neither parent is flagged; a mixed child is not', () => {
    const rows = [tie('r1', 'ruth', 'dre', 'mother'), tie('r2', 'omar', 'dre', 'father')];
    const flagged = computeFlags(rows, people({ ruth: ['Ruth Coleman', ['Black']], omar: ['Omar Coleman', ['Black']], dre: ['Dre Coleman', ['Korean']] }));
    expect(flagged.map((f) => f.key)).toEqual(['parents-dre']);
    expect(flagged[0].sentence).toBe("Dre Coleman is Ruth Coleman and Omar Coleman's child by blood, but their heritage shares nothing: Ruth — Black; Omar — Black; Dre — Korean.");
    expect(computeFlags(rows, people({ ruth: ['Ruth', ['Black']], omar: ['Omar', ['Korean']], dre: ['Dre', ['Black', 'Korean']] }))).toEqual([]);
  });
});
