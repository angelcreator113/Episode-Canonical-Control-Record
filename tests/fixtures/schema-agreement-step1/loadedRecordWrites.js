'use strict';

/**
 * Fixture for scripts/check-schema-agreement.js step 1 (Task #1909): writes
 * through a loaded record. Read statically with --step1-src; never run.
 * Every undeclared name the checker must report starts with `fx_hit_`; every
 * name it must NOT report starts with `fx_miss_` (or is declared).
 * ThumbnailComposition is a real model; `name` and `status` are declared.
 */
const { models } = require('../../../src/models');

// 1. x.update(values) on a row from findByPk
async function updateLoaded(id) {
  const { ThumbnailComposition } = models;
  const row = await ThumbnailComposition.findByPk(id);
  await row.update({ name: 'ok', fx_hit_update: 1 });
}

// 2. x.attr = ... then x.save() on a row from findOne
async function assignThenSave(id) {
  const { ThumbnailComposition } = models;
  const row = await ThumbnailComposition.findOne({ where: { id } });
  row.status = 'draft';
  row.fx_hit_assigned = true;
  await row.save();
  row.fx_miss_after_save = true; // assigned after the last save: not written
}

// 3. for (const x of await Model.findAll(...))
async function loopOverFindAll() {
  for (const row of await models.ThumbnailComposition.findAll()) {
    await row.update({ fx_hit_loop: 1 });
  }
}

// 4. for (const x of rows), rows from findAll in scope, and a row from create
async function loopOverList() {
  const rows = await models.ThumbnailComposition.findAll();
  for (const row of rows) {
    row.fx_hit_list_assigned = 1;
    await row.save();
  }
  const made = await models.ThumbnailComposition.create({ name: 'n' });
  await made.update({ fx_hit_created: 1 });
}

// Not reported: no save follows; a shadowing parameter; a plain object.
async function notWrites(id) {
  const row = await models.ThumbnailComposition.findByPk(id);
  row.fx_miss_no_save = 1;
  const inner = async (row) => { await row.update({ fx_miss_shadowed: 1 }); };
  const obj = { update: async () => {} };
  await obj.update({ fx_miss_plain_object: 1 });
  return inner;
}

module.exports = { updateLoaded, assignThenSave, loopOverFindAll, loopOverList, notWrites };
