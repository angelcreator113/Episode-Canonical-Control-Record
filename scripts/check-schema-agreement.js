#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * check-schema-agreement.js — where code disagrees with the schema (Task #1861)
 *
 * A static read, no database. It loads the Sequelize models with no connection
 * (Sequelize does not connect until a query runs) and parses source with
 * @babel/parser (pinned exactly in devDependencies, Task #1871).
 *
 *   Step 1  query vs model:   literal attribute names in Model.findAll/findOne/
 *           findByPk/findAndCountAll/count/update/destroy/create/bulkCreate/
 *           findOrCreate/upsert/increment/decrement/sum/max/min calls in src/
 *           (where incl. Op.or/Op.and/Op.not, attributes, order, group, include,
 *           create/update values) checked against rawAttributes (names and
 *           fields) and association aliases.
 *   Step 2  model vs migrations: every table rebuilt by replaying src/migrations/
 *           statically (createTable/addColumn/removeColumn/renameColumn/
 *           renameTable/dropTable and DDL inside sequelize.query strings),
 *           compared with every model in sequelize.models.
 *   Step 3  raw SQL: sequelize.query strings in src/ (outside migrations):
 *           INSERT column lists, UPDATE SET targets, alias.column references and,
 *           for single-table statements, bare WHERE columns — checked against
 *           the step 2 tables.
 *   Step 4  mocks: rows returned by fake models in tests/ (an object keyed by a
 *           model name, a mockResolvedValue on a model method, local row
 *           builders and the parameters that feed them) and where/values in
 *           toHaveBeenCalledWith on a model method — undeclared keys and enum
 *           values outside the declared ENUM.
 *
 * Anything it cannot resolve (dynamic keys, spreads of unknown objects, unknown
 * receivers, computed SQL) is counted as unresolved, never guessed.
 *
 * Usage:
 *   node scripts/check-schema-agreement.js                 summary + every hit
 *   node scripts/check-schema-agreement.js --root <dir>    read another checkout
 *                                                          (needs node_modules
 *                                                          reachable from it)
 *   node scripts/check-schema-agreement.js --json <file>   full report as JSON
 *   node scripts/check-schema-agreement.js --unresolved    also list unresolved
 *   node scripts/check-schema-agreement.js --capture <file>
 *        annotate every hit with a column-level schema capture (psql output of
 *        table_name | column_name | ..., e.g. docs/audit/
 *        EvidenceNote_Canon_Schema_Capture_2026-09-17.txt): [cap: present |
 *        ABSENT | no table]. Reads a file only; no database.
 *   node scripts/check-schema-agreement.js --baseline <file> [--update-baseline]
 *        step 1 as a ratchet: fail only on hits whose key is not in the baseline
 *   node scripts/check-schema-agreement.js --step2-baseline <file> [--update-baseline]
 *        step 2 as a ratchet (Task #1875): fail only on model-vs-migration
 *        findings whose key is not in the baseline. The two flags are
 *        independent; with both, --update-baseline rewrites both files.
 *
 * Exit code: 0 always in report mode; in --baseline / --step2-baseline mode 1
 * when the gated step has a finding its baseline does not list. A baseline
 * entry that no longer occurs is printed as GONE and does not fail; the
 * baseline should only shrink.
 *
 * CI (Task #1871): .github/workflows/validate.yml runs
 *   node scripts/check-schema-agreement.js --baseline scripts/schema-agreement.baseline
 * in the Route Validation job, next to the silent-catch lint. Baseline keys are
 * `file<TAB>Model.method<TAB>clause<TAB>name` (no line numbers), one per line,
 * generated with --update-baseline, never edited by hand.
 *
 * CI (Task #1875): the same job also runs
 *   node scripts/check-schema-agreement.js --step2-baseline scripts/schema-agreement-step2.baseline
 * Step 2 keys are `Model<TAB>column<TAB>kind` (no line numbers), kind one of
 *   missing-column          a declared (non-VIRTUAL) column no live migration creates
 *   paranoid-no-deleted_at  a paranoid model whose table has no deletedAt column
 *   no-table                a model whose table no live migration creates
 *                           (column slot is `-`)
 * generated with --update-baseline, never edited by hand. Models whose table
 * the live tree only alters (ALTERONLY) have no columns compared and are not
 * keyed.
 *
 * Boundary of step 2 (Evoni, 2026-09-25): MIGRATIONS ARE NOT PRODUCTION.
 * Step 2 compares models with the migration tree replayed statically, not
 * with any database; 35 of the 49 "missing" columns in docs/
 * SCHEMA_AGREEMENT_READ.md exist in production. This gate catches drift
 * introduced in code against the migration tree (a model declaring a column,
 * a paranoid deleted_at or a table that no live migration creates). Drift
 * between the migrations and the live database is a different job, done by
 * scripts/check-pending-migrations.js and docs/MIGRATION_DRIFT_READ.md.
 * Two tools, two jobs.
 *
 * Blind spots of the ratchet (what a green run does NOT prove):
 *   - Only steps 1 and 2 are gated. Steps 3-4 (raw SQL, mocks) print a report
 *     and never affect the exit code.
 *   - Step 2 says nothing about production: a baselined missing-column may
 *     exist in the live database, and a column every migration creates may
 *     still be absent there.
 *   - Step 2 keys ignore the table name and migration line: a model moved to
 *     another table with the same gaps, or a gap closed and reopened, is not
 *     reported. Tables with unresolved ops ([table has unresolved ops]) are
 *     compared all the same; an unresolved createTable can hide a gap.
 *   - Instance calls are not checked: row.update({...}), row.save(), row.set()
 *     and other methods on a fetched instance have a non-model receiver.
 *   - Non-model receivers are not checked: a call is attributed only when the
 *     receiver is a model name (`Foo`), a property named after one
 *     (`models.Foo`, `db.Foo`), or a local variable assigned from either.
 *     Anything else (services, dynamic `models[name]`, `this.model`) is
 *     counted, not checked.
 *   - Unresolved names (dynamic keys, spreads of unknown objects, computed
 *     attribute lists) are counted as unresolved, never flagged.
 */

const fs = require('fs');
const path = require('path');

// ─── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argVal(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}
const ROOT = path.resolve(argVal('--root') || path.join(__dirname, '..'));
const JSON_OUT = argVal('--json');
const SHOW_UNRESOLVED = argv.includes('--unresolved');
const BASELINE = argVal('--baseline');
const BASELINE2 = argVal('--step2-baseline');
const UPDATE_BASELINE = argv.includes('--update-baseline');
const CAPTURE = argVal('--capture');

const parser = require(require.resolve('@babel/parser', { paths: [ROOT, __dirname] }));

function parse(file) {
  const src = fs.readFileSync(file, 'utf8');
  return parser.parse(src, {
    sourceType: 'unambiguous',
    errorRecovery: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    plugins: ['jsx', 'classProperties', 'classPrivateProperties', 'optionalChaining', 'objectRestSpread', 'topLevelAwait'],
  });
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out);
    else if (/\.(c?js)$/.test(ent.name)) out.push(p);
  }
  return out;
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// Generic AST walk with parent links.
function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'leadingComments' ||
        key === 'trailingComments' || key === 'innerComments' || key === 'extra' || key === '_parent') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') { c._parent = node; walk(c, visit, node); } }
    else if (v && typeof v.type === 'string') { v._parent = node; walk(v, visit, node); }
  }
}
const isFn = (n) => n && /^(ArrowFunctionExpression|FunctionExpression|FunctionDeclaration|ObjectMethod|ClassMethod)$/.test(n.type);
const keyName = (prop) => {
  if (!prop || prop.computed) return null;
  const k = prop.key;
  if (!k) return null;
  if (k.type === 'Identifier') return k.name;
  if (k.type === 'StringLiteral') return k.value;
  if (k.type === 'NumericLiteral') return String(k.value);
  return null;
};
const memberProp = (m) => {
  if (!m || !/MemberExpression$/.test(m.type)) return null;
  if (!m.computed && m.property.type === 'Identifier') return m.property.name;
  if (m.property.type === 'StringLiteral') return m.property.value;
  return null;
};
const strOf = (n) => (n && n.type === 'StringLiteral' ? n.value
  : n && n.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const lineOf = (n) => (n && n.loc ? n.loc.start.line : 0);

// ─── models (no connection) ─────────────────────────────────────────────────
function loadModels() {
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '1';
  delete process.env.DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  const log = console.log; const warn = console.warn;
  console.log = () => {}; console.warn = () => {};
  let db;
  try { db = require(path.join(ROOT, 'src/models')); } finally { console.log = log; console.warn = warn; }
  const out = {};
  for (const [name, M] of Object.entries(db.sequelize.models)) {
    const attrs = new Set(); const fields = new Set(); const enums = {}; const virtual = new Set();
    const fieldOf = {};
    for (const [a, def] of Object.entries(M.rawAttributes)) {
      attrs.add(a); const f = def.field || a; fields.add(f); fieldOf[a] = f;
      const tkey = def.type && (def.type.key || (def.type.constructor && def.type.constructor.key));
      if (tkey === 'VIRTUAL') virtual.add(a);
      if (tkey === 'ENUM' && Array.isArray(def.type.values)) { enums[a] = def.type.values; enums[f] = def.type.values; }
    }
    let table = M.getTableName(); if (table && typeof table === 'object') table = table.tableName;
    const deletedAtAttr = M._timestampAttributes && M._timestampAttributes.deletedAt;
    out[name] = {
      name, table: String(table), attrs, fields, fieldOf, enums, virtual,
      aliases: new Set(Object.keys(M.associations || {})),
      assocTarget: Object.fromEntries(Object.entries(M.associations || {}).map(([k, a]) => [k, a.target && a.target.name])),
      paranoid: !!M.options.paranoid,
      deletedAtField: deletedAtAttr ? (M.rawAttributes[deletedAtAttr] && M.rawAttributes[deletedAtAttr].field) || deletedAtAttr : null,
    };
  }
  // export aliases (db.X where X differs from the model name)
  const exportAlias = {};
  for (const [k, v] of Object.entries(db)) if (v && v.rawAttributes && v.name && out[v.name] && k !== v.name) exportAlias[k] = v.name;
  return { models: out, exportAlias };
}

const { models: MODELS, exportAlias: EXPORT_ALIAS } = loadModels();
const MODEL_NAMES = new Set([...Object.keys(MODELS), ...Object.keys(EXPORT_ALIAS)]);
const canon = (n) => EXPORT_ALIAS[n] || n;
function declared(model, name) {
  const m = MODELS[model];
  return m.attrs.has(name) || m.fields.has(name) || m.aliases.has(name);
}

// ─── step 1: query vs model ─────────────────────────────────────────────────
const MODEL_METHODS = new Set(['findAll', 'findOne', 'findByPk', 'findAndCountAll', 'count', 'update', 'destroy',
  'create', 'bulkCreate', 'findOrCreate', 'upsert', 'increment', 'decrement', 'sum', 'max', 'min']);
// Methods that exist only on a model class: an unknown receiver calling one is
// an unresolved model call. create/update/destroy/count/increment/sum/max/min
// also exist on instances and on non-Sequelize objects, so an unknown receiver
// calling one is counted separately and not treated as a model call.
const MODEL_ONLY = new Set(['findAll', 'findOne', 'findByPk', 'findAndCountAll', 'bulkCreate', 'findOrCreate', 'upsert']);
const DIRECTIONS = /^(ASC|DESC|NULLS FIRST|NULLS LAST|ASC NULLS (FIRST|LAST)|DESC NULLS (FIRST|LAST))$/i;

function step1() {
  const files = walkFiles(path.join(ROOT, 'src')).filter(f => !rel(f).startsWith('src/migrations/'));
  const hits = []; const unresolved = []; const unknownOther = [];
  let calls = 0; let callsPartial = 0; let namesChecked = 0;

  for (const file of files) {
    let ast; try { ast = parse(file); } catch (e) { unresolved.push({ file: rel(file), line: 0, reason: `parse error: ${e.message}` }); continue; }
    const alias = {};
    // pass 1: aliases
    walk(ast, (n) => {
      if (n.type === 'ObjectPattern') {
        for (const p of n.properties) {
          const k = keyName(p);
          if (k && MODEL_NAMES.has(k)) {
            const v = p.value && p.value.type === 'AssignmentPattern' ? p.value.left : p.value;
            if (v && v.type === 'Identifier') alias[v.name] = canon(k);
          }
        }
      }
    });
    const resolveModel = (node) => {
      if (!node) return null;
      if (node.type === 'Identifier') {
        if (alias[node.name]) return alias[node.name];
        if (MODEL_NAMES.has(node.name)) return canon(node.name);
        return null;
      }
      const p = memberProp(node);
      if (p && MODEL_NAMES.has(p)) return canon(p);
      return null;
    };
    walk(ast, (n) => {
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) {
        const m = resolveModel(n.init.type === 'AwaitExpression' ? n.init.argument : n.init);
        if (m) alias[n.id.name] = m;
      }
    });

    // resolve an identifier to its declaration in the nearest enclosing scope
    const resolveIdent = function resolveIdent(name, from) {
      let scope = from._parent;
      while (scope) {
        if (isFn(scope) || scope.type === 'Program') {
          let found = null; const extra = [];
          const body = scope.type === 'Program' ? scope : scope.body;
          walk(body, (x) => {
            if (x !== body && isFn(x)) return false;
            if (x.type === 'VariableDeclarator' && x.id.type === 'Identifier' && x.id.name === name && x.init) found = found || x.init;
            if (x.type === 'AssignmentExpression' && x.left.type === 'MemberExpression' &&
                x.left.object.type === 'Identifier' && x.left.object.name === name) extra.push(x);
            return undefined;
          });
          if (found) return { init: found, extra };
          if (isFn(scope) && scope.params.some(p => p.type === 'Identifier' && p.name === name)) return null;
        }
        scope = scope._parent;
      }
      return null;
    }

    walk(ast, (n) => {
      if (n.type !== 'CallExpression' && n.type !== 'OptionalCallExpression') return;
      const method = memberProp(n.callee);
      if (!method || !MODEL_METHODS.has(method)) return;
      const recv = n.callee.object;
      const model = resolveModel(recv);
      const f = rel(file);
      if (!model) {
        const text = srcText(file, recv);
        if (MODEL_ONLY.has(method)) unresolved.push({ file: f, line: lineOf(n), reason: `unknown receiver ${text}.${method}` });
        else unknownOther.push({ file: f, line: lineOf(n), recv: text, method });
        return;
      }
      calls++;
      const ctx = { file: f, model, method, partial: false };
      const hit = (m, name, where, node) => {
        namesChecked++;
        if (!declared(m, name)) hits.push({ file: f, line: lineOf(node), model: m, method, clause: where, name, callLine: lineOf(n), recv: srcText(file, recv) });
      };
      const unres = (reason, node) => { ctx.partial = true; unresolved.push({ file: f, line: lineOf(node), reason: `${model}.${method}: ${reason}` }); };

      const checkName = (m, raw, clause, node) => {
        if (typeof raw !== 'string') return;
        if (raw.startsWith('$') && raw.endsWith('$')) return checkNested(m, raw.slice(1, -1), clause, node);
        const name = raw.split('.')[0].split('->')[0];
        hit(m, name, clause, node);
      };
      const checkNested = (m, dotted, clause, node) => {
        const segs = dotted.split('.');
        let cur = m;
        for (let i = 0; i < segs.length - 1; i++) {
          const mi = MODELS[cur];
          if (!mi.aliases.has(segs[i])) { hit(cur, segs[i], `${clause}($nested$ alias)`, node); return; }
          cur = mi.assocTarget[segs[i]]; if (!cur || !MODELS[cur]) return;
        }
        hit(cur, segs[segs.length - 1], `${clause}($nested$)`, node);
      };
      const isOpKey = (k) => /MemberExpression$/.test(k.type) && (
        (k.object.type === 'Identifier' && /^(Op|Sequelize|sequelize)$/.test(k.object.name)) || memberProp(k.object) === 'Op');
      const derefObj = (node, what) => {
        if (!node) return null;
        if (node.type === 'ObjectExpression') return { obj: node, extra: [] };
        if (node.type === 'Identifier') {
          const r = resolveIdent(node.name, node);
          if (r && r.init.type === 'ObjectExpression') return { obj: r.init, extra: r.extra };
          unres(`${what} is ${node.name} (not a local object literal)`, node); return null;
        }
        unres(`${what} is a ${node.type}`, node); return null;
      };
      const checkWhere = (m, node, depth = 0) => {
        if (!node || depth > 6) return;
        if (node.type === 'ArrayExpression') { node.elements.forEach(e => checkWhere(m, e, depth + 1)); return; }
        const d = derefObj(node, 'where'); if (!d) return;
        for (const p of d.obj.properties) {
          if (p.type === 'SpreadElement') { checkWhere(m, p.argument, depth + 1); continue; }
          if (p.computed) {
            if (isOpKey(p.key)) {
              const op = memberProp(p.key);
              if (/^(or|and|not)$/.test(op)) checkWhere(m, p.value, depth + 1);
            } else if (p.key.type === 'StringLiteral') checkName(m, p.key.value, 'where', p);
            else unres('computed where key', p);
            continue;
          }
          const k = keyName(p); if (k) checkName(m, k, 'where', p);
        }
        for (const a of d.extra) {
          const k = memberProp(a.left);
          if (k) checkName(m, k, 'where(assigned)', a);
          else if (a.left.computed && isOpKey(a.left.property)) checkWhere(m, a.right, depth + 1);
          else unres('computed where key (assigned)', a);
        }
      };
      const checkAttributes = (m, node) => {
        if (!node) return;
        if (node.type === 'ArrayExpression') {
          for (const e of node.elements) {
            if (!e) continue;
            const s = strOf(e);
            if (s != null) checkName(m, s, 'attributes', e);
            else if (e.type === 'ArrayExpression') { const s0 = strOf(e.elements[0]); if (s0 != null) checkName(m, s0, 'attributes', e); }
            else if (e.type === 'SpreadElement' || e.type === 'Identifier') unres('attributes element not literal', e);
          }
          return;
        }
        if (node.type === 'ObjectExpression') {
          for (const p of node.properties) {
            const k = keyName(p);
            if (k === 'exclude' || k === 'include') checkAttributes(m, p.value);
          }
          return;
        }
        if (node.type === 'Identifier') { const r = resolveIdent(node.name, node); if (r && /ArrayExpression|ObjectExpression/.test(r.init.type)) return checkAttributes(m, r.init); }
        unres(`attributes is a ${node.type}`, node);
      };
      const checkOrder = (m, node) => {
        if (!node) return;
        if (node.type !== 'ArrayExpression') { if (node.type !== 'StringLiteral' && node.type !== 'CallExpression') unres(`order is a ${node.type}`, node); return; }
        for (const e of node.elements) {
          if (!e) continue;
          const s = strOf(e);
          if (s != null) { if (!/\s/.test(s)) checkName(m, s, 'order', e); continue; }
          if (e.type !== 'ArrayExpression') continue; // sequelize.literal / fn
          const parts = e.elements.slice();
          const last = strOf(parts[parts.length - 1]);
          if (parts.length > 1 && last != null && DIRECTIONS.test(last)) parts.pop();
          if (!parts.every(x => strOf(x) != null)) continue; // [Model, 'col'] / literals
          const segs = parts.map(strOf);
          if (segs.length === 1) checkName(m, segs[0], 'order', e);
          else checkNested(m, segs.join('.'), 'order', e);
        }
      };
      const checkGroup = (m, node) => {
        if (!node) return;
        const s = strOf(node); if (s != null) { if (!s.includes('.')) checkName(m, s, 'group', node); return; }
        if (node.type === 'ArrayExpression') for (const e of node.elements) { const t = strOf(e); if (t != null && !t.includes('.')) checkName(m, t, 'group', e); }
      };
      const checkValues = (m, node, clause) => {
        if (!node) return;
        if (node.type === 'ArrayExpression') { node.elements.forEach(e => e && checkValues(m, e, clause)); return; }
        if (node.type === 'CallExpression' && memberProp(node.callee) === 'map' && isFn(node.arguments[0])) {
          const fn = node.arguments[0];
          if (fn.body.type === 'ObjectExpression') return checkValues(m, fn.body, clause);
          unres(`${clause} built by .map with a block body`, node); return;
        }
        const d = derefObj(node, clause); if (!d) return;
        for (const p of d.obj.properties) {
          if (p.type === 'SpreadElement') {
            if (p.argument.type === 'ObjectExpression' || p.argument.type === 'Identifier') {
              const inner = p.argument.type === 'Identifier' ? resolveIdent(p.argument.name, p.argument) : { init: p.argument, extra: [] };
              if (inner && inner.init.type === 'ObjectExpression') { checkValues(m, inner.init, clause); continue; }
            }
            unres(`${clause} spreads ${p.argument.type === 'Identifier' ? p.argument.name : p.argument.type}`, p); continue;
          }
          if (p.type === 'ObjectMethod') continue;
          if (p.computed) { if (p.key.type === 'StringLiteral') checkName(m, p.key.value, clause, p); else unres(`computed ${clause} key`, p); continue; }
          const k = keyName(p); if (k) checkName(m, k, clause, p);
        }
        for (const a of d.extra) { const k = memberProp(a.left); if (k) checkName(m, k, `${clause}(assigned)`, a); else unres(`computed ${clause} key (assigned)`, a); }
      };
      const checkInclude = (m, node, depth = 0) => {
        if (!node || depth > 5) return;
        const list = node.type === 'ArrayExpression' ? node.elements : [node];
        for (const e of list) {
          if (!e) continue;
          const s = strOf(e);
          if (s != null) { if (!MODELS[m].aliases.has(s)) hits.push({ file: f, line: lineOf(e), model: m, method, clause: 'include(alias)', name: s, callLine: lineOf(n) }); continue; }
          if (e.type !== 'ObjectExpression') continue;
          let target = null; let as = null; let assoc = null;
          for (const p of e.properties) {
            const k = keyName(p);
            if (k === 'model') target = resolveModel(p.value);
            if (k === 'as') as = strOf(p.value);
            if (k === 'association') assoc = strOf(p.value);
          }
          const a = as || assoc;
          if (a != null) {
            namesChecked++;
            if (!MODELS[m].aliases.has(a)) hits.push({ file: f, line: lineOf(e), model: m, method, clause: 'include(as)', name: a, callLine: lineOf(n) });
            else if (!target) target = MODELS[m].assocTarget[a];
          }
          if (target && MODELS[target]) checkOptions(target, e, depth + 1);
        }
      };
      const checkOptions = (m, node, depth = 0) => {
        if (!node) return;
        if (node.type === 'Identifier') { const r = resolveIdent(node.name, node); if (r && r.init.type === 'ObjectExpression') node = r.init; else { unres(`options is ${node.name}`, node); return; } }
        if (node.type !== 'ObjectExpression') { unres(`options is a ${node.type}`, node); return; }
        for (const p of node.properties) {
          if (p.type === 'SpreadElement') { unres('options spread', p); continue; }
          const k = keyName(p);
          if (k === 'where') checkWhere(m, p.value);
          else if (k === 'attributes') checkAttributes(m, p.value);
          else if (k === 'order') checkOrder(m, p.value);
          else if (k === 'group') checkGroup(m, p.value);
          else if (k === 'include') checkInclude(m, p.value, depth);
          else if (k === 'defaults') checkValues(m, p.value, 'defaults');
          else if (k === 'fields' && p.value.type === 'ArrayExpression') p.value.elements.forEach(e => { const s = strOf(e); if (s != null) checkName(m, s, 'fields', e); });
        }
      };

      const a = n.arguments;
      switch (method) {
        case 'findByPk': checkOptions(model, a[1]); break;
        case 'update': checkValues(model, a[0], 'values'); checkOptions(model, a[1]); break;
        case 'create': case 'upsert': checkValues(model, a[0], 'values'); checkOptions(model, a[1]); break;
        case 'bulkCreate': checkValues(model, a[0], 'values'); checkOptions(model, a[1]); break;
        case 'increment': case 'decrement': {
          const s = strOf(a[0]);
          if (s != null) checkName(model, s, 'fields', a[0]);
          else if (a[0] && a[0].type === 'ArrayExpression') a[0].elements.forEach(e => { const t = strOf(e); if (t != null) checkName(model, t, 'fields', e); });
          else if (a[0] && a[0].type === 'ObjectExpression') checkValues(model, a[0], 'fields');
          checkOptions(model, a[1]); break;
        }
        case 'sum': case 'max': case 'min': { const s = strOf(a[0]); if (s != null) checkName(model, s, 'field', a[0]); checkOptions(model, a[1]); break; }
        default: if (a[0]) checkOptions(model, a[0]);
      }
      if (ctx.partial) callsPartial++;
    });
  }
  return { hits, unresolved, unknownOther, calls, callsPartial, namesChecked, files: files.length };
}

