// ============================================================================
// UNIT TEST — world_facts is a list at every door (review item 8)
// ============================================================================
// POST and PUT /world/state/snapshots refuse a world_facts that is not a
// list of facts (400, through services/worldFacts normalizeFacts); the
// context summary, scene proposals and story evaluation read facts through
// factsOf; the temperature service never writes world_facts as an object.

const fs = require('fs');
const path = require('path');
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');
const studio = read('src', 'routes', 'worldStudio.js');
const slice = (src, from, to) => { const a = src.indexOf(from); return src.slice(a, src.indexOf(to, a)); };

describe('world snapshots: the world_facts contract', () => {
  test('create and update normalize world_facts and refuse a non-list', () => {
    const create = slice(studio, "router.post('/world/state/snapshots'", '// PUT /world/state/snapshots/:id');
    const update = slice(studio, "router.put('/world/state/snapshots/:id'", '// DELETE /world/state/snapshots/:id');
    expect(create).toMatch(/const facts = normalizeFacts\(world_facts\);\s*if \(facts\.error\) return res\.status\(400\)/);
    expect(create).toMatch(/world_facts: facts\.facts/);
    expect(create).not.toMatch(/world_facts: world_facts \|\| \[\]/);
    expect(update).toMatch(/normalizeFacts\(updates\.world_facts\)/);
    expect(update).toMatch(/updates\.world_facts = facts\.facts/);
  });

  test('the readers go through factsOf', () => {
    expect(slice(studio, "router.get('/world/context-summary'", '// Location names')).toMatch(/facts = factsOf\(snap\)\.slice\(0, 8\)/);
    expect(read('src', 'routes', 'storyEvaluationRoutes.js')).toMatch(/const facts = factsOf\(snapshot\);/);
    expect(read('src', 'routes', 'sceneProposeRoute.js')).toMatch(/const facts = factsOf\(snapshot\);/);
    for (const f of ['worldStudio.js', 'storyEvaluationRoutes.js', 'sceneProposeRoute.js']) {
      expect(read('src', 'routes', f)).not.toMatch(/Array\.isArray\(snap(shot)?\.world_facts\)/);
    }
  });

  test('the temperature service writes metadata.world_temperature and a list of facts', () => {
    const svc = read('src', 'services', 'worldTemperatureService.js');
    expect(svc).toMatch(/world_temperature: \{ value: temperature, updated_at: new Date\(\)\.toISOString\(\) \}/);
    expect(svc).toMatch(/world_facts: factsOf\(existing\)/);
    expect(svc).not.toMatch(/worldTemperature: temperature/);
    expect(svc).not.toMatch(/snapshot\.world_facts\?\.worldTemperature/);
  });
});
