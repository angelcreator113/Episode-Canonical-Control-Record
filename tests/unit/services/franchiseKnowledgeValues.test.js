// ============================================================================
// UNIT TEST — every franchise_knowledge extracted_by the code writes is one
// the column accepts
// ============================================================================
// franchise_knowledge.extracted_by is an ENUM (migration
// 20260307210000-create-franchise-knowledge.js). Amber and episode
// completion wrote values outside it, so their inserts failed (wiring map
// §5 finding 5b, fix-list item 9). This ratchet reads src/ and fails on any
// extracted_by string literal that is not an allowed value.

const fs = require('fs');
const path = require('path');
const { FK_EXTRACTED_BY, FK_CATEGORIES, FK_SEVERITIES } = require('../../../src/services/franchiseKnowledgeValues');

const SRC = path.join(__dirname, '..', '..', '..', 'src');
const MIGRATION = fs.readFileSync(path.join(SRC, 'migrations', '20260307210000-create-franchise-knowledge.js'), 'utf8');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'migrations' ? [] : files(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

describe('franchise_knowledge values', () => {
  test('the lists match the migration that builds the columns', () => {
    for (const v of [...FK_EXTRACTED_BY, ...FK_CATEGORIES, ...FK_SEVERITIES]) expect(MIGRATION).toContain(`'${v}'`);
  });

  test("no file in src/ writes an extracted_by the column doesn't accept", () => {
    const bad = [];
    for (const f of files(SRC)) {
      const text = fs.readFileSync(f, 'utf8');
      // FranchiseTechKnowledge has its own column and values.
      if (/FranchiseTechKnowledge|franchise_tech_knowledge/.test(text) && !/franchise_knowledge\b/.test(text.replace(/franchise_tech_knowledge/g, ''))) continue;
      for (const m of text.matchAll(/extracted_by:\s*'([a-z_]+)'/g)) {
        if (!FK_EXTRACTED_BY.includes(m[1])) bad.push(`${path.relative(SRC, f)}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