const SRC_CACHE = {};
function srcText(file, node) {
  if (!SRC_CACHE[file]) SRC_CACHE[file] = fs.readFileSync(file, 'utf8');
  return SRC_CACHE[file].slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 60);
}

// ─── step 2: migrations replay ──────────────────────────────────────────────
const UNKNOWN = Symbol('unknown');
const QI = { kind: 'qi' }; const QSEQ = { kind: 'qi.sequelize' };

function step2() {
  const dir = path.join(ROOT, 'src/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const tables = {}; // name -> { cols: Map(col -> file), uncertain: [], createdBy }
  const unresolved = []; let ops = 0; let sqlStatements = 0;
  const T = (name) => (tables[name] = tables[name] || { cols: new Map(), uncertain: [], createdBy: null, dropped: null });

  for (const fname of files) {
    const file = path.join(dir, fname); const f = `src/migrations/${fname}`;
    let ast; try { ast = parse(file); } catch (e) { unresolved.push({ file: f, line: 0, reason: `parse error ${e.message}` }); continue; }
    let depth = 0;

    const note = (reason, node) => unresolved.push({ file: f, line: lineOf(node), reason });
    const tname = (v) => (typeof v === 'string' ? v.replace(/^public\./, '') : v && typeof v === 'object' && typeof v.tableName === 'string' ? v.tableName : null);

    const lookup = (env, name) => { for (let e = env; e; e = e.parent) if (e.vars.has(name)) return e.vars.get(name); return UNKNOWN; };
    const newEnv = (parent) => ({ vars: new Map(), parent });
    const bind = (env, pat, val) => {
      if (!pat) return;
      if (pat.type === 'Identifier') env.vars.set(pat.name, val);
      else if (pat.type === 'AssignmentPattern') bind(env, pat.left, val === UNKNOWN || val === undefined ? evalE(pat.right, env) : val);
      else if (pat.type === 'ArrayPattern') pat.elements.forEach((p, i) => bind(env, p, Array.isArray(val) ? val[i] : UNKNOWN));
      else if (pat.type === 'ObjectPattern') {
        for (const p of pat.properties) {
          if (p.type === 'RestElement') { bind(env, p.argument, UNKNOWN); continue; }
          const k = keyName(p);
          let v = UNKNOWN;
          if (val === QI && k === 'sequelize') v = QSEQ;
          else if (val && typeof val === 'object' && k && Object.prototype.hasOwnProperty.call(val, k)) v = val[k];
          bind(env, p.value, v);
        }
      }
    };
    const closure = (fn, env) => ({ kind: 'closure', fn, env });

    const addCol = (t, c, node, how) => {
      ops++;
      const tn = tname(t);
      if (!tn) { note(`${how}: table not resolved`, node); return; }
      if (typeof c !== 'string') { T(tn).uncertain.push(`${f}:${lineOf(node)} ${how} column not resolved`); note(`${how} on ${tn}: column not resolved`, node); return; }
      T(tn).cols.set(c, `${f}:${lineOf(node)}`);
    };
    const rmCol = (t, c, node, how) => {
      ops++;
      const tn = tname(t);
      if (!tn || typeof c !== 'string') { note(`${how}: not resolved`, node); if (tn) T(tn).uncertain.push(`${f}:${lineOf(node)} ${how} not resolved`); return; }
      if (tables[tn]) tables[tn].cols.delete(c);
    };

    const qiOp = function qiOp(method, args, node) {
      switch (method) {
        case 'createTable': {
          ops++;
          const tn = tname(args[0]);
          if (!tn) { note('createTable: table not resolved', node); return; }
          const t = T(tn); if (!t.createdBy) t.createdBy = `${f}:${lineOf(node)}`; t.dropped = null;
          const def = args[1];
          if (!def || typeof def !== 'object' || def === UNKNOWN) { t.uncertain.push(`${f}:${lineOf(node)} createTable columns not resolved`); note(`createTable ${tn}: columns not resolved`, node); return; }
          for (const [k, v] of Object.entries(def)) {
            const col = v && typeof v === 'object' && typeof v.field === 'string' ? v.field : k;
            t.cols.set(col, `${f}:${lineOf(node)}`);
          }
          if (def.__partial) { t.uncertain.push(`${f}:${lineOf(node)} createTable has a spread or computed key`); note(`createTable ${tn}: spread/computed column`, node); }
          return;
        }
        case 'addColumn': return addCol(args[0], args[1], node, 'addColumn');
        case 'removeColumn': return rmCol(args[0], args[1], node, 'removeColumn');
        case 'renameColumn': {
          const tn = tname(args[0]);
          if (tn && typeof args[1] === 'string' && typeof args[2] === 'string') {
            ops++; const t = T(tn); if (t.cols.has(args[1])) t.cols.delete(args[1]); t.cols.set(args[2], `${f}:${lineOf(node)}`);
          } else { ops++; note('renameColumn not resolved', node); if (tn) T(tn).uncertain.push(`${f}:${lineOf(node)} renameColumn not resolved`); }
          return;
        }
        case 'renameTable': {
          ops++;
          const a = tname(args[0]); const b = tname(args[1]);
          if (a && b) { if (tables[a]) { tables[b] = tables[a]; delete tables[a]; } else T(b).uncertain.push(`${f}:${lineOf(node)} renamed from unknown ${a}`); } else note('renameTable not resolved', node);
          return;
        }
        case 'dropTable': {
          ops++;
          const tn = tname(args[0]); if (!tn) { note('dropTable not resolved', node); return; }
          if (tables[tn]) { tables[tn].cols = new Map(); tables[tn].dropped = `${f}:${lineOf(node)}`; }
          return;
        }
        default:
      }
    }

    const sqlOp = function sqlOp(sqlVal, node) {
      if (sqlVal === UNKNOWN || sqlVal == null) { if (node) note('sequelize.query with non-literal SQL', node); return; }
      const text = typeof sqlVal === 'string' ? sqlVal : sqlVal.partial;
      if (typeof text !== 'string') return;
      for (const st of parseDDL(text)) {
        sqlStatements++;
        const hole = (s) => typeof s === 'string' && s.includes('\u0000');
        if (st.kind === 'create') {
          ops++;
          if (hole(st.table)) { note('CREATE TABLE name has an interpolation', node); continue; }
          const t = T(st.table); if (!t.createdBy) t.createdBy = `${f}:${lineOf(node)}`; t.dropped = null;
          for (const c of st.cols) { if (hole(c)) { t.uncertain.push(`${f}:${lineOf(node)} CREATE TABLE column interpolated`); continue; } t.cols.set(c, `${f}:${lineOf(node)}`); }
        } else if (st.kind === 'add') {
          if (hole(st.table)) { ops++; note('ALTER TABLE name has an interpolation', node); continue; }
          addCol(st.table, hole(st.col) ? null : st.col, node, 'ADD COLUMN');
        } else if (st.kind === 'drop') {
          if (hole(st.table)) { ops++; note('ALTER TABLE name has an interpolation', node); continue; }
          rmCol(st.table, hole(st.col) ? null : st.col, node, 'DROP COLUMN');
        } else if (st.kind === 'rename') {
          if (hole(st.table) || hole(st.from) || hole(st.to)) { ops++; note('RENAME COLUMN interpolated', node); continue; }
          qiOp('renameColumn', [st.table, st.from, st.to], node);
        } else if (st.kind === 'renameTable') {
          if (hole(st.table) || hole(st.to)) { ops++; note('RENAME TO interpolated', node); continue; }
          qiOp('renameTable', [st.table, st.to], node);
        } else if (st.kind === 'dropTable') {
          if (hole(st.table)) { ops++; note('DROP TABLE interpolated', node); continue; }
          qiOp('dropTable', [st.table], node);
        }
      }
    }

    const callFn = function callFn(clo, args) {
      if (!clo || clo.kind !== 'closure' || depth > 10) return UNKNOWN;
      depth++;
      const env = newEnv(clo.env);
      clo.fn.params.forEach((p, i) => bind(env, p, args[i] === undefined ? UNKNOWN : args[i]));
      let ret = UNKNOWN;
      if (clo.fn.body.type === 'BlockStatement') execBlock(clo.fn.body.body, env);
      else ret = evalE(clo.fn.body, env);
      depth--;
      return ret;
    }

    const evalE = function evalE(n, env) {
      if (!n) return UNKNOWN;
      switch (n.type) {
        case 'StringLiteral': return n.value;
        case 'NumericLiteral': return n.value;
        case 'BooleanLiteral': return n.value;
        case 'NullLiteral': return null;
        case 'TemplateLiteral': {
          let s = ''; let partial = false;
          n.quasis.forEach((q, i) => {
            s += q.value.cooked;
            if (i < n.expressions.length) {
              const v = evalE(n.expressions[i], env);
              if (typeof v === 'string' || typeof v === 'number') s += v;
              else if (Array.isArray(v) && v.every(x => typeof x === 'string')) s += v.join(',');
              else { s += '\u0000'; partial = true; }
            }
          });
          return partial ? { partial: s } : s;
        }
        case 'Identifier': return n.name === 'undefined' ? undefined : lookup(env, n.name);
        case 'ArrayExpression': {
          const out = [];
          for (const e of n.elements) {
            if (!e) continue;
            if (e.type === 'SpreadElement') { const v = evalE(e.argument, env); if (Array.isArray(v)) out.push(...v); else out.push(UNKNOWN); }
            else out.push(evalE(e, env));
          }
          return out;
        }
        case 'ObjectExpression': {
          const o = {};
          for (const p of n.properties) {
            if (p.type === 'SpreadElement') { const v = evalE(p.argument, env); if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(o, v); else Object.defineProperty(o, '__partial', { value: true, enumerable: false }); continue; }
            let k = keyName(p);
            if (p.computed) { const kv = evalE(p.key, env); k = typeof kv === 'string' ? kv : null; }
            if (k == null) { Object.defineProperty(o, '__partial', { value: true, enumerable: false }); continue; }
            o[k] = p.type === 'ObjectMethod' ? closure(p, env) : evalE(p.value, env);
          }
          return o;
        }
        case 'AwaitExpression': return evalE(n.argument, env);
        case 'ArrowFunctionExpression': case 'FunctionExpression': return closure(n, env);
        case 'MemberExpression': case 'OptionalMemberExpression': {
          const o = evalE(n.object, env);
          const p = n.computed ? evalE(n.property, env) : n.property.name;
          if (o === QI && p === 'sequelize') return QSEQ;
          if (o && typeof o === 'object' && o !== UNKNOWN && (typeof p === 'string' || typeof p === 'number') && Object.prototype.hasOwnProperty.call(o, p)) return o[p];
          return UNKNOWN;
        }
        case 'LogicalExpression': { const l = evalE(n.left, env); const r = evalE(n.right, env); return l !== UNKNOWN && l ? l : r; }
        case 'ConditionalExpression': { evalE(n.test, env); const a = evalE(n.consequent, env); const b = evalE(n.alternate, env); return a === b ? a : UNKNOWN; }
        case 'BinaryExpression': {
          const l = evalE(n.left, env); const r = evalE(n.right, env);
          if (n.operator === '+' && (typeof l === 'string' || typeof r === 'string')) {
            const ls = typeof l === 'string' || typeof l === 'number' ? String(l) : l && l.partial ? l.partial : '\u0000';
            const rs = typeof r === 'string' || typeof r === 'number' ? String(r) : r && r.partial ? r.partial : '\u0000';
            const s = ls + rs; return s.includes('\u0000') ? { partial: s } : s;
          }
          return UNKNOWN;
        }
        case 'AssignmentExpression': {
          const v = evalE(n.right, env);
          if (n.left.type === 'Identifier') { for (let e = env; e; e = e.parent) if (e.vars.has(n.left.name)) { e.vars.set(n.left.name, v); break; } }
          return v;
        }
        case 'SequenceExpression': { let v; for (const e of n.expressions) v = evalE(e, env); return v; }
        case 'UnaryExpression': evalE(n.argument, env); return UNKNOWN;
        case 'NewExpression': n.arguments.forEach(a => evalE(a, env)); return UNKNOWN;
        case 'CallExpression': case 'OptionalCallExpression': return evalCall(n, env);
        default: return UNKNOWN;
      }
    }

    const evalCall = function evalCall(n, env) {
      const c = n.callee;
      const args = () => n.arguments.map(a => (a.type === 'SpreadElement' ? UNKNOWN : evalE(a, env)));
      if (/MemberExpression$/.test(c.type)) {
        const m = memberProp(c);
        const obj = evalE(c.object, env);
        if (obj === QI) { const a = args(); qiOp(m, a, n); return UNKNOWN; }
        if (m === 'query' && (obj === QSEQ || memberProp(c.object) === 'sequelize')) {
          const a = args(); sqlOp(a[0], n); return [UNKNOWN, UNKNOWN];
        }
        if (c.object.type === 'Identifier' && c.object.name === 'Object' && (m === 'entries' || m === 'keys' || m === 'values')) {
          const o = evalE(n.arguments[0], env);
          if (o && typeof o === 'object' && o !== UNKNOWN && !Array.isArray(o)) return m === 'entries' ? Object.entries(o) : m === 'keys' ? Object.keys(o) : Object.values(o);
          return UNKNOWN;
        }
        if (Array.isArray(obj) && (m === 'map' || m === 'forEach' || m === 'filter')) {
          const fn = evalE(n.arguments[0], env);
          if (fn && fn.kind === 'closure') { const r = obj.map((x, i) => callFn(fn, [x, i])); return m === 'map' ? r : m === 'filter' ? obj : UNKNOWN; }
        }
        if (Array.isArray(obj) && (m === 'join')) { const sep = evalE(n.arguments[0], env); return obj.every(x => typeof x === 'string') ? obj.join(typeof sep === 'string' ? sep : ',') : UNKNOWN; }
        if (obj && obj.kind === 'closure' && (m === 'call' || m === 'apply')) return callFn(obj, args().slice(1));
        // unknown method: run function arguments once (transaction callbacks, .then, Promise.all(...map))
        const a = args();
        for (const v of a) if (v && v.kind === 'closure') callFn(v, []);
        return UNKNOWN;
      }
      if (c.type === 'Identifier') {
        const fn = lookup(env, c.name);
        const a = args();
        if (fn && fn.kind === 'closure') return callFn(fn, a);
        for (const v of a) if (v && v.kind === 'closure') callFn(v, []);
        return UNKNOWN;
      }
      const fn = evalE(c, env); const a = args();
      if (fn && fn.kind === 'closure') return callFn(fn, a);
      return UNKNOWN;
    }

    const execBlock = function execBlock(stmts, env) {
      // hoist function declarations
      for (const s of stmts) if (s.type === 'FunctionDeclaration' && s.id) env.vars.set(s.id.name, closure(s, env));
      for (const s of stmts) exec(s, env);
    }
    const exec = function exec(s, env) {
      if (!s) return;
      switch (s.type) {
        case 'VariableDeclaration':
          for (const d of s.declarations) bind(env, d.id, d.init ? evalE(d.init, env) : undefined);
          return;
        case 'ExpressionStatement': evalE(s.expression, env); return;
        case 'IfStatement': evalE(s.test, env); exec(s.consequent, env); exec(s.alternate, env); return;
        case 'BlockStatement': execBlock(s.body, newEnv(env)); return;
        case 'ForOfStatement': case 'ForInStatement': {
          const it = evalE(s.right, env);
          const decl = s.left.type === 'VariableDeclaration' ? s.left.declarations[0].id : s.left;
          const items = Array.isArray(it) ? it : it && typeof it === 'object' && it !== UNKNOWN && s.type === 'ForInStatement' ? Object.keys(it) : null;
          if (items) for (const x of items) { const e = newEnv(env); bind(e, decl, x); exec(s.body, e); }
          else { const e = newEnv(env); bind(e, decl, UNKNOWN); exec(s.body, e); }
          return;
        }
        case 'ForStatement': case 'WhileStatement': case 'DoWhileStatement': { const e = newEnv(env); if (s.init) { if (s.init.type === 'VariableDeclaration') exec(s.init, e); else evalE(s.init, e); } exec(s.body, e); return; }
        case 'TryStatement': exec(s.block, env); if (s.handler) exec(s.handler.body, env); if (s.finalizer) exec(s.finalizer, env); return;
        case 'ReturnStatement': evalE(s.argument, env); return;
        case 'SwitchStatement': for (const cs of s.cases) execBlock(cs.consequent, newEnv(env)); return;
        case 'FunctionDeclaration': return;
        case 'LabeledStatement': exec(s.body, env); return;
        default:
      }
    }

    // program-level declarations, then up()
    const genv = newEnv(null);
    let upFn = null;
    const findUp = (obj) => {
      if (!obj || obj.type !== 'ObjectExpression') return;
      for (const p of obj.properties) {
        if (keyName(p) !== 'up') continue;
        upFn = p.type === 'ObjectMethod' ? p : p.value;
      }
    };
    for (const s of ast.program.body) {
      if (s.type === 'ExpressionStatement' && s.expression.type === 'AssignmentExpression') {
        const l = s.expression.left;
        const lt = srcText(file, l);
        if (lt === 'module.exports') {
          let r = s.expression.right;
          if (r.type === 'Identifier') { const v = genv.vars.get(r.name); if (v && v.node) r = v.node; }
          findUp(r);
        } else if (lt === 'module.exports.up' || lt === 'exports.up') upFn = s.expression.right;
        continue;
      }
      if (s.type === 'VariableDeclaration') {
        for (const d of s.declarations) {
          if (d.id.type === 'Identifier' && d.init && d.init.type === 'ObjectExpression' && d.init.properties.some(p => keyName(p) === 'up')) { genv.vars.set(d.id.name, { node: d.init }); continue; }
          if (d.init && d.init.type === 'CallExpression' && d.init.callee.type === 'Identifier' && d.init.callee.name === 'require') { bind(genv, d.id, UNKNOWN); continue; }
          bind(genv, d.id, d.init ? evalE(d.init, genv) : undefined);
        }
      } else if (s.type === 'FunctionDeclaration' && s.id) genv.vars.set(s.id.name, closure(s, genv));
    }
    if (upFn && upFn.type === 'Identifier') { const v = genv.vars.get(upFn.name); upFn = v && v.kind === 'closure' ? v.fn : null; }
    if (!upFn || !isFn(upFn)) { note('no up() found', ast); continue; }
    const env = newEnv(genv);
    bind(env, upFn.params[0], QI);
    if (upFn.body.type === 'BlockStatement') execBlock(upFn.body.body, env); else evalE(upFn.body, env);
  }
  return { tables, unresolved, ops, sqlStatements, files: files.length };
}

// SQL helpers ---------------------------------------------------------------
function stripSql(sql) {
  // remove comments and string literals ('' escapes), keep dollar-quoted bodies
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'(?:[^']|'')*'/g, "''");
}
const ident = (s) => {
  if (s == null) return s;
  s = s.trim();
  const m = /^"([^"]+)"$/.exec(s); if (m) return m[1];
  return s.toLowerCase();
};
const IDENT_RE = '(?:"[^"]+"|[A-Za-z_\\u0000][A-Za-z0-9_$\\u0000]*)';
const QUAL_RE = `(?:${IDENT_RE}\\.)?(${IDENT_RE})`;
function splitTop(s) {
  const out = []; let d = 0; let cur = '';
  for (const ch of s) {
    if (ch === '(') d++; else if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function matchParen(s, i) { let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === '(') d++; else if (s[j] === ')') { d--; if (d === 0) return j; } } return -1; }
