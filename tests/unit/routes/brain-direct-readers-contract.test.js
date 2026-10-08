// ============================================================================
// UNIT TEST — no reader picks Show Bible rules with its own query
// ============================================================================
// The wiring map (docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list
// item 25) found eight files reading franchise_knowledge for a prompt or a
// check with their own findAll or SELECT: no show scope, and an order
// Postgres chose. Each now selects through services/brainRules
// (selectRules or selectInjectedRules), which applies the show scope and
// the order, severity then id. What each takes is unchanged. Behaviour is
// pinned by tests/unit/services/brainRules.readers.test.js and
// tests/integration/brainDirectReaders.integration.test.js.

const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const slice = (src, from, to) => {
  const start = src.indexOf(from);
  const end = src.indexOf(to, start + from.length);
  if (start < 0 || end < 0) throw new Error(`slice not found: ${from} … ${to}`);
  return src.slice(start, end);
};
const OWN_QUERY = /FranchiseKnowledge\.findAll\(|FROM franchise_knowledge/;

const writer = read('src', 'services', 'episodeScriptWriterService.js');
const story = read('src', 'routes', 'storyEvaluationRoutes.js');
const brief = read('src', 'routes', 'episodeBriefRoutes.js');
const engine = read('src', 'routes', 'memories', 'engine.js');
const tier = read('src', 'routes', 'tierFeatures.js');
const upgrade = read('src', 'routes', 'upgradeRoutes.js');
// The post-generation review's own service (2026-10-08): Evaluate and the
// route both run it.
const review = read('src', 'services', 'postGenerationReview.js');
const brain = read('src', 'routes', 'franchiseBrainRoutes.js');
const amber = read('src', 'routes', 'memories', 'assistant.js');

describe('Show Bible readers select through brainRules', () => {
  test('the script writer: its rules and its auto-guard, both in the show\'s scope', () => {
    expect(writer).not.toMatch(OWN_QUERY);
    expect(writer).toMatch(/selectInjectedRules\(FranchiseKnowledge, \{ showId \}\)/);
    expect(writer).toMatch(/const guardEntries = await selectRules\(models\.FranchiseKnowledge, \{ showId, limit: 100 \}\)/);
  });

  test('the line rewrite: the Script tab\'s show, validated, the first 30 always-inject rules', () => {
    expect(brief).not.toMatch(OWN_QUERY);
    expect(brief).toMatch(/const showId = req\.body\.showId \|\| null;/);
    expect(brief).toMatch(/'showId must be a show id \(UUID\)'/);
    expect(brief).toMatch(/selectInjectedRules\(models\.FranchiseKnowledge, \{ showId, limit: 30 \}\)/);
  });

  test('the franchise guard: the body\'s show, validated, critical or always-inject', () => {
    const guard = slice(brain, "router.post('/franchise-brain/guard'", '// PUSH PAGE CONTENT TO BRAIN');
    expect(guard).not.toMatch(/findAll\(/);
    expect(guard).toMatch(/const showId = req\.body\.show_id \|\| null;/);
    expect(guard).toMatch(/'show_id must be a show id \(UUID\)'/);
    expect(guard).toMatch(/selectRules\(db\.FranchiseKnowledge, \{ showId, where: CRITICAL_OR_ALWAYS_INJECT \}\)/);
  });

  test('Amber\'s knowledge block: critical or always-inject, its use counted', () => {
    const inject = slice(brain, 'async function buildKnowledgeInjection', 'async function getTechContext');
    expect(inject).not.toMatch(/findAll\(|FranchiseKnowledge\.update\(/);
    expect(inject).toMatch(/selectRules\(db\.FranchiseKnowledge, \{ where: CRITICAL_OR_ALWAYS_INJECT \}\)/);
    expect(inject).toMatch(/recordRuleUse\(db\.sequelize, entries\.map\(e => e\.id\), 'Amber'\)/);
  });

  test('Amber\'s develop_world: the page\'s own entries and the franchise laws', () => {
    const develop = slice(amber, "case 'develop_world': {", "case 'read_relationships': {");
    expect(develop).not.toMatch(OWN_QUERY);
    expect(develop).toMatch(/selectRules\(db\.FranchiseKnowledge, \{ where: \{ source_document: sourceDoc \}, limit: 30 \}\)/);
    expect(develop).toMatch(/selectRules\(db\.FranchiseKnowledge, \{ where: \{ category: 'franchise_law' \}, limit: 10 \}\)/);
  });

  // The book's readers take the franchise tier only (Evoni's ruling,
  // 2026-10-08); story evaluation reads always_inject for its filter.
  test('WriteMode, story evaluation, the tier guard and the post-generation review: the franchise tier only', () => {
    for (const src of [engine, story, tier, upgrade, review]) expect(src).not.toMatch(/FranchiseKnowledge\.findAll\(/);
    expect(engine).toMatch(/selectRules\(FranchiseKnowledge, \{ franchiseOnly: true, limit: 15 \}\)/);
    expect(story).toMatch(/franchiseOnly: true,\s*where: CRITICAL_OR_ALWAYS_INJECT,\s*attributes: \[\.\.\.RULE_ATTRIBUTES, 'applies_to', 'always_inject'\],\s*limit: 20,/);
    expect(tier).toMatch(/selectRules\(db\.FranchiseKnowledge, \{\s*franchiseOnly: true,\s*where: \{ category: \['franchise_law', 'locked_decision', 'character', 'narrative'\] \},\s*\}\)/);
    expect(tier).toMatch(/recordRuleUse\(db\.sequelize, laws\.map\(l => l\.id\), 'franchise-guard-check'\)/);
    expect(tier).not.toMatch(/law\.update\(/);
    expect(review).toMatch(/selectRules\(db\.FranchiseKnowledge, \{ franchiseOnly: true, where: \{ severity: 'critical' \} \}\)/);
    expect(upgrade).toMatch(/const result = await reviewStory\(db, String\(story_id\)\);/);
  });

  test('Amber still reads every show\'s', () => {
    const inject = slice(brain, 'async function buildKnowledgeInjection', 'async function getTechContext');
    const develop = slice(amber, "case 'develop_world': {", "case 'read_relationships': {");
    for (const src of [inject, develop]) expect(src).not.toMatch(/franchiseOnly/);
  });
});
