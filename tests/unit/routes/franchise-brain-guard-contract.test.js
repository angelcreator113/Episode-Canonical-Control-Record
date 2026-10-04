// ============================================================================
// UNIT TEST — the guard contract, pinned from the route's side
// ============================================================================
// POST /franchise-brain/guard reads scene_brief (plus characters_in_scene,
// scene_type, tone) and answers one result format:
//   { status: 'passed' | 'issues' | 'check_failed', passed, warnings,
//     rules_checked, message }
// A check that could not run (the AI's verdict unreadable) is 'check_failed'
// with passed false. Until 2026-10-04 it answered passed: true ("allowing
// through"), so the Show Bible showed a green pass for a check that never
// happened; and the Show Bible sent scene_text, refused with 400. The page's
// side is pinned by frontend ShowBiblePage.guard.test.jsx.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'franchiseBrainRoutes.js'), 'utf8');
const start = SRC.indexOf("router.post('/franchise-brain/guard'");
const end = SRC.indexOf('// PUSH PAGE CONTENT TO BRAIN', start);
const handler = SRC.slice(start, end);
const helperStart = SRC.indexOf('const guardResult = (status');
const helper = SRC.slice(helperStart, start);

describe('franchise-brain guard contract', () => {
  test('the route reads scene_brief and refuses without it', () => {
    expect(handler).toMatch(/const\s*\{\s*scene_brief,\s*characters_in_scene,\s*scene_type,\s*tone\s*\}\s*=\s*req\.body/);
    expect(handler).toMatch(/'scene_brief is required'/);
    expect(handler).not.toMatch(/scene_text/);
  });

  test('one result format: status, passed derived from it, warnings, rules_checked, message', () => {
    expect(helper).toMatch(/\(\{\s*status,\s*passed:\s*status === 'passed',\s*warnings,\s*rules_checked,\s*message\s*\}\)/);
    expect(handler).toMatch(/guardResult\('passed', \[\], 0,/);
    expect(handler).toMatch(/guardResult\(status, warnings, laws\.length, message\)/);
  });

  test('a verdict that cannot be parsed is check_failed, never a pass, and is logged', () => {
    expect(handler).toMatch(/guardResult\('check_failed', \[\], laws\.length,/);
    expect(handler).not.toMatch(/passed:\s*true/);
    expect(handler).not.toMatch(/allowing through/);
    expect(handler).toMatch(/console\.error\('Franchise guard: could not parse the verdict:'/);
  });

  test('warnings are normalised to { law, risk, suggestion } and decide the status', () => {
    expect(handler).toMatch(/law:\s*String\(w\.law/);
    expect(handler).toMatch(/risk:\s*String\(w\.risk/);
    expect(handler).toMatch(/suggestion:\s*String\(w\.suggestion/);
    expect(handler).toMatch(/const status = warnings\.length > 0 \|\| parsed\.passed === false \? 'issues' : 'passed'/);
  });
});