function parseDDL(raw) {
  const sql = stripSql(raw); const out = [];
  const reCreate = new RegExp(`CREATE\\s+(?:UNLOGGED\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${QUAL_RE}\\s*\\(`, 'gi');
  let m;
  while ((m = reCreate.exec(sql))) {
    const open = m.index + m[0].length - 1; const close = matchParen(sql, open);
    if (close < 0) continue;
    const cols = [];
    for (const part of splitTop(sql.slice(open + 1, close))) {
      const tok = part.trim().split(/\s+/)[0];
      if (!tok || /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE)$/i.test(tok)) continue;
      cols.push(ident(tok));
    }
    out.push({ kind: 'create', table: ident(m[1]), cols });
  }
  const reAlter = new RegExp(`ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${QUAL_RE}\\s+([\\s\\S]*?)(?:;|$|\\bEND\\b|\\$\\$)`, 'gi');
  while ((m = reAlter.exec(sql))) {
    const table = ident(m[1]);
    for (const act of splitTop(m[2])) {
      const a = act.trim(); let x;
      if ((x = new RegExp(`^ADD\\s+(?:COLUMN\\s+)?(?:IF\\s+NOT\\s+EXISTS\\s+)?(${IDENT_RE})`, 'i').exec(a)) && !/^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK)$/i.test(x[1])) out.push({ kind: 'add', table, col: ident(x[1]) });
      else if ((x = new RegExp(`^DROP\\s+(?:COLUMN\\s+)?(?:IF\\s+EXISTS\\s+)?(${IDENT_RE})`, 'i').exec(a)) && !/^(CONSTRAINT|DEFAULT|NOT|IDENTITY|EXPRESSION)$/i.test(x[1])) out.push({ kind: 'drop', table, col: ident(x[1]) });
      else if ((x = new RegExp(`^RENAME\\s+TO\\s+(${IDENT_RE})`, 'i').exec(a))) out.push({ kind: 'renameTable', table, to: ident(x[1]) });
      else if ((x = new RegExp(`^RENAME\\s+(?:COLUMN\\s+)?(${IDENT_RE})\\s+TO\\s+(${IDENT_RE})`, 'i').exec(a)) && !/^CONSTRAINT$/i.test(x[1])) out.push({ kind: 'rename', table, from: ident(x[1]), to: ident(x[2]) });
    }
  }
  const reDrop = new RegExp(`DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${QUAL_RE}`, 'gi');
  while ((m = reDrop.exec(sql))) out.push({ kind: 'dropTable', table: ident(m[1]) });
  return out;
}

