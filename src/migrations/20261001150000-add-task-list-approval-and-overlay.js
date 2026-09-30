'use strict';

/**
 * Task list approval and its overlay (Task #2395, ruling P14, Evoni
 * 2026-09-30): "An episode's task list can be approved; approving offers
 * "Design task-list overlay" (cost shown) in the event's visual direction;
 * it becomes an episode overlay placed on the tasks/deadline beat,
 * replacing an earlier one."
 *
 * On episode_todo_lists, the row that owns the episode's one task list
 * (social_tasks, T2 §8(bb)):
 *   task_list_approved_at    when the list was approved (NULL = never)
 *   task_list_approved_hash  hash of the list's content at approval; the
 *                            approval holds only while it equals the
 *                            current content's hash
 *   task_overlay_asset_id    the episode's current task-list overlay (assets.id)
 *   task_overlay_hash        hash of the list the overlay was designed from;
 *                            the overlay is outdated when it differs
 *
 * All four are nullable with no default, so existing lists read as "not
 * approved, no overlay". ADD COLUMN IF NOT EXISTS, and skipped when the
 * table is absent, so a re-run or a partial database never fails here.
 */
const tableExists = async (queryInterface, table) => {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT to_regclass(:name) AS reg',
    { replacements: { name: `public.${table}` } },
  );
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'episode_todo_lists'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_list_approved_at TIMESTAMP WITH TIME ZONE');
    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_list_approved_hash TEXT');
    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_overlay_asset_id UUID');
    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_overlay_hash TEXT');
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'episode_todo_lists'))) return;
    const q = (sql) => queryInterface.sequelize.query(sql);
    await q('ALTER TABLE episode_todo_lists DROP COLUMN IF EXISTS task_overlay_hash');
    await q('ALTER TABLE episode_todo_lists DROP COLUMN IF EXISTS task_overlay_asset_id');
    await q('ALTER TABLE episode_todo_lists DROP COLUMN IF EXISTS task_list_approved_hash');
    await q('ALTER TABLE episode_todo_lists DROP COLUMN IF EXISTS task_list_approved_at');
  },
};
