/**
 * Confidential professionals stay out of the writers (utils/confidentialCharacters;
 * Evoni, 2026-10-18, on Dr. Amara Sinclair).
 */
const {
  CONFIDENTIAL, isConfidential, withoutConfidential, notConfidentialSql,
} = require('../../../src/utils/confidentialCharacters');

describe('confidentialCharacters', () => {
  test('a confidential professional is known by her classification or her key', () => {
    expect(isConfidential({ extra_fields: { classification: CONFIDENTIAL } })).toBe(true);
    expect(isConfidential({ extra_fields: JSON.stringify({ classification: CONFIDENTIAL }) })).toBe(true);
    expect(isConfidential({ character_key: 'amara_sinclair' })).toBe(true);
    expect(isConfidential({ get: (k) => ({ character_key: 'x', extra_fields: { classification: CONFIDENTIAL } })[k] })).toBe(true);
    expect(isConfidential({ character_key: 'lala', extra_fields: {} })).toBe(false);
    expect(isConfidential({ character_key: 'lala', extra_fields: 'not json' })).toBe(false);
    expect(isConfidential(null)).toBe(false);
  });

  test('withoutConfidential leaves her out of a list', () => {
    const list = [{ character_key: 'lala' }, { character_key: 'amara_sinclair' }, { character_key: 'nia_bennett', extra_fields: {} }];
    expect(withoutConfidential(list).map((c) => c.character_key)).toEqual(['lala', 'nia_bennett']);
  });

  test('notConfidentialSql keeps her out by classification and key, with or without an alias', () => {
    expect(notConfidentialSql('rc')).toBe("(COALESCE(rc.extra_fields->>'classification', '') <> 'confidential_professional' AND COALESCE(rc.character_key, '') NOT IN ('amara_sinclair'))");
    expect(notConfidentialSql('')).toBe("(COALESCE(extra_fields->>'classification', '') <> 'confidential_professional' AND COALESCE(character_key, '') NOT IN ('amara_sinclair'))");
  });

  test('the writers that pick characters themselves use it', () => {
    const fs = require('fs');
    const path = require('path');
    const read = (p) => fs.readFileSync(path.join(__dirname, '../../../src', p), 'utf8');
    for (const p of ['routes/memories/engine.js', 'routes/sceneProposeRoute.js', 'routes/characterAI.js', 'routes/tierFeatures.js', 'routes/relationships.js']) {
      expect(read(p)).toMatch(/confidentialCharacters/);
    }
    expect((read('routes/relationships.js').match(/notConfidentialSql/g) || []).length).toBe(2);
  });
});