// ─── step 3: raw SQL in src ─────────────────────────────────────────────────
const SQL_KW = new Set(('select from where and or not in is null as on join left right inner outer full cross group by order limit offset having ' +
  'distinct case when then else end like ilike between exists union all any some returning set values into update insert delete ' +
  'true false asc desc nulls first last coalesce count sum max min avg now interval lateral using with default conflict do nothing ' +
  'excluded array jsonb json text integer int boolean uuid timestamp date varchar numeric float lower upper trim cast extract epoch ' +
  'filter over partition row_number rank dense_rank current_date current_timestamp only natural similar to escape at time zone ' +
  'jsonb_array_elements jsonb_array_length json_agg jsonb_agg array_agg string_agg jsonb_build_object greatest least nullif age ' +
  'unnest generate_series length substring position random md5 round floor ceil abs concat to_char date_trunc sign mod power').split(/\s+/));
function sqlRefs(raw) {
  const sql = stripSql(raw); const refs = []; const tablesSeen = [];
  const aliasMap = {}; const opaque = new Set();
  const lower = (s) => ident(s);
  // CTEs and subquery aliases are opaque
  let m;
  const reCte = new RegExp(`(?:WITH|,)\\s*(?:RECURSIVE\\s+)?(${IDENT_RE})\\s+AS\\s*\\(`, 'gi');
  while ((m = reCte.exec(sql))) opaque.add(lower(m[1]));
  const reSub = new RegExp(`\\)\\s+(?:AS\\s+)?(${IDENT_RE})`, 'gi');
  while ((m = reSub.exec(sql))) if (!SQL_KW.has(lower(m[1]))) opaque.add(lower(m[1]));
  const reFrom = new RegExp(`\\b(FROM|JOIN|UPDATE|INTO)\\s+(?:ONLY\\s+)?(?:(?:public)\\.)?(${IDENT_RE})(?:\\s+(?:AS\\s+)?(${IDENT_RE}))?`, 'gi');
  while ((m = reFrom.exec(sql))) {
    const t = lower(m[2]);
    if (SQL_KW.has(t) || t.includes('\u0000')) continue;
    if (sql[m.index + m[0].length] === '(' && m[1].toUpperCase() !== 'INTO') continue; // function call FROM fn(...)
    tablesSeen.push(t);
    aliasMap[t] = t;
    const al = m[3] ? lower(m[3]) : null;
    if (al && !SQL_KW.has(al) && !al.includes('\u0000')) aliasMap[al] = t;
  }
  const realTables = [...new Set(tablesSeen)].filter(t => !opaque.has(t));
  // INSERT INTO t (cols)
  const reIns = new RegExp(`INSERT\\s+INTO\\s+(?:public\\.)?(${IDENT_RE})\\s*\\(([^)]*)\\)`, 'gi');
  while ((m = reIns.exec(sql))) { const t = lower(m[1]); for (const c of m[2].split(',')) refs.push({ table: t, col: lower(c), how: 'INSERT column' }); }
  // UPDATE t [alias] SET a = .., b = ..
  const reUpd = new RegExp(`UPDATE\\s+(?:ONLY\\s+)?(?:public\\.)?(${IDENT_RE})(?:\\s+(?:AS\\s+)?(${IDENT_RE}))?\\s+SET\\s+([\\s\\S]*?)(?:\\bWHERE\\b|\\bFROM\\b|\\bRETURNING\\b|;|$)`, 'gi');
  while ((m = reUpd.exec(sql))) {
    const t = lower(m[1]);
    for (const asg of splitTop(m[3])) { const x = new RegExp(`^\\s*(?:${IDENT_RE}\\.)?(${IDENT_RE})\\s*=`).exec(asg); if (x) refs.push({ table: t, col: lower(x[1]), how: 'UPDATE SET' }); }
  }
  // ON CONFLICT (cols) DO UPDATE SET col = EXCLUDED.col
  const reSetAfterConflict = new RegExp(`DO\\s+UPDATE\\s+SET\\s+([\\s\\S]*?)(?:\\bWHERE\\b|\\bRETURNING\\b|;|$)`, 'gi');
  const insTables = []; const reInsT = new RegExp(`INSERT\\s+INTO\\s+(?:public\\.)?(${IDENT_RE})`, 'gi');
  while ((m = reInsT.exec(sql))) insTables.push(lower(m[1]));
  if (insTables.length === 1) {
    while ((m = reSetAfterConflict.exec(sql))) for (const asg of splitTop(m[1])) { const x = new RegExp(`^\\s*(${IDENT_RE})\\s*=`).exec(asg); if (x) refs.push({ table: insTables[0], col: lower(x[1]), how: 'ON CONFLICT SET' }); }
    aliasMap.excluded = insTables[0];
  }
  // alias.col
  const reQual = new RegExp(`(?<![A-Za-z0-9_."\\u0000:])(${IDENT_RE})\\.(${IDENT_RE}|\\*)`, 'g');
  while ((m = reQual.exec(sql))) {
    const a = lower(m[1]); const c = m[2] === '*' ? '*' : lower(m[2]);
    if (c === '*' || !aliasMap[a] || opaque.has(a) || opaque.has(aliasMap[a])) continue;
    refs.push({ table: aliasMap[a], col: c, how: 'qualified' });
  }
  // single-table: bare WHERE columns
  const joins = /\bJOIN\b/i.test(sql); const subq = /\(\s*SELECT\b/i.test(sql);
  if (!joins && !subq && realTables.length === 1 && opaque.size === 0) {
    const t = realTables[0];
    const reW = /\bWHERE\b([\s\S]*?)(?:\bGROUP\b|\bORDER\b|\bLIMIT\b|\bRETURNING\b|;|$)/gi;
    while ((m = reW.exec(sql))) {
      const body = m[1];
      const reC = new RegExp(`(?<![A-Za-z0-9_."\\u0000:>])(${IDENT_RE})\\s*(?:=|<>|!=|<=|>=|<|>|@>|\\?\\||\\?&|\\bIS\\b|\\bIN\\b|\\bNOT\\s+IN\\b|\\bILIKE\\b|\\bLIKE\\b|->)`, 'gi');
      let x;
      while ((x = reC.exec(body))) {
        const c = lower(x[1]);
        if (SQL_KW.has(c) || /^\d/.test(c) || c.includes('\u0000') || c.startsWith('$')) continue;
        if (body[x.index - 1] === ':' || body[x.index - 1] === '$') continue; // :replacement
        refs.push({ table: t, col: c, how: 'WHERE (single table)' });
      }
    }
  }
  return { refs: refs.filter(r => r.col && !r.col.includes('\u0000') && !r.table.includes('\u0000')), tables: realTables };
}

function step3(tables) {
  const files = walkFiles(path.join(ROOT, 'src')).filter(f => !rel(f).startsWith('src/migrations/'));
  const hits = []; const unknownTables = {}; const uncheckable = []; const otherReceivers = [];
  let calls = 0; let literal = 0; let template = 0; let checkedRefs = 0; let callsWithRefs = 0;
  const tableCols = {};
  for (const [t, v] of Object.entries(tables)) tableCols[t] = v;
  for (const file of files) {
    let ast; try { ast = parse(file); } catch { continue; }
    const f = rel(file);
    walk(ast, (n) => {
      if (n.type !== 'CallExpression' && n.type !== 'OptionalCallExpression') return;
      if (memberProp(n.callee) !== 'query') return;
      const recvText = srcText(file, n.callee.object);
      if (!/sequelize$/i.test(recvText)) { otherReceivers.push(`${f}:${lineOf(n)} ${recvText}.query`); return; }
      calls++;
      let a = n.arguments[0];
      if (a && a.type === 'Identifier') {
        // resolve a same-scope const string/template
        let scope = n._parent; let found = null;
        while (scope && !found) {
          if (isFn(scope) || scope.type === 'Program') {
            const body = scope.type === 'Program' ? scope : scope.body;
            walk(body, (x) => { if (x !== body && isFn(x)) return false; if (x.type === 'VariableDeclarator' && x.id.type === 'Identifier' && x.id.name === a.name && x.init) found = found || x.init; return undefined; });
          }
          scope = scope._parent;
        }
        if (found && (found.type === 'StringLiteral' || found.type === 'TemplateLiteral')) a = found;
      }
      let text = null;
      if (a && a.type === 'StringLiteral') { text = a.value; literal++; }
      else if (a && a.type === 'TemplateLiteral') {
        text = a.quasis.map((q, i) => q.value.cooked + (i < a.expressions.length ? '\u0000' : '')).join('');
        if (a.expressions.length) template++; else literal++;
      } else { uncheckable.push({ file: f, line: lineOf(n), reason: `SQL is a ${a ? a.type : 'missing arg'}` }); return; }
      const { refs, tables: used } = sqlRefs(text);
      let checkedHere = 0;
      for (const r of refs) {
        const t = tableCols[r.table];
        if (!t || !t.createdBy) { (unknownTables[r.table] = unknownTables[r.table] || []).push(`${f}:${lineOf(n)}`); continue; }
        checkedRefs++; checkedHere++;
        const has = t.cols.has(r.col) || [...t.cols.keys()].some(k => k.toLowerCase() === r.col);
        if (!has) hits.push({ file: f, line: lineOf(n), table: r.table, col: r.col, how: r.how, uncertainTable: t.uncertain.length > 0 });
      }
      if (checkedHere) callsWithRefs++;
      else if (!refs.length) uncheckable.push({ file: f, line: lineOf(n), reason: used.length ? `no column reference extracted (tables: ${used.join(',')})` : 'no table extracted' });
      else uncheckable.push({ file: f, line: lineOf(n), reason: `table(s) not created by the live tree: ${[...new Set(refs.map(r => r.table))].join(',')}` });
    });
  }
  return { hits, uncheckable, unknownTables, otherReceivers, calls, literal, template, checkedRefs, callsWithRefs };
}

// ─── step 4: mocks in tests ─────────────────────────────────────────────────
// Mocked methods whose return value is a row or rows (count/update/destroy return numbers).
const ROW_METHODS = new Set(['findAll', 'findOne', 'findByPk', 'findAndCountAll', 'findOrCreate', 'create', 'bulkCreate', 'upsert', 'findCreateFind']);
const INSTANCE_KEYS = new Set(['update', 'save', 'destroy', 'reload', 'toJSON', 'get', 'set', 'increment', 'decrement', 'changed',
  'dataValues', '_previousDataValues', 'isNewRecord', 'restore', 'setDataValue', 'getDataValue', 'previous', 'validate', 'count', 'rows']);
function step4() {
  const files = walkFiles(path.join(ROOT, 'tests'));
  const hits = []; const enumHits = []; const unresolved = [];
  let rows = 0; let keysChecked = 0; let mockModels = 0; let whereObjs = 0;
  for (const file of files) {
    let ast; try { ast = parse(file); } catch { continue; }
    const f = rel(file);
    const seenRow = new Set();
    const fnDecls = {}; // name -> fn node (file-wide, first wins)
    const allProps = {}; // key -> [value nodes]  (for parameter feeds)
    const varInits = {}; // name -> [init nodes]
    walk(ast, (n) => {
      if (n.type === 'FunctionDeclaration' && n.id && !fnDecls[n.id.name]) fnDecls[n.id.name] = n;
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) {
        if (isFn(n.init) && !fnDecls[n.id.name]) fnDecls[n.id.name] = n.init;
        (varInits[n.id.name] = varInits[n.id.name] || []).push(n.init);
      }
      if (n.type === 'ObjectProperty') { const k = keyName(n); if (k) (allProps[k] = allProps[k] || []).push(n.value); }
      if (n.type === 'AssignmentPattern' && n.left.type === 'Identifier') (allProps[`=${n.left.name}`] = allProps[`=${n.left.name}`] || []).push(n.right);
    });

    const isParamOf = (name, node) => {
      for (let s = node._parent; s; s = s._parent) {
        if (isFn(s)) {
          for (const p of s.params) {
            let found = false;
            walk(p, (x) => { if (x.type === 'Identifier' && x.name === name) found = true; });
            if (found) return true;
          }
        }
      }
      return false;
    };

    const checkRow = (model, obj, bindings, via) => {
      const key = `${model}@${obj.start}@${JSON.stringify(Object.keys(bindings))}`;
      if (seenRow.has(key)) return; seenRow.add(key);
      rows++;
      for (const p of obj.properties) {
        if (p.type === 'SpreadElement') continue;
        if (p.type === 'ObjectMethod') continue;
        const k = keyName(p); if (!k) continue;
        if (isFn(p.value) || (p.value.type === 'CallExpression' && srcText(file, p.value.callee).startsWith('jest.fn'))) continue;
        if (INSTANCE_KEYS.has(k) || /^(get|set|add|has|remove|create|count)[A-Z]/.test(k)) continue;
        keysChecked++;
        if (!declared(model, k)) hits.push({ file: f, line: lineOf(p), model, key: k, via });
        const en = MODELS[model].enums[k];
        if (en) {
          let v = p.value;
          if (v.type === 'Identifier' && bindings[v.name]) v = bindings[v.name];
          const s = strOf(v);
          if (s != null && !en.includes(s)) enumHits.push({ file: f, line: lineOf(p), model, key: k, value: s, allowed: en, via, valueLine: lineOf(v) });
        }
      }
    };

    const feedsDone = new Set();
    const resolveRows = (model, expr, bindings, via, depth = 0) => {
      if (!expr || depth > 8) return;
      switch (expr.type) {
        case 'ObjectExpression': {
          const rowsProp = expr.properties.find(p => keyName(p) === 'rows');
          if (rowsProp) { resolveRows(model, rowsProp.value, bindings, via, depth + 1); return; }
          checkRow(model, expr, bindings, via); return;
        }
        case 'ArrayExpression': for (const e of expr.elements) if (e) resolveRows(model, e.type === 'SpreadElement' ? e.argument : e, bindings, via, depth + 1); return;
        case 'AwaitExpression': resolveRows(model, expr.argument, bindings, via, depth + 1); return;
        case 'ConditionalExpression': resolveRows(model, expr.consequent, bindings, via, depth + 1); resolveRows(model, expr.alternate, bindings, via, depth + 1); return;
        case 'LogicalExpression': resolveRows(model, expr.left, bindings, via, depth + 1); resolveRows(model, expr.right, bindings, via, depth + 1); return;
        case 'NullLiteral': case 'NumericLiteral': case 'BooleanLiteral': case 'StringLiteral': return;
        case 'Identifier': {
          if (expr.name === 'undefined') return;
          if (bindings[expr.name]) { resolveRows(model, bindings[expr.name], {}, via, depth + 1); return; }
          const inits = varInits[expr.name];
          if (inits && inits.length) { for (const i of inits) if (!isFn(i)) resolveRows(model, i, {}, `${via} via ${expr.name}`, depth + 1); return; }
          if (isParamOf(expr.name, expr)) {
            const fk = `${model}:${expr.name}`;
            if (feedsDone.has(fk)) return; feedsDone.add(fk);
            const feeds = [...(allProps[expr.name] || []), ...(allProps[`=${expr.name}`] || [])];
            if (!feeds.length) { unresolved.push({ file: f, line: lineOf(expr), reason: `${model} mock returns parameter ${expr.name} with no literal feed` }); return; }
            for (const v of feeds) resolveRows(model, v, {}, `${via} via param ${expr.name}`, depth + 1);
            return;
          }
          unresolved.push({ file: f, line: lineOf(expr), reason: `${model} mock returns ${expr.name}` }); return;
        }
        case 'CallExpression': {
          const c = expr.callee;
          if (c.type === 'Identifier' && fnDecls[c.name]) {
            const fn = fnDecls[c.name]; const b = {};
            fn.params.forEach((p, i) => {
              const arg = expr.arguments[i];
              if (p.type === 'Identifier' && arg) b[p.name] = arg;
              else if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') b[p.left.name] = arg || p.right;
            });
            for (const r of returnsOf(fn)) resolveRows(model, r, b, `${via} via ${c.name}()`, depth + 1);
            return;
          }
          const mp = memberProp(c);
          if (mp === 'resolve' && srcText(file, c.object) === 'Promise') { resolveRows(model, expr.arguments[0], bindings, via, depth + 1); return; }
          if (mp === 'from' && srcText(file, c.object) === 'Array' && isFn(expr.arguments[1])) { for (const r of returnsOf(expr.arguments[1])) resolveRows(model, r, bindings, via, depth + 1); return; }
          if (mp === 'map' && isFn(expr.arguments[0])) { for (const r of returnsOf(expr.arguments[0])) resolveRows(model, r, bindings, via, depth + 1); return; }
          if (mp && /^mock(Resolved|Returned|Return)Value(Once)?$/.test(mp)) { resolveRows(model, expr.arguments[0], bindings, via, depth + 1); return; }
          if (mp && /^mockImplementation(Once)?$/.test(mp)) { resolveMockFn(model, expr.arguments[0], via, depth + 1); return; }
          if (srcText(file, c).startsWith('jest.fn')) {
            if (expr.arguments[0]) resolveMockFn(model, expr.arguments[0], via, depth + 1);
            // chained jest.fn().mockResolvedValue(...) handled by the outer member call
            return;
          }
          if (/MemberExpression$/.test(c.type) && c.object.type === 'CallExpression') { resolveRows(model, c.object, bindings, via, depth + 1); if (/^mock/.test(mp || '')) return; }
          unresolved.push({ file: f, line: lineOf(expr), reason: `${model} mock returns ${srcText(file, expr)}` }); return;
        }
        case 'MemberExpression': case 'OptionalMemberExpression':
          unresolved.push({ file: f, line: lineOf(expr), reason: `${model} mock returns ${srcText(file, expr)}` }); return;
        default:
      }
    };
    const resolveMockFn = (model, fn, via, depth) => {
      if (!fn) return;
      if (!isFn(fn)) { resolveRows(model, fn, {}, via, depth); return; }
      checkMockWhere(model, fn);
      for (const r of returnsOf(fn)) resolveRows(model, r, {}, via, depth);
    };
    const checkMockWhere = (model, fn) => {
      // opts.where.KEY / opts.where?.KEY inside a fake model method
      walk(fn.body, (x) => {
        if (!/MemberExpression$/.test(x.type)) return;
        if (memberProp(x.object) === 'where' && !x.computed) {
          const k = memberProp(x); if (!k) return;
          whereObjs++; keysChecked++;
          if (!declared(model, k)) hits.push({ file: f, line: lineOf(x), model, key: k, via: 'fake-model where read' });
        }
      });
    };
    const mockObject = (model, obj, via) => {
      mockModels++;
      for (const p of obj.properties) {
        const m = keyName(p); if (!m || !ROW_METHODS.has(m)) continue;
        const v = p.type === 'ObjectMethod' ? p : p.value;
        if (p.type === 'ObjectMethod') { checkMockWhere(model, p); for (const r of returnsOf(p)) resolveRows(model, r, {}, `${via}.${m}`); continue; }
        resolveRows(model, v, {}, `${via}.${m}`);
      }
    };

    walk(ast, (n) => {
      // (a) { Model: { findAll: ... } }  (b) const Model = { ... }
      if (n.type === 'ObjectProperty') {
        const k = keyName(n);
        if (k && MODEL_NAMES.has(k) && n.value.type === 'ObjectExpression') mockObject(canon(k), n.value, `${k} mock`);
      }
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && MODEL_NAMES.has(n.id.name) && n.init && n.init.type === 'ObjectExpression') mockObject(canon(n.id.name), n.init, `${n.id.name} mock`);
      // (c) X.Model = {...} / X.Model.method = jest.fn(...)
      if (n.type === 'AssignmentExpression' && /MemberExpression$/.test(n.left.type)) {
        const segs = srcText(file, n.left).split('.');
        const mi = segs.findIndex(s => MODEL_NAMES.has(s));
        if (mi >= 0) {
          const model = canon(segs[mi]);
          if (mi === segs.length - 1 && n.right.type === 'ObjectExpression') mockObject(model, n.right, `${segs[mi]} mock`);
          else if (mi === segs.length - 2 && ROW_METHODS.has(segs[mi + 1])) resolveRows(model, n.right, {}, `${segs[mi]}.${segs[mi + 1]} =`);
        }
      }
      // (d) Model.method.mockResolvedValue(...) / jest.spyOn(Model, 'm').mockResolvedValue(...)
      if (n.type === 'CallExpression' && /MemberExpression$/.test(n.callee.type)) {
        const mp = memberProp(n.callee);
        if (mp && /^mock(Resolved|Return)Value(Once)?$|^mockImplementation(Once)?$/.test(mp)) {
          let model = null;
          const obj = n.callee.object;
          if (obj.type === 'CallExpression' && srcText(file, obj.callee) === 'jest.spyOn') { const r = obj.arguments[0]; const s = r && srcText(file, r).split('.').pop(); if (MODEL_NAMES.has(s) && ROW_METHODS.has(strOf(obj.arguments[1]))) model = canon(s); }
          else { const segs = srcText(file, obj).split('.'); const s = segs.find(x => MODEL_NAMES.has(x)); if (s && segs.indexOf(s) === segs.length - 2 && ROW_METHODS.has(segs[segs.length - 1])) model = canon(s); }
          if (model) {
            if (/Implementation/.test(mp)) resolveMockFn(model, n.arguments[0], `${model} ${mp}`, 0);
            else resolveRows(model, n.arguments[0], {}, `${model} ${mp}`);
          }
        }
        // expect(Model.method).toHaveBeenCalledWith({ where: {...} } / values)
        if (mp === 'toHaveBeenCalledWith' || mp === 'toHaveBeenLastCalledWith' || mp === 'toHaveBeenNthCalledWith') {
          let e = n.callee.object; while (/MemberExpression$/.test(e.type)) e = e.object; // expect(...).not
          if (e.type === 'CallExpression' && srcText(file, e.callee) === 'expect' && e.arguments[0]) {
            const segs = srcText(file, e.arguments[0]).split('.');
            const s = segs.find(x => MODEL_NAMES.has(x));
            if (s && segs.indexOf(s) === segs.length - 2) {
              const model = canon(s); const method = segs[segs.length - 1];
              const args = mp === 'toHaveBeenNthCalledWith' ? n.arguments.slice(1) : n.arguments;
              const checkWhereObj = (o) => {
                if (!o) return;
                if (o.type === 'CallExpression' && /objectContaining$/.test(srcText(file, o.callee))) o = o.arguments[0];
                if (!o || o.type !== 'ObjectExpression') return;
                whereObjs++;
                for (const p of o.properties) {
                  if (p.computed) { if (/^(Op\.or|Op\.and)$/.test(srcText(file, p.key)) && p.value.type === 'ArrayExpression') p.value.elements.forEach(checkWhereObj); continue; }
                  const k = keyName(p); if (!k) continue; keysChecked++;
                  if (!declared(model, k)) hits.push({ file: f, line: lineOf(p), model, key: k, via: `expect(${s}.${method}) where` });
                }
              };
              args.forEach((a, i) => {
                let o = a; if (o && o.type === 'CallExpression' && /objectContaining$/.test(srcText(file, o.callee))) o = o.arguments[0];
                if (!o || o.type !== 'ObjectExpression') return;
                if ((method === 'create' || method === 'update' || method === 'upsert') && i === 0) { checkRow(model, o, {}, `expect(${s}.${method}) values`); return; }
                const w = o.properties.find(p => keyName(p) === 'where'); if (w) checkWhereObj(w.value);
              });
            }
          }
        }
      }
    });
  }
  const seenU = new Set();
  const uniq = unresolved.filter(u => { const k = `${u.file}:${u.line}:${u.reason}`; if (seenU.has(k)) return false; seenU.add(k); return true; });
  return { hits, enumHits, unresolved: uniq, rows, keysChecked, mockModels, whereObjs, files: files.length };
}
function returnsOf(fn) {
  if (!fn) return [];
  if (fn.body && fn.body.type !== 'BlockStatement') return [fn.body];
  const out = [];
  walk(fn.body, (x) => { if (x !== fn.body && isFn(x)) return false; if (x.type === 'ReturnStatement' && x.argument) out.push(x.argument); return undefined; });
  return out;
}

