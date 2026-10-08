// ============================================================================
// UNIT TEST — the tension scanner and proposal contracts, from the routes' side
// ============================================================================
// GET /world/tension-scanner answers { status: 'ok' | 'scan_failed', pairs,
// count, characters_scanned, error? }, each pair with char_a: { id, name,
// world_tag } and char_b: { id, name }. POST /world/create-tension-proposal
// reads that pair ({ char_a, char_b, … }; the older flat char_a_name /
// char_b_name still read) and keeps the ids in the proposal (character_ids)
// beside the name slugs (characters). Until 2026-10-04 the scanner answered
// an empty list on failure, and the page sent char_a_id / char_b_id, which
// the route never read. The page's side: frontend
// WorldDashboard.tensions.test.jsx.
//
// Since 2026-10-08 the scanner reads character_relationships, the table the
// Relationships page edits, and no longer World Studio's relationship_graph
// (Evoni's ruling, wiring map fix-list item 23); the pairs are registry
// characters. Behaviour: tests/integration/worldStudioTension.integration.test.js.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldStudio.js'), 'utf8');
const slice = (from, to) => SRC.slice(SRC.indexOf(from), SRC.indexOf(to, SRC.indexOf(from)));
const scanner = slice("router.get('/world/tension-scanner'", "router.post('/world/create-story-task'");
const proposal = slice("router.post('/world/create-tension-proposal'", "router.get('/world/context-summary'");
const summary = slice("router.get('/world/context-summary'", 'WORLD MAP');
const confirmed = slice('const confirmedRelationships = (req) => Q(req,', '/** Every relationship of one registry character');

describe('world tension scanner contract', () => {
  test('the pairs are confirmed character_relationships rows, never the World Studio graph', () => {
    expect(scanner).toMatch(/const rows = await confirmedRelationships\(req\);/);
    expect(scanner).not.toMatch(/relationship_graph/);
    expect(confirmed).toMatch(/FROM character_relationships cr/);
    expect(confirmed).toMatch(/WHERE cr\.confirmed = true AND cr\.deleted_at IS NULL/);
    expect(confirmed).toMatch(/JOIN registry_characters ra ON ra\.id = cr\.character_id_a AND ra\.deleted_at IS NULL/);
  });
  test('pairs carry their characters as objects with ids', () => {
    expect(scanner).toMatch(/char_a:\s*\{\s*id:\s*r\.a_id,\s*name:\s*r\.a_name,\s*world_tag:\s*r\.a_world_tag \|\| null\s*\}/);
    expect(scanner).toMatch(/char_b:\s*\{\s*id:\s*r\.b_id,\s*name:\s*r\.b_name\s*\}/);
    expect(scanner).toMatch(/relationship_id:\s*r\.id/);
  });
  test('the scanner and the context summary share one high-tension check and one source', () => {
    expect(SRC).toMatch(/const \{ isHighTension \} = require\('\.\.\/services\/tensionLevels'\)/);
    expect(scanner).toMatch(/rows\.filter\(\(r\) => isHighTension\(r\.tension_state\)\)/);
    expect(summary).toMatch(/tensionCount = \(await confirmedRelationships\(req\)\)\.filter\(\(r\) => isHighTension\(r\.tension_state\)\)\.length;/);
    expect(summary).not.toMatch(/relationship_graph/);
    // No caller keeps its own list again.
    expect(SRC).not.toMatch(/\['Simmering', 'Explosive'/);
  });
  test('a scan says whether it ran, and a failed one is logged, not an empty list', () => {
    expect(scanner).toMatch(/res\.json\(\{\s*status:\s*'ok',\s*pairs,\s*count:\s*pairs\.length,\s*characters_scanned:\s*characters\.size\s*\}\)/);
    expect(scanner).toMatch(/status:\s*'scan_failed'/);
    expect(scanner).toMatch(/console\.error\('\[world-studio\] tension scan failed:'/);
    expect(scanner).not.toMatch(/catch \(err\) \{ res\.json\(\{ pairs: \[\], count: 0 \}\); \}/);
  });
});

describe('world tension proposal contract', () => {
  test('reads the scanner pair, with the flat names as a fallback', () => {
    expect(proposal).toMatch(/const\s*\{\s*char_a,\s*char_b,\s*tension_state,\s*relationship_type,\s*conflict_summary,\s*romantic\s*\}\s*=\s*req\.body/);
    expect(proposal).toMatch(/char_a\?\.name \|\| req\.body\.char_a_name/);
    expect(proposal).toMatch(/'char_a\.name and char_b\.name required'/);
  });
  test('keeps the character ids in the proposal beside the name slugs', () => {
    expect(proposal).toMatch(/character_ids:\s*\[char_a\?\.id,\s*char_b\?\.id\]\.filter/);
    expect(proposal).toMatch(/characters:\s*\[char_a_name\.toLowerCase/);
  });
});
