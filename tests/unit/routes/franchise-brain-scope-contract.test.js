// ============================================================================
// UNIT TEST — the scope contract, pinned from the route's side
// ============================================================================
// franchise_knowledge.scope ('franchise' | 'show') and show_id are stored
// (migration 20261004120000), no longer guessed from category. The list
// route filters by ?scope= and by ?show_id= (franchise plus that show's
// own entries); create and update read scope and show_id through one
// validator, and a franchise entry never keeps a show_id. The page's side
// is pinned by frontend ShowBiblePage.scope.test.jsx.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'franchiseBrainRoutes.js'), 'utf8');
const slice = (from, to) => { const a = SRC.indexOf(from); const b = SRC.indexOf(to, a); return SRC.slice(a, b); };
const list = slice("router.get('/franchise-brain/entries'", '// CREATE ENTRY');
const create = slice("router.post('/franchise-brain/entries'", '// UPDATE ENTRY');
const update = slice("router.patch('/franchise-brain/entries/:id'", '// DELETE ENTRY');
const validator = slice('const SCOPES =', "router.get('/franchise-brain/entries'");

describe('franchise-brain scope contract', () => {
  test('one validator: scope is franchise or show, show_id a UUID (shows.id), a franchise entry drops its show_id', () => {
    expect(validator).toMatch(/const SCOPES = \['franchise', 'show'\]/);
    expect(validator).toMatch(/'scope must be franchise or show'/);
    expect(validator).toMatch(/if \(scope === 'franchise'\) fields\.show_id = null/);
    expect(validator).toMatch(/'show_id must be a show id \(UUID\)'/);
    expect(validator).not.toMatch(/Number\(show_id\)/);
  });

  test('the list filters by scope and by show_id (franchise plus that show)', () => {
    expect(list).toMatch(/const \{ category, status, severity, scope, show_id \} = req\.query/);
    expect(list).toMatch(/where\.scope = scope/);
    expect(list).toMatch(/where\[Op\.or\] = \[\{ scope: 'franchise' \}, \{ show_id \}\]/);
  });

  test('create stores scope (default franchise) and show_id', () => {
    expect(create).toMatch(/scope, show_id \} = req\.body/);
    expect(create).toMatch(/scopeFields\(\{ scope: scope === undefined \? 'franchise' : scope, show_id \}\)/);
    expect(create).toMatch(/scope: scoped\.fields\.scope,\s*show_id: scoped\.fields\.show_id \?\? null/);
  });

  test('update accepts scope and show_id even on a synced entry', () => {
    expect(update).toMatch(/always_inject, scope, show_id \} = req\.body/);
    expect(update).toMatch(/Object\.assign\(updates, scoped\.fields\)/);
    // The 409 guard covers the words a source owns, not the scope.
    expect(update).toMatch(/\[title, content, category, severity\]\.some/);
  });

  test('the model declares both columns', () => {
    const model = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'models', 'FranchiseKnowledge.js'), 'utf8');
    expect(model).toMatch(/scope: \{[\s\S]*?defaultValue: 'franchise'[\s\S]*?isIn: \[\['franchise', 'show'\]\]/);
    expect(model).toMatch(/show_id:\s*\{ type: DataTypes\.UUID, allowNull: true \}/);
  });
});