// ─── compare step 2 tables with models ──────────────────────────────────────
function compareModels(tables) {
  const noTable = []; const alteredOnly = []; const missing = []; const paranoidNoDeleted = []; const extra = [];
  for (const m of Object.values(MODELS)) {
    const t = tables[m.table];
    if (!t || (t.cols.size === 0 && !t.uncertain.length)) { noTable.push({ model: m.name, table: m.table, dropped: t && t.dropped }); continue; }
    if (!t.createdBy) { alteredOnly.push({ model: m.name, table: m.table, columnsAdded: t.cols.size }); continue; }
    const fields = new Set([...m.attrs].filter(a => !m.virtual.has(a)).map(a => m.fieldOf[a]));
    const has = (c) => t.cols.has(c) || [...t.cols.keys()].some(k => k.toLowerCase() === c.toLowerCase());
    for (const c of fields) {
      if (has(c)) continue;
      const rec = { model: m.name, table: m.table, column: c, tableUncertain: t.uncertain.length > 0 };
      if (m.paranoid && c === m.deletedAtField) paranoidNoDeleted.push(rec);
      else missing.push(rec);
    }
    for (const c of t.cols.keys()) if (![...fields].some(x => x.toLowerCase() === c.toLowerCase())) extra.push({ model: m.name, table: m.table, column: c, from: t.cols.get(c) });
  }
  return { noTable, alteredOnly, missing, paranoidNoDeleted, extra };
}

