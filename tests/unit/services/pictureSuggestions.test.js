/**
 * Visual Memory phase 4 (services/pictureSuggestions): reading a caption,
 * ranking the poster's pictures for that reading (Evoni's example: Maren's
 * "still here. the bread is rising." wants the dough, not a gown or a
 * portrait), and the plan's use / edit / create thresholds. Evoni's rulings
 * (2026-10-19): every choice is always offered, an optional person can be
 * included, and a new picture keeps the place picture earlier ones kept.
 */
const ps = require('../../../src/services/pictureSuggestions');

const MAREN = 'maren-id';
const CAPTION = 'still here. the bread is rising.';
const READING = {
  subject: 'bread dough rising', activity: 'baking bread', mood: 'quiet, hopeful', setting: 'home kitchen',
  person_in_frame: 'optional', objects: ['dough', 'ceramic bowl'], avoid: ['unrelated outfits', 'evening gown', 'products'],
};
const at = (d) => new Date(`2026-10-${String(d).padStart(2, '0')}T10:00:00Z`).toISOString();
const library = [
  { id: 'gown', url: 'https://img/gown.jpg', caption: 'Maren in an evening gown', source: 'upload', status: 'approved', visibility: 'public', created_at: at(18), details: { wardrobe: ['evening gown'] }, links: [{ entity_type: 'character', entity_id: MAREN, role: 'pictured', name: 'Maren' }, { entity_type: 'wardrobe', entity_id: 'w1', role: 'pictured', name: 'Evening gown' }] },
  { id: 'portrait', url: 'https://img/p.jpg', caption: 'Their profile photo', source: 'portrait', status: 'approved', visibility: 'public', created_at: at(19), details: {}, links: [{ entity_type: 'character', entity_id: MAREN, role: 'pictured', name: 'Maren' }] },
  { id: 'dough', url: 'https://img/dough.jpg', caption: 'Dough rising in a ceramic bowl', source: 'upload', status: 'approved', visibility: 'internal', created_at: at(10), details: { objects: ['ceramic bowl', 'dough'] }, links: [{ entity_type: 'character', entity_id: MAREN, role: 'owner', name: 'Maren' }] },
  { id: 'kitchen', url: 'https://img/k.jpg', caption: "Maren's kitchen", source: 'scene_set', status: 'approved', visibility: 'internal', created_at: at(5), details: {}, links: [{ entity_type: 'scene_set', entity_id: 'set-1', role: 'location', name: 'Home kitchen' }] },
];

