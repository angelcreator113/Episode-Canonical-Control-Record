'use strict';

/**
 * The cast matches canon (Evoni, 2026-10-16: "yes do ... B, and I've
 * deleted the Jade character"; docs/CANON.md).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('Jade, the Almost-Mentor, is deleted', () => {
  test.each([
    ['src/routes/characterRegistry.js'],
    ['src/routes/characterGenerator.js'],
    ['src/services/thresholdDetection.js'],
    ['src/routes/memories/voice.js'],
    ['frontend/src/data/characterAppearanceRules.js'],
    ['frontend/src/pages/SocialImport.jsx'],
    ['frontend/src/pages/NovelAssembler.jsx'],
  ])('%s has no Jade or Almost-Mentor', (file) => {
    expect(read(...file.split('/'))).not.toMatch(/\bJade\b|almost[-_ ]mentor/i);
  });

  test('the relationship map and the character DNA have no Jade', () => {
    const engine = read('src', 'routes', 'memories', 'engine.js');
    const map = engine.slice(engine.indexOf('const BOOK1_NODES'), engine.indexOf("router.get('/relationship-map'"));
    expect(map).not.toMatch(/'jade'/);
    const dna = engine.slice(engine.indexOf('const CHARACTER_DNA'), engine.indexOf('const SE_DB_KEY_MAP'));
    expect(dna).not.toMatch(/almost-mentor/);
  });
});

describe('labels and the cast', () => {
  test('pressure is Pressure, never Antagonist', () => {
    const c = read('frontend', 'src', 'constants', 'characterConstants.js');
    expect(c).toMatch(/pressure:\s+'Pressure'/);
    expect(c).toMatch(/value: 'pressure',\s+label: 'Pressure'/);
    expect(c).not.toMatch(/'Antagonist'/);
  });

  test('seed-book1 gives Lala her species, and the Witness is a mirror', () => {
    const reg = read('src', 'routes', 'characterRegistry.js');
    expect(reg).toMatch(/const LALA_SPECIES = 'sentient AI'/);
    expect(reg).toMatch(/species: LALA_SPECIES/);
    const witness = reg.slice(reg.indexOf("character_key: 'the-witness'"), reg.indexOf("character_key: 'the-witness'") + 300);
    expect(witness).toMatch(/role_type: 'mirror'/);
  });

  test('Nia Vale is the escalation mirror, not the retired Comparison Creator', () => {
    const rules = read('frontend', 'src', 'data', 'characterAppearanceRules.js');
    const nia = rules.slice(rules.indexOf('the_comparison_creator:'), rules.indexOf('the_witness:'));
    expect(nia).toMatch(/ESCALATION MIRROR/);
    expect(nia).toMatch(/goes fully explicit on a live, intentionally/);
    expect(nia).not.toMatch(/'She represents the timeline JustAWoman abandoned|'She is consistent|'She cannot be mean/);
  });

  test('the Story Engine finds the Comparison Creator under every key she is stored as', () => {
    expect(read('src', 'routes', 'memories', 'engine.js'))
      .toMatch(/'the-comparison-creator': \['the-comparison-creator', 'comparison-creator', 'nia-vale'\]/);
  });

  test('the LalaVerse character prompt never names JustAWoman and uses a LalaVerse city', () => {
    const ws = read('src', 'routes', 'worldStudio.js');
    const cfg = ws.slice(ws.indexOf("  'lalaverse': {"), ws.indexOf('Character types available:'));
    expect(cfg).not.toMatch(/JustAWoman's entire confidence playbook/);
    expect(cfg).toMatch(/never name JustAWoman/);
    expect(cfg).toMatch(/Dazzle District/);
  });

  test('the retired profile script is gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'scripts', 'update-character-profiles.js'))).toBe(false);
  });
});