// ─── optional: a column-level schema capture ────────────────────────────────
let CAP = null;
if (CAPTURE) {
  CAP = {};
  for (const line of fs.readFileSync(CAPTURE, 'utf8').split('\n')) {
    const parts = line.split('|').map(x => x.trim());
    if (parts.length < 2 || !parts[0] || !parts[1] || parts[0] === 'table_name' || /^-+$/.test(parts[0])) continue;
    (CAP[parts[0]] = CAP[parts[0]] || new Set()).add(parts[1]);
  }
}
function cap(table, col) {
  if (!CAP) return '';
  if (!CAP[table]) return '  [cap: no table]';
  if (col == null) return '  [cap: table present]';
  return CAP[table].has(col) || [...CAP[table]].some(c => c.toLowerCase() === String(col).toLowerCase()) ? '  [cap: present]' : '  [cap: ABSENT]';
}

// ─── run ────────────────────────────────────────────────────────────────────
const s1 = step1();
const s2 = step2();
const cmp = compareModels(s2.tables);
const s3 = step3(s2.tables);
const s4 = step4();

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
console.log(`schema-agreement read — root ${ROOT}`);
console.log(`models loaded: ${Object.keys(MODELS).length}`);
console.log('');
console.log(`STEP 1 query vs model: ${s1.files} files, ${s1.calls} resolved model calls, ${s1.namesChecked} names checked`);
console.log(`  hits (undeclared names): ${s1.hits.length}`);
console.log(`  resolved calls with an unresolved part: ${s1.callsPartial} (${pct(s1.callsPartial, s1.calls)})`);
console.log(`  unresolved items: ${s1.unresolved.length} (of which unknown receiver on a model-only method: ${s1.unresolved.filter(u => /unknown receiver/.test(u.reason)).length})`);
console.log(`  create/update/destroy/count/... on a non-model receiver (instance or other object, not checked): ${s1.unknownOther.length}`);
for (const h of s1.hits) console.log(`  HIT ${h.file}:${h.line}  ${h.model}.${h.method}  ${h.clause}  ${h.name}${h.clause.startsWith('include') ? '' : cap(MODELS[h.model].table, h.name)}`);
console.log('');
console.log(`STEP 2 model vs migrations: ${s2.files} migration files, ${s2.ops} ops replayed (${s2.sqlStatements} from SQL), ${Object.keys(s2.tables).length} tables rebuilt, ${s2.unresolved.length} unresolved ops`);
console.log(`  models whose table no live migration creates: ${cmp.noTable.length}`);
for (const x of cmp.noTable) console.log(`  NOTABLE ${x.model} (${x.table})${x.dropped ? ` dropped at ${x.dropped}` : ''}${cap(x.table, null)}`);
console.log(`  models whose table the live tree only alters (created elsewhere; columns not compared): ${cmp.alteredOnly.length}`);
for (const x of cmp.alteredOnly) console.log(`  ALTERONLY ${x.model} (${x.table}) ${x.columnsAdded} column(s) added by live migrations${cap(x.table, null)}`);
console.log(`  paranoid models whose table has no deleted_at column: ${cmp.paranoidNoDeleted.length}`);
for (const x of cmp.paranoidNoDeleted) console.log(`  PARANOID ${x.model} (${x.table}) lacks ${x.column}${x.tableUncertain ? '  [table has unresolved ops]' : ''}${cap(x.table, x.column)}`);
console.log(`  declared columns no migration creates: ${cmp.missing.length}`);
for (const x of cmp.missing) console.log(`  MISSING ${x.model} (${x.table}).${x.column}${x.tableUncertain ? '  [table has unresolved ops]' : ''}${cap(x.table, x.column)}`);
console.log(`  migration columns the model does not declare (report only): ${cmp.extra.length}`);
console.log('');
console.log(`STEP 3 raw SQL: ${s3.calls} sequelize.query calls (${s3.literal} literal, ${s3.template} template with interpolation, ${s3.calls - s3.literal - s3.template} other); ${s3.callsWithRefs} had a checkable column reference; ${s3.checkedRefs} references checked`);
console.log(`  hits: ${s3.hits.length}; uncheckable calls: ${s3.uncheckable.length}; tables named but not created by the live tree: ${Object.keys(s3.unknownTables).length}; other .query receivers (not sequelize): ${s3.otherReceivers.length}`);
for (const h of s3.hits) console.log(`  HIT ${h.file}:${h.line}  ${h.table}.${h.col}  (${h.how})${h.uncertainTable ? '  [table has unresolved ops]' : ''}${cap(h.table, h.col)}`);
console.log('');
console.log(`STEP 4 mocks: ${s4.files} test files, ${s4.mockModels} fake models, ${s4.rows} rows, ${s4.keysChecked} keys checked, ${s4.whereObjs} where objects/reads`);
console.log(`  undeclared keys: ${s4.hits.length}; out-of-enum values: ${s4.enumHits.length}; unresolved mock returns: ${s4.unresolved.length}`);
for (const h of s4.hits) console.log(`  HIT ${h.file}:${h.line}  ${h.model}.${h.key}  (${h.via})`);
for (const h of s4.enumHits) console.log(`  ENUM ${h.file}:${h.line}  ${h.model}.${h.key} = '${h.value}' (value at line ${h.valueLine}; ${h.via})`);

