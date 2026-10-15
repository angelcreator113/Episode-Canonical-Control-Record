/**
 * The Book 1 cast is Cast B (Evoni, 2026-10-15; docs/CANON.md): sons Elias
 * (9) and Zion (5), Marcus the paying man (never a son), Nia Vale the
 * Comparison Creator, the Witness unnamed. The relationship map's seed is
 * matched to registry characters by name, so a seed "Marcus" written as a
 * son drew the paying man as JustAWoman's and David's son.
 */
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const engine = read('src', 'routes', 'memories', 'engine.js');
const seedMap = engine.slice(engine.indexOf('const BOOK1_NODES = ['), engine.indexOf('// ─── GET /relationship-map'));

describe('Book 1 relationship map seed', () => {
  test('the sons are Elias and Zion', () => {
    expect(seedMap).toMatch(/label: 'Elias'/);
    expect(seedMap).toMatch(/label: 'Zion'/);
    expect(seedMap).toMatch(/Mother of Elias \(9\) and Zion \(5\)/);
  });

  test('Marcus is the paying man, never a son', () => {
    const marcus = seedMap.slice(seedMap.indexOf("id: 'marcus'"), seedMap.indexOf("id: 'jade'"));
    expect(marcus).toMatch(/The paying man/);
    expect(seedMap).not.toMatch(/familial\('[a-z]+', 'marcus'/);
    expect(seedMap).not.toMatch(/to: 'marcus',\s*direction: 'two_way',\s*type: 'familial'/);
  });

  test('no retired cast member is in the seed', () => {
    for (const name of ['Miles', 'Noah', 'Dana', 'Chloe']) expect(seedMap).not.toMatch(new RegExp(`\\b${name}\\b`));
  });
});

describe('writing prompts read Cast B', () => {
  test.each([
    ['src/routes/memories/engine.js'],
    ['src/routes/memories/stories.js'],
    ['src/routes/memories/helpers.js'],
    ['src/routes/characterGenerator.js'],
    ['src/routes/characterRegistry.js'],
    ['frontend/src/data/characterAppearanceRules.js'],
  ])('%s names no retired cast member', (file) => {
    const src = read(...file.split('/'));
    expect(src).not.toMatch(/\bChloe\b|\bMiles\b|\bDana\b|Marcus \(7\)/);
  });

  test('the Lala bleed follows the transfer, not a chapter number', () => {
    expect(engine).not.toMatch(/ONLY USE IN CHAPTERS 41-50/);
    expect(engine).not.toMatch(/(story|chapter) 47/i);
    expect(engine).toMatch(/BLEED — AFTER THE TRANSFER/);
    expect(engine).toMatch(/set "bleed_active": false on every story unless the brief says the transfer has happened/);
  });
});

describe('no JustAWoman in the LalaVerse', () => {
  test('the seeder no longer inserts the @justawoman record', () => {
    const seeder = read('src', 'seeders', '20260314100000-justawoman-lalaverse-profile.js');
    expect(seeder).toMatch(/async up\(\) \{\}/);
    expect(seeder).not.toMatch(/bulkInsert/);
  });

  test('the migration removes LalaVerse records only, and logs them for down', () => {
    const mig = read('src', 'migrations', '20261015190000-remove-justawoman-lalaverse-profile.js');
    expect(mig).toMatch(/is_justawoman_record = true\s+AND feed_layer::text = 'lalaverse'/);
    expect(mig).toMatch(/justawoman_profile_removals/);
  });

  test('the Feed page pins no @justawoman card', () => {
    const page = read('frontend', 'src', 'pages', 'SocialProfileGenerator.jsx');
    expect(page).not.toMatch(/@justawoman|justAwomanProfile/);
  });
});
