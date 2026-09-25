/**
 * A model-agnostic schema-checked fake (Task #1870), generalising
 * strictSocialProfileRelationship.js (Task #1860) to any model file.
 *
 * The declared names come from the real model's rawAttributes: the model is
 * defined on a Sequelize instance that is never connected (Sequelize opens a
 * connection only when a query runs), so the fake cannot drift from
 * src/models/<Name>.js.
 *
 * What Sequelize 6 does with an undeclared name (docs/SCHEMA_AGREEMENT_READ.md
 * §0): in where/attributes/order it goes into the SQL unchanged and the
 * query fails when the column is missing; in create/update values it is
 * DROPPED with no error. This fake makes both loud:
 *   - a read whose where (at any depth, through Op.or / Op.and), attributes
 *     or order names an undeclared attribute throws "column … does not exist";
 *   - a write whose values name an undeclared attribute throws "… would be
 *     dropped", so a test of a write fails where production silently loses
 *     the value.
 *
 * Usage:
 *   const { schemaCheckedModel } = require('../helpers/schemaCheckedModel');
 *   const WorldEvent = schemaCheckedModel('WorldEvent', {
 *     create: async (values) => ({ id: 'ev-1', ...values }),
 *   });
 *   // WorldEvent.create is a jest.fn; WorldEvent.Model is the real model.
 *
 * strictSocialProfileRelationship.js keeps its own exports and behaviour.
 */
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const MODELS_DIR = path.join(__dirname, '..', '..', '..', 'src', 'models');

let sequelize;
const cache = new Map();

/** The real model, defined on a never-connected Sequelize instance. */
function loadModel(name) {
  if (cache.has(name)) return cache.get(name);
  if (!sequelize) {
    sequelize = new Sequelize('postgres://unused:unused@127.0.0.1:1/unused', { logging: false });
  }
  const define = require(path.join(MODELS_DIR, `${name}.js`));
  const Model = define(sequelize, DataTypes);
  cache.set(name, Model);
  return Model;
}

/** Attribute names plus their column names (createdAt / created_at). */
function declaredNames(Model) {
  return new Set(Object.entries(Model.rawAttributes).flatMap(([n, a]) => [n, a.field || n]));
}

function makeChecker(name, Model) {
  const DECLARED = declaredNames(Model);

  function assertRead(key, clause) {
    if (!DECLARED.has(key)) throw new Error(`column ${name}.${key} does not exist (${clause})`);
  }

  // String keys are attribute names; symbol keys are operators (Op.or,
  // Op.in), whose values are walked for nested conditions. A value that is
  // itself a plain object under a string key is an operator map
  // ({ [Op.in]: [...] }) and holds no attribute names.
  function checkWhere(node) {
    if (Array.isArray(node)) { node.forEach(checkWhere); return; }
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) assertRead(key, 'where');
    for (const sym of Object.getOwnPropertySymbols(node)) checkWhere(node[sym]);
  }

  function checkAttributes(attrs) {
    if (!attrs) return;
    const list = Array.isArray(attrs) ? attrs : [...(attrs.include || []), ...(attrs.exclude || [])];
    for (const a of list) {
      if (typeof a === 'string') assertRead(a, 'attributes');
      else if (Array.isArray(a) && typeof a[0] === 'string') assertRead(a[0], 'attributes');
    }
  }

  function checkOrder(order) {
    if (!Array.isArray(order)) return;
    for (const o of order) {
      if (Array.isArray(o) && typeof o[0] === 'string' && o.length === 2) assertRead(o[0], 'order');
    }
  }

  function checkRead(opts = {}) {
    checkWhere(opts.where);
    checkAttributes(opts.attributes);
    checkOrder(opts.order);
  }

  function checkValues(values, method) {
    for (const key of Object.keys(values || {})) {
      if (!DECLARED.has(key)) {
        throw new Error(`${name}.${key} is not a declared attribute; Sequelize ${method} would drop it`);
      }
    }
  }

  return { DECLARED, checkRead, checkValues };
}

const DEFAULTS = {
  findAll: async () => [],
  findOne: async () => null,
  findByPk: async () => null,
  count: async () => 0,
  findAndCountAll: async () => ({ rows: [], count: 0 }),
  create: async (values) => ({ ...values, toJSON: () => ({ ...values }) }),
  bulkCreate: async (rows) => rows,
  upsert: async (values) => [values, true],
  update: async () => [1],
  destroy: async () => 1,
};

/**
 * @param {string} name — model file / model name under src/models
 * @param {object} impls — method implementations to run after the check
 * @returns {object} fake with jest.fn methods, plus Model and DECLARED
 */
function schemaCheckedModel(name, impls = {}) {
  const Model = loadModel(name);
  const { DECLARED, checkRead, checkValues } = makeChecker(name, Model);
  const run = (method, args) => (impls[method] || DEFAULTS[method])(...args);
  const fake = { Model, DECLARED, rawAttributes: Model.rawAttributes };

  for (const m of ['findAll', 'findOne', 'count', 'findAndCountAll']) {
    fake[m] = jest.fn(async (opts = {}, ...rest) => { checkRead(opts); return run(m, [opts, ...rest]); });
  }
  fake.findByPk = jest.fn(async (pk, opts = {}) => { checkRead(opts); return run('findByPk', [pk, opts]); });
  fake.create = jest.fn(async (values, opts) => { checkValues(values, 'create'); return run('create', [values, opts]); });
  fake.bulkCreate = jest.fn(async (rows, opts) => { (rows || []).forEach(r => checkValues(r, 'bulkCreate')); return run('bulkCreate', [rows, opts]); });
  fake.upsert = jest.fn(async (values, opts) => { checkValues(values, 'upsert'); return run('upsert', [values, opts]); });
  fake.update = jest.fn(async (values, opts = {}) => {
    checkValues(values, 'update');
    checkRead({ where: opts.where });
    return run('update', [values, opts]);
  });
  fake.destroy = jest.fn(async (opts = {}) => { checkRead({ where: opts.where }); return run('destroy', [opts]); });
  return fake;
}

module.exports = { schemaCheckedModel, loadModel, declaredNames };