if (SHOW_UNRESOLVED) {
  console.log('\nUNRESOLVED step 1:'); for (const u of s1.unresolved) console.log(`  ${u.file}:${u.line} ${u.reason}`);
  console.log('UNRESOLVED step 2:'); for (const u of s2.unresolved) console.log(`  ${u.file}:${u.line} ${u.reason}`);
  console.log('UNCHECKABLE step 3:'); for (const u of s3.uncheckable) console.log(`  ${u.file}:${u.line} ${u.reason}`);
  console.log('TABLES named in SQL, not created by the live tree:'); for (const [t, w] of Object.entries(s3.unknownTables)) console.log(`  ${t}: ${w.length} (${w.slice(0, 3).join(', ')})`);
  console.log('UNRESOLVED step 4:'); for (const u of s4.unresolved) console.log(`  ${u.file}:${u.line} ${u.reason}`);
}

if (JSON_OUT) {
  const tablesOut = Object.fromEntries(Object.entries(s2.tables).map(([k, v]) => [k, { cols: [...v.cols.keys()], createdBy: v.createdBy, uncertain: v.uncertain, dropped: v.dropped }]));
  fs.writeFileSync(JSON_OUT, JSON.stringify({ step1: s1, step2: { ...cmp, unresolved: s2.unresolved, tables: tablesOut }, step3: s3, step4: s4 }, null, 1));
}

