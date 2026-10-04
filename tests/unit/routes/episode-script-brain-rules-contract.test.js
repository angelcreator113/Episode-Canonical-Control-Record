// ============================================================================
// UNIT TEST — the script writer uses the recorded Brain selection
// ============================================================================
// loadScriptContext takes its Show Brain rules from services/brainRules
// (deterministic, scoped to the show, the omitted rules named), the saved
// script's context_snapshot carries brain_rules, the context route answers
// brain_rules, and the grounded generator uses the same selector. Until
// 2026-10-04 the writer took the first 50 always_inject rows in whatever
// order Postgres returned them, with 104 marked, and recorded only ids.

const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const writer = read('src', 'services', 'episodeScriptWriterService.js');
const grounded = read('src', 'services', 'groundedScriptGeneratorService.js');
const route = read('src', 'routes', 'episodeScriptWriterRoutes.js');

describe('episode script writer: Brain rules contract', () => {
  test('loadScriptContext selects through brainRules with the show and records the selection', () => {
    expect(writer).toMatch(/selectInjectedRules\(FranchiseKnowledge, \{ showId \}\)/);
    expect(writer).toMatch(/context\.franchiseLaws = selection\.rules/);
    expect(writer).toMatch(/context\.franchiseLawIds = selection\.used\.map\(l => l\.id\)/);
    expect(writer).toMatch(/context\.brainRules = brainRulesRecord\(selection\)/);
    expect(writer).not.toMatch(/where: \{ status: 'active', always_inject: true \},\s*attributes: \['id', 'title', 'content', 'category'\],\s*limit: 50/);
  });

  test('the saved script keeps brain_rules in its context_snapshot', () => {
    expect(writer).toMatch(/brain_rules: context\.brainRules,/);
  });

  test('the context route answers brain_rules', () => {
    expect(route).toMatch(/brain_rules: context\.brainRules,/);
  });

  test('the grounded generator uses the same selector', () => {
    expect(grounded).toMatch(/selectInjectedRules\(FranchiseKnowledge, \{ showId \}\)/);
    expect(grounded).not.toMatch(/limit: 50/);
  });
});
