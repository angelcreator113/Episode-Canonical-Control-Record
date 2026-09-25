/**
 * A fake SocialProfileRelationship that knows the real model's columns
 * (Task #1860). assembleGuestList queried profile_a_id / profile_b_id from
 * #453 until #1860; the table has source_profile_id / target_profile_id,
 * and the tests' mocks used the same wrong names, so the tests passed while
 * every production lookup failed.
 *
 * The declared names come from the real model's rawAttributes — the model
 * is defined on a Sequelize instance that is never connected — so this fake
 * cannot drift from src/models/SocialProfileRelationship.js. It:
 *   - rejects a findAll whose where clause (at any depth, through Op.or /
 *     Op.and) or attributes list names an undeclared attribute;
 *   - rejects fixture rows with an undeclared key or a relationship_type /
 *     direction / public_visibility outside the model's enums;
 *   - returns rows that throw when code reads an undeclared attribute.
 */
const { Sequelize, DataTypes } = require('sequelize');
const defineModel = require('../../../src/models/SocialProfileRelationship');

// Never connects: Sequelize opens a connection only when a query runs.
const sequelize = new Sequelize('postgres://unused:unused@127.0.0.1:1/unused', { logging: false });
const Model = defineModel(sequelize, DataTypes);
const raw = Model.rawAttributes;

// Both the attribute names and their column names (createdAt / created_at).
const DECLARED = new Set(Object.entries(raw).flatMap(([name, a]) => [name, a.field || name]));
const ENUMS = {
  relationship_type: raw.relationship_type.values,
  direction: raw.direction.values,
  public_visibility: raw.public_visibility.values,
};

function assertDeclared(key, where) {
  if (!DECLARED.has(key)) {
    throw new Error(`column SocialProfileRelationship.${key} does not exist (${where})`);
  }
}

// String keys are attribute names; symbol keys are operators (Op.or, Op.in),
// whose values are walked for nested conditions.
function checkWhere(node) {
  if (Array.isArray(node)) { node.forEach(checkWhere); return; }
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) assertDeclared(key, 'where');
  for (const sym of Object.getOwnPropertySymbols(node)) checkWhere(node[sym]);
}

function strictRow(row) {
  for (const [key, value] of Object.entries(row)) {
    assertDeclared(key, 'fixture row');
    if (ENUMS[key] && !ENUMS[key].includes(value)) {
      throw new Error(`${key} '${value}' is not in the model's enum (${ENUMS[key].join(', ')})`);
    }
  }
  return new Proxy(row, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target) && !(prop in Object.prototype)) {
        assertDeclared(prop, 'row read');
      }
      return target[prop];
    },
  });
}

/**
 * @param {object[]|Function} rows — fixture rows, or a function returning them
 * @returns {{ findAll: jest.Mock }}
 */
function strictSocialProfileRelationship(rows = []) {
  return {
    findAll: jest.fn(async (opts = {}) => {
      checkWhere(opts.where);
      for (const a of opts.attributes || []) assertDeclared(Array.isArray(a) ? a[1] : a, 'attributes');
      const list = typeof rows === 'function' ? await rows(opts) : rows;
      return list.map(strictRow);
    }),
  };
}

module.exports = { strictSocialProfileRelationship, DECLARED, ENUMS };