// A ratchet over a list of keys: write it with --update-baseline, otherwise
// fail on keys the baseline does not list and report (not fail) GONE keys.
function ratchet(file, cur) {
  if (UPDATE_BASELINE) { fs.writeFileSync(file, `${[...new Set(cur)].sort().join('\n')}\n`); console.log(`\nbaseline written: ${file} (${new Set(cur).size} entries)`); return 0; }
  const base = new Set(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : []);
  const fresh = [...new Set(cur)].filter(k => !base.has(k));
  const gone = [...base].filter(k => !cur.includes(k));
  console.log(`\nbaseline ${file}: ${base.size} entries, ${fresh.length} new, ${gone.length} no longer occur`);
  for (const k of fresh) console.log(`  NEW ${k}`);
  for (const k of gone) console.log(`  GONE ${k}`);
  return fresh.length ? 1 : 0;
}

let exit = 0;
if (BASELINE) {
  const key = (h) => `${h.file}\t${h.model}.${h.method}\t${h.clause}\t${h.name}`;
  exit = Math.max(exit, ratchet(BASELINE, s1.hits.map(key)));
}
if (BASELINE2) {
  const cur = [
    ...cmp.missing.map(x => `${x.model}\t${x.column}\tmissing-column`),
    ...cmp.paranoidNoDeleted.map(x => `${x.model}\t${x.column}\tparanoid-no-deleted_at`),
    ...cmp.noTable.map(x => `${x.model}\t-\tno-table`),
  ];
  exit = Math.max(exit, ratchet(BASELINE2, cur));
}
process.exit(exit);
