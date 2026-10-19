/**
 * Brand and company profiles (services/brandProfile, constants/companyKinds;
 * Evoni, 2026-10-18): the tabs each kind shows, identity kept in its three
 * layers, names compared trimmed / one space / any case, and the outlets in
 * step with the press characters' publications.
 */
const fs = require('fs');
const path = require('path');
const bp = require('../../../src/services/brandProfile');
const { SECTIONS_BY_KIND, PRESS_OUTLETS, normalizeName, COMPANY_KINDS } = require('../../../src/constants/companyKinds');

describe('brandProfile', () => {
  test('each kind shows only its own tabs', () => {
    expect(bp.sectionsFor('brand').map((s) => s.key)).toEqual(['identity', 'people', 'pulse', 'business', 'wardrobe', 'press', 'relationships']);
    expect(bp.sectionsFor('outlet').map((s) => s.key)).toEqual(['identity', 'people', 'pulse', 'business', 'press']);
    expect(bp.sectionsFor('agency').map((s) => s.key)).toEqual(['identity', 'people', 'pulse', 'business']);
    expect(bp.sectionsFor('venue').map((s) => s.key)).toEqual(['identity', 'business', 'press']);
    expect(bp.sectionsFor('nonsense')).toEqual(bp.sectionsFor('brand'));
    expect(bp.sectionsFor('brand').find((s) => s.key === 'press').label).toBe('Press & events');
    expect(bp.sectionsFor('outlet').find((s) => s.key === 'press').label).toBe('What it published');
    expect(bp.sectionsFor('venue').find((s) => s.key === 'press').label).toBe('Events held here');
    expect(Object.keys(SECTIONS_BY_KIND)).toEqual(Object.keys(COMPANY_KINDS));
  });

  test('identity keeps its history, its beliefs and its tone apart; the six fall back to their approved personality', () => {
    const velour = bp.identityOf({ slug: 'velour_atelier', name: 'Velour Atelier', founder: 'A founder', description: 'A house.', personality: null });
    expect(velour.history.map((f) => f.key)).toEqual(['founder', 'description']);
    expect(velour.beliefs.find((f) => f.key === 'defining_principle').value).toBe('Nothing extraneous');
    expect(velour.tone.find((f) => f.key === 'direction').value).toMatch(/Restrained/);
    expect(Array.isArray(velour.beliefs.find((f) => f.key === 'earns_trust').value)).toBe(true);
    const saved = bp.identityOf({ slug: 'velour_atelier', personality: { beliefs: 'Her own words.' } });
    expect(saved.beliefs).toEqual([{ key: 'beliefs', label: 'What it believes', value: 'Her own words.' }]);
    expect(bp.identityOf({ slug: 'a_new_venue', description: 'A room.' })).toEqual({ history: [{ key: 'description', label: 'What it is', value: 'A room.' }], beliefs: [], tone: [] });
  });

  test('names are compared trimmed, with one space, in any case', () => {
    expect(normalizeName('  The   Column ')).toBe('the column');
    expect(normalizeName('VELOUR atelier')).toBe(normalizeName('Velour Atelier'));
    expect(normalizeName(null)).toBe('');
  });

  test('a deal links to the one company of its typed name; a picked company fills a blank name', async () => {
    const velour = { id: '11111111-1111-4111-8111-111111111111', slug: 'velour_atelier', name: 'Velour Atelier', kind: 'brand' };
    const db = { sequelize: { QueryTypes: { SELECT: 'SELECT' }, query: jest.fn(async (sql, { replacements }) => {
      if (/WHERE id = :id/.test(sql)) return replacements.id === velour.id ? [velour] : [];
      return replacements.n === 'velour atelier' ? [velour] : [];
    }) } };
    expect((await bp.linkDeal(db, { brand_or_company: ' velour  ATELIER ' })).company_id).toBe(velour.id);
    expect((await bp.linkDeal(db, { brand_or_company: 'Maison Belle' })).company_id).toBeNull();
    expect(await bp.linkDeal(db, { name: 'No company in this edit' })).toEqual({ name: 'No company in this edit' });
    expect(await bp.linkDeal(db, { company_id: velour.id })).toEqual({ company_id: velour.id, brand_or_company: 'Velour Atelier' });
    await expect(bp.linkDeal(db, { company_id: '22222222-2222-4222-8222-222222222222' })).rejects.toThrow('company_id is not a company.');
  });

  test('the outlets are the press characters\' publications, with their publishers', () => {
    const press = fs.readFileSync(path.join(__dirname, '../../../src/routes/press.js'), 'utf8');
    expect(PRESS_OUTLETS.map((o) => o.name)).toEqual(['The Real Rate', 'Undressed', 'First Look', 'The Cost of Wanting More']);
    for (const o of PRESS_OUTLETS) {
      expect(press).toContain(`publication:  '${o.name}'`);
      expect(press).toContain(`slug:         '${o.publisher_key}'`);
    }
  });
});