describe('pictureSuggestions', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { jest.restoreAllMocks(); });

  test("Maren's dough beats a gown and a portrait, the same way every time", () => {
    const ranked = ps.rank(READING, CAPTION, library, { posterId: MAREN });
    const ids = ranked.map((r) => r.asset.id);
    expect(ids[0]).toBe('dough');
    expect(ids.indexOf('gown')).toBeGreaterThan(ids.indexOf('kitchen'));
    expect(ids.indexOf('portrait')).toBeGreaterThan(ids.indexOf('kitchen'));
    expect(ranked[0].why.join('; ')).toMatch(/shows dough, ceramic bowl/);
    expect(ranked.find((r) => r.asset.id === 'gown').why.join('; ')).toMatch(/avoid: evening gown/);
    expect(ranked.find((r) => r.asset.id === 'portrait').why.join('; ')).toMatch(/not every post needs one/);
    expect(ranked.find((r) => r.asset.id === 'kitchen').why.join('; ')).toMatch(/set in the home kitchen/);
    expect(ps.rank(READING, CAPTION, [...library].reverse(), { posterId: MAREN }).map((r) => r.asset.id)).toEqual(ids);
    expect(ps.rank(READING, CAPTION, library, { posterId: MAREN })).toEqual(ranked);
  });

  test('when no one needs to be in it, a portrait sinks further; when they are in it, it rises', () => {
    const none = ps.rank({ ...READING, person_in_frame: 'no' }, CAPTION, library, { posterId: MAREN });
    const optional = ps.rank(READING, CAPTION, library, { posterId: MAREN });
    const score = (list, id) => list.find((r) => r.asset.id === id).score;
    expect(score(none, 'portrait')).toBeLessThan(score(optional, 'portrait'));
    const selfie = ps.rank({ ...READING, subject: 'Maren smiling', objects: [], avoid: [], person_in_frame: 'yes' }, 'me today', library, { posterId: MAREN });
    expect(score(selfie, 'portrait')).toBeGreaterThan(score(optional, 'portrait'));
    expect(selfie.find((r) => r.asset.id === 'gown').why).toContain('they are in it');
  });

  test('the plan: use when strong, an edit with the rest locked when nearly right, create when nothing fits', async () => {
    const db = {};
    const poster = { id: MAREN, name: 'Maren' };
    const ranked = ps.rank(READING, CAPTION, library, { posterId: MAREN });
    expect(ranked[0].score).toBeGreaterThanOrEqual(ps.THRESHOLDS.use);
    const strong = await ps.planFor(db, { reading: READING, caption: CAPTION, ranked, poster });
    expect(strong.recommended).toBe('use');
    expect(strong.use).toEqual({ action: 'use', asset_id: 'dough', ready: false });
    expect(strong.edit).toBeNull();
    // The recommendation guides; every choice is still offered, and a new picture says what it would cost.
    expect(strong.actions).toEqual(['use', 'edit', 'create', 'upload']);
    expect(strong.create_note).toMatch(/A fitting picture already exists; generating costs about \$0.20/);
    expect(strong.thresholds).toEqual({ use: 10, edit: 4 });

    // Only the kitchen: set right, no dough in it. An object edit, place kept.
    const kitchenOnly = ps.rank({ ...READING, activity: '' }, CAPTION, [library[3]], { posterId: MAREN });
    expect(kitchenOnly[0].score).toBeGreaterThanOrEqual(ps.THRESHOLDS.edit);
    expect(kitchenOnly[0].score).toBeLessThan(ps.THRESHOLDS.use);
    const near = await ps.planFor(db, { reading: { ...READING, activity: '' }, caption: CAPTION, ranked: kitchenOnly, poster });
    expect(near.recommended).toBe('edit');
    expect(near.edit).toEqual({ action: 'edit', asset_id: 'kitchen', change: { kind: 'object', text: 'add dough and ceramic bowl' }, locks: ['face', 'wardrobe', 'location'] });

    // Only the gown and the portrait: nothing fits; a new picture with no one in it, the kitchen not known.
    const nothing = ps.rank(READING, CAPTION, library.slice(0, 2), { posterId: MAREN });
    const plan = await ps.planFor(db, { reading: READING, caption: CAPTION, ranked: nothing, poster });
    expect(plan.recommended).toBe('create');
    expect(plan.create.blocked).toBeNull();
    expect(plan.create.references).toEqual([]);
    expect(plan.create.prompt).toContain('No people in the frame.');
    expect(plan.create.prompt).toContain('In the frame: dough, ceramic bowl.');
    expect(plan.create.prompt).toContain('Leave out: unrelated outfits; evening gown; products.');
  });

  test('a new picture uses the place picture for the setting, and their portrait only when they are in it', async () => {
    const poster = { id: MAREN, name: 'Maren' };
    const loaf = { ...READING, objects: ['loaf'], activity: '' };
    const withPlace = await ps.planFor({}, { reading: loaf, caption: CAPTION, ranked: ps.rank(loaf, CAPTION, [library[3], library[0]], { posterId: MAREN }), poster });
    expect(withPlace.create.references).toEqual([{ kind: 'place', asset_id: 'kitchen', url: 'https://img/k.jpg', name: "Maren's kitchen" }]);
    expect(withPlace.create.prompt).toContain("The place is the one in the reference image (Maren's kitchen)");

    const portraits = { RegistryCharacter: { findByPk: jest.fn() }, sequelize: { query: jest.fn() } };
    portraits.RegistryCharacter.findByPk.mockResolvedValue({ id: MAREN, display_name: 'Maren', portrait_url: null, appearance: null });
    portraits.sequelize.query.mockResolvedValue([[]]);
    const yes = await ps.planFor(portraits, { reading: { ...READING, person_in_frame: 'yes' }, caption: CAPTION, ranked: [], poster });
    expect(yes.create.blocked).toMatch(/no approved portrait of Maren/);
    portraits.RegistryCharacter.findByPk.mockResolvedValue({ id: MAREN, display_name: 'Maren', portrait_url: 'https://img/p.jpg', appearance: null });
    const ok = await ps.planFor(portraits, { reading: { ...READING, person_in_frame: 'yes' }, caption: CAPTION, ranked: [], poster });
    expect(ok.create.blocked).toBeNull();
    expect(ok.create.references).toEqual([{ kind: 'portrait', character_id: MAREN, url: 'https://img/p.jpg' }]);
    expect(ok.create.prompt).toContain('must look exactly like the person in the reference portrait');
    expect(ok.create.review.reasons[0]).toMatch(/approved portraits/);
  });

  test('the reading is parsed and checked, with a plainer reading when the answer cannot be read', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(ps.parseReading('Here you go: {"subject":" dough ","activity":"","mood":"quiet","setting":"kitchen","person_in_frame":"NO","objects":["dough",""],"avoid":"gowns"}'))
      .toEqual({ subject: 'dough', activity: '', mood: 'quiet', setting: 'kitchen', person_in_frame: 'no', objects: ['dough'], avoid: ['gowns'] });
    expect(ps.parseReading('{"subject":"x","person_in_frame":"maybe"}').person_in_frame).toBe('optional');
    expect(ps.parseReading('not json at all')).toBeNull();
    expect(ps.parseReading('{"mood":"quiet"}')).toBeNull();
    const fb = ps.fallbackReading('slow morning in the kitchen with fresh bread');
    expect(fb).toMatchObject({ setting: 'kitchen', person_in_frame: 'optional', avoid: [] });
    expect(fb.objects).toEqual(expect.arrayContaining(['bread']));
    expect(ps.fallbackReading('outfit check in the mirror').person_in_frame).toBe('yes');
  });

  test('the thresholds are one adjustable config object', async () => {
    const poster = { id: MAREN, name: 'Maren' };
    const ranked = ps.rank(READING, CAPTION, library, { posterId: MAREN });
    const before = ps.THRESHOLDS.use;
    try {
      ps.THRESHOLDS.use = ranked[0].score + 1;
      const plan = await ps.planFor({}, { reading: READING, caption: CAPTION, ranked, poster });
      expect(plan.recommended).toBe('edit');
      expect(plan.create_note).toBeNull();
    } finally {
      ps.THRESHOLDS.use = before;
    }
  });

  test('an optional person is left out by default and included when asked', async () => {
    const poster = { id: MAREN, name: 'Maren' };
    const db = { RegistryCharacter: { findByPk: jest.fn().mockResolvedValue({ id: MAREN, display_name: 'Maren', portrait_url: 'https://img/p.jpg', appearance: null }) }, sequelize: { query: jest.fn().mockResolvedValue([[]]) } };
    const out = await ps.planFor(db, { reading: READING, caption: CAPTION, ranked: [], poster });
    expect(out.create.include_person).toBe(false);
    expect(out.create.references).toEqual([]);
    expect(out.create.prompt).toContain('No people in the frame.');
    expect(out.person).toEqual({ name: 'Maren', in_frame: 'optional', included: false, portraits: 1 });
    const inc = await ps.planFor(db, { reading: READING, caption: CAPTION, ranked: [], poster, includePerson: true });
    expect(inc.create.include_person).toBe(true);
    expect(inc.create.references).toEqual([{ kind: 'portrait', character_id: MAREN, url: 'https://img/p.jpg' }]);
    expect(inc.create.prompt).toContain('must look exactly like the person in the reference portrait');
  });

  test('a new picture keeps the place picture earlier ones kept, and never one made from it', () => {
    const second = { ...library[3], id: 'kitchen-2', url: 'https://img/k2.jpg', created_at: at(20) };
    const made = { ...library[3], id: 'kitchen-made', url: 'https://img/k3.jpg', source: 'generated', created_at: at(21) };
    const ranked = ps.rank(READING, CAPTION, [library[3], second, made], { posterId: MAREN });
    expect(ps.placeFor(READING, ranked).asset.id).not.toBe('kitchen-made');
    expect(ps.placeFor(READING, ranked, new Map([['kitchen', 3], ['kitchen-2', 1]])).asset.id).toBe('kitchen');
    expect(ps.placeFor(READING, ranked, new Map([['kitchen-2', 2]])).asset.id).toBe('kitchen-2');
    expect(ps.placeFor({ ...READING, setting: '' }, ranked)).toBeNull();
  });

  test('an edit that includes them adds them when they are not in it yet', () => {
    const poster = { id: MAREN, name: 'Maren' };
    const choice = { change: { kind: 'object', text: 'add candle' }, locks: ['face', 'wardrobe', 'location', 'props'] };
    expect(ps.editChange({ ...choice, include_person: true }, { reading: READING, asset: library[2], poster }))
      .toEqual({ change: { kind: 'add_character', character_id: MAREN, text: 'add candle; baking bread' }, locks: ['face', 'wardrobe', 'location'] });
    // Already in it, or not asked: the edit as given.
    expect(ps.editChange({ ...choice, include_person: true }, { reading: READING, asset: library[0], poster })).toEqual({ change: choice.change, locks: choice.locks });
    expect(ps.editChange({ ...choice, include_person: false }, { reading: READING, asset: library[2], poster })).toEqual({ change: choice.change, locks: choice.locks });
  });
});
